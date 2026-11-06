# 028：`test:desktop` 冷啟動時固定 2 秒注入太早（間歇失敗）

**大小：** S　**狀態：** 可開始（2026-11-07 記錄，尚未處理；改動會碰到 `scripts/desktop-smoke.js` 與 `src-tauri/src/lib.rs` 的除錯專用 `smoke` 模組，**需專案擁有者同意**）

**現象：** 2026-11-07 在 Windows 11 連跑 `npm run test:desktop` 3 次：1 次失敗、2 次通過。失敗的是剛編出新 debug 執行檔後的第一次啟動，報告 `{"error": "TypeError: Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of type 'Element'."}`，接著 `FAIL: report is missing "ballCount": 6`。

**已知事實：**
- `lib.rs` 的 `smoke::start` 在啟動後固定睡 2 秒才 `window.eval` 注入腳本，再睡 4 秒就關窗。
- 以全新 WebView2 資料夾量測 debug 版，`template-ball` 第一次出現在啟動後約 5.3 秒（單次量測；第二輪量測腳本因頁面導航而崩潰，沒有更多樣本）。冷啟動時 2 秒的注入在畫面出現之前，所以 `querySelector` 回 null。
- 後續兩次通過，推測是暖啟動較快；**冷啟動為何慢沒有查證**。

**可能的做法（我不替你選）：** 腳本自己輪詢等到 `template-ball` 出現再動作，並讓 Rust 端等到報告檔寫出（或加大上限）再關窗，而不是固定秒數。這類似票 001／022 把固定等待改成等明確畫面條件。不放寬任何斷言。

**注意：** 在 PowerShell 裡執行 `npm run test:desktop` 會因為 `bash` 解析成 WSL 而失敗（找不到 Windows 的 `.exe`），請在 Git Bash 執行。

證據：`docs/evidence/desktop-verification-2026-11-07.md`、`docs/evidence/desktop-scripts/s7-smoke-timing.mjs`。

共同規則（先讀）：[`issues/README.md`](README.md)。
