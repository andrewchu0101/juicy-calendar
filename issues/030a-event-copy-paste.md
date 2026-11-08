# 030a：事件複製貼上

**大小：** M　**狀態：** 完成（2026-11-08；單 worker 完整回歸通過，並行 fixture 不穩定保留）　**Blocked by：** 無

## 最終實作（2026-11-08）

- 使用者以「直接把30a 完成」授權後續紅燈由代理確認並接續綠燈；沿用先紅後綠，不再逐次等回覆。未修改任何舊測試期待。
- appStore 的 `copiedEvents` 僅記憶體快照；`copySelected()` 複製單／多選，`pasteCopied(start)` 驗證整批後一次 commit。engine `copiedEventTimes` 以最早來源為錨點、用絕對時間差平移；新 ID、保留名稱／顏色／templateId／各自長度／間隔，重做保留副本 ID。
- 快捷鍵依目前游標與實際命中換算，不重用舊位置；日期標題、時間軸、日曆外與空剪貼簿拒絕。工作區 reset/hydrate、關閉／重啟清除快照；複製不寫檔、不改歷史，無 OS 剪貼簿呼叫。
- radial 拒絕新測試先紅（事件數應 1、實際 2，新增事件檔），再以 UI hook 的進行中 pointer session 加上既有手勢標記隔離命令；Escape 留給手勢、文字欄保留原生編輯。
- 新增 `src/stores/copyPaste.test.ts` 10 個單元／整合案例、`e2e/copyPaste.spec.ts` 12 個案例。其餘已具備的拒絕規則是特徵化檢查，不冒稱全部曾出現紅燈。
- typecheck／lint／build 通過，完整單元 39 檔／476 passed；完整 WebKit e2e 單 worker 113 passed（7.5m／exit 0）。前次雙 worker 為 112 passed／1 failed（4.0m／exit 1）：舊 multiSelect 第三個 createAt 預期 before+1=1、實際 3，尚未進入批次移動測試主體。單 worker 同案例通過但根因未定，不宣稱並行穩定；失敗快照見 docs/evidence/030a-full-e2e-fixture-failure.md。無舊期待修改或放寬。
- e2e 使用獨立 Vite 127.0.0.1:1441，臨時設定沿用 playwright.config.ts、僅覆寫 baseURL／停用 webServer 管理；驗證後移除設定並停止該伺服器。命令與重做方式見 Test Plan 030a 最終驗證。
- 無新套件、IPC 或磁碟欄位，不涉及 Rust 改動；Rust／Windows 原生桌面本輪未另驗收。未 commit／push；030b／030c 未實作。

## 歷史紅綠燈紀錄（以下為階段快照，以最終實作為準）

## 單選建置與多選紅燈（2026-11-08）

- 使用者「確認」單選成功案例紅燈後，新增 appStore 單選記憶體快照／貼上 action（reset/hydrate 清除）、快捷鍵與最新游標命中定位；沿用 engine 的 moveEvent／pointerToTime，時間運算不放在 store。新事件走 schema 驗證、既有一次 commit 與持久化。
- 變更產品檔案：appStore.ts、useKeyboardShortcuts.ts、AppShell.tsx。既有測試期待未改。
- typecheck、lint 通過，新增多選測試前完整單元仍 466 passed。單選與原拒絕 e2e 首輪為單選逾時／原拒絕通過；帶 trace 的單選診斷重跑逐項通過（11.2s），但命令收尾未退出，已中止。不宣稱穩定綠燈或整個 e2e 命令 exit 0；首輪逾時根因待查。
- 新增 src/stores/copyPaste.test.ts：TC-19／AC-05.1／FR-15，反序多選 a/b，預期最早開始為錨點、保留 150／60 分鐘及間隔、零複製寫入、整批一次歷史、落盤重開與原檔不變、復原／重做同 ID。`npm.cmd test -- src/stores/copyPaste.test.ts`：1 failed，copySelected 預期 true 實際 false，因目前只取 selectedEventId，多選時為 null。停在首個斷言，後續斷言尚未執行，不宣稱已驗證。
- 這是多選成功案例紅燈，非新拒絕紅燈；尚未擴充多選，等人確認。030a 尚未完成，不提交／推送。

## 第一輪綠燈與下一輪紅燈（2026-11-08）

- e2e 命令收尾限制：原拒絕＋multiSelect 共 14 個案例逐項回報通過後，程序未正常退出，已 Ctrl+C 中止；不記作 exit 0，日後需補正常結束的驗收。

- 使用者以「好ok」確認首個拒絕紅燈；只修改 `useKeyboardShortcuts.ts`，在 `body.is-interacting` 期間隔離事件命令，Escape 仍由手勢處理，文字欄保留原生操作。
- 原拒絕案例轉綠；完整 `npm.cmd test` 38 檔／466 passed，typecheck／lint／diff check 通過。多選 e2e 回歸結果見 Test Plan／HANDOFF。
- 下一個 TC-19／AC-05.1／FR-15 成功案例：既有 150 分鐘 Source，Ctrl+C 後移到週三 11:00 EST 再 Ctrl+V，預期新 ID 副本 16:00Z～18:30Z、選中且來源不變。`npm.cmd run test:e2e -- e2e/copyPaste.spec.ts --grep 150-minute --workers=1`：1 failed（8.5s／exit 1），事件數預期 2、實際 1。這是尚無複製貼上功能的成功案例紅燈，不能當成第二個拒絕案例；尚未實作該功能，等待人確認。

## 紅燈紀錄（2026-11-08）

- 新增 `e2e/copyPaste.spec.ts` TC-19／R-12：載入獨立 browser 工作區事件，開始真實拖曳並確認 `is-interacting-move`／`data-active=true`，按 Delete。
- `npm.cmd run test:e2e -- e2e/copyPaste.spec.ts --workers=1`：1 failed（2.0s），事件數及選取數預期 1、實際 0；檔案快照缺少來源，寫入觀測記錄 `removeItem:juicy-calendar:file:events/copy-source.json`。原因是全域 Delete 未隔離進行中手勢，非缺函式或 fixture 建立失敗。
- 首輪使用兩個自動等待的 soft locator 斷言，已有事件數 0 的失敗但後續逾時；改為在超過 debounce 後讀取實際數量，得到上述完整斷言紅燈。另修正新測試 storage observer 的函式聯集型別問題；最終 typecheck、lint、diff check 通過。
- 產品程式與舊測試未改，完整單元／e2e 尚未重跑；尚未證明其他 TC-19 行為。停下等待專案擁有者確認才進綠燈。

**讀取：** AGENTS.md、CLAUDE.md、CODING_STANDARD.md、docs/LESSONS.md、030 規格票；PRD US-05、SRS FR-15／16 與 R-10／12、SDS UI-08、Test Plan TC-19。

## 完成條件

- [x] 單／多選複製當下快照，來源修改不影響快照；不寫檔、不進歷史。
- [x] Ctrl+V 使用即時有效游標時間、最早來源錨點及 R-1 磁吸；新 ID、保留欄位／長度／間隔，全部選中。
- [x] 重疊、跨午夜及可見範圍外可用；整批一次復原／重做，重做恢復同 ID；重開一致、來源檔不變。
- [x] 空快照／無效位置／sticky 標題／時間軸拒絕，不能用舊目標；零事件／選取／歷史／入列／檔案副作用。
- [x] 工作區切換與重啟清除；不使用系統剪貼簿；文字操作及進行中手勢隔離。

## 範圍與接縫

`src/stores/appStore.ts`、calendar engine／pointer／timeline、`useKeyboardShortcuts.ts`、CalendarGrid 與必要位置追蹤 hook、工作區生命週期；對應單元／整合測試與新 `e2e/copyPaste.spec.ts`。必要時 types 與既有 persistence 測試 fixture；不改磁碟格式、不動 Rust。超出票範圍先列依據。

## 測試先行與驗收

依 TC-19 紅燈策略；「貼上不存在所以無新增」不算新拒絕測試的紅燈。最初拒絕及單選紅燈已經人確認；使用者於本輪授權直接完成後，其餘原因正確紅燈由代理確認並接續實作。既有測試期待仍需人確認才可修訂，本次沒有修訂。

執行 typecheck、lint、npm test、test:e2e（包含舊有效案例），回填 Test Plan 追溯與 HANDOFF。新案例未執行，不沿用歷史通過數；現有期待需變更先取得人確認。共同規則見 issues/README.md；新對話 `$implement-gaston`，不自動提交。
