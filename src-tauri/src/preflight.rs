//! Pre-launch checks (API-07). Runs before Tauri starts, so the decisions here are plain functions
//! that need no window, registry or process: the Windows calls live in `platform_win`.

/// Whether the registry value `pv` of the WebView2 runtime means "installed" (FR-08, API-07).
/// `None` is a missing value; `0.0.0.0` is what the updater leaves behind after an uninstall.
pub fn webview2_pv_means_installed(pv: Option<&str>) -> bool {
    matches!(pv, Some(version) if !version.is_empty() && version != "0.0.0.0")
}

/// Whether a WebView2 runtime can be used. `override_folder_has_runtime` is `Some` when the environment
/// variable `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` is set: WebView2 then loads only from that folder and
/// ignores the installed runtime, so the folder's content decides (`true` = it holds the runtime).
pub fn webview2_available(override_folder_has_runtime: Option<bool>, pv: Option<&str>) -> bool {
    override_folder_has_runtime.unwrap_or_else(|| webview2_pv_means_installed(pv))
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum HelpLanguage {
    TraditionalChinese,
    English,
}

/// Which language the "WebView2 is missing" window uses, from the Windows locale name (API-07, FR-09).
pub fn help_language(locale: Option<&str>) -> HelpLanguage {
    match locale.and_then(|name| name.split('-').next()) {
        Some("zh") => HelpLanguage::TraditionalChinese,
        _ => HelpLanguage::English,
    }
}

/// Title and body of the window shown when the WebView2 runtime is missing.
pub struct HelpText {
    pub title: &'static str,
    pub body: &'static str,
}

/// The URL is Microsoft's official WebView2 Runtime page. The app never opens it (NFR-03):
/// the user copies it into a browser.
pub fn help_text(language: HelpLanguage) -> HelpText {
    match language {
        HelpLanguage::TraditionalChinese => HelpText {
            title: "Juicy Calendar 缺少 WebView2",
            body: "找不到 Microsoft Edge WebView2 執行階段，Juicy Calendar 無法啟動。\n\n\
                   請用瀏覽器到微軟官方網頁下載並安裝「Evergreen」執行階段，再重新開啟：\n\
                   https://developer.microsoft.com/microsoft-edge/webview2/",
        },
        HelpLanguage::English => HelpText {
            title: "Juicy Calendar needs WebView2",
            body: "Juicy Calendar could not find the Microsoft Edge WebView2 Runtime and cannot start.\n\n\
                   Please download and install the Evergreen Runtime from Microsoft's official page \
                   in a browser, then open Juicy Calendar again:\n\
                   https://developer.microsoft.com/microsoft-edge/webview2/",
        },
    }
}

/// Runs before Tauri starts. When no WebView2 runtime is usable, explains how to get one in a native
/// message box and ends the process with exit code 1, so Tauri never starts and nothing goes online
/// (FR-08, U-12, NFR-03). Verified by hand (M-07): it needs a real registry, window and exit code.
#[cfg(windows)]
pub fn exit_if_webview2_missing() {
    let override_folder = std::env::var_os("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER")
        .map(|folder| std::path::Path::new(&folder).join("msedgewebview2.exe").is_file());
    let pv = crate::platform_win::webview2_pv();
    if webview2_available(override_folder, pv.as_deref()) {
        return;
    }
    let text = help_text(help_language(crate::platform_win::system_locale().as_deref()));
    crate::platform_win::show_message(text.title, text.body);
    std::process::exit(1);
}

#[cfg(test)]
mod tests {
    use super::*;

    // TC-13、API-07｜FR-08、U-12：登錄值 pv 是真實版本號 → 視為已安裝。
    #[test]
    fn a_real_version_means_the_runtime_is_installed() {
        assert!(webview2_pv_means_installed(Some("156.0.4314.58")));
    }

    // TC-13、API-07｜FR-08、U-12：值不存在、空字串、或更新程式留下的 0.0.0.0 → 未安裝。
    #[test]
    fn a_missing_empty_or_zero_version_means_the_runtime_is_absent() {
        for (label, pv) in [("missing", None), ("empty", Some("")), ("zero", Some("0.0.0.0"))] {
            assert!(!webview2_pv_means_installed(pv), "{label}");
        }
    }

    // TC-13、M-07 前置｜FR-08、U-12：官方環境變數指定了資料夾時，WebView2 只從該資料夾載入，
    // 已安裝的版本不算數；所以「指向空資料夾」要被偵測為缺少，即使登錄的 pv 是真實版本。
    #[test]
    fn an_override_folder_decides_regardless_of_the_installed_version() {
        assert!(!webview2_available(Some(false), Some("156.0.4314.58")), "empty override folder");
        assert!(webview2_available(Some(true), None), "override folder holds a runtime");
    }

    // TC-13｜FR-08：沒有環境變數時，看登錄的 pv（WebView2 存在時啟動行為不變）。
    #[test]
    fn without_an_override_the_installed_version_decides() {
        assert!(webview2_available(None, Some("156.0.4314.58")));
        assert!(!webview2_available(None, Some("0.0.0.0")));
        assert!(!webview2_available(None, None));
    }

    // TC-13、API-07｜FR-08、U-12：任何 zh 開頭的語系 → 繁體中文（與 TC-11 同表）。
    #[test]
    fn chinese_locales_get_the_traditional_chinese_help() {
        for locale in ["zh-TW", "zh-HK", "zh-CN", "zh"] {
            assert_eq!(help_language(Some(locale)), HelpLanguage::TraditionalChinese, "{locale}");
        }
    }

    // TC-13、API-07｜FR-08、U-12：兩種語言的說明都要指名缺少的元件並附官方頁面網址
    // （2026-11-04 確認該頁回應 200，為微軟官方 WebView2 頁，內有 Runtime 下載區塊）。
    #[test]
    fn both_help_texts_name_the_runtime_and_the_official_download_page() {
        for (language, missing_phrase) in [
            (HelpLanguage::English, "could not find"),
            (HelpLanguage::TraditionalChinese, "找不到"),
        ] {
            let text = help_text(language);
            assert!(text.title.contains("WebView2"), "{language:?} title");
            assert!(text.body.contains(missing_phrase), "{language:?} body says what is missing");
            assert!(
                text.body.contains("https://developer.microsoft.com/microsoft-edge/webview2/"),
                "{language:?} body has the URL"
            );
        }
    }

    // TC-13、API-07｜FR-08：其他語系、取不到語系 → 英文（沿用 TC-11 已決）。
    #[test]
    fn other_or_unknown_locales_get_the_english_help() {
        for locale in [Some("en-US"), Some("ja-JP"), Some("zhx"), Some(""), None] {
            assert_eq!(help_language(locale), HelpLanguage::English, "{locale:?}");
        }
    }
}
