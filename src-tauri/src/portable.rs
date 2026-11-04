//! Portable mode (FR-11, ADR-05). The directory is a parameter so tests never touch the real
//! executable folder.

use std::path::{Path, PathBuf};

pub const FLAG_FILE: &str = "portable.flag";
pub const DATA_DIR: &str = "data";

/// `<exe_dir>/data` when `portable.flag` sits next to the executable, otherwise `None`.
pub fn detect(exe_dir: &Path) -> Option<PathBuf> {
    exe_dir.join(FLAG_FILE).is_file().then(|| exe_dir.join(DATA_DIR))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!("juicy-test-portable-{label}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            TempDir(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    // TC-10（portable::detect）｜FR-11、ADR-05、AC-03.4：執行檔旁有 portable.flag → 回傳 <目錄>/data。
    #[test]
    fn a_portable_flag_next_to_the_executable_selects_its_data_folder() {
        let exe_dir = TempDir::new("flag");
        fs::write(exe_dir.0.join(FLAG_FILE), "").unwrap();

        assert_eq!(detect(&exe_dir.0), Some(exe_dir.0.join(DATA_DIR)));
    }

    // TC-10（portable::detect）｜FR-11、ADR-05：沒有 portable.flag → None，即使旁邊有同名的 data 資料夾
    // （安裝版不受影響）。
    #[test]
    fn without_a_portable_flag_the_app_is_not_portable_even_with_a_data_folder() {
        let exe_dir = TempDir::new("noflag");
        fs::create_dir_all(exe_dir.0.join(DATA_DIR)).unwrap();

        assert_eq!(detect(&exe_dir.0), None);
    }
}
