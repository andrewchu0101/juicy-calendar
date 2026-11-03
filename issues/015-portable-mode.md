# 015：免安裝模式

**大小：** M　**狀態：** 未就緒：等待 S-01 決定

**成果（What to build）：** 執行檔旁有 `portable.flag` 時為免安裝模式：工作區固定是執行檔旁的 `data`（不存在就建立並初始化），App 設定也存在 `data`，不使用 `last-workspace.txt`；仍可手動切換工作區，但下次啟動回到 `data`。安裝版行為不變。

**Blocked by：** 009、010，以及 **S-01 決定**（以 `portable.flag` 判斷免安裝模式是否同意）

**對應 TC／人工：** TC-10（`portable::detect`）、M-02（部分）；AC-03.4、FR-11

**驗收指令：** `npm run test:rust`、`npm run typecheck`、`npm run lint`、`npm test`

**要讀的規格段落：** `docs/04-sad.md` ADR-05；`docs/05-sds.md` API-02、`portable` 契約；`docs/03-srs.md` R-8

## 驗收條件

- [ ] **開工前先確認 S-01 已由專案擁有者決定**；若決定採用不同機制，這張票要先改寫。
- [ ] `portable::detect(目錄)`：有 `portable.flag` → 回傳 `<目錄>/data`；沒有 → 空值；目錄以參數傳入，測試用暫存資料夾。
- [ ] 免安裝模式下的還原：工作區為 `data`，不讀不寫 `last-workspace.txt`；`data` 內沒有工作區時走既有的初始化流程。
- [ ] 單一寫入者（票 009）對免安裝版同樣適用。
- [ ] WebView2 的快取位置是否能放進 `data`，**未驗證**；在票中查證並記錄結果，不宣稱已整包帶走。

共同規則（先讀）：[`issues/README.md`](README.md)。
