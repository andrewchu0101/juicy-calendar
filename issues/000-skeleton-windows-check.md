# 000：骨架核對：Windows 桌面版啟動與 health 檢查

**大小：** M　**狀態：** ready-for-agent

**成果（What to build）：** 專案已有設定檔、入口與測試，這張票**不建立骨架**，而是確認它在 Windows 上真的能跑：桌面版能啟動，health 檢查可重複執行，基準線全綠並留下證據。不寫任何業務邏輯。

**Blocked by：** 無（可立即開始）

**對應 TC／人工：** 無（基準線）；是 G-03 的第一筆證據

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`、`npm run desktop`、`npm run test:desktop`

**要讀的規格段落：** `CLAUDE.md` 第 8 節；`README.md`；`docs/HANDOFF.md`；測試計畫「環境、資料與判定方式」

## 驗收條件

- [x] 依 `docs/HANDOFF.md` 的方式在目前程序設定 Rust 環境後，`typecheck`、`lint`、`npm test`、`test:rust` 全部通過，貼出實際指令與輸出。（2026-11-04 第二台電腦：181／23 passed）
- [ ] 在 Windows 實際執行 `npm run desktop`：視窗出現，能建立工作區，關閉後重開能還原。記錄結果與證據（截圖或文字）。（視窗出現且 Responding、`http://localhost:1421/` 回 200 已確認；**建立工作區、關閉、重開還原為 Manual Pending**，等專案擁有者人工驗收）
- [x] `npm run test:desktop` 是 bash 腳本，README 說只在 macOS 驗證過。在 Windows 能執行並通過就記錄；不能就明確記錄原因與替代的 health 檢查步驟，**不宣稱通過**。（Windows 10 + Git Bash 實測 Passed）
- [x] 結果寫入 `docs/HANDOFF.md`，並在 `docs/06-test-plan.md` 的追溯表記為 G-03 的證據。
- [x] 沒有修改任何產品程式。（`git status` 僅 `docs/`、`issues/` 變更，見下）

## 備註

這是桌面版第一次在 Windows 上實際啟動，可能出現平台差異；有問題先記錄，用 `/diagnosing-bugs` 處理，不要順手重構。

共同規則（先讀）：[`issues/README.md`](README.md)。
