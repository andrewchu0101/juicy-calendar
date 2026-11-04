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

/// Decides 12- or 24-hour from a Windows time pattern such as `tt hh:mm` or `HH:mm` (FR-10, API-06).
/// The first `h` / `H` outside single quotes decides: `h` is a 12-hour clock, `H` a 24-hour one.
/// Returns `None` when the pattern has no hour symbol.
/// A doubled quote (`''`) is one literal quote character, so toggling on every quote handles it.
fn hour12_from_time_pattern(pattern: &str) -> Option<bool> {
    let mut quoted = false;
    for symbol in pattern.chars() {
        match symbol {
            '\'' => quoted = !quoted,
            'h' if !quoted => return Some(true),
            'H' if !quoted => return Some(false),
            _ => {}
        }
    }
    None
}

/// Turns the UTF-16 buffer Windows filled in into the pattern text. `None` without a terminator or when empty.
fn pattern_from_utf16(buffer: &[u16]) -> Option<String> {
    let end = buffer.iter().position(|&unit| unit == 0)?;
    let text = String::from_utf16(&buffer[..end]).ok()?;
    (!text.is_empty()).then_some(text)
}

#[cfg(windows)]
mod ffi {
    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetLocaleInfoEx(locale_name: *const u16, lc_type: u32, lc_data: *mut u16, cch_data: i32) -> i32;
    }
    #[link(name = "advapi32")]
    extern "system" {
        pub fn RegGetValueW(
            hkey: isize,
            sub_key: *const u16,
            value: *const u16,
            flags: u32,
            value_type: *mut u32,
            data: *mut u16,
            data_len: *mut u32,
        ) -> i32;
    }
    #[link(name = "user32")]
    extern "system" {
        pub fn MessageBoxW(hwnd: isize, text: *const u16, caption: *const u16, kind: u32) -> i32;
    }
    pub const HKEY_CURRENT_USER: isize = 0x8000_0001u32 as i32 as isize;
    pub const HKEY_LOCAL_MACHINE: isize = 0x8000_0002u32 as i32 as isize;
    /// Only accept a text value (`REG_SZ`).
    pub const RRF_RT_REG_SZ: u32 = 0x0000_0002;
    pub const MB_OK: u32 = 0x0000_0000;
    pub const MB_ICONERROR: u32 = 0x0000_0010;
    /// The WebView2 Evergreen runtime's client id; its `pv` value is the installed version.
    pub const WEBVIEW2_CLIENT_KEYS: [(isize, &str); 3] = [
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"),
        (HKEY_CURRENT_USER, r"Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"),
    ];
    /// A null locale name means "the current user's default locale".
    pub const LOCALE_NAME_USER_DEFAULT: *const u16 = std::ptr::null();
    pub const LOCALE_SNAME: u32 = 0x0000_005C;
    /// The short time pattern the user has set, for example `tt hh:mm` or `HH:mm`.
    pub const LOCALE_SSHORTTIME: u32 = 0x0000_0079;
    /// Time patterns are at most 80 characters long, plus the terminator.
    pub const TIME_PATTERN_MAX_LENGTH: usize = 81;
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

/// Whether Windows shows a 12-hour clock (`Some(true)`), a 24-hour one (`Some(false)`), or is unknown
/// (`None`, also on other platforms). Reads the user's short time pattern, so custom formats count.
#[cfg(windows)]
pub fn system_hour12() -> Option<bool> {
    let mut buffer = [0u16; ffi::TIME_PATTERN_MAX_LENGTH];
    // SAFETY: `buffer` is valid for `buffer.len()` UTF-16 units and the length passed is exactly that;
    // a null locale name is the documented way to ask for the user default.
    let written = unsafe {
        ffi::GetLocaleInfoEx(ffi::LOCALE_NAME_USER_DEFAULT, ffi::LOCALE_SSHORTTIME, buffer.as_mut_ptr(), buffer.len() as i32)
    };
    if written <= 0 {
        return None;
    }
    hour12_from_time_pattern(&pattern_from_utf16(&buffer)?)
}

#[cfg(not(windows))]
pub fn system_hour12() -> Option<bool> {
    None
}

/// UTF-16 with the terminator Windows string parameters need.
#[cfg(windows)]
fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

/// The installed WebView2 runtime version (`pv`), from the first registry location that has one
/// (64-bit view, 32-bit view, then the current user). `None` when no location has a text value.
/// Whether that value counts as "installed" is decided by `preflight`, not here.
#[cfg(windows)]
pub fn webview2_pv() -> Option<String> {
    let value_name = wide("pv");
    for (root, key) in ffi::WEBVIEW2_CLIENT_KEYS {
        let sub_key = wide(key);
        let mut buffer = [0u16; 128];
        let mut byte_len = std::mem::size_of_val(&buffer) as u32;
        // SAFETY: both names are NUL-terminated; `buffer` is valid for `byte_len` bytes, which is
        // what is passed; the type pointer may be null when RRF_RT_REG_SZ restricts the type.
        let status = unsafe {
            ffi::RegGetValueW(
                root,
                sub_key.as_ptr(),
                value_name.as_ptr(),
                ffi::RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buffer.as_mut_ptr(),
                &mut byte_len,
            )
        };
        if status == 0 {
            if let Some(version) = pattern_from_utf16(&buffer) {
                return Some(version);
            }
        }
    }
    None
}

#[cfg(not(windows))]
pub fn webview2_pv() -> Option<String> {
    None
}

/// Shows a modal error message box and returns after the user closes it. No-op on other platforms.
#[cfg(windows)]
pub fn show_message(title: &str, text: &str) {
    let (title, text) = (wide(title), wide(text));
    // SAFETY: both strings are NUL-terminated and outlive the call; a null owner window is allowed.
    unsafe {
        ffi::MessageBoxW(0, text.as_ptr(), title.as_ptr(), ffi::MB_OK | ffi::MB_ICONERROR);
    }
}

#[cfg(not(windows))]
pub fn show_message(_title: &str, _text: &str) {}

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
        assert_eq!(system_hour12(), None);
    }

    // TC-12｜FR-10：Windows 一定有短時間圖樣，其中一定有小時符號。
    #[cfg(windows)]
    #[test]
    fn windows_reports_a_twelve_or_twenty_four_hour_clock() {
        assert!(system_hour12().is_some(), "the user default time pattern always has an hour symbol");
    }

    // TC-12、API-06｜FR-10：由 Windows 的短時間圖樣判斷 12／24 小時。
    #[test]
    fn hour_symbol_decides_twelve_or_twenty_four_hour() {
        for (pattern, expected) in [
            ("tt hh:mm", Some(true)),
            ("h:mm tt", Some(true)),
            ("tt h:mm", Some(true)),
            ("hh:mm:ss tt", Some(true)),
            ("HH:mm", Some(false)),
            ("H:mm", Some(false)),
            ("HH:mm:ss", Some(false)),
        ] {
            assert_eq!(hour12_from_time_pattern(pattern), expected, "{pattern}");
        }
    }

    // 單引號內是字面文字，不是時間符號；兩個單引號是一個單引號字元。
    #[test]
    fn quoted_text_is_not_an_hour_symbol() {
        for (pattern, expected) in [
            ("'h' HH:mm", Some(false)),
            ("HH'h'mm", Some(false)),
            ("'H' hh:mm", Some(true)),
            ("'o''clock' h:mm tt", Some(true)),
        ] {
            assert_eq!(hour12_from_time_pattern(pattern), expected, "{pattern}");
        }
    }

    // 沒有小時符號（或根本不是時間圖樣）→ 不知道，前端退回 Intl。
    #[test]
    fn a_pattern_without_an_hour_symbol_is_unknown() {
        for pattern in ["", "mm:ss", "tt", "'hh'", "   "] {
            assert_eq!(hour12_from_time_pattern(pattern), None, "{pattern:?}");
        }
    }

    // Windows 回傳以 NUL 結尾的 UTF-16，後面可能還有舊資料。
    #[test]
    fn reads_the_pattern_up_to_the_terminator() {
        assert_eq!(pattern_from_utf16(&utf16("tt hh:mm", &[0x41, 0x42])).as_deref(), Some("tt hh:mm"));
        assert_eq!(pattern_from_utf16(&utf16("HH:mm", &[])).as_deref(), Some("HH:mm"));
    }

    #[test]
    fn unusable_pattern_buffers_are_unknown() {
        let unterminated: Vec<u16> = "HH:mm".encode_utf16().collect();
        for (label, buffer) in [
            ("empty slice", Vec::new()),
            ("immediately terminated", vec![0]),
            ("no terminator", unterminated),
            ("lone surrogate", vec![0xD800u16, 0]),
        ] {
            assert_eq!(pattern_from_utf16(&buffer), None, "{label}");
        }
    }
}
