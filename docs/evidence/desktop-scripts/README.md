# 桌面版驗證腳本（證據，不是維護中的測試）

2026-11-07 收尾各票時，用這些腳本在 Windows 11 的真實桌面版（免安裝版複本、暫存工作區）取得證據。結果在 `../desktop-verification-2026-11-07.md`。

- 方法：以環境變數 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<埠>`（只對被測程序設定）開啟 WebView2 的遠端除錯，再用 Playwright 的 `connectOverCDP` 連到**真正的 Tauri webview**。滑鼠與鍵盤預設是 CDP 合成事件；`票 026c` 的刪除鈕與 `Ctrl+Z` 另以 Win32 `SetCursorPos`／`mouse_event`／`keybd_event` 送真實作業系統輸入（腳本內嵌在當時的 PowerShell 指令中，沒有存成檔）。
- 路徑寫死 `D:/DevCache/...`、`D:/Project/Fun/juicy-calendar/...`，換機器要改。腳本依賴專案已有的 `@playwright/test`，沒有新增套件。
- 注意：Windows 路徑一律正斜線；`WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` 例外，要反斜線（見 `docs/LESSONS.md`）。
- 這些腳本不進 `npm test`，也不是 CI 的一部分。
