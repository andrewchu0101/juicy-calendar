# HANDOFF —— Juicy Calendar 交接紀錄

## 摘要（每次覆寫這一段）

| 項目 | 內容 |
|---|---|
| 更新時間 | 2026-11-04（票 001 完成，未 commit） |
| 目前目標 | 把一次性 demo 接手成「依 template 流程開發」的專案；下一步補文件（Brief → PRD → SRS …） |
| 工作目錄 | `D:\Project\Fun\juicy-calendar\juicy-calendar` |
| 分支／HEAD | `main` ／ 尚無 commit（已 `git init`，無遠端） |
| 工作樹 | 全部為未追蹤檔案（尚未 commit）。原 demo 在 `..\juicy-calendar-oneshotted-demo`，未動，仍是 git repo（`main`，24 個未提交修改） |

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
3. 審查 `docs/04-sad.md`、`docs/05-sds.md`、`docs/06-test-plan.md`（草稿；待決 S-01、S-02、Q-05、NFR-01 的重複次數 N）；拆票已完成（`issues/` 共 21 張，`issues/README.md` 有索引與依賴圖）；可立即開始的票：000、001、002、006、018，每張票另開新對話，用 `/implement` 與 `/tdd`。Brief、PRD、SRS 已確認，三張流程圖已產出於 `diagrams/`。

### 狀態核對

| 面向 | 狀態 | 說明 |
|---|---|---|
| 已實作 | 部分 | demo 功能已在；本輪沒有改任何功能碼 |
| 自動測試 | 部分 Passed | 見上；e2e 9 項 Failed；desktop-smoke Not Run |
| 人工驗收 | Manual Pending | 從未人工驗收桌面版 |
| 已 commit | 否 | 新資料夾沒有 git |
| 已 push | 否 | |

### 接手者要先知道
- 跑 e2e 前要在該程序設 `PLAYWRIGHT_BROWSERS_PATH=D:\DevTools\playwright-browsers`；沒設會找 C 槽、報 `Executable doesn't exist`（已驗證）。安裝同理：`npx playwright install webkit` 前先設。
- `PRODUCT.md`／`DESIGN.md`／`ARCHITECTURE.md` 是 demo 作者的描述，不是人確認過的規格。
- Rust 不在 PATH。執行 `test:rust`／`desktop` 前，在該程序設：`RUSTUP_HOME=D:\DevTools\rust\rustup`、`CARGO_HOME=D:\DevTools\rust\cargo`、PATH 加 `D:\DevTools\rust\cargo\bin`。
- README 仍寫「只跑過 macOS」，尚未更新。
