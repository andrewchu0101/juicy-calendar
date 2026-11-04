# 004a：TC-02 間歇失敗（Escape 取消後放置預覽殘留）

**大小：** S　**狀態：** 完成（2026-11-04，未 commit）　**插入位置：** 004 之後、005 之前的突發任務

**成果（What to build）：** 找出並修正 TC-02 在負載下的間歇失敗，並把 TC-02 補成測試計畫要求的樣子（檔案清單與雜湊、之後球仍可拖曳）。

**對應 TC／人工：** TC-02；AC-01.2、FR-01、NFR-01

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

## 驗收條件

- [x] 重現並分類原因，附證據（見 `docs/LESSONS.md`）。
- [x] 補強後的 TC-02 修正前紅燈、修正後綠燈（`--repeat-each=40 --workers=8`：修正前 6/40 失敗，修正後 40/40 與 120/120 通過）。
- [x] 只改 `useTemplateDrag.ts` 的拖曳旗標與 TC-02 e2e；不改其他行為。
- [ ] 範圍外、**未處理**：magnet 測試的另一個間歇失敗（見 `docs/LESSONS.md`）；TC-02 的碎片回饋「於短時間內消失」仍未斷言。
