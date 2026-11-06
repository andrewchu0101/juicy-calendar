# 014：缺少 WebView2 時顯示說明

**大小：** M　**狀態：** 完成（2026-11-04；M-07 專案擁有者已確認視窗；英文版與 release 版未驗證）

**成果（What to build）：** App 在啟動 Tauri 之前先偵測 WebView2 執行階段；缺少時顯示原生說明視窗（依系統語系為繁體中文或英文），引導使用者用瀏覽器自行下載，然後以結束碼 1 結束，不啟動 Tauri，也不連網。

**Blocked by：** 010

**對應 TC／人工：** TC-13（本票新增）、M-07；FR-08、U-12

**驗收指令：** `npm run test:rust`、人工 M-07

**要讀的規格段落：** `docs/04-sad.md` ADR-04；`docs/05-sds.md` API-07；`docs/03-srs.md` U-12

## 驗收條件

- [x] 偵測依登錄值 `pv`：存在且不是 `0.0.0.0` 視為已安裝；判斷邏輯為純函式，單元測試涵蓋：空值、`0.0.0.0`、`156.0.4314.58`。（`preflight::webview2_pv_means_installed`）
- [x] 說明文字依語系選擇的純函式有單元測試：`zh*` → 繁體中文，其他 → 英文。（`preflight::help_language`、`help_text`）
- [x] 人工 M-07（專案擁有者 2026-11-04 看過說明視窗並按「確定」；結束碼 1 以代理自動化為證）：以官方環境變數 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` 指向空資料夾模擬缺少，確認說明視窗內容、結束碼為 1、Tauri 沒有啟動。代理以 UI Automation 跑過：視窗內容正確（繁中）、按「確定」後結束碼 1。「Tauri 沒有啟動」以結束碼 1 與程序在視窗期間沒有主視窗推定，未另外證明。專案擁有者已確認視窗。
- [x] WebView2 存在時，啟動行為與現在完全相同。（不設環境變數啟動 debug 版：無說明視窗、程序持續執行、主視窗出現；`test:desktop` 本票未跑）
- [x] 官方下載網址在實作時再次確認；App 本身不連網。（2026-11-04 `https://developer.microsoft.com/microsoft-edge/webview2/` 回應 200，為微軟官方頁、內有「Download the WebView2 Runtime」；App 只顯示網址，不開啟、不連線）

共同規則（先讀）：[`issues/README.md`](README.md)。

## 實作紀錄與偏差（2026-11-04）

- 新增 `src-tauri/src/preflight.rs`（純函式 + `exit_if_webview2_missing`）；`platform_win.rs` 加 `webview2_pv`（`RegGetValueW`，依序查 HKLM 64 位元檢視、HKLM 32 位元檢視、HKCU）與 `show_message`（`MessageBoxW`），unsafe 仍只在此；`lib.rs` 的 `run()` 在 `cfg(windows)` 下於 Tauri 啟動前呼叫。沒有新增套件。
- **偏差一（待專案擁有者確認）**：SDS API-07 只寫登錄值，但 M-07 與本票用 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` 模擬缺少，此時登錄 `pv` 仍是真實版本，只看登錄偵測不到。因此該變數有設定時，以「資料夾內有 `msedgewebview2.exe`」決定，並忽略登錄（WebView2 本身在此變數存在時也只從該資料夾載入）。SDS API-07 需補這句。
- 偏差二：測試計畫原本沒有對應的單元 TC，依專案擁有者指示新增 TC-13。
- 語系判斷用語言子標籤等於 `zh`（`zhx` 不算），比 SDS 寫的 `zh*` 嚴一點，對 Windows 語系名稱結果相同。
- 簡單的「其他語系→英文」測試加入時沒有紅燈（`English` 樁已滿足），屬特徵化測試。
- 說明視窗只在 Windows 編譯；其他平台不檢查。
- 英文視窗、release 版（無主控台）、固定版本執行階段未實測。`clippy` 未安裝，未跑。

## 補充（2026-11-07）
release 執行檔缺少 WebView2 時的說明窗（繁中）、結束碼 1、不啟動 Tauri 皆驗證通過，見 `docs/evidence/desktop-verification-2026-11-07.md`。英文版視窗仍未驗證（需英文系統語言）。
