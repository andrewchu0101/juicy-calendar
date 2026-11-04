//! The error every Tauri command returns: a stable `code` the frontend translates, plus a
//! `detail` for diagnostics only. The frontend never shows `detail` to the user.

use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// Defined now, first returned by ticket 009 (single-writer lock).
    #[allow(dead_code)]
    WorkspaceLocked,
    NotAWorkspace,
    NoWorkspaceOpen,
    PathNotAllowed,
    IoError,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct IpcError {
    pub code: ErrorCode,
    pub detail: Option<String>,
}

impl IpcError {
    pub fn io(detail: impl fmt::Display) -> Self {
        IpcError { code: ErrorCode::IoError, detail: Some(detail.to_string()) }
    }
}

impl IpcError {
    pub fn not_a_workspace() -> Self {
        IpcError { code: ErrorCode::NotAWorkspace, detail: None }
    }

    pub fn no_workspace_open() -> Self {
        IpcError { code: ErrorCode::NoWorkspaceOpen, detail: None }
    }

    pub fn path_not_allowed(relative: &str) -> Self {
        IpcError { code: ErrorCode::PathNotAllowed, detail: Some(format!("Path is not allowed: {relative}")) }
    }
}

impl fmt::Display for IpcError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.detail {
            Some(detail) => write!(f, "{:?}: {detail}", self.code),
            None => write!(f, "{:?}", self.code),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // TC-10｜SDS 錯誤格式：序列化後的 JSON 欄位名稱與代碼大小寫必須與前端 Zod 契約完全一致。
    #[test]
    fn serializes_as_code_and_detail_with_screaming_snake_case_codes() {
        let cases = [
            (ErrorCode::WorkspaceLocked, "WORKSPACE_LOCKED"),
            (ErrorCode::NotAWorkspace, "NOT_A_WORKSPACE"),
            (ErrorCode::NoWorkspaceOpen, "NO_WORKSPACE_OPEN"),
            (ErrorCode::PathNotAllowed, "PATH_NOT_ALLOWED"),
            (ErrorCode::IoError, "IO_ERROR"),
        ];
        for (code, expected) in cases {
            let value = serde_json::to_value(IpcError { code, detail: None }).unwrap();
            assert_eq!(value, json!({ "code": expected, "detail": null }));
        }
        let with_detail = serde_json::to_value(IpcError::io("disk full")).unwrap();
        assert_eq!(with_detail, json!({ "code": "IO_ERROR", "detail": "disk full" }));
    }
}
