# 020：radial 選單 hover 效果

**大小：** M　**狀態：** 已實作並通過自動測試；M-03 人工待做（2026-11-05）

**成果（What to build）：** 長按左鍵叫出 radial 選單後，被 hover 的那顆球出現呼吸或沿圓周跑的波；移開即停止；系統設定減少動態效果時不播放；球身維持純色。

**Blocked by：** **Q-05 決定**（效果樣式），以及 `DESIGN.md`「沒有持續性裝飾動畫」規則的修訂

**對應 TC／人工：** M-03；AC-01.4、FR-04、Brief G-07

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`；人工 M-03

**要讀的規格段落：** `docs/02-prd.md` AC-01.4；`docs/01-brief.md` G-07；`DESIGN.md` 硬規則與動態表

## 驗收條件

- [x] Q-05 已決（2026-11-05，專案擁有者）：圓周小波，顏色與球相同，球身純色；撿起時機為按住時移出球範圍。`DESIGN.md` 硬規則與動態表已修訂。
- [x] 效果只出現在 radial 選單被 hover 的球；移開即停；減少動態效果時不播放。
- [x] 現有的「球為純色」e2e 檢查繼續通過；動畫不改變命中判定與時間計算所用的幾何。
- [ ] 人工 M-03 有結果。

共同規則（先讀）：[`issues/README.md`](README.md)。
