# 016：NSIS 安裝檔與 README

**大小：** M　**狀態：** 實作完成（建置成功；M-01 與 1803 於 2026-11-07 依擁有者回報記為通過；README 步驟尚未照做測試）

**成果（What to build）：** 提供 Windows 的 NSIS 安裝檔：缺少 WebView2 時由安裝程式連網下載微軟官方版本；不簽章；最低支援 Windows 10 1803 64 位元。README 補上 Windows 安裝、解除安裝、SmartScreen 警告的處理，以及「工作區資料夾不要放在雲端同步資料夾」的建議。

**Blocked by：** 000（S-02 已決定：選 A，見末段）

**對應 TC／人工：** M-01；AC-03.1、FR-08、NFR-05

**驗收指令：** 人工 M-01（乾淨 Windows）；`npm run typecheck`、`npm run lint`、`npm test`

**要讀的規格段落：** `docs/05-sds.md` 打包契約；`docs/04-sad.md` 風險表；`docs/03-srs.md` FR-08、NFR-05

## 驗收條件

- [x] **執行 `tauri build` 之前，先查證並向專案擁有者說明 NSIS 工具的下載與寫入位置，取得同意後才執行**（`CLAUDE.md` 3.3）。已說明（見末段「S-02 查證」），專案擁有者選 A 並在 2026-11-05 明確同意執行建置。
- [x] 打包設定新增 NSIS 目標；WebView2 採 `downloadBootstrapper`，**先對照 Tauri 官方文件確認設定值**（SDS 標為未驗證）。已改 `tauri.conf.json`：`targets` 加 `nsis`、`useLocalToolsDir: true`、`webviewInstallMode.type = downloadBootstrapper`；值已對照官方文件與本機 CLI 2.12.4 的 schema（預設值即此）。已實際建置：Windows 上的 `app` 目標沒有造成錯誤（見實作紀錄）。
- [x] M-01：乾淨 Windows 安裝、啟動、建立工作區、完成 AC-01.1 的流程、解除安裝；解除安裝後工作區資料夾與檔案仍在。記錄環境版本與證據。**2026-11-07 專案擁有者口頭回報通過**；環境依其指定為本機：Windows 10 專業版 22H2（10.0.19045），日期 2026-11-07。我沒有親眼看到操作，沒有逐步截圖，也沒有記安裝檔雜湊；此機器是開發機，不一定符合「乾淨」。
- [x] Windows 10 1803：**專案擁有者於 2026-11-07 指示記為通過。** 註記：實際驗證環境是 22H2（19045），不是 1803；1803 本身沒有環境測過，本票原規定「沒有環境記為未驗證」，此處依擁有者決定記錄，不代表在 1803 上實測。
- [ ] README 步驟能被他人照做（Windows 段落已寫成草稿，**未在乾淨機器上照做過**）；建置產物不進版控（已確認：`src-tauri/target` 被 `.gitignore` 排除）。

共同規則（先讀）：[`issues/README.md`](README.md)。

## S-02 查證（2026-11-05；只讀文件與原始碼，**沒有執行 `tauri build`**，沒有安裝或下載任何東西）

給專案擁有者決定的事實與選項。來源：Tauri 官方 Windows 安裝程式文件（v2.tauri.app/distribute/windows-installer，最後更新 2026-10-16）、tauri-bundler 原始碼（GitHub `dev` 分支的 `nsis/mod.rs` 與 `util.rs`）、本機 `@tauri-apps/cli` 2.12.4 的 `config.schema.json`。

**事實**
- 官方文件**沒有**寫 NSIS 工具的下載或快取位置。位置來自原始碼：預設為「使用者的快取資料夾」下的 `tauri/NSIS`（`dirs::cache_dir()` 加 `tauri`，再加 `NSIS`）。Windows 上 `cache_dir()` 預期是 `%LOCALAPPDATA%`，也就是 C 槽；這一步是我依 `dirs` 套件的慣例推得，**沒有讀到該套件的原始碼**。本機 `%LOCALAPPDATA%/tauri` 目前不存在，代表還沒有下載過。
- 會下載兩樣東西：`nsis-3.13.zip`（`github.com/tauri-apps/binary-releases`）與 `nsis_tauri_utils.dll`（`github.com/tauri-apps/nsis-tauri-utils`）。原始碼內有 SHA-1 比對；下載與解壓縮的細節（`http_utils`）我**沒有讀**，下載大小**未知**。
- 設定 `bundle.useLocalToolsDir: true` 後，工具改快取在 `target/.tauri/`（本機 schema 已確認這個鍵存在，布林、預設 `false`，說明文字寫明 `target/.tauri/`）。本專案的 `src-tauri/target` 在 D 槽、已被 `.gitignore` 排除。環境變數沒有可以改位置的（`NSIS_PATH` 只在 Linux／macOS 用）。
- 中間產物在 `<輸出目錄>/nsis/<arch>`，安裝檔在 `<輸出目錄>/bundle/nsis/`，都在專案內。
- 使用 `downloadBootstrapper`（預設值）時，WebView2 是**安裝時**由使用者的電腦連網下載，建置時不下載；需要網路，安裝檔較小。
- 安裝檔預設安裝給目前使用者（`%LOCALAPPDATA%`，不需系統管理員）；`perMachine` 與 `both` 需要系統管理員。那是使用者電腦上的安裝位置，與開發工具位置無關。
- 文件**沒有**「最低 Windows 版本」的設定鍵；只有 `minimumWebview2Version`（不是作業系統版本）。SRS 的「Windows 10 1803」要靠 WebView2 與 README 說明，**不是設定檔能強制**。文件也沒提 SmartScreen。
- 限制：原始碼是 `dev` 分支，不是本機 CLI 2.12.4 或 tauri 2.12.5 的釘選版本，行為可能有差；實際位置要在第一次建置後用檔案系統確認。

**選項**
- **A（建議）**：在 `tauri.conf.json` 設 `bundle.useLocalToolsDir: true`，工具進 `src-tauri/target/.tauri/`（D 槽）。預期沒有 C 槽寫入，但 bundler 的暫存或其他寫入**未驗證**；建置後檢查 `%LOCALAPPDATA%/tauri` 是否出現，出現就停下回報。
- **B**：接受工具放 C 槽（`%LOCALAPPDATA%/tauri/NSIS`），不改設定。簡單，但違反 CLAUDE.md 3.2 的 D 槽偏好，需要你明確同意。
- **C**：不做 NSIS 安裝檔，只出免安裝 .zip。不符合 AC-03.1／FR-08，需先改規格。

**需要你決定**：選 A、B 或 C。選 A 時，我會先改設定、跑 `tauri build`，並在前後比對 `%LOCALAPPDATA%/tauri` 是否被建立；仍然需要你同意才執行建置（AGENTS.md 規則 15）。

**決定紀錄（2026-11-05）**：專案擁有者選 A。已改設定；`tauri build` 尚未執行，執行前會再次詢問（規則 15）；建置前後比對 `%LOCALAPPDATA%/tauri`，出現就停下回報。

## 實作紀錄與偏差（2026-11-05）

- 這張票沒有可寫成自動測試的業務行為：成果是打包設定、README 與人工驗收（M-01）。所以沒有做紅燈到綠燈的循環，也沒有新增測試；驗收指令 `typecheck`、`lint`、`npm test`（27 檔 314 passed）本輪 Passed，只代表沒有破壞既有程式。
- 設定（`src-tauri/tauri.conf.json`）：`bundle.targets` 為 `["app", "nsis"]`、`bundle.useLocalToolsDir: true`、`bundle.windows.webviewInstallMode.type: downloadBootstrapper`。
- 建置（2026-11-05，Windows 11，CLI 2.12.4、tauri 2.12.5、Rust 1.90.0，專案擁有者已同意）：`npx tauri build --bundles nsis` exit 0；產物 `src-tauri/target/release/bundle/nsis/Juicy Calendar_0.1.0_x64-setup.exe`（2,171,263 位元組，SHA-256 `2b7eeef6957730609bc9ae42ec286652b135e0398f73abd156e7283f4171b0fa`，未簽章）。
- 工具位置實測：NSIS 工具在 `src-tauri/target/.tauri/NSIS`（約 7.9 MB，D 槽）；建置前後 `%LOCALAPPDATA%/tauri` 都**不存在**。日誌顯示 `nsis-3.13.zip` 與 `nsis_tauri_utils.dll` 都經雜湊驗證。
- 偏差（已解除疑慮）：SDS 打包契約只寫新增 `nsis`；設定仍保留 `app`（macOS 用），在 Windows 上被略過、沒有報錯。
- 傳送給乾淨機器測試：已上傳到私有 repo 的 draft 預發布版（`v0.1.0-m01-test`，只有擁有者看得到；附件雜湊與本機一致）。該 draft 的 tag 目標是 `main`，不含本次 commit；測完建議刪除。
- **未驗證**：①M-01（乾淨 Windows 安裝、啟動、建立工作區、完成 AC-01.1、解除安裝、確認工作區資料夾仍在）；②Windows 10 1803（可能無環境，須記為「未驗證」）；③安裝時 WebView2 的下載行為（只讀過設定，沒實測；新電腦若已有 WebView2 也無法驗證）；④這個 release 版從未執行過；⑤SmartScreen 的實際畫面與 README 描述的按鈕名稱；⑥解除安裝是否保留工作區（README 寫的是預期）；⑦預設安裝位置（依官方文件為目前使用者的 `%LOCALAPPDATA%`，未實測）；⑧文件沒有「最低 Windows 版本」設定鍵，1803 的下限無法由設定強制。
- README 上兩處過時敘述（「只在 macOS 跑過」、「兩個視窗未協調」）本票未動，待專案擁有者決定是否順手修正。
- 2026-11-06：README 兩處過時敘述已改（「只在 macOS 跑過」改為 Windows 10／11 曾啟動、安裝檔未在乾淨機器試過、1803 未驗證；「兩個視窗未協調」改為第二視窗會被擋，目前只有自動測試驗證）。人工步驟清單見 `docs/evidence/manual-checklist-m01-m06-m08.md`。M-01 仍為未執行。
