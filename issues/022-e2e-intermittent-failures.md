# 022：e2e 間歇失敗（overlapping、weekly/daily）

**大小：** S　**狀態：** ready-for-agent（插入任務，來自票 005 的完整 e2e 重跑）

**成果（What to build）：** 找出並修好完整 `npm run test:e2e` 連續執行時清單不一致的原因，讓 NFR-01 的「連續 3 次通過清單完全相同」成立。用 `/diagnosing-bugs` 的紀律：重現、最小化、立假說、下探針、修好、補回歸測試。

**Blocked by：** 無

**對應 TC／人工：** NFR-01；TC-01、TC-02（拖曳輔助函式）

**驗收指令：** `npm run test:e2e`（連續 3 次）、`npx playwright test -g overlapping --repeat-each=40 --workers=8`

**要讀的規格段落：** `docs/LESSONS.md`（「magnet 測試另有間歇失敗」、「e2e 還有其他間歇失敗」）；`docs/03-srs.md` NFR-01；`issues/001-fix-drag-helper.md`

## 已知證據（2026-11-04，票 005 期間）

- 完整 e2e 3 次：33／33／34 passed。失敗分別為 `overlapping events are allowed and keep their times`（收到的時間清單不等於 `['Mon 10:00', 'Mon 11:00']`）與 `weekly and daily views share data, and edits carry across`（`toHaveText` 失敗）。
- `-g overlapping --repeat-each=10 --workers=4`：失敗 1/10。
- 另有已知的 magnet 測試間歇失敗（約 1/40，收到 `Mon 09:56` 而非 `Mon 10:26`，差 30 px）。
- **未驗證的推測**：`dragBall` 放開前只等 `drop-ghost` 可見，但中途點就已出現預覽，放開時位移可能還停在中途點。三項是否同因未知。

## 驗收條件

- [ ] 重現並分類原因（測試輔助函式、產品競態或環境），附證據，補進 `docs/LESSONS.md`。
- [ ] 若為 `dragBall` 放開時機：改為等預覽移到最終位置；不用固定等待、不放寬斷言、不刪測試。
- [ ] 修正前後各以 `--repeat-each=40 --workers=8` 記錄失敗數。
- [ ] 完整 `npm run test:e2e` 連續 3 次，通過清單完全相同。
- [ ] 完成後回頭處理票 001「3 次清單一致」與票 004a 最後一項的勾選。

共同規則（先讀）：[`issues/README.md`](README.md)。
