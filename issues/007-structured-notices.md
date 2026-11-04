# 007：通知與開啟錯誤以代碼呈現

**大小：** M　**狀態：** 完成（2026-11-04；人工驗收尚未做）

**成果（What to build）：** `issues`、`openError`、`saveError` 由字串改為結構（代碼加檔案或診斷），通知與歡迎畫面依代碼顯示文字。文字暫時來自集中在一處的英文對照表，票 012 會改由字典提供。

**Blocked by：** 006

**對應 TC／人工：** TC-08（拒絕開啟）；AC-02.2 的通知

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

**要讀的規格段落：** `docs/05-sds.md` UI-01、UI-02 與 `schemas`／`repository` 契約

## 驗收條件

- [x] **【開始任務前先檢查】**（2026-11-04：magnet 間歇失敗**未修**，已問專案擁有者，決定先做本票；本票 e2e 單次 34/34，未跑 `--repeat-each`。） 已知的 e2e 間歇失敗：`magnet attracts near half-hours…`（`e2e/core.spec.ts`）在 `npx playwright test -g "magnet attracts" --repeat-each=40 --workers=8` 約 1/40 失敗，收到 `Mon 09:56` 而非 `Mon 10:26`（差 30 px），**有無票 004a 的修正都會發生**，與本票無關（`docs/LESSONS.md`）。開工前先確認它是否已修：
  - 已修（LESSONS 或 HANDOFF 有紀錄，且上述指令 40/40 通過）→ 直接開工。
  - 未修 → **先停下來問專案擁有者**是否要先修。若決定先做本票，之後跑 `test:e2e` 遇到此測試失敗，先單獨重跑並用上述指令確認，歸類為既有問題，**不要當成本票造成的迴歸**，也不要為了讓它通過而放寬斷言。
  - 影響：測試計畫退出條件 4（NFR-01，連續 3 次 e2e 通過清單一致）在修好前無法標達成。
- [x] `WorkspaceOpenError` 攜帶代碼：`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`、`WORKSPACE_TOO_NEW`（含版本號）、`WORKSPACE_LOCKED`、`NOT_A_WORKSPACE`、`OPEN_FAILED`（含診斷）。（偏差：`WorkspaceOpenError` 類別本身只帶前三個；後三個來自 `BackendError` 或其他例外，由 `workspaceSession` 轉成同一組六個代碼存入 `openError`。）
- [x] 通知代碼：`FILE_SKIPPED`（含檔案路徑與原因）、`SETTINGS_RESET`。
- [x] TC-08：`workspace.json` 版本為 3、缺少、無法解析，分別得到 `WORKSPACE_TOO_NEW`、`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`，不進入主畫面，資料夾除行程鎖定標記 `.juicy.lock` 外清單與雜湊不變。
- [x] 暫時的英文對照表集中在**一處**，票 012 取代它；畫面上的英文文字與現在相同，現有 e2e 仍通過。（偏差：儲存失敗與 `OPEN_FAILED` 的畫面不再附加診斷句，見 HANDOFF；`WorkspaceOpenError.message` 仍是英文，非畫面文字。）
- [x] 不得把 `detail` 直接顯示在畫面上。

共同規則（先讀）：[`issues/README.md`](README.md)。
