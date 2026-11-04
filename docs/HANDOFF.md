# HANDOFF —— Juicy Calendar 交接紀錄

## 摘要（每次覆寫這一段）

| 項目 | 內容 |
|---|---|
| 更新時間 | 2026-11-04（票 008 完成並已 commit，未 push；稍晚票 010 完成後一起 push） |
| 目前目標 | 把一次性 demo 接手成「依 template 流程開發」的專案；下一步補文件（Brief → PRD → SRS …） |
| 工作目錄 | `D:\Project\Fun\juicy-calendar\juicy-calendar` |
| 分支／HEAD | `main` ／ `9589e5e`（票 008），領先 `origin/main` 1 個 commit，未 push |
| 工作樹 | 乾淨（2026-11-04 票 008 commit 後 `git status` 無變更）。原 demo 在 `..\juicy-calendar-oneshotted-demo`，未動，仍是 git repo（`main`，24 個未提交修改） |

### 已完成
- 複製 template 骨架，併入 demo 原始碼（排除 `.git`、`node_modules`、`dist`、`real-test`、`src-tauri/target`）。
- 新增 `AGENTS.md`（safe 範本 + demo 的 8 條專案規則）；`CLAUDE.md` 加 `@AGENTS.md`；`.gitignore` 合併 template 的秘密規則。
- 安裝 Rust 1.99.1 到 `D:\DevTools\rust`（下載在 `D:\DevCache\rust`，SHA-256 已核對；只用程序層級環境變數，未改 PATH；C 槽無 `.cargo`/`.rustup`）。
- 測試基準線（2026-11-03，Windows 11，node 24.22.0）：
  - `npm run typecheck` Passed；`npm run lint` Passed
  - `npm test` Passed（3 files, 48 tests）
  - `npm run test:rust` Passed（5 tests）
  - `bash .maintain/check.sh` Passed（5 項）
  - `npm run test:e2e` **不穩定**：同一份程式碼三次結果 20 passed/9 failed、9 passed/20 failed、`--workers=1` 6 passed/23 failed（見阻塞）

- 票 001（2026-11-04）：`e2e/core.spec.ts` 的 `dragBall` 改為放開前等待拖曳狀態與放置預覽；TC-01／TC-02 已標註。`test:e2e` 連續 3 次皆 29/29 通過（修復前 22／9／16）；`typecheck`、`lint`、`npm test`（48）Passed。未改產品程式與斷言。`dragFromTo`（移動／調整）未改，但 3 次皆綠。

- 票 002（2026-11-04，未 commit）：新增 `src/test-support/workspaceFixture.ts`（測試專用 fixture 建構器：格式版本 2、6 模板、可附加事件與壞檔）與 `src/services/persistence/reopen.test.ts`（TC-06、AC-02.1、FR-05）。`typecheck`、`lint` Passed；`npm test` 49/49 Passed；`npm run build` 的 `dist` 檔名與大小與先前完全相同、無 fixture 內容。未改產品程式。未跑 test:rust、test:e2e（與本票無關）。

- 票 003（2026-11-04，未 commit）：新增 `src/features/calendar/engine/limits.ts`（`NAME_MAX_CHARS` 30、`EVENT_MIN_MINUTES` 1、`EVENT_MAX_MINUTES` 10080、`NEW_EVENT_MINUTES` 120 的唯一來源，`MIN_EVENT_MINUTES` 改名為 `EVENT_MIN_MINUTES`）；引擎新增 `validateTitle`（`Intl.Segmenter` 計 grapheme）；`appStore.updateEvent`／`saveTemplate` 改為在 store 驗證並回傳 boolean（拒絕時資料不變、不進佇列）；`EventBlock`、`Inspector`、`TemplateEditor` 接上同一條規則。測試：`validateTitle.test.ts`（11）、`stores/nameLimit.test.ts`（9）、e2e 3 項。`typecheck`、`lint` Passed；`npm test` 69/69；`test:e2e` 32/32（另有 1 次 TC-02 間歇失敗）。未跑 `test:rust`（未改 Rust）。`EVENT_MAX_MINUTES` 目前只定義、尚未被使用（票 004、005 才套用上下限）。

- 票 004a（2026-11-04，未 commit，插入任務）：修正 Escape 取消拖曳後放置預覽殘留的競態（`useTemplateDrag.ts` 加 `activeRef`，取消後遲到的 `move` 忽略），並把 TC-02 e2e 補強（雜湊、球可再次拖曳）。證據與數字見 LESSONS、追溯表。`typecheck`、`lint` Passed；`npm test` 69/69；TC-02 負載下 120/120。**完整 e2e 連續 3 次仍不一致**：第 2 次 magnet 測試失敗（既有，有無修正都約 1/40，與本修正無關，未處理）。

- 票 005（2026-11-04，未 commit）：`resizeStart`／`resizeEnd` 加 `EVENT_MAX_MINUTES`（經過時間）上限，改動僅 `engine/mutations.ts`；新增 `resizeBounds.test.ts`（TC-05 單元 4 項）與 `e2e/core.spec.ts` 2 項 TC-05 e2e（含變異檢查）。`typecheck`、`lint` Passed；`npm test` 73/73。完整 e2e 3 次 33／33／34 passed，各有 1 項不相關間歇失敗（overlapping、weekly/daily，見 LESSONS）。發現面板持續分鐘欄無 7 天上限，歸票 004；新增票 021（小時＋分鐘輸入，未就緒）、票 022（e2e 間歇失敗，可開始）。同時依實測勾選票 001（除「3 次一致」）、002、003 的驗收條件；004 未勾。

- 票 006（2026-11-04，已 commit，未 push）：Rust 命令錯誤由英文句子改為 `{code, detail}`（新 `src-tauri/src/error.rs`：`ErrorCode`、`IpcError`；`fs_safe::resolve`、`lib.rs` 全部命令改回傳 `IpcError`；`choose_root` 從 `workspace_select` 抽出以便測試）。前端新增 `services/persistence/backendError.ts`（Zod 驗證、`BackendError`），`backend.ts` 的每個 `invoke` 經 `call()` 轉換。`BackendError.message`／`String(error)` 暫為舊英文句子（`detail` 不顯示），票 007 換成集中對照表、票 012 換成字典後移除。`serde_json = "1"` 經同意加入 `[dev-dependencies]`。測試：`typecheck`、`lint` Passed；`npm test` 93/93；`test:rust` 9/9（原有 5 + 新增 4）；`test:desktop` Passed。**偏差**：`IO_ERROR` 畫面文字改為固定句子，不再顯示系統訊息。**未驗證**：symlink／跳出工作區的 `PATH_NOT_ALLOWED` 僅 unix 測得到；`test:desktop` 只確認被拒絕、未確認代碼；`test:e2e` 未跑；人工驗收未做。

- 票 007（2026-11-04，已 commit 並 push）：`issues`、`openError`、`saveError` 由字串改為結構。`WorkspaceOpenError` 帶 `code`（`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`、`WORKSPACE_TOO_NEW` 含 `version`）；`issues` 為 `FILE_SKIPPED {file, detail}`／`SETTINGS_RESET`；store 的 `openError`（另有 `WORKSPACE_LOCKED`、`NOT_A_WORKSPACE`、`OPEN_FAILED` 含 `detail`）與 `saveError`（`SAVE_FAILED`）存代碼。新增 `src/services/notices/notices.ts`：型別與**唯一**英文對照表（票 012 取代它），`Notices`、`WelcomeScreen` 依代碼顯示，`BackendError.message` 改讀此表。測試：`openErrors.test.ts`（TC-08 三情境含雜湊不變、`FILE_SKIPPED`、`SETTINGS_RESET`）、`workspaceSession.test.ts`、`saveError.test.ts`、`notices.test.ts`。`typecheck`、`lint` Passed；`npm test` 109/109；`test:e2e` 單次 34/34（含 magnet，本次未失敗，未跑 `--repeat-each`，不代表已修）。**偏差**：`saveError`、`OPEN_FAILED` 畫面不再附加診斷句；`WorkspaceOpenError.message` 仍是英文（非畫面文字）；`FILE_SKIPPED` 的「長度或名稱」原因目前歸在 `invalid content`。**未驗證**：真實磁碟與 Tauri 桌面版、`test:rust`（未動 Rust）、NFR-01 連續 3 次 e2e、人工驗收。追溯：`docs/06-test-plan.md` 第 224 列已回填；票 007 驗收條件已勾選（含偏差註記）。

- 票 008（2026-11-04，已 commit `9589e5e`，未 push）：`eventSchema` 加長度 ≤ `EVENT_MAX_MINUTES` 與名稱規則，`templateSchema` 加名稱規則（皆引用 `limits.ts`／`validateTitle`）；`skipReason` 改用 zod 的訊息，通知原因可區分。新增 `loadRules.test.ts`（TC-07，七種壞檔 × 載入與編輯後，共 14 項；(g) 模板名稱 31 字經專案擁有者同意列入）。紅燈 3 失敗／11 通過，綠燈後 `npm test` 123/123、`typecheck`、`lint` Passed；`test:e2e` 第 1 次 33/34（既有間歇項 `overlapping events…`，單獨重跑通過），重跑 34/34。**未驗證**：Rust 真實磁碟載入、桌面版手動開啟版本 2 樣本資料夾。

### 進行中
- 無。

### 阻塞
- **e2e 不穩定的原因已查出（2026-11-04，尚未修）**：`e2e/core.spec.ts` 的 `dragBall` 在最後一次 `mouse.move` 後立刻 `mouse.up()`。dnd-kit 的拖曳啟動要等 React 狀態提交，約 100 ms 後 `ball-dragging-source` 才出現；`mouse.up()` 若早於此，`onDragEnd` 拿不到 active，就不會建立事件。證據：獨立腳本每組 5 次，放開前等 0 ms → 0/5 建立事件；等 50／200／500 ms → 皆 5/5。完整測試時各測試的耗時與機器負載不同，所以失敗數每次都不一樣（9／20／23）。已排除：沒有殘留 server、`isPrimary`／`button` 正常、沒有 blur／resize／visibilitychange 取消、沒有 console 錯誤、載入後多等 3 秒無改善。
  - 判斷：測試端的時序問題。人類操作放開前通常超過 50 ms，不受影響；但快速甩動加上慢速機器是否會漏建事件，尚待人確認。
  - 建議修法（待你同意）：在 `dragBall` 的最後一次移動後，等到 `drop-ghost` 出現（`expect(page.getByTestId('drop-ghost')).toBeVisible()`）再 `mouse.up()`。這是確定性等待，不是加 sleep，也不放寬任何斷言。
- 票 000 結果（2026-11-04，Windows 11）：`typecheck`、`lint`、`npm test`（48）、`test:rust`（5）皆 Passed；`npm run test:desktop` 在 Windows（Git Bash）**Passed**（建立工作區、拖放後 10:30–12:30、關閉後重開事件仍在、越界寫入被拒）；`npm run desktop` 視窗出現，Vite `http://localhost:1420` 回 200。人工操作驗收（建立工作區、關閉、重開還原）**Manual Pending**。追溯：`docs/06-test-plan.md` G-03 列。未修改任何產品程式。
- Playwright WebKit 已重裝到 `D:\DevTools\playwright-browsers`（實體檔案，175 MB），C 槽 `ms-playwright` 已刪除（那是 2026-11-03 我自己裝的）。

### 下一步（最多三項）
1. 用 `/diagnosing-bugs` 查 9 個 e2e 失敗的原因（先分環境／測試／實作）。
2. 試 `npm run desktop`（Edge WebView 156 已在本機）。
3. 審查 `docs/04-sad.md`、`docs/05-sds.md`、`docs/06-test-plan.md`（草稿；待決 S-01、S-02、Q-05、NFR-01 的重複次數 N）；拆票已完成（`issues/` 共 21 張，`issues/README.md` 有索引與依賴圖）；票 008 已完成，下一張依 `issues/README.md` 建議順序為 009／010；其他可開始的票：018、022，每張票另開新對話，用 `/implement` 與 `/tdd`。Brief、PRD、SRS 已確認，三張流程圖已產出於 `diagrams/`。

### 狀態核對

| 面向 | 狀態 | 說明 |
|---|---|---|
| 已實作 | 部分 | demo 功能已在；本輪沒有改任何功能碼 |
| 自動測試 | 部分 Passed | 見上；e2e 9 項 Failed；desktop-smoke Not Run |
| 人工驗收 | Manual Pending | 從未人工驗收桌面版 |
| 已 commit | 是（到票 008，`9589e5e`） | |
| 已 push | 到票 007 | 票 008 的 commit 尚未 push，等票 010 一起 |

### 接手者要先知道
- 跑 e2e 前要在該程序設 `PLAYWRIGHT_BROWSERS_PATH=D:\DevTools\playwright-browsers`；沒設會找 C 槽、報 `Executable doesn't exist`（已驗證）。安裝同理：`npx playwright install webkit` 前先設。
- `PRODUCT.md`／`DESIGN.md`／`ARCHITECTURE.md` 是 demo 作者的描述，不是人確認過的規格。
- Rust 不在 PATH。執行 `test:rust`／`desktop` 前，在該程序設：`RUSTUP_HOME=D:\DevTools\rust\rustup`、`CARGO_HOME=D:\DevTools\rust\cargo`、PATH 加 `D:\DevTools\rust\cargo\bin`。
- README 仍寫「只跑過 macOS」，尚未更新。
