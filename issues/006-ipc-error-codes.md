# 006：IPC 錯誤改為代碼與診斷文字

**大小：** M　**狀態：** 完成（2026-11-04，未 commit；人工驗收尚未做）

**成果（What to build）：** Rust 命令的錯誤由英文句子改為 `{code, detail}`，前端 backend 把它轉成帶代碼的錯誤。畫面行為暫時不變；這是後續語言與單一寫入者的共同地基。

**Blocked by：** 無（可立即開始）

**對應 TC／人工：** TC-08（代碼部分）、TC-10（路徑拒絕）

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`

**要讀的規格段落：** `docs/05-sds.md` API 契約（錯誤格式與代碼表）；`docs/04-sad.md` 信任邊界

## 驗收條件

- [x] 所有命令的錯誤都是 `{code, detail}`；代碼為 `WORKSPACE_LOCKED`、`NOT_A_WORKSPACE`、`NO_WORKSPACE_OPEN`、`PATH_NOT_ALLOWED`、`IO_ERROR`（`WORKSPACE_LOCKED` 先定義，票 009 才使用）。（序列化形狀有單元測試；命令本身無法單元測試，以編譯與 `test:desktop` 涵蓋。）
- [x] Rust 測試：不合法路徑回傳 `PATH_NOT_ALLOWED`；未開啟工作區呼叫檔案命令回傳 `NO_WORKSPACE_OPEN`；原有 5 項測試保留並通過。
- [x] 前端 backend 把錯誤轉成含代碼的型別，單元測試涵蓋映射；`detail` 不直接顯示給使用者。
- [x] 現有畫面行為與文字暫時不變；若現有測試因錯誤格式改變而調整，列明理由。（沒有調整任何既有測試。**偏差**：`IO_ERROR` 不再顯示系統訊息，改為固定的 `The file operation failed.`，因為 `detail` 不得顯示；其餘三個代碼沿用舊句子。）
- [x] 沒有新增套件。（例外：經專案擁有者同意，`serde_json = "1"` 加入 `[dev-dependencies]`，僅供序列化形狀測試；`Cargo.lock` 原本就含 1.0.154，未新增下載。）

共同規則（先讀）：[`issues/README.md`](README.md)。

## 完成紀錄（2026-11-04）

- 實作：`src-tauri/src/error.rs`（新）、`fs_safe.rs`、`lib.rs`；前端 `backendError.ts`（新）、`backend.ts`。
- 測試：`npm run typecheck`、`npm run lint` Passed；`npm test` 93/93；`npm run test:rust` 9/9（原有 5 項保留 + 4 項新增）；`npm run test:desktop` Passed。
- 過渡設計：`BackendError.message` 為由代碼決定的舊英文句子，票 007 改為集中對照表、票 012 改由字典後移除。
- 未驗證：symlink／跳出工作區回 `PATH_NOT_ALLOWED` 僅 unix 測得到，Windows 未驗；`test:desktop` 只確認路徑被拒絕，未確認代碼；`test:e2e` 未跑（瀏覽器版 backend 未改）。
