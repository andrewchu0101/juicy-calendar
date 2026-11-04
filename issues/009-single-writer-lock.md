# 009：單一寫入者：第二個視窗被擋

**大小：** L　**狀態：** 實作完成、自動測試通過（2026-11-04）；人工驗收（兩個真實 App 行程）尚未做

**成果（What to build）：** 同一個工作區資料夾同時只有一個視窗能開啟。第二個視窗看到說明、無法進入，且過程不寫入任何使用者資料；原視窗關閉或被強制結束後，資料夾可以再次被開啟。

**Blocked by：** 006、007

**對應 TC／人工：** TC-09、TC-10（路徑與空資料夾部分）；AC-02.3、FR-07；U-05

**驗收指令：** `npm run test:rust`、`npm run typecheck`、`npm run lint`、`npm test`；人工：在 Windows 開兩個 App 行程指向同一資料夾

**要讀的規格段落：** `docs/04-sad.md` ADR-01；`docs/05-sds.md` API-01、API-02、API-03 與 `workspace_lock` 契約；測試計畫 TC-09、TC-10

## 驗收條件

- [x] 先寫 TC-09 的雙行程測試並看到紅燈。（紅燈：`left: Ok(()) right: Err(WorkspaceLocked)`，用不取鎖的空殼取得。）
- [x] 行程 A 取鎖成功；行程 B 回傳 `WORKSPACE_LOCKED`，`.juicy.lock` 的大小與修改時間不變、沒有新增任何檔案、其餘檔案雜湊不變；強制結束 A 後，B 再試成功。
- [x] 同一行程再次選擇目前已開啟的資料夾，回傳目前位置，不被自己擋住。
- [x] 取鎖失敗時，原本開啟的工作區維持開啟，`last-workspace.txt` 不變（取鎖在記住上次工作區之前）。
- [x] 判斷「資料夾是否為空」時忽略 `.juicy.lock`；`.juicy.lock` 與其他新檔案**不在**前端的路徑允許清單，並有 Rust 測試證明。
- [x] 畫面顯示「此工作區已在另一個視窗開啟」的說明（文字暫來自票 007 的對照表）。（本票未改前端：票 007 已有英文對照與 `workspaceSession` 測試，`WORKSPACE_LOCKED` → `openError`。**未在真實畫面看過**；中文版屬票 012。）
- [x] 使用 Rust 標準函式庫的檔案鎖，不新增套件。（`File::try_lock`；需 Rust 1.89+，依賴 tauri 2 要求 1.90，故專案改釘 1.90.0。）

## 備註

單一票涵蓋 Rust 取鎖、`activate()` 流程、前端說明與雙行程測試；拆開後各半都無法單獨驗證，所以維持一張。檔案鎖在雲端同步資料夾與網路磁碟的行為未實測，不在本票範圍。

## 實際偏差與限制（2026-11-04）

- **Rust 版本**：新增 `rust-toolchain.toml`（1.90.0）、`Cargo.toml` 的 `rust-version` 由 1.77 改 1.90、`CLAUDE.md` 設定表更新；本機另裝 1.90.0 到 `D:\DevTools\rust\rustup`。經專案擁有者同意（原票不含）。
- **`activate()` 重構**：抽出 `activate_in(state, last_workspace_file, root)` 才能單元測試；`WorkspaceState` 改持有 `OpenWorkspace { root, lock }`。取鎖在 `remember` 之前，舊鎖在換 state 時才釋放。
- **TC-09 測試輔助**：Windows 不允許讀取被其他行程鎖定的檔案，所以快照對 `.juicy.lock` 只比對大小與修改時間（並斷言為空檔），其他檔案仍比對位元組。
- **未涵蓋**：真實兩個 App 行程的人工驗證；`JUICY_SMOKE_WORKSPACE` 除錯路徑不取鎖（沒有改，避免動到 `test:desktop`）；`workspace_select`／`workspace_restore` 命令本身。

共同規則（先讀）：[`issues/README.md`](README.md)。
