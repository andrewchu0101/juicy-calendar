//! Native layer. The frontend never sends absolute paths: the workspace root is set here, from the
//! native folder dialog or the remembered last workspace, and all file access is relative to it.

mod fs_safe;

use serde::Serialize;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct WorkspaceState(Mutex<Option<PathBuf>>);

#[derive(Serialize)]
struct WorkspaceLocation {
    path: String,
    initialized: bool,
}

fn manifest(root: &Path) -> PathBuf {
    root.join("workspace.json")
}

fn location(root: &Path) -> WorkspaceLocation {
    WorkspaceLocation {
        path: root.to_string_lossy().into_owned(),
        initialized: manifest(root).is_file(),
    }
}

fn last_workspace_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("last-workspace.txt"))
}

fn remember(app: &AppHandle, root: &Path) -> Result<(), String> {
    fs_safe::atomic_write(&last_workspace_file(app)?, &root.to_string_lossy())
        .map_err(|e| e.to_string())
}

fn activate(app: &AppHandle, state: &WorkspaceState, root: PathBuf) -> Result<WorkspaceLocation, String> {
    remember(app, &root)?;
    let result = location(&root);
    *state.0.lock().map_err(|e| e.to_string())? = Some(root);
    Ok(result)
}

fn current_root(state: &WorkspaceState) -> Result<PathBuf, String> {
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "No workspace is open".to_string())
}

#[tauri::command(async)]
fn workspace_select(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
    mode: String,
) -> Result<Option<WorkspaceLocation>, String> {
    let creating = match mode.as_str() {
        "create" => true,
        "open" => false,
        other => return Err(format!("Unknown mode: {other}")),
    };
    let title = if creating {
        "Choose where to create your workspace"
    } else {
        "Open a workspace folder"
    };
    let Some(picked) = app.dialog().file().set_title(title).blocking_pick_folder() else {
        return Ok(None);
    };
    let picked = picked.into_path().map_err(|e| e.to_string())?;

    let root = if manifest(&picked).is_file() {
        // Choosing an existing workspace opens it, even from Create. Nothing is overwritten.
        picked
    } else if creating {
        fs_safe::new_workspace_dir(&picked).map_err(|e| e.to_string())?
    } else {
        return Err("This folder is not a workspace: it has no workspace.json.".to_string());
    };
    activate(&app, &state, root).map(Some)
}

#[tauri::command]
fn workspace_restore(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
) -> Result<Option<WorkspaceLocation>, String> {
    // Debug builds only: lets a launch smoke test choose a folder without a native dialog.
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("JUICY_SMOKE_WORKSPACE") {
        // Not remembered: a test run must not replace the user's real last workspace.
        let root = PathBuf::from(path);
        let result = location(&root);
        *state.0.lock().map_err(|e| e.to_string())? = Some(root);
        return Ok(Some(result));
    }

    let file = last_workspace_file(&app)?;
    let saved = match fs::read_to_string(&file) {
        Ok(saved) => saved,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    let root = PathBuf::from(saved.trim());
    // A moved or deleted workspace returns to the welcome screen. It is never recreated.
    if !manifest(&root).is_file() {
        return Ok(None);
    }
    activate(&app, &state, root).map(Some)
}

#[tauri::command]
fn workspace_close(app: AppHandle, state: State<'_, WorkspaceState>) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = None;
    match fs::remove_file(last_workspace_file(&app)?) {
        Err(error) if error.kind() != ErrorKind::NotFound => Err(error.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
fn workspace_list(state: State<'_, WorkspaceState>, dir: String) -> Result<Vec<String>, String> {
    if !fs_safe::ENTITY_DIRS.contains(&dir.as_str()) {
        return Err(format!("Directory is not allowed: {dir}"));
    }
    let root = current_root(&state)?;
    // Validate the directory through a representative path, which also rejects escaping symlinks.
    fs_safe::resolve(&root, &format!("{dir}/x.json"))?;
    fs_safe::list_entity_files(&root.join(dir)).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_read(state: State<'_, WorkspaceState>, path: String) -> Result<Option<String>, String> {
    let target = fs_safe::resolve(&current_root(&state)?, &path)?;
    match fs::read_to_string(target) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn workspace_write(state: State<'_, WorkspaceState>, path: String, contents: String) -> Result<(), String> {
    let target = fs_safe::resolve(&current_root(&state)?, &path)?;
    fs_safe::atomic_write(&target, &contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_remove(state: State<'_, WorkspaceState>, path: String) -> Result<(), String> {
    let target = fs_safe::resolve(&current_root(&state)?, &path)?;
    match fs::remove_file(target) {
        Err(error) if error.kind() != ErrorKind::NotFound => Err(error.to_string()),
        _ => Ok(()),
    }
}

/// Debug builds only: scripts/desktop-smoke.sh exercises the real webview and IPC without touching
/// the user's mouse. Runs a script inside the window, then closes it through the normal close path.
#[cfg(debug_assertions)]
mod smoke {
    use std::time::Duration;
    use tauri::{AppHandle, Manager};

    pub fn start(app: AppHandle) {
        let Some(path) = std::env::var_os("JUICY_SMOKE_SCRIPT") else {
            return;
        };
        let script = std::fs::read_to_string(path).expect("smoke script is readable");
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(2));
            let window = app.get_webview_window("main").expect("main window exists");
            window.eval(script.as_str()).expect("smoke script runs");
            std::thread::sleep(Duration::from_secs(4));
            window.close().expect("window closes");
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(WorkspaceState::default())
        .invoke_handler(tauri::generate_handler![
            workspace_select,
            workspace_restore,
            workspace_close,
            workspace_list,
            workspace_read,
            workspace_write,
            workspace_remove,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            smoke::start(_app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Juicy Calendar");
}
