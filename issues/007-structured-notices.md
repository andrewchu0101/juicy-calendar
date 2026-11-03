# 007：通知與開啟錯誤以代碼呈現

**大小：** M　**狀態：** ready-for-agent（前置票完成後才能開始）

**成果（What to build）：** `issues`、`openError`、`saveError` 由字串改為結構（代碼加檔案或診斷），通知與歡迎畫面依代碼顯示文字。文字暫時來自集中在一處的英文對照表，票 012 會改由字典提供。

**Blocked by：** 006

**對應 TC／人工：** TC-08（拒絕開啟）；AC-02.2 的通知

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

**要讀的規格段落：** `docs/05-sds.md` UI-01、UI-02 與 `schemas`／`repository` 契約

## 驗收條件

- [ ] `WorkspaceOpenError` 攜帶代碼：`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`、`WORKSPACE_TOO_NEW`（含版本號）、`WORKSPACE_LOCKED`、`NOT_A_WORKSPACE`、`OPEN_FAILED`（含診斷）。
- [ ] 通知代碼：`FILE_SKIPPED`（含檔案路徑與原因）、`SETTINGS_RESET`。
- [ ] TC-08：`workspace.json` 版本為 3、缺少、無法解析，分別得到 `WORKSPACE_TOO_NEW`、`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`，不進入主畫面，資料夾除行程鎖定標記 `.juicy.lock` 外清單與雜湊不變。
- [ ] 暫時的英文對照表集中在**一處**，票 012 取代它；畫面上的英文文字與現在相同，現有 e2e 仍通過。
- [ ] 不得把 `detail` 直接顯示在畫面上。

共同規則（先讀）：[`issues/README.md`](README.md)。
