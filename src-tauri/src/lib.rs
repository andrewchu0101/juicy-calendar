//! Native layer. The frontend never sends absolute paths: the workspace root is set here, from the
//! native folder dialog or the remembered last workspace, and all file access is relative to it.

mod app_settings;
mod error;
mod fs_safe;
mod platform_win;
mod portable;
mod preflight;
mod workspace_lock;

use error::{ErrorCode, IpcError};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// The workspace this process has open. `lock` keeps the single-writer lock for as long as the
/// workspace is open (None only for the debug smoke-test path).
struct OpenWorkspace {
    root: PathBuf,
    #[allow(dead_code)]
    lock: Option<workspace_lock::LockGuard>,
}

#[derive(Default)]
struct WorkspaceState(Mutex<Option<OpenWorkspace>>);

#[derive(Debug, Serialize)]
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

fn last_workspace_file(app: &AppHandle) -> Result<PathBuf, IpcError> {
    let dir = app.path().app_config_dir().map_err(IpcError::io)?;
    Ok(dir.join("last-workspace.txt"))
}

fn remember(file: &Path, root: &Path) -> Result<(), IpcError> {
    fs_safe::atomic_write(file, &root.to_string_lossy()).map_err(IpcError::io)
}

fn activate(app: &AppHandle, state: &WorkspaceState, root: PathBuf) -> Result<WorkspaceLocation, IpcError> {
    // Portable mode never reads or writes last-workspace.txt: the next start returns to `data`.
    let remembered = match app.state::<PortableData>().0 {
        Some(_) => None,
        None => Some(last_workspace_file(app)?),
    };
    activate_in(state, remembered.as_deref(), root)
}

/// Makes `root` the open workspace and, when `last_workspace` is given, remembers it there.
fn activate_in(state: &WorkspaceState, last_workspace: Option<&Path>, root: PathBuf) -> Result<WorkspaceLocation, IpcError> {
    // Same folder as the one already open: a second handle would be refused by our own lock.
    if is_open_root(state, &root)? {
        return Ok(location(&root));
    }
    // Lock first: a refused attempt must not touch last-workspace.txt or the workspace already open.
    let lock = workspace_lock::acquire(&root)?;
    if let Some(file) = last_workspace {
        remember(file, &root)?;
    }
    let result = location(&root);
    // Replacing the state drops the old guard, which releases the previous workspace's lock.
    *state.0.lock().map_err(IpcError::io)? = Some(OpenWorkspace { root, lock: Some(lock) });
    Ok(result)
}

/// Portable mode start-up (API-02, FR-11): opens `data_dir`, creating it when missing. Takes no
/// `last-workspace.txt` path on purpose: portable mode never reads or writes that file.
fn restore_portable(state: &WorkspaceState, data_dir: PathBuf) -> Result<WorkspaceLocation, IpcError> {
    fs::create_dir_all(&data_dir).map_err(IpcError::portable_data_unavailable)?;
    // Already open: a second handle would be refused by our own lock.
    if is_open_root(state, &data_dir)? {
        return Ok(location(&data_dir));
    }
    // Taking the lock also proves the folder is writable. A refused lock keeps its own code.
    let lock = workspace_lock::acquire(&data_dir).map_err(|error| match error.code {
        ErrorCode::WorkspaceLocked => error,
        _ => IpcError::portable_data_unavailable(error),
    })?;
    let result = location(&data_dir);
    *state.0.lock().map_err(IpcError::io)? = Some(OpenWorkspace { root: data_dir, lock: Some(lock) });
    Ok(result)
}

/// True when `root` is the folder this process already has open (compared after normalising).
fn is_open_root(state: &WorkspaceState, root: &Path) -> Result<bool, IpcError> {
    let guard = state.0.lock().map_err(IpcError::io)?;
    let Some(open) = guard.as_ref() else { return Ok(false) };
    let same = match (open.root.canonicalize(), root.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => open.root == root,
    };
    Ok(same)
}

fn current_root(state: &WorkspaceState) -> Result<PathBuf, IpcError> {
    state
        .0
        .lock()
        .map_err(IpcError::io)?
        .as_ref()
        .map(|open| open.root.clone())
        .ok_or_else(IpcError::no_workspace_open)
}

/// Decides the workspace root from the folder the user picked.
fn choose_root(picked: PathBuf, creating: bool) -> Result<PathBuf, IpcError> {
    if manifest(&picked).is_file() {
        // Choosing an existing workspace opens it, even from Create. Nothing is overwritten.
        Ok(picked)
    } else if creating {
        fs_safe::new_workspace_dir(&picked).map_err(IpcError::io)
    } else {
        Err(IpcError::not_a_workspace())
    }
}

#[tauri::command(async)]
fn workspace_select(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
    mode: String,
    title: String,
) -> Result<Option<WorkspaceLocation>, IpcError> {
    let creating = match mode.as_str() {
        "create" => true,
        "open" => false,
        other => return Err(IpcError::io(format!("Unknown mode: {other}"))),
    };
    // Display text comes from the frontend dictionary; reject malformed IPC input before opening UI.
    if title.trim().is_empty() || title.chars().any(char::is_control) {
        return Err(IpcError::io("Invalid dialog title"));
    }
    let Some(picked) = app.dialog().file().set_title(title).blocking_pick_folder() else {
        return Ok(None);
    };
    let picked = picked.into_path().map_err(IpcError::io)?;

    let root = choose_root(picked, creating)?;
    activate(&app, &state, root).map(Some)
}

#[tauri::command]
fn workspace_restore(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
) -> Result<Option<WorkspaceLocation>, IpcError> {
    // Debug builds only: lets a launch smoke test choose a folder without a native dialog.
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("JUICY_SMOKE_WORKSPACE") {
        // Not remembered: a test run must not replace the user's real last workspace.
        let root = PathBuf::from(path);
        let result = location(&root);
        *state.0.lock().map_err(IpcError::io)? = Some(OpenWorkspace { root, lock: None });
        return Ok(Some(result));
    }

    // Portable mode: always start in `data`; last-workspace.txt is neither read nor written.
    if let Some(data_dir) = app.state::<PortableData>().0.clone() {
        return restore_portable(&state, data_dir).map(Some);
    }

    let file = last_workspace_file(&app)?;
    let saved = match fs::read_to_string(&file) {
        Ok(saved) => saved,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(IpcError::io(error)),
    };
    let root = PathBuf::from(saved.trim());
    // A moved or deleted workspace returns to the welcome screen. It is never recreated.
    if !manifest(&root).is_file() {
        return Ok(None);
    }
    activate(&app, &state, root).map(Some)
}

#[tauri::command]
fn workspace_close(app: AppHandle, state: State<'_, WorkspaceState>) -> Result<(), IpcError> {
    let remembered = if app.state::<PortableData>().0.is_some() {
        None
    } else {
        Some(last_workspace_file(&app)?)
    };
    close_in(&state, remembered.as_deref())
}

fn close_in(state: &WorkspaceState, remembered: Option<&Path>) -> Result<(), IpcError> {
    let mut open = state.0.lock().map_err(IpcError::io)?;
    // Keep the root and writer lock available for recovery until every fallible close step succeeds.
    if let Some(file) = remembered {
        match fs::remove_file(file) {
            Err(error) if error.kind() != ErrorKind::NotFound => return Err(IpcError::io(error)),
            _ => (),
        }
    }
    *open = None;
    Ok(())
}

#[tauri::command]
fn workspace_list(state: State<'_, WorkspaceState>, dir: String) -> Result<Vec<String>, IpcError> {
    if !fs_safe::ENTITY_DIRS.contains(&dir.as_str()) {
        return Err(IpcError::path_not_allowed(&dir));
    }
    let root = current_root(&state)?;
    // Validate the directory through a representative path, which also rejects escaping symlinks.
    fs_safe::resolve(&root, &format!("{dir}/x.json"))?;
    fs_safe::list_entity_files(&root.join(dir)).map_err(IpcError::io)
}

#[tauri::command]
fn workspace_read(state: State<'_, WorkspaceState>, path: String) -> Result<Option<String>, IpcError> {
    read_workspace_file(&current_root(&state)?, &path)
}

/// Reads UTF-8 without replacing invalid bytes; missing files and unreadable content are distinct.
fn read_workspace_file(root: &Path, path: &str) -> Result<Option<String>, IpcError> {
    let target = fs_safe::resolve(root, path)?;
    match fs::read_to_string(target) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) if error.kind() == ErrorKind::InvalidData => Err(IpcError {
            code: ErrorCode::InvalidFileEncoding,
            detail: Some(error.to_string()),
        }),
        Err(error) => Err(IpcError::io(error)),
    }
}

#[tauri::command]
fn workspace_write(state: State<'_, WorkspaceState>, path: String, contents: String) -> Result<(), IpcError> {
    let target = fs_safe::resolve(&current_root(&state)?, &path)?;
    fs_safe::atomic_write(&target, &contents).map_err(IpcError::io)
}

#[tauri::command]
fn workspace_remove(state: State<'_, WorkspaceState>, path: String) -> Result<(), IpcError> {
    let target = fs_safe::resolve(&current_root(&state)?, &path)?;
    match fs::remove_file(target) {
        Err(error) if error.kind() != ErrorKind::NotFound => Err(IpcError::io(error)),
        _ => Ok(()),
    }
}

/// Where this computer's app-wide settings live. Decided here; the frontend never sends a path.
fn app_settings_dir(app: &AppHandle) -> Result<PathBuf, IpcError> {
    let config_dir = app.path().app_config_dir().map_err(IpcError::io)?;
    Ok(settings_dir_for(app.state::<PortableData>().0.as_deref(), config_dir))
}

/// The folder holding `portable.flag`'s `data` when running portable, otherwise None.
struct PortableData(Option<PathBuf>);

/// Portable mode keeps the settings in `data` always, even after the user opens another workspace.
fn settings_dir_for(portable_data: Option<&Path>, config_dir: PathBuf) -> PathBuf {
    portable_data.map(Path::to_path_buf).unwrap_or(config_dir)
}

#[derive(Serialize)]
struct AppSettingsReply {
    language: Option<String>,
}

#[derive(Deserialize)]
struct AppSettingsInput {
    language: String,
}

#[tauri::command]
fn app_settings_read(app: AppHandle) -> Result<AppSettingsReply, IpcError> {
    Ok(AppSettingsReply { language: app_settings::read(&app_settings_dir(&app)?) })
}

#[tauri::command]
fn app_settings_write(app: AppHandle, settings: AppSettingsInput) -> Result<(), IpcError> {
    app_settings::write(&app_settings_dir(&app)?, &settings.language)
}

#[derive(Serialize)]
struct SystemInfo {
    locale: Option<String>,
    hour12: Option<bool>,
}

/// Never fails: a value that cannot be read is reported as null (FR-09, FR-10).
#[tauri::command]
fn system_info() -> SystemInfo {
    SystemInfo { locale: platform_win::system_locale(), hour12: platform_win::system_hour12() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;

    // TC-10（NO_WORKSPACE_OPEN）｜SDS 錯誤代碼表：尚未開啟工作區就呼叫檔案命令。
    #[test]
    fn file_commands_without_an_open_workspace_fail_with_no_workspace_open() {
        let state = WorkspaceState::default();
        let error = current_root(&state).unwrap_err();
        assert_eq!(error.code, ErrorCode::NoWorkspaceOpen);
    }

    // TC-08（代碼部分）｜FR-06：open 模式選到沒有 workspace.json 的資料夾 → NOT_A_WORKSPACE，且不建立任何檔案。
    #[test]
    fn opening_a_folder_without_workspace_json_fails_with_not_a_workspace() {
        let dir = std::env::temp_dir().join(format!("juicy-test-choose-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let error = choose_root(dir.clone(), false).unwrap_err();
        let entries = fs::read_dir(&dir).unwrap().count();
        fs::remove_dir_all(&dir).unwrap();
        assert_eq!(error.code, ErrorCode::NotAWorkspace);
        assert_eq!(entries, 0);
    }

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("juicy-test-{label}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir.canonicalize().unwrap()
    }

    // TC-07 | FR-06, R-5: report invalid UTF-8 without replacing bytes or hiding other I/O failures.
    #[test]
    fn reading_invalid_utf8_returns_a_distinct_code_and_leaves_bytes_unchanged() {
        let root = temp_dir("encoding-invalid");
        let file = root.join("events/bad.json");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        let bytes = [b'{', b'"', 0xff, b'"', b'}'];
        fs::write(&file, bytes).unwrap();

        let error = read_workspace_file(&root, "events/bad.json").unwrap_err();
        let after = fs::read(&file).unwrap();
        fs::remove_dir_all(root).unwrap();

        assert_eq!(after, bytes);
        assert_eq!(serde_json::to_value(error.code).unwrap(), "INVALID_FILE_ENCODING");
    }

    // TC-07 | FR-06, R-5: valid UTF-8 (including Chinese) must pass through unchanged.
    #[test]
    fn reading_utf8_preserves_text_and_distinguishes_missing_from_io_failure() {
        let root = temp_dir("encoding-valid");
        fs::create_dir_all(root.join("events")).unwrap();
        for (name, text) in [("ascii", "{\"title\":\"Work\"}"), ("chinese", "{\"title\":\"讀書\"}")] {
            fs::write(root.join(format!("events/{name}.json")), text).unwrap();
            assert_eq!(read_workspace_file(&root, &format!("events/{name}.json")).unwrap(), Some(text.to_string()));
        }
        assert_eq!(read_workspace_file(&root, "events/missing.json").unwrap(), None);
        fs::create_dir_all(root.join("events/directory.json")).unwrap();
        let error = read_workspace_file(&root, "events/directory.json").unwrap_err();
        fs::remove_dir_all(root).unwrap();
        assert_eq!(error.code, ErrorCode::IoError);
    }

    // TC-06 / TC-09 | FR-05, FR-07: failed close must retain the writable root and its lock.
    #[test]
    fn failed_close_keeps_the_workspace_open_and_locked() {
        let base = temp_dir("close-failed");
        let root = base.join("workspace");
        fs::create_dir_all(&root).unwrap();
        let remembered = base.join("last-workspace.txt");
        // A directory at the remembered-file path deterministically makes remove_file fail.
        fs::create_dir_all(&remembered).unwrap();
        let state = WorkspaceState::default();
        activate_in(&state, None, root.clone()).unwrap();

        let error = close_in(&state, Some(&remembered)).unwrap_err();
        let still_open = current_root(&state);
        let second_writer = workspace_lock::acquire(&root).map(|_| ()).map_err(|e| e.code);

        drop(state);
        fs::remove_dir_all(base).unwrap();
        assert_eq!(error.code, ErrorCode::IoError);
        assert_eq!(still_open.unwrap(), root);
        assert_eq!(second_writer, Err(ErrorCode::WorkspaceLocked));
    }

    // TC-06 / TC-09 | FR-05, FR-07: successful close forgets the root and releases its lock.
    #[test]
    fn successful_close_forgets_the_workspace_and_releases_its_lock() {
        let base = temp_dir("close-success");
        let root = base.join("workspace");
        fs::create_dir_all(&root).unwrap();
        let remembered = base.join("last-workspace.txt");
        let state = WorkspaceState::default();
        activate_in(&state, Some(&remembered), root.clone()).unwrap();

        close_in(&state, Some(&remembered)).unwrap();

        assert_eq!(current_root(&state).unwrap_err().code, ErrorCode::NoWorkspaceOpen);
        assert!(!remembered.exists());
        let next_writer = workspace_lock::acquire(&root).expect("closed workspace can be reopened");
        drop(next_writer);
        fs::remove_dir_all(base).unwrap();
    }

    // TC-10（portable 還原）｜FR-11、AC-03.4、API-02：免安裝版 data 不存在 → 建立並開啟，回傳
    // initialized=false（前端走既有初始化流程），目前根目錄為 data，且持有單一寫入者鎖。
    #[test]
    fn portable_restore_creates_a_missing_data_folder_and_opens_it_locked() {
        let base = temp_dir("portable-create");
        let data = base.join("data");
        let state = WorkspaceState::default();

        let location = restore_portable(&state, data.clone()).expect("portable restore");

        let root = current_root(&state);
        let second_writer = workspace_lock::acquire(&data).map(|_| ()).map_err(|e| e.code);
        let created = data.is_dir();
        fs::remove_dir_all(&base).unwrap_or(());
        assert!(created, "data must be created");
        assert!(!location.initialized);
        assert_eq!(root.unwrap(), data);
        assert_eq!(second_writer, Err(ErrorCode::WorkspaceLocked));
    }

    // TC-10（portable 還原）｜FR-07、FR-11：data 已是目前開啟的工作區時再還原一次（例如重新載入畫面），
    // 回傳目前位置，不被自己的鎖擋住。
    #[test]
    fn portable_restore_twice_does_not_lock_itself_out() {
        let base = temp_dir("portable-twice");
        let data = base.join("data");
        let state = WorkspaceState::default();
        let first = restore_portable(&state, data.clone()).expect("first restore");

        let again = restore_portable(&state, data.clone());

        fs::remove_dir_all(&base).unwrap_or(());
        assert_eq!(again.map(|l| l.path).map_err(|e| e.code), Ok(first.path));
    }

    // TC-10（portable 還原）｜FR-11、ADR-05 條件①：data 無法建立 → PORTABLE_DATA_UNAVAILABLE，
    // 不改存別處、不留下開啟中的工作區。
    #[test]
    fn portable_restore_reports_an_unavailable_data_folder_and_opens_nothing() {
        let base = temp_dir("portable-blocked");
        let data = base.join("data");
        fs::write(&data, "a file squatting on the folder name").unwrap();
        let state = WorkspaceState::default();

        let error = restore_portable(&state, data.clone()).unwrap_err();

        let nothing_open = current_root(&state).unwrap_err().code;
        let entries = fs::read_dir(&base).unwrap().count();
        fs::remove_dir_all(&base).unwrap_or(());
        assert_eq!(error.code, ErrorCode::PortableDataUnavailable);
        assert_eq!(nothing_open, ErrorCode::NoWorkspaceOpen);
        assert_eq!(entries, 1, "nothing may be written anywhere else");
    }

    // TC-10（portable 設定位置）｜FR-11、FR-09、ADR-05 條件：免安裝版的 App 設定存在 data；安裝版維持 app_config_dir。
    #[test]
    fn portable_settings_live_in_data_and_installed_settings_in_the_config_dir() {
        let data = PathBuf::from("exe/data");
        let config = PathBuf::from("appdata/config");

        assert_eq!(settings_dir_for(Some(&data), config.clone()), data);
        assert_eq!(settings_dir_for(None, config.clone()), config);
    }

    // TC-10（portable 切換）｜FR-11、ADR-05：免安裝版手動切到別的工作區照常開啟並持鎖，但不寫任何
    // last-workspace.txt（下次啟動回到 data）。
    #[test]
    fn portable_manual_switch_opens_the_workspace_without_remembering_it() {
        let base = temp_dir("portable-switch");
        let other = base.join("other");
        fs::create_dir_all(&other).unwrap();
        let state = WorkspaceState::default();

        let switched = activate_in(&state, None, other.clone());

        let root = current_root(&state);
        let remembered_somewhere = other.join("last-workspace.txt").exists() || base.join("last-workspace.txt").exists();
        fs::remove_dir_all(&base).unwrap_or(());
        assert_eq!(switched.map(|l| l.path).map_err(|e| e.code), Ok(other.to_string_lossy().into_owned()));
        assert_eq!(root.unwrap(), other);
        assert!(!remembered_somewhere, "portable mode must not write last-workspace.txt");
    }

    // TC-09（第二條）｜FR-07、AC-02.3：同一行程再選目前已開啟的資料夾，回傳目前位置，不被自己擋住。
    #[test]
    fn reselecting_the_open_workspace_returns_its_location_without_locking_itself_out() {
        let base = temp_dir("activate-same");
        let a = base.join("a");
        fs::create_dir_all(&a).unwrap();
        fs::write(a.join("workspace.json"), "{}").unwrap();
        let remembered = base.join("last-workspace.txt");
        let state = WorkspaceState::default();
        let first = activate_in(&state, Some(&remembered), a.clone()).expect("first open");

        let again = activate_in(&state, Some(&remembered), a.clone());

        let still_open = current_root(&state);
        let (first_path, again_path) = (first.path, again.as_ref().map(|l| l.path.clone()));
        fs::remove_dir_all(&base).unwrap_or(());
        assert_eq!(again_path.map_err(|e| e.code), Ok(first_path));
        assert_eq!(still_open.unwrap(), a);
    }

    // TC-09（第二條）｜FR-07：同一資料夾以不同寫法（大小寫不同；Windows 檔名不分大小寫）再選，
    // 仍視為目前已開啟的工作區。
    #[cfg(windows)]
    #[test]
    fn reselecting_the_open_workspace_by_another_spelling_is_still_the_same_folder() {
        let base = temp_dir("activate-spelling");
        let a = base.join("a");
        fs::create_dir_all(&a).unwrap();
        let remembered = base.join("last-workspace.txt");
        let state = WorkspaceState::default();
        activate_in(&state, Some(&remembered), a.clone()).expect("first open");

        let again = activate_in(&state, Some(&remembered), base.join("A"));

        let code = again.map(|_| ()).map_err(|e| e.code);
        fs::remove_dir_all(&base).unwrap_or(());
        assert_eq!(code, Ok(()));
    }

    // TC-09（第三條）｜FR-07、AC-02.3：取鎖失敗時，原本開啟的工作區維持開啟，last-workspace.txt 不變
    // （取鎖在記住上次工作區之前）。
    #[test]
    fn failed_lock_keeps_the_open_workspace_and_the_remembered_one() {
        let base = temp_dir("activate-fail");
        let (a, b) = (base.join("a"), base.join("b"));
        fs::create_dir_all(&a).unwrap();
        fs::create_dir_all(&b).unwrap();
        let remembered = base.join("last-workspace.txt");
        let state = WorkspaceState::default();
        activate_in(&state, Some(&remembered), a.clone()).expect("first workspace opens");
        let remembered_before = fs::read(&remembered).unwrap();

        // Stands in for "another window already has b open".
        let _other_window = workspace_lock::acquire(&b).expect("test takes b's lock");
        let error = activate_in(&state, Some(&remembered), b.clone()).unwrap_err();

        let still_open = current_root(&state).unwrap();
        let remembered_after = fs::read(&remembered).unwrap();
        drop(_other_window);
        fs::remove_dir_all(&base).unwrap();
        assert_eq!(error.code, ErrorCode::WorkspaceLocked);
        assert_eq!(still_open, a, "the original workspace must stay open");
        assert_eq!(remembered_after, remembered_before, "last-workspace.txt must not change");
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
    // The missing-runtime failure happens inside Builder::run and cannot be caught, so check first.
    #[cfg(windows)]
    preflight::exit_if_webview2_missing();

    // Portable mode is decided once, from the folder the executable sits in (ADR-05).
    let portable_data = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .and_then(|dir| portable::detect(&dir));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PortableData(portable_data))
        .manage(WorkspaceState::default())
        .invoke_handler(tauri::generate_handler![
            workspace_select,
            workspace_restore,
            workspace_close,
            workspace_list,
            workspace_read,
            workspace_write,
            workspace_remove,
            app_settings_read,
            app_settings_write,
            system_info,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            smoke::start(_app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Juicy Calendar");
}
