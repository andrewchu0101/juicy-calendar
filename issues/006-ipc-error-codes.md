# 006：IPC 錯誤改為代碼與診斷文字

**大小：** M　**狀態：** ready-for-agent

**成果（What to build）：** Rust 命令的錯誤由英文句子改為 `{code, detail}`，前端 backend 把它轉成帶代碼的錯誤。畫面行為暫時不變；這是後續語言與單一寫入者的共同地基。

**Blocked by：** 無（可立即開始）

**對應 TC／人工：** TC-08（代碼部分）、TC-10（路徑拒絕）

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`

**要讀的規格段落：** `docs/05-sds.md` API 契約（錯誤格式與代碼表）；`docs/04-sad.md` 信任邊界

## 驗收條件

- [ ] 所有命令的錯誤都是 `{code, detail}`；代碼為 `WORKSPACE_LOCKED`、`NOT_A_WORKSPACE`、`NO_WORKSPACE_OPEN`、`PATH_NOT_ALLOWED`、`IO_ERROR`（`WORKSPACE_LOCKED` 先定義，票 009 才使用）。
- [ ] Rust 測試：不合法路徑回傳 `PATH_NOT_ALLOWED`；未開啟工作區呼叫檔案命令回傳 `NO_WORKSPACE_OPEN`；原有 5 項測試保留並通過。
- [ ] 前端 backend 把錯誤轉成含代碼的型別，單元測試涵蓋映射；`detail` 不直接顯示給使用者。
- [ ] 現有畫面行為與文字暫時不變；若現有測試因錯誤格式改變而調整，列明理由。
- [ ] 沒有新增套件。

共同規則（先讀）：[`issues/README.md`](README.md)。
