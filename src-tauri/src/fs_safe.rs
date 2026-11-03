//! Path validation and atomic file I/O. Knows nothing about calendars, only about which relative
//! paths may exist inside a workspace and how to write them safely.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const ROOT_FILES: [&str; 3] = ["workspace.json", "settings.json", "settings.corrupt.json"];
pub const ENTITY_DIRS: [&str; 2] = ["templates", "events"];

/// A JSON entity file name: `[A-Za-z0-9_-]+.json`.
pub fn is_entity_file_name(name: &str) -> bool {
    match name.strip_suffix(".json") {
        Some(stem) => {
            !stem.is_empty()
                && stem.len() <= 120
                && stem.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        }
        None => false,
    }
}

/// Checks a relative path against the allow-list. Rejects everything else, including `..`.
pub fn is_allowed_path(relative: &str) -> bool {
    if ROOT_FILES.contains(&relative) {
        return true;
    }
    match relative.split_once('/') {
        Some((dir, file)) => ENTITY_DIRS.contains(&dir) && is_entity_file_name(file),
        None => false,
    }
}

/// Resolves an allowed path under the root, refusing symlinks that lead out of the workspace.
pub fn resolve(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if !is_allowed_path(relative) {
        return Err(format!("Path is not allowed: {relative}"));
    }
    let target = root.join(relative);
    let canonical_root = root.canonicalize().map_err(|e| e.to_string())?;

    if let Some(parent) = target.parent() {
        if parent.exists() {
            let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
            if !canonical_parent.starts_with(&canonical_root) {
                return Err(format!("Path leaves the workspace: {relative}"));
            }
        }
    }
    if let Ok(metadata) = fs::symlink_metadata(&target) {
        if metadata.file_type().is_symlink() {
            return Err(format!("Refusing to follow a symlink: {relative}"));
        }
    }
    Ok(target)
}

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Writes to a synced temp file beside the target, then renames over it, so a crash leaves
/// either the complete old file or the complete new one.
pub fn atomic_write(target: &Path, contents: &str) -> io::Result<()> {
    let parent = target
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target has no parent"))?;
    fs::create_dir_all(parent)?;

    let name = target.file_name().and_then(|n| n.to_str()).unwrap_or("file");
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp = parent.join(format!(".{name}.{}.{counter}.tmp", std::process::id()));

    let result = (|| {
        let mut file = fs::File::create(&temp)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
        fs::rename(&temp, target)?;
        // Makes the rename itself durable where directories can be synced.
        #[cfg(unix)]
        fs::File::open(parent)?.sync_all()?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

/// Lists valid entity files in a directory, sorted. A missing directory is simply empty.
/// Other files (temp files, a user's notes) are ignored.
pub fn list_entity_files(dir: &Path) -> io::Result<Vec<String>> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut names = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        if let Some(name) = entry.file_name().to_str() {
            if is_entity_file_name(name) {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

/// For a new workspace: the folder itself if empty, otherwise a fresh subfolder.
/// Never reuses a folder that holds other files.
pub fn new_workspace_dir(picked: &Path) -> io::Result<PathBuf> {
    if fs::read_dir(picked)?.next().is_none() {
        return Ok(picked.to_path_buf());
    }
    for attempt in 1.. {
        let name = if attempt == 1 {
            "MyTimeBlock".to_string()
        } else {
            format!("MyTimeBlock-{attempt}")
        };
        let candidate = picked.join(name);
        if !candidate.exists() {
            fs::create_dir(&candidate)?;
            return Ok(candidate);
        }
    }
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(label: &str) -> Self {
            let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "juicy-test-{label}-{}-{counter}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            TempDir(path.canonicalize().unwrap())
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn allows_only_known_paths() {
        for ok in [
            "workspace.json",
            "settings.json",
            "settings.corrupt.json",
            "events/evt_1.json",
            "templates/deep-work.json",
        ] {
            assert!(is_allowed_path(ok), "{ok}");
        }
        for bad in [
            "",
            "../secret.json",
            "/etc/passwd",
            "events/../../secret.json",
            "events/a/b.json",
            "events/.json",
            "events/a.txt",
            "events/a b.json",
            "events\\..\\x.json",
            "other/a.json",
            "events/",
            "notes.json",
            "events/..json",
            "events/é.json",
        ] {
            assert!(!is_allowed_path(bad), "{bad}");
        }
    }

    #[test]
    fn atomic_write_creates_replaces_and_leaves_no_temp_files() {
        let dir = TempDir::new("write");
        let target = dir.0.join("events/evt_1.json");
        atomic_write(&target, "one").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "one");
        atomic_write(&target, "two").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "two");
        assert_eq!(fs::read_dir(dir.0.join("events")).unwrap().count(), 1);
    }

    #[test]
    fn failed_write_keeps_the_old_file() {
        let dir = TempDir::new("fail");
        let target = dir.0.join("settings.json");
        fs::write(&target, "old").unwrap();
        // Renaming a file over a non-empty directory fails, standing in for any late failure.
        let blocked = dir.0.join("blocked");
        fs::create_dir_all(blocked.join("child")).unwrap();
        assert!(atomic_write(&blocked, "new").is_err());
        assert_eq!(fs::read_to_string(&target).unwrap(), "old");
        let leftovers = fs::read_dir(&dir.0)
            .unwrap()
            .filter(|entry| {
                entry.as_ref().unwrap().file_name().to_string_lossy().ends_with(".tmp")
            })
            .count();
        assert_eq!(leftovers, 0);
    }

    #[test]
    fn listing_ignores_other_files_and_missing_directories() {
        let dir = TempDir::new("list");
        assert!(list_entity_files(&dir.0.join("events")).unwrap().is_empty());
        for name in ["b.json", "a.json", ".a.json.1.tmp", "notes.txt"] {
            fs::write(dir.0.join(name), "x").unwrap();
        }
        fs::create_dir(dir.0.join("sub.json")).unwrap();
        assert_eq!(list_entity_files(&dir.0).unwrap(), ["a.json", "b.json"]);
    }

    #[test]
    fn new_workspace_never_reuses_a_folder_with_files() {
        let dir = TempDir::new("new");
        assert_eq!(new_workspace_dir(&dir.0).unwrap(), dir.0);
        fs::write(dir.0.join("thesis.docx"), "x").unwrap();
        let first = new_workspace_dir(&dir.0).unwrap();
        assert_eq!(first, dir.0.join("MyTimeBlock"));
        let second = new_workspace_dir(&dir.0).unwrap();
        assert_eq!(second, dir.0.join("MyTimeBlock-2"));
    }

    #[cfg(unix)]
    #[test]
    fn resolve_refuses_symlinks_out_of_the_workspace() {
        use std::os::unix::fs::symlink;
        let dir = TempDir::new("link");
        let outside = TempDir::new("outside");
        symlink(&outside.0, dir.0.join("events")).unwrap();
        assert!(resolve(&dir.0, "events/evt_1.json").is_err());

        fs::write(outside.0.join("secret"), "x").unwrap();
        symlink(outside.0.join("secret"), dir.0.join("settings.json")).unwrap();
        assert!(resolve(&dir.0, "settings.json").is_err());

        assert!(resolve(&dir.0, "workspace.json").is_ok());
    }
}
