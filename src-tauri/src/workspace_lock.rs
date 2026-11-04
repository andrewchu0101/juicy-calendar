//! Single-writer lock for a workspace folder (FR-07, ADR-01).

use crate::error::{ErrorCode, IpcError};
use std::fs::{File, OpenOptions, TryLockError};
use std::path::Path;

pub const LOCK_FILE: &str = ".juicy.lock";

/// Holds the OS lock on `<root>/.juicy.lock` until dropped (the OS also releases it if the
/// process dies).
#[derive(Debug)]
pub struct LockGuard(#[allow(dead_code)] File);

/// Takes the exclusive lock. The lock file is created empty if missing and never truncated or
/// written, so a refused attempt leaves its size and modified time untouched.
pub fn acquire(root: &Path) -> Result<LockGuard, IpcError> {
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(root.join(LOCK_FILE))
        .map_err(IpcError::io)?;
    match file.try_lock() {
        Ok(()) => Ok(LockGuard(file)),
        Err(TryLockError::WouldBlock) => {
            Err(IpcError { code: ErrorCode::WorkspaceLocked, detail: None })
        }
        Err(TryLockError::Error(error)) => Err(IpcError::io(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;
    use std::collections::BTreeMap;
    use std::fs;
    use std::io::{BufRead, BufReader};
    use std::path::PathBuf;
    use std::process::{Command, Stdio};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::SystemTime;

    const HOLDER_ENV: &str = "JUICY_LOCK_HOLDER_DIR";
    const READY_MARKER: &str = "JUICY_HOLDER_READY";
    static COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(label: &str) -> Self {
            let n = COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!("juicy-lock-{label}-{}-{n}", std::process::id()));
            fs::create_dir_all(&path).unwrap();
            TempDir(path.canonicalize().unwrap())
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    /// File name -> (bytes, length, modified time), for every file under `dir` (one level plus events/).
    fn snapshot(dir: &Path) -> BTreeMap<String, (Vec<u8>, u64, SystemTime)> {
        let mut map = BTreeMap::new();
        for entry in fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name().to_string_lossy().into_owned();
            let path = entry.path();
            if path.is_dir() {
                for (inner, value) in snapshot(&path) {
                    map.insert(format!("{name}/{inner}"), value);
                }
            } else {
                let meta = fs::metadata(&path).unwrap();
                // Windows refuses reads of a file another process has locked. TC-09 only asks for the
                // lock file's size and modified time, and it must be empty, so its bytes are skipped.
                let bytes = if name == LOCK_FILE { Vec::new() } else { fs::read(&path).unwrap() };
                map.insert(name, (bytes, meta.len(), meta.modified().unwrap()));
            }
        }
        map
    }

    /// Child-process half of TC-09. Does nothing unless the parent test sets the env var; then it
    /// takes the lock, announces it, and holds it until the parent kills this process.
    #[test]
    fn lock_holder_process() {
        let Some(dir) = std::env::var_os(HOLDER_ENV) else { return };
        let _guard = acquire(Path::new(&dir)).expect("holder takes the lock");
        println!("{READY_MARKER}");
        std::thread::sleep(std::time::Duration::from_secs(120));
    }

    // TC-09｜AC-02.3、FR-07：行程 A 持有鎖時，行程 B 取鎖得到 WORKSPACE_LOCKED 且不改動任何檔案；
    // 強制結束 A 之後，B 再試成功。
    #[test]
    fn second_process_is_refused_until_the_first_is_killed() {
        let dir = TempDir::new("two-process");
        fs::create_dir_all(dir.0.join("events")).unwrap();
        fs::write(dir.0.join("workspace.json"), r#"{"schemaVersion":2}"#).unwrap();
        fs::write(dir.0.join("events/evt_1.json"), "event").unwrap();

        // Row A: a separate process (this test executable) takes the lock.
        let mut holder = Command::new(std::env::current_exe().unwrap())
            .args(["workspace_lock::tests::lock_holder_process", "--exact", "--nocapture", "--test-threads=1"])
            .env(HOLDER_ENV, &dir.0)
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let mut lines = BufReader::new(holder.stdout.take().unwrap()).lines();
        let ready = lines.any(|line| line.map(|l| l.contains(READY_MARKER)).unwrap_or(false));
        assert!(ready, "holder process never reported that it holds the lock");

        // Row B: this process tries; nothing on disk may change.
        let before = snapshot(&dir.0);
        let refused = acquire(&dir.0);
        let after = snapshot(&dir.0);
        let outcome = refused.as_ref().map(|_| ()).map_err(|e| e.code);
        assert_eq!(outcome, Err(ErrorCode::WorkspaceLocked));
        assert_eq!(before, after, "refused attempt changed files (size, mtime, bytes or file list)");
        let lock_entry = before.get(LOCK_FILE).expect("holder should have created .juicy.lock");
        assert_eq!(lock_entry.1, 0, ".juicy.lock must be an empty file");

        // Kill A, then B can take it.
        holder.kill().unwrap();
        holder.wait().unwrap();
        assert!(acquire(&dir.0).is_ok(), "lock should be free after the holder is killed");
    }
}
