# 015：免安裝模式

**大小：** M　**狀態：** 實作完成（M-02 人工驗收、WebView2 快取位置待專案擁有者；S-01 已於 2026-11-05 決定：採用 `portable.flag`）

**成果（What to build）：** 執行檔旁有 `portable.flag` 時為免安裝模式：**啟動時一律開啟**執行檔旁的 `data`（不存在就建立並初始化），App 設定**始終**存在 `data`（不隨手動切換的工作區移動），不使用 `last-workspace.txt`；仍可手動切換工作區，但下次啟動回到 `data`；切到外部工作區後那份資料不在「整包帶走」的承諾內。`data` 無法建立或寫入時顯示明確錯誤，**不**自動改存使用者目錄。安裝版行為不變。

**Blocked by：** 009、010（S-01 已決定，條件見 `docs/04-sad.md` ADR-05）

**對應 TC／人工：** TC-10（`portable::detect`）、M-02（部分）；AC-03.4、FR-11

**驗收指令：** `npm run test:rust`、`npm run typecheck`、`npm run lint`、`npm test`

**要讀的規格段落：** `docs/04-sad.md` ADR-05；`docs/05-sds.md` API-02、`portable` 契約；`docs/03-srs.md` R-8

## 驗收條件

- [x] **開工前先確認 S-01 已由專案擁有者決定**：2026-11-05 已決定採用 `portable.flag`，附三項條件（見下方三條與 ADR-05）。
- [x] `data` 無法建立或寫入 → 回傳明確錯誤 `PORTABLE_DATA_UNAVAILABLE`（附 i18n 文字）；不改存使用者目錄、不寫 `last-workspace.txt`。
- [x] 免安裝模式下手動切換工作區可用，App 設定仍寫在 `data`；下次啟動回到 `data`。
- [ ] 說明檔／文件寫明：外部工作區的資料不包含在整包帶走的承諾內（說明檔本身由票 017 組裝，本票只留下文字）。
- [x] `portable::detect(目錄)`：有 `portable.flag` → 回傳 `<目錄>/data`；沒有 → 空值；目錄以參數傳入，測試用暫存資料夾。
- [x] 免安裝模式下的還原：工作區為 `data`，不讀不寫 `last-workspace.txt`；`data` 內沒有工作區時走既有的初始化流程。
- [x] 單一寫入者（票 009）對免安裝版同樣適用。
- [ ] WebView2 的快取位置是否能放進 `data`，**未驗證**；在票中查證並記錄結果，不宣稱已整包帶走。

共同規則（先讀）：[`issues/README.md`](README.md)。

## 實作紀錄與偏差（2026-11-05）

- 新增 `src-tauri/src/portable.rs`（`detect`）；`lib.rs` 加 `restore_portable`、`PortableData`（啟動時由 `current_exe` 旁判斷一次）、`settings_dir_for`；`workspace_restore` 在免安裝時走 `restore_portable`，`workspace_close` 不碰 `last-workspace.txt`；`error.rs` 新增 `PORTABLE_DATA_UNAVAILABLE`；前端 Zod 列舉、`notices.ts`、字典（兩種語言）、`workspaceSession.ts` 對應。沒有新增套件。
- 單一寫入者：`restore_portable` 沿用 `workspace_lock::acquire`；再還原一次時以 `is_open_root` 回傳目前位置，不被自己擋住。
- **偏差一**：`activate_in` 的 `last_workspace` 參數由 `&Path` 改為 `Option<&Path>`（`None`＝免安裝，不記錄）；既有 3 個測試只把引數包成 `Some(...)`，斷言未改。
- **偏差二（待確認）**：`data` 無法建立或寫入的錯誤，新增 `PORTABLE_DATA_UNAVAILABLE`，不沿用 `IO_ERROR`；英文與繁中句子是我的提案翻譯。「無法寫入」是以取得 `.juicy.lock` 失敗來判斷（非 `WORKSPACE_LOCKED` 的失敗都歸為此代碼）。
- **偏差三**：SRS FR-11 是已確認文件，依專案擁有者建議把「刪除資料夾即移除」改成「刪除資料夾即可移除程式與其中的使用者資料」並註明 WebView2 可能留下快取。
- 第一個測試（`a_portable_flag_…`）的綠燈是最小寫法（無條件回傳 `<目錄>/data`），由第二個測試（無 flag→`None`）逼出旗標判斷；中間兩次紅燈原因皆為預期的斷言失敗。
- **未驗證**：①M-02 的人工流程（解壓 .zip、建立區塊、複製到另一台電腦）；②release 版與 .zip 組裝（票 017）；③「`data` 唯讀或被占用」在真實 App 畫面上顯示的文字（只有單元測試覆蓋代碼與文字對照）；④手動切換外部工作區的原生對話框流程（只測了 `activate_in(None, …)`）；⑤WebView2 快取是否能放進 `data`（Tauri `data_directory`）**未驗證**，不宣稱整包帶走；⑥`npm run test:e2e` 本輪沒跑（已知有票 022 的間歇失敗，本票只動 Rust 與錯誤文字）；⑦說明檔文字（外部工作區不在承諾內）尚未寫，留給票 017 組裝時放入。
- 實機證據（debug 執行檔複製到暫存資料夾，旁放 `portable.flag`，測試腳本放在 scratchpad）：首次啟動 `data` 內出現 `workspace.json`、`settings.json`、6 個 `templates/*.json`、`app-settings.json`（`{"language":"en"}`）、`.juicy.lock`；畫面為日曆（6 顆球）；複製整個資料夾再啟動，語言 `en`、模板 6、直接進日曆；兩次執行後 `%APPDATA%\app.juicycalendar.timeblock` 仍不存在。
