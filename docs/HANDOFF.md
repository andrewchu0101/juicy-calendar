# HANDOFF —— Juicy Calendar 交接紀錄

## 摘要（每次覆寫這一段）

| 項目 | 內容 |
|---|---|
| 更新時間 | 2026-11-05（票 004、004a 補完：面板時間規則與 TC-02 碎片斷言；**未 commit**） |
| 目前目標 | 依 `issues/` 的工作票逐張實作。票 022（e2e 間歇失敗）完成，NFR-01「連續 3 次清單相同」達成（N=3 仍暫定）。票 020（radial hover）先前完成。下一張預計 021，但它被 004 擋住（見「下一步」）；025、026 為新增的未就緒票（等專案擁有者決定）。 |
| 工作目錄 | 這台電腦（第二台，無 D 槽）：`C:/Users/student/Project/juicy-calendar`；另一台為 `D:/Project/Fun/juicy-calendar/juicy-calendar` |
| 分支／HEAD | `main` ／ 票 020 的 commit（`git log -1` 查雜湊）；上一個已知 HEAD 為 `7e9a6be`（票 019）。本輪**未 push**，以 `git status` 核對，不要只信這一行 |
| 工作樹 | commit 後應為乾淨（以 `git status` 核對）。原 demo 在 `../juicy-calendar-oneshotted-demo`，未動 |

### 已完成
- 票 004 面板時間規則＋票 004a 補完（2026-11-05，**未 commit**）：`engine/mutations.ts` 的 `withEndTime`（結束套在結束目前的日期，嚴格晚於開始且 ≤ 10080，不再當隔天）、`withDuration`（先判輸入範圍再四捨五入）、`withDate`（往返比對，拒絕 `2026-02-30`）。新增 `panelInputs.test.ts`（TC-04，38 項；紅燈 11 項，原因皆為「預期 null」）與 e2e `[TC-04]`（舊引擎紅、新引擎 40/40）；TC-04 表格經同意補列。修訂既有測試一條：`engine.test.ts › applies inspector edits` 的 `withEndTime(base,'01:00')` 由隔天改為 `null`（依 SRS R-3、PRD Q-04）。票 004a 補完：TC-02 e2e 斷言碎片 18 個且動畫後透明度 0，突變轉紅。`typecheck`、`lint` Passed；`npm test` 384 passed；完整 e2e 連續 3 次皆 64 passed、清單相同；TC-04／TC-02 `--repeat-each=40 --workers=8` 皆全過。**未驗證**：人工操作面板；`type=date` 不存在日期只在單元層；`test:rust`、`test:desktop` 本輪未跑（未改 Rust）。**下一步**：票 021 現在不再被 004 擋住，但仍未就緒（待專案擁有者回答，見票內）。
- 票 022 e2e 間歇失敗（2026-11-05，已 commit，未 push）：原因是 `dragBall` 在預覽還停在中途點時放開（測試輔助函式競態，產品無誤）。修法在 `e2e/core.spec.ts`：放開前輪詢 `drop-ghost` 的 `y` 與目標差 ≤ `MAGNET_PX`（8），最後一段改單步移動；新增紅燈測試 `… slow drag …`（注入腳本延後 React 提交，修正前約 20～30% 紅，修正後 30/30；容差放寬突變 7/30 轉紅）。`--repeat-each=40 --workers=8`：overlapping 2／0／3→0／0、magnet 3／4→0／0、weekly and daily 0／0→0／0；完整 e2e 連續 3 次皆 63 passed、清單相同；`typecheck`、`lint` Passed、`npm test` 346 passed。已勾票 001「3 次一致」、票 004a 最後一項。**未驗證**：weekly and daily 基線未重現（歸為同因的推定）；macOS／Tauri 桌面版未跑；票 013 的 `moving stays correct after scrolling the calendar` 單次失敗仍未歸類（LESSONS）。細節見 `issues/022-e2e-intermittent-failures.md` 末段與 LESSONS。
- 複製 template 骨架，併入 demo 原始碼（排除 `.git`、`node_modules`、`dist`、`real-test`、`src-tauri/target`）。
- 新增 `AGENTS.md`（safe 範本 + demo 的 8 條專案規則）；`CLAUDE.md` 加 `@AGENTS.md`；`.gitignore` 合併 template 的秘密規則。
- 安裝 Rust 1.99.1 到 `D:\DevTools\rust`（下載在 `D:\DevCache\rust`，SHA-256 已核對；只用程序層級環境變數，未改 PATH；C 槽無 `.cargo`/`.rustup`）。
- 測試基準線（2026-11-03，Windows 11，node 24.22.0）：
  - `npm run typecheck` Passed；`npm run lint` Passed
  - `npm test` Passed（3 files, 48 tests）
  - `npm run test:rust` Passed（5 tests）
  - `bash .maintain/check.sh` Passed（5 項）
  - `npm run test:e2e` **不穩定**：同一份程式碼三次結果 20 passed/9 failed、9 passed/20 failed、`--workers=1` 6 passed/23 failed（見阻塞）

- 票 009（2026-11-04，未 commit）：新增 `src-tauri/src/workspace_lock.rs`（`acquire` 用 `File::try_lock`，`.juicy.lock` 不截斷）；`lib.rs` 的 `activate_in` 先取鎖再 `remember`，同資料夾（正規化後）不重鎖；`fs_safe::new_workspace_dir` 忽略 `.juicy.lock`。Rust 改釘 1.90.0（`rust-toolchain.toml`、`Cargo.toml` rust-version 1.90；本機已裝 1.90.0，1.99.1 仍在）。`test:rust` 15 passed、`typecheck`／`lint` Passed、`npm test` 123 passed。**人工驗收未做**（兩個真實 App 行程；不能用真實 `last-workspace.txt`，需另想隔離做法）；`JUICY_SMOKE_WORKSPACE` 路徑未取鎖（是否補鎖待專案擁有者決定，補了會影響 `test:desktop`）；`test:e2e`、`test:desktop` 本票未跑。
- 票 010（2026-11-04，已 commit）：新增 `src/i18n/`（`detectLanguage`、`dictionary`、`i18n` store 含 `initLanguage`／`setLanguage`／`translate`、`useT`）；`WorkspaceBackend` 加 `readAppSettings`／`writeAppSettings`／`systemInfo`（瀏覽器版用 `localStorage` 與 `navigator`，Tauri 版呼叫新命令）；Rust 新增 `app_settings.rs`、`platform_win.rs`（`system_locale`，unsafe 只在此）並在 `lib.rs` 註冊 `app_settings_read`／`app_settings_write`／`system_info`；歡迎畫面有語言選單、完整翻譯、儲存失敗的紅底錯誤。`typecheck`、`lint` Passed；`npm test` 181 passed；`test:rust` 23 passed；`test:e2e` 44 passed；`test:desktop` Passed。偏差與未驗證見 `issues/010-i18n-foundation.md` 末段與追溯表 AC-03.2 列。**未驗證**：桌面版實際寫入 `%APPDATA%\app.juicycalendar.timeblock\app-settings.json`（需同意）；日曆畫面沒有語言選單；`serde_json` 搬到正式依賴（已同意）。

- 票 019 排版（2026-11-05，未 commit）：新增 `e2e/layout.spec.ts`（6 項）；改 `TemplatePalette.tsx`（`li` 加 `w-full min-w-0`）、`AppShell.tsx`（日曆區加 `relative` 容器）、`Inspector.tsx`（面板與展開鈕改 `top-2 right-4`）。`typecheck`／`lint` Passed、`npm test` 340 passed、`test:e2e` 59 passed。截圖在 `docs/evidence/`。**未驗證**：M-04 人工；Windows WebView2 的實際字體。細節見 `issues/019-adaptive-layout.md` 末段。

- 票 018 離線靜態檢查（2026-11-05，未 commit）：新增 src/offline/offline.test.ts（19 項，TC-15）與 src/test-support/cspCheck.ts、networkCalls.ts；CSP 只允許 ipc，src 沒有對外呼叫；變異檢查已做並還原；M-06 監看流程寫進 docs/06-test-plan.md（PowerShell 內建指令，未正式執行）。**重大發現**：預跑 5 次嘗試、3 次有效，WebView2 的 msedgewebview2.exe 在 App 啟動後約 3 秒內對非本機位址的 443 連線（不是我們的程式碼）。NFR-03 已在 SRS 拆成 03a（功能可離線）、03b（App 自有程式與依賴不主動連線，前端部分已過）、03c（包含 WebView2 的整個行程樹零連線，**未達成**，不得宣稱完全不連網）；後續調查見票 024，結論由專案擁有者決定（SRS U-13）。測試一律正常關閉 App，強制結束會留下孤兒 WebView2 行程。細節見 issues/018-offline-static-check.md 末段。

- 票 017 免安裝 .zip 組裝腳本（2026-11-05，未 commit）：新增 scripts/make-portable-zip.mjs（bsdtar 壓縮、輸出 src-tauri/target/portable）與 TC-14 七項測試，vitest include 加 scripts；用法 npx tauri build --no-bundle 後 node scripts/make-portable-zip.mjs；實機從 zip 解壓啟動 release 版，data 建立成功。未驗證：M-02 人工流程、乾淨機器、README.txt 審閱。細節見 issues/017-portable-zip.md 末段。

- 票 015 免安裝模式（2026-11-05，未 commit）：S-01 決定採用 portable.flag（啟動一律開 data、App 設定始終在 data、data 無法使用時顯示明確錯誤且不改存別處、外部工作區不在整包帶走承諾內）。新增 portable.rs、restore_portable、錯誤代碼 PORTABLE_DATA_UNAVAILABLE（前端 Zod、字典兩種語言、workspaceSession）；SRS FR-11 的「刪除資料夾即移除」改為「即可移除程式與其中的使用者資料」。typecheck、lint Passed；npm test 314 passed；test:rust 43 passed；test:desktop Passed；debug 執行檔實機驗證第一次啟動、複製資料夾再啟動。未驗證：M-02 人工流程、release 版與 zip（票 017）、錯誤畫面實機文字、WebView2 快取位置、test:e2e 本輪未跑。細節見 issues/015-portable-mode.md 末段。

- pre-commit 控制字元檢查（2026-11-04）：新增 `.githooks/pre-commit`（只檢查本次 commit 暫存的內容：文字檔不得有控制字元、`.md` 不得有 Tab、文字副檔名不得含 NUL）與回歸規格 `.githooks/test-pre-commit.sh`（17 項；先紅後綠，4 種突變都會變紅；真實 repo 端到端驗證過被擋）。`.maintain/check.sh` 會跑它，`.maintain/check-hooks.sh` 檢查已啟用；`AGENTS.md` 規則 16 與「怎麼跑」已補說明。**每個新 clone 要執行一次 `git config core.hooksPath .githooks`**（存在本機 `.git/config`，不隨 repo 傳出）。其他系統 clone 若 hook 沒觸發，commit 時加 `--chmod=+x`。**下一個 session 從票 011（翻譯日曆與工具列）開始**，開工前先讀 `AGENTS.md`、`CLAUDE.md`、`docs/LESSONS.md` 與本檔。

- 與 demo 去耦合（2026-11-04）：專案與 demo 的 Tauri `identifier` 相同（`app.juicycalendar.desktop`）、開發埠同為 1420 且 `strictPort`，會共用 `%APPDATA%` 設定資料夾與瀏覽器 `localStorage`、也不能同時跑 `npm run dev`。已改為識別碼 `app.juicycalendar.timeblock`、埠 1421（`tauri.conf.json`、`vite.config.ts`、`playwright.config.ts`，並同步 `AGENTS.md`、`README.md`、SAD／SDS／追溯表的路徑）。`typecheck`、`lint`、`npm test` 181、`test:rust` 23、`test:e2e` 44、`test:desktop` 皆 Passed。**影響**：換識別碼後，桌面版不會讀到舊的 `last-workspace.txt`，第一次啟動回到歡迎畫面（需重新選一次工作區）；舊資料夾 `%APPDATA%\app.juicycalendar.desktop\` 仍在，App 不再使用，未刪除。**未處理**：`HANDOFF.md` 摘要仍寫有 demo 的相對路徑（專案擁有者表示不用改）。

- 票 001（2026-11-04）：`e2e/core.spec.ts` 的 `dragBall` 改為放開前等待拖曳狀態與放置預覽；TC-01／TC-02 已標註。`test:e2e` 連續 3 次皆 29/29 通過（修復前 22／9／16）；`typecheck`、`lint`、`npm test`（48）Passed。未改產品程式與斷言。`dragFromTo`（移動／調整）未改，但 3 次皆綠。

- 票 002（2026-11-04，未 commit）：新增 `src/test-support/workspaceFixture.ts`（測試專用 fixture 建構器：格式版本 2、6 模板、可附加事件與壞檔）與 `src/services/persistence/reopen.test.ts`（TC-06、AC-02.1、FR-05）。`typecheck`、`lint` Passed；`npm test` 49/49 Passed；`npm run build` 的 `dist` 檔名與大小與先前完全相同、無 fixture 內容。未改產品程式。未跑 test:rust、test:e2e（與本票無關）。

- 票 003（2026-11-04，未 commit）：新增 `src/features/calendar/engine/limits.ts`（`NAME_MAX_CHARS` 30、`EVENT_MIN_MINUTES` 1、`EVENT_MAX_MINUTES` 10080、`NEW_EVENT_MINUTES` 120 的唯一來源，`MIN_EVENT_MINUTES` 改名為 `EVENT_MIN_MINUTES`）；引擎新增 `validateTitle`（`Intl.Segmenter` 計 grapheme）；`appStore.updateEvent`／`saveTemplate` 改為在 store 驗證並回傳 boolean（拒絕時資料不變、不進佇列）；`EventBlock`、`Inspector`、`TemplateEditor` 接上同一條規則。測試：`validateTitle.test.ts`（11）、`stores/nameLimit.test.ts`（9）、e2e 3 項。`typecheck`、`lint` Passed；`npm test` 69/69；`test:e2e` 32/32（另有 1 次 TC-02 間歇失敗）。未跑 `test:rust`（未改 Rust）。`EVENT_MAX_MINUTES` 目前只定義、尚未被使用（票 004、005 才套用上下限）。

- 票 004a（2026-11-04，未 commit，插入任務）：修正 Escape 取消拖曳後放置預覽殘留的競態（`useTemplateDrag.ts` 加 `activeRef`，取消後遲到的 `move` 忽略），並把 TC-02 e2e 補強（雜湊、球可再次拖曳）。證據與數字見 LESSONS、追溯表。`typecheck`、`lint` Passed；`npm test` 69/69；TC-02 負載下 120/120。**完整 e2e 連續 3 次仍不一致**：第 2 次 magnet 測試失敗（既有，有無修正都約 1/40，與本修正無關，未處理）。

- 票 014（2026-11-04，未 commit）：新增 `src-tauri/src/preflight.rs`（`webview2_pv_means_installed`、`webview2_available`、`help_language`、`help_text`、`exit_if_webview2_missing`）；`platform_win.rs` 加 `webview2_pv`、`show_message`；`lib.rs` 的 `run()` 在 Windows 於 Tauri 啟動前檢查。`06-test-plan.md` 新增 TC-13。`cargo test` 36 passed、`test:rust`／`typecheck`／`lint` Passed、`npm test` 309 passed；`test:e2e`、`test:desktop` 未跑。M-07 由代理以 UI Automation 跑過（繁中視窗、結束碼 1、WebView2 存在時照常啟動），專案擁有者已確認視窗（結束碼 1 以代理自動化為證）；**英文視窗、release 版未做**。**待決定**：偏差「環境變數優先於登錄」需補進 SDS API-07（見 `issues/014-webview2-preflight.md`）。本機沒有 D 槽，Rust 用既有 `C:\Users\student\.cargo`。
- 票 005（2026-11-04，未 commit）：`resizeStart`／`resizeEnd` 加 `EVENT_MAX_MINUTES`（經過時間）上限，改動僅 `engine/mutations.ts`；新增 `resizeBounds.test.ts`（TC-05 單元 4 項）與 `e2e/core.spec.ts` 2 項 TC-05 e2e（含變異檢查）。`typecheck`、`lint` Passed；`npm test` 73/73。完整 e2e 3 次 33／33／34 passed，各有 1 項不相關間歇失敗（overlapping、weekly/daily，見 LESSONS）。發現面板持續分鐘欄無 7 天上限，歸票 004；新增票 021（小時＋分鐘輸入，未就緒）、票 022（e2e 間歇失敗，可開始）。同時依實測勾選票 001（除「3 次一致」）、002、003 的驗收條件；004 未勾。

- 票 006（2026-11-04，已 commit，未 push）：Rust 命令錯誤由英文句子改為 `{code, detail}`（新 `src-tauri/src/error.rs`：`ErrorCode`、`IpcError`；`fs_safe::resolve`、`lib.rs` 全部命令改回傳 `IpcError`；`choose_root` 從 `workspace_select` 抽出以便測試）。前端新增 `services/persistence/backendError.ts`（Zod 驗證、`BackendError`），`backend.ts` 的每個 `invoke` 經 `call()` 轉換。`BackendError.message`／`String(error)` 暫為舊英文句子（`detail` 不顯示），票 007 換成集中對照表、票 012 換成字典後移除。`serde_json = "1"` 經同意加入 `[dev-dependencies]`。測試：`typecheck`、`lint` Passed；`npm test` 93/93；`test:rust` 9/9（原有 5 + 新增 4）；`test:desktop` Passed。**偏差**：`IO_ERROR` 畫面文字改為固定句子，不再顯示系統訊息。**未驗證**：symlink／跳出工作區的 `PATH_NOT_ALLOWED` 僅 unix 測得到；`test:desktop` 只確認被拒絕、未確認代碼；`test:e2e` 未跑；人工驗收未做。

- 票 007（2026-11-04，已 commit 並 push）：`issues`、`openError`、`saveError` 由字串改為結構。`WorkspaceOpenError` 帶 `code`（`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`、`WORKSPACE_TOO_NEW` 含 `version`）；`issues` 為 `FILE_SKIPPED {file, detail}`／`SETTINGS_RESET`；store 的 `openError`（另有 `WORKSPACE_LOCKED`、`NOT_A_WORKSPACE`、`OPEN_FAILED` 含 `detail`）與 `saveError`（`SAVE_FAILED`）存代碼。新增 `src/services/notices/notices.ts`：型別與**唯一**英文對照表（票 012 取代它），`Notices`、`WelcomeScreen` 依代碼顯示，`BackendError.message` 改讀此表。測試：`openErrors.test.ts`（TC-08 三情境含雜湊不變、`FILE_SKIPPED`、`SETTINGS_RESET`）、`workspaceSession.test.ts`、`saveError.test.ts`、`notices.test.ts`。`typecheck`、`lint` Passed；`npm test` 109/109；`test:e2e` 單次 34/34（含 magnet，本次未失敗，未跑 `--repeat-each`，不代表已修）。**偏差**：`saveError`、`OPEN_FAILED` 畫面不再附加診斷句；`WorkspaceOpenError.message` 仍是英文（非畫面文字）；`FILE_SKIPPED` 的「長度或名稱」原因目前歸在 `invalid content`。**未驗證**：真實磁碟與 Tauri 桌面版、`test:rust`（未動 Rust）、NFR-01 連續 3 次 e2e、人工驗收。追溯：`docs/06-test-plan.md` 第 224 列已回填；票 007 驗收條件已勾選（含偏差註記）。

- 票 008（2026-11-04，已 commit `9589e5e`，未 push）：`eventSchema` 加長度 ≤ `EVENT_MAX_MINUTES` 與名稱規則，`templateSchema` 加名稱規則（皆引用 `limits.ts`／`validateTitle`）；`skipReason` 改用 zod 的訊息，通知原因可區分。新增 `loadRules.test.ts`（TC-07，七種壞檔 × 載入與編輯後，共 14 項；(g) 模板名稱 31 字經專案擁有者同意列入）。紅燈 3 失敗／11 通過，綠燈後 `npm test` 123/123、`typecheck`、`lint` Passed；`test:e2e` 第 1 次 33/34（既有間歇項 `overlapping events…`，單獨重跑通過），重跑 34/34。**未驗證**：Rust 真實磁碟載入、桌面版手動開啟版本 2 樣本資料夾。

- 票 011（2026-11-04，第二台電腦，未 commit）：翻譯日曆與工具列。新增 `src/i18n/dateFormat.ts`（`formatDate`，`date-fns` 的 `zh-TW`／`en-US` 語系）、`rangeLabel.ts`（標題由 `CalendarToolbar` 搬出，中文寫法 `2026年11月9日 – 15日` 等已由專案擁有者確認）、`hiddenEventsTitle.ts`（`+N` 徽章說明，英文單複數）；字典新增 15 個鍵；`CalendarToolbar`／`CalendarGrid`／`EventBlock` 的固定文字、`aria-label`、`title` 改由字典與這些函式提供。`typecheck`、`lint`、`build` Passed；`npm test` 222 passed；`test:e2e` 連續 2 次 47 passed。**偏差與決定**：(1) 日曆畫面沒有語言選單，AC「切換語言立即反映」只驗證到「歡迎畫面選語言→進日曆」，選單另開**票 023**（專案擁有者同意）；(2) 中文字串（上一個期間、下一個期間、今天、時間軸起點／終點、30 分鐘吸附、縮放、檢視、週、日、開啟星期X、有 N 個事件在可見時段之外、事件名稱）為我的提案，**待審閱**；(3) 中文跨年週寫成 `12月28日 – 2027年1月3日`（依英文只標結束年的原則推出，專案擁有者只確認了單日、同月、跨月）；(4) `TemplatePalette`（球列）與 `00:00` 時間軸標籤不在本票（分別歸 012、013）。**未驗證**：桌面版中文介面人工操作；`test:rust`、`test:desktop`（本票未動 Rust）。
- 票 012（2026-11-04，第二台電腦，未 commit）：翻譯右側面板、模板編輯器、球列、環形選單、顏色選擇器、通知與錯誤。刪除 `notices.ts` 的暫時英文對照表，`openErrorText`／`issueText`／`saveErrorText`／`backendErrorText` 改為 `(language, …)` 並由字典提供；`BackendError.message` 與 `String(error)` 改為**錯誤代碼**（專案擁有者同意，替換 `backendError.test.ts` 原本釘住英文句子的 3 項）；字典新增約 45 個鍵。新增完整性檢查：`src/test-support/hardcodedText.ts`（用 `typescript` 解析 TSX，找 JSX 文字、字串屬性、條件運算裡的字母文字）加 `src/i18n/hardcodedText.test.ts`（含兩項自我驗證）。`typecheck`、`lint`、`build` Passed；`npm test` 272 passed；`test:e2e` 連續 2 次 50 passed。**偏差與決定**：(1) `WORKSPACE_LOCKED` 英文維持原句（不補「Close that window first.」），中文為規格原句；(2) `formatDuration` 的 `h`／`m` 不翻譯；(3) 英文維持英式拼法 `Colour`；(4) 中文字串全為提案翻譯，**待審閱**；(5) 掃描器限制見追溯表。**未驗證**：桌面版中文介面人工操作；`test:rust`、`test:desktop`。
- 票 013（2026-11-04，第二台電腦，未 commit）：時間格式跟隨 Windows。新增 `src/i18n/formatTime.ts`、`hour12.ts`（`resolveHour12`、`browserHourCycle`）、`formatTimeRange.ts`、`useTimeFormat.ts`；Rust `platform_win.rs` 新增 `system_hour12`（`GetLocaleInfoEx` 讀短時間圖樣）與兩個純函式，`system_info` 填入 `hour12`；`initLanguage` 每次啟動都記下 `systemHour12`；區塊、拖曳預覽、時間軸選單標籤改用 `formatTime`，引擎的 `formatTimeRange` 刪除；Playwright 預設語系改 `en-GB`。`typecheck`、`lint`、`build` Passed；`npm test` 309 passed；`test:rust` 29 passed；`test:e2e` 4 次完整執行 53 passed 三次、另一次 1 項失敗（原因不明，見 LESSONS）。`test:desktop` 原本失敗（斷言寫死 24 小時制），經專案擁有者同意改為驗證 10:30 與 12:30 兩個時刻後 Passed（詳見票 013「實作偏差與決定」）。**未驗證**：M-05、24 小時制 Windows 的真實 App。
- 已知限制（2026-11-04，專案擁有者在桌面版觀察並同意接受，不處理）：Windows `zh-TW` 12 小時制、App 切成英文時，右側面板開始／結束的原生時間欄位仍顯示 `上午`／`下午`；欄位名稱已是英文。原因是原生欄位的 AM/PM 文字由 WebView2 依 Windows 語系決定（頁面 `lang` 寫死 `en` 也無效），App 字典管不到。歸票 013 的人工驗收 M-05 與票 016 的使用說明；細節與日後選項見 `issues/013-time-format-windows.md`「已知限制」。我沒有親眼看到畫面，現象依專案擁有者回報。
- 環境（2026-11-04，第二台電腦）：`C:/DevTools/jq` 已由專案擁有者同意加入**使用者 PATH**（登錄 `HKCU/Environment`，原值備份在暫存區）；Rust 仍不在 PATH。新開的終端機與重啟的 Claude Code 才會讀到。以新 PATH 在 Git Bash 實測 `bash .maintain/check.sh`，`test-guard-git.sh`、`test-guard-secrets.sh` 實際執行並通過。注意：PowerShell 裡的 `bash` 會先找到 WSL 啟動器（`C:/Windows/system32/bash.exe`），那個看不到 jq；hook 要在 Git Bash 下執行才有效。

- 票 020 radial hover（2026-11-05，已 commit）：Q-05 決定樣式 A「果凍起伏邊界」（`clip-path` 多邊形、3＋5 瓣、4 秒、hover 球放大 1.3 倍、純色；減少動態時不起伏，改靜態外框）。選中規則改為 hover 只起伏、其他球保留，離開球的固定圓形命中範圍（28 px）才選中並開始拖曳；相鄰球只換 hover、重疊取最近；退回圓環中央（固定半徑 80 px，超出圓環半徑 76 px；球優先）取消 hover、選單保留；hover 沒離開就放開則關閉選單、不建區塊。新增引擎 `radialRing`、`radialStep`、`RADIAL_HIT_RADIUS`、`RADIAL_CENTER_RADIUS`（`engine/pointer.ts`），`useRadialPalette.ts` 改用 `radialStep`。測試 TC-16a～f（單元）與 3 項 e2e（長按選球改為往外離開、放開不選、退回圓心取消）加 1 項變小球 e2e。PRD AC-01.4、SRS FR-04、`DESIGN.md`、測試計畫、SAD／SDS 的 Q-05 已同步。驗證（2026-11-05，Windows 10 Pro 10.0.19045，Node 24.22.0）：`npm test` 346/346、`typecheck`、`lint`、`test:rust` 43/43 Passed；`test:e2e` 連續 3 次皆 62 passed。M-03：專案擁有者回報通過（口頭，未逐項記錄；Tauri 開發模式）。**回歸教訓**：改 `index.css` 時用「整段取代」誤刪 `split-particle`／`split-burst`／`radial-enter` 規則，使用者回報變小球消失；已從 git 還原並新增 e2e（原 TC-02 只數 DOM 元素抓不到）。改 CSS 請用只含目標行的精確取代，並看 `git diff` 的刪除行。
- 票 025、026（2026-11-05，新增，皆「未就緒」）：025 radial 選單啟動速度（長按 450 ms、進場 220 ms，等專案擁有者定新數值，改動需同步 PRD AC-01.4／SRS FR-04）；026 拖曳選取多個時段（新功能，行為未定，與 NG-03 新事件固定 120 分鐘及空白處長按手勢有衝突，需先問答並修訂 Brief／PRD／SRS）。

### 進行中
- 無。

### 阻塞
- **（已解決，票 001，2026-11-04）e2e 不穩定的原因與修法**：`e2e/core.spec.ts` 的 `dragBall` 在最後一次 `mouse.move` 後立刻 `mouse.up()`。dnd-kit 的拖曳啟動要等 React 狀態提交，約 100 ms 後 `ball-dragging-source` 才出現；`mouse.up()` 若早於此，`onDragEnd` 拿不到 active，就不會建立事件。證據：獨立腳本每組 5 次，放開前等 0 ms → 0/5 建立事件；等 50／200／500 ms → 皆 5/5。完整測試時各測試的耗時與機器負載不同，所以失敗數每次都不一樣（9／20／23）。已排除：沒有殘留 server、`isPrimary`／`button` 正常、沒有 blur／resize／visibilitychange 取消、沒有 console 錯誤、載入後多等 3 秒無改善。
  - 判斷：測試端的時序問題。人類操作放開前通常超過 50 ms，不受影響。
  - 修法（已實作，票 001）：`dragBall` 放開前等待拖曳狀態與放置預覽；`test:e2e` 連續 3 次皆 29/29。之後仍有少數**不相關**的間歇失敗（`overlapping events…`、`weekly and daily views…`、magnet 約 1/40），**待票 022 處理**；NFR-01 在 022 完成前不算達成。
- 票 000 結果（2026-11-04，Windows 11）：`typecheck`、`lint`、`npm test`（48）、`test:rust`（5）皆 Passed；`npm run test:desktop` 在 Windows（Git Bash）**Passed**（建立工作區、拖放後 10:30–12:30、關閉後重開事件仍在、越界寫入被拒）；`npm run desktop` 視窗出現，Vite `http://localhost:1420` 回 200。人工操作驗收（建立工作區、關閉、重開還原）**Manual Pending**。追溯：`docs/06-test-plan.md` G-03 列。未修改任何產品程式。
- 票 000 在第二台電腦重跑（2026-11-04，Windows 10 Pro 10.0.19045；工作目錄 `C:/Users/student/Project/juicy-calendar`，HEAD `6592827`，工作樹乾淨）：node v26.13.0、npm 11.20.0、Rust 1.90.0（`C:/DevTools/rust`，只用程序層級環境變數，未改 PATH）、jq 1.8.2。`typecheck`、`lint` Passed；`npm test` 19 files／181 passed；`test:rust` 23 passed；`test:desktop`（Git Bash）Passed（6 顆球、拖放後 10:30–12:30、重開後 `blocksOnLaunch: 1`、路徑穿越類寫入全被拒絕）。`npm run desktop`：視窗「Juicy Calendar」出現且 Responding；Vite `http://localhost:1421/` 回 HTTP 200。觀察：Vite 只監聽 `::1`，`127.0.0.1:1421` 拒絕連線（webview 用 `localhost` 正常）；`tauri dev` 的檔案監看對 `src-tauri/target/debug/deps` 的 exe／pdb 印出 `EBUSY` 警告，不影響啟動。人工「建立工作區、關閉、重開還原」：專案擁有者表示**已人工驗收完成**（2026-11-04，第二台電腦，由專案擁有者操作；我沒有親眼看到操作過程，也沒有截圖，依其回報記錄）。票 000 的狀態刻意維持「可開始」，專案擁有者換工作區時會優先再跑一次。驗收後已關閉視窗，`juicy-calendar` 行程與埠 1421 皆已結束。`test:e2e` 不在此票範圍（同日另測 43 passed／1 failed，失敗為票 022 已知的 `overlapping events…`，單獨重跑 3 次皆通過）。未修改任何產品程式。
- Playwright WebKit 已重裝到 `D:\DevTools\playwright-browsers`（實體檔案，175 MB），C 槽 `ms-playwright` 已刪除（那是 2026-11-03 我自己裝的）。

### 下一步（最多三項）
1. **票 021 不能直接接**：它被票 004（面板時間與持續分鐘新規則，TC-04 仍「未執行」）擋住，且票上有 4 個待決（介面形式、驗證規則、範圍判斷、標籤是否走 i18n）並需修訂 SRS R-3／FR-03。建議先做票 004（前置票 003 已完成），再讓專案擁有者回答 021 的待決。
2. 專案擁有者決定票 025（新的長按與進場時間）與票 026（多時段選取的行為，建議先用 `/grilling` 問清楚）；025 要在 020 之後做，026 在 025 之後做。
3. 票 022（e2e 間歇失敗，NFR-01）、審查 SAD／SDS／測試計畫草稿；M-01（票 016）暫緩、M-02、M-04、M-05 仍待專案擁有者人工驗收。

### 狀態核對

| 面向 | 狀態 | 說明 |
|---|---|---|
| 已實作 | 部分 | 票 001～008 已實作（見上）；其餘票未做 |
| 自動測試 | 部分 Passed | 2026-11-04：`npm test` 123/123、`typecheck`、`lint` Passed；`test:e2e` 單次 33/34、重跑 34/34（間歇失敗待票 022）；`test:rust` 與 `test:desktop` 為票 000／006 時的結果（Passed），票 008 後未重跑 |
| 人工驗收 | Manual Pending | 從未人工驗收桌面版 |
| 已 commit | 是（到票 020；`git log -1` 查雜湊） | |
| 已 push | 否（本輪） | 票 020 的 commit 尚未 push，等專案擁有者要求；以 `git status` 核對 |

### 接手者要先知道
- 跑 e2e 前要在該程序設 `PLAYWRIGHT_BROWSERS_PATH=D:\DevTools\playwright-browsers`；沒設會找 C 槽、報 `Executable doesn't exist`（已驗證）。安裝同理：`npx playwright install webkit` 前先設。
- `PRODUCT.md`／`DESIGN.md`／`ARCHITECTURE.md` 是 demo 作者的描述，不是人確認過的規格。
- Rust 不在 PATH。執行 `test:rust`／`desktop` 前，在該程序設：`RUSTUP_HOME=D:\DevTools\rust\rustup`、`CARGO_HOME=D:\DevTools\rust\cargo`、PATH 加 `D:\DevTools\rust\cargo\bin`。
- README 仍寫「只跑過 macOS」，尚未更新（**待票 016**，該票含 README）。
