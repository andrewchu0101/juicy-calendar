//! Windows-only native calls (ADR-04). The only module allowed to contain `unsafe`.
//! On other platforms every function reports "unknown" so callers fall back to the browser's values.

/// Turns the UTF-16 buffer Windows filled in into a locale name such as `zh-TW`.
/// Returns `None` when the buffer has no terminator, is empty, or is not a plausible locale name.
fn locale_from_utf16(buffer: &[u16]) -> Option<String> {
    let end = buffer.iter().position(|&unit| unit == 0)?;
    let name = String::from_utf16(&buffer[..end]).ok()?;
    let mut parts = name.split('-');
    let language = parts.next()?;
    let language_ok = (2..=3).contains(&language.len()) && language.chars().all(|c| c.is_ascii_lowercase());
    let rest_ok = parts.all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_alphanumeric()));
    (language_ok && rest_ok).then_some(name)
}

#[cfg(windows)]
mod ffi {
    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetLocaleInfoEx(locale_name: *const u16, lc_type: u32, lc_data: *mut u16, cch_data: i32) -> i32;
    }
    /// A null locale name means "the current user's default locale".
    pub const LOCALE_NAME_USER_DEFAULT: *const u16 = std::ptr::null();
    pub const LOCALE_SNAME: u32 = 0x0000_005C;
    /// LOCALE_NAME_MAX_LENGTH, including the terminator.
    pub const LOCALE_NAME_MAX_LENGTH: usize = 85;
}

/// The user's Windows locale name (for example `zh-TW`), or `None` when unknown or not on Windows.
#[cfg(windows)]
pub fn system_locale() -> Option<String> {
    let mut buffer = [0u16; ffi::LOCALE_NAME_MAX_LENGTH];
    // SAFETY: `buffer` is valid for `buffer.len()` UTF-16 units and the length passed is exactly that;
    // a null locale name is the documented way to ask for the user default.
    let written = unsafe {
        ffi::GetLocaleInfoEx(ffi::LOCALE_NAME_USER_DEFAULT, ffi::LOCALE_SNAME, buffer.as_mut_ptr(), buffer.len() as i32)
    };
    if written <= 0 {
        return None;
    }
    locale_from_utf16(&buffer)
}

#[cfg(not(windows))]
pub fn system_locale() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utf16(text: &str, tail: &[u16]) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).chain(tail.iter().copied()).collect()
    }

    // TC-11、API-06｜FR-09：Windows 回傳以 NUL 結尾的 UTF-16，後面可能還有舊資料。
    #[test]
    fn reads_the_name_up_to_the_terminator() {
        assert_eq!(locale_from_utf16(&utf16("zh-TW", &[0x41, 0x42])).as_deref(), Some("zh-TW"));
        assert_eq!(locale_from_utf16(&utf16("en-US", &[])).as_deref(), Some("en-US"));
        assert_eq!(locale_from_utf16(&utf16("zh-Hant-TW", &[])).as_deref(), Some("zh-Hant-TW"));
        assert_eq!(locale_from_utf16(&utf16("ja", &[])).as_deref(), Some("ja"));
    }

    // API-06：「永不回傳錯誤」，取不到或不像語系名稱 → None。
    #[test]
    fn unusable_buffers_are_unknown() {
        let unterminated: Vec<u16> = "zh-TW".encode_utf16().collect();
        let bad_surrogate = [0xD800u16, 0];
        for (label, buffer) in [
            ("empty slice", Vec::new()),
            ("immediately terminated", vec![0]),
            ("no terminator", unterminated),
            ("lone surrogate", bad_surrogate.to_vec()),
            ("not a locale name", utf16("hello world!", &[])),
            ("leading hyphen", utf16("-TW", &[])),
        ] {
            assert_eq!(locale_from_utf16(&buffer), None, "{label}");
        }
    }

    #[cfg(windows)]
    #[test]
    fn windows_reports_a_locale_name_of_the_expected_shape() {
        let locale = system_locale().expect("Windows always has a user locale");
        let mut parts = locale.split('-');
        let language = parts.next().unwrap();
        assert!((2..=3).contains(&language.len()) && language.chars().all(|c| c.is_ascii_lowercase()), "{locale}");
        assert!(parts.all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric())), "{locale}");
    }

    #[cfg(not(windows))]
    #[test]
    fn other_platforms_report_unknown() {
        assert_eq!(system_locale(), None);
    }
}
