//! App-wide settings that belong to this computer, not to a workspace (FR-09, ADR-02).
//! The directory is a parameter so tests never touch the real settings folder.

use crate::error::IpcError;
use crate::fs_safe;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

pub const FILE_NAME: &str = "app-settings.json";

const LANGUAGES: [&str; 2] = ["zh-TW", "en"];

#[derive(Serialize, Deserialize)]
struct Stored {
    language: String,
}

/// The saved language, or `None` when the file is missing, unreadable, damaged or holds a value
/// outside the allowed set. Never writes: a damaged file stays as it is until the next valid write.
pub fn read(dir: &Path) -> Option<String> {
    let text = fs::read_to_string(dir.join(FILE_NAME)).ok()?;
    let stored: Stored = serde_json::from_str(&text).ok()?;
    LANGUAGES.contains(&stored.language.as_str()).then_some(stored.language)
}

/// Saves `language` atomically. Anything but `zh-TW` or `en` is refused and nothing is written.
pub fn write(dir: &Path, language: &str) -> Result<(), IpcError> {
    if !LANGUAGES.contains(&language) {
        return Err(IpcError::io(format!("Unsupported language: {language}")));
    }
    let contents = serde_json::to_string(&Stored { language: language.to_string() }).map_err(IpcError::io)?;
    fs_safe::atomic_write(&dir.join(FILE_NAME), &contents).map_err(IpcError::io)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;
    use std::fs;
    use std::path::PathBuf;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!("juicy-test-appsettings-{label}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            TempDir(path)
        }
        fn file(&self) -> PathBuf {
            self.0.join(FILE_NAME)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    // TC-10｜FR-09：檔案不存在 → 讀回 None，也不建立檔案。
    #[test]
    fn missing_file_reads_as_none_and_creates_nothing() {
        let dir = TempDir::new("missing");
        assert_eq!(read(&dir.0), None);
        assert!(!dir.file().exists());
    }

    // TC-10、TC-11｜FR-09、API-05：損毀或值不合法 → None，且檔案位元組不變。
    #[test]
    fn damaged_or_invalid_file_reads_as_none_and_stays_untouched() {
        let cases: [&[u8]; 6] = [
            b"{ not json",
            b"",
            b"\xff\xfe\x00",
            br#"{"language":"fr"}"#,
            br#"{"language":5}"#,
            br#"{"lang":"en"}"#,
        ];
        for bytes in cases {
            let dir = TempDir::new("damaged");
            fs::write(dir.file(), bytes).unwrap();
            assert_eq!(read(&dir.0), None, "{:?}", String::from_utf8_lossy(bytes));
            assert_eq!(fs::read(dir.file()).unwrap(), bytes, "file must not change");
        }
    }

    // TC-10、TC-11｜FR-09：寫入 en 讀回 en；zh-TW 亦然；再寫入可覆蓋。
    #[test]
    fn written_language_reads_back() {
        let dir = TempDir::new("roundtrip");
        write(&dir.0, "en").unwrap();
        assert_eq!(read(&dir.0).as_deref(), Some("en"));
        write(&dir.0, "zh-TW").unwrap();
        assert_eq!(read(&dir.0).as_deref(), Some("zh-TW"));
    }

    // TC-10｜API-05：寫入不合法的值 → IO_ERROR 且不改檔（沒有檔就不建立檔）。
    #[test]
    fn writing_an_unknown_language_is_refused_and_changes_nothing() {
        let dir = TempDir::new("refuse");
        let error = write(&dir.0, "fr").unwrap_err();
        assert_eq!(error.code, ErrorCode::IoError);
        assert!(!dir.file().exists(), "nothing may be created");

        write(&dir.0, "en").unwrap();
        let before = fs::read(dir.file()).unwrap();
        assert_eq!(write(&dir.0, "fr").unwrap_err().code, ErrorCode::IoError);
        assert_eq!(fs::read(dir.file()).unwrap(), before);
    }

    // TC-11｜FR-09、API-05：損毀的檔案只在使用者下次切換語言時才被覆寫。
    #[test]
    fn a_damaged_file_is_replaced_only_by_the_next_valid_write() {
        let dir = TempDir::new("replace");
        fs::write(dir.file(), b"garbage").unwrap();
        write(&dir.0, "en").unwrap();
        assert_eq!(read(&dir.0).as_deref(), Some("en"));
    }
}
