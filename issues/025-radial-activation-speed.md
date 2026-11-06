# 025：radial 選單啟動速度

**大小：** S　**狀態：** 完成（2026-11-05；M-03 手感由專案擁有者回報通過；未 commit）

**成果（What to build）：** 使用者長按空白處叫出 radial 選單的等待時間，以及選單球向外滑出的進場動畫，感覺不再「太慢」。具體數值由專案擁有者決定。

**來源：** 專案擁有者於 2026-11-05 試用票 020 的桌面版後表示：「我覺得球啟動的速度太慢了」。

**現況（需核對程式與規格）：**
- 長按 450 ms 才叫出選單（`src/features/templates/hooks/useRadialPalette.ts` 的 `setTimeout(…, 450)`）。
- 進場動畫 220 ms（`src/app/index.css` 的 `radial-enter`；`DESIGN.md` 的 Radial picker 一行）。
- 按下後移動超過 6 px 就取消長按。
- 450 ms 與 6 px 寫在已確認的 `docs/02-prd.md` AC-01.4 與 `docs/03-srs.md` FR-04；改數值要同步修訂這兩份。

**Blocked by：** **專案擁有者決定**：
1. 長按時間改為多少 ms（目前 450）。
2. 進場動畫改為多少 ms，或是否取消（目前 220）。
3. 是否需要讓使用者在設定中調整（建議不做，先固定數值）。
4. 6 px 的移動容許值是否維持。

**對應 TC／人工：** AC-01.4、FR-04；M-03 的體驗部分

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`；人工 M-03（手感）

**要讀的規格段落：** `docs/02-prd.md` AC-01.4；`docs/03-srs.md` FR-04；`DESIGN.md` Radial picker；`docs/LESSONS.md`

## 驗收條件

- [x] **專案擁有者已決定**（2026-11-05）：長按 **250 ms**、進場 **120 ms**、移動容許 **6 px 維持**、**不做**使用者可調整。
- [x] 長按時間常數只在一處定義（目前寫死在 hook 內；若新增常數，放在引擎或 `limits`，並寫測試依據該常數而非複製數字）。
- [x] 按住未達新的長按時間就放開或移動超過容許值：不出現選單、不建立區塊、不寫檔（沿用既有拒絕分支）。
- [x] 達到新的長按時間：選單出現（e2e 以固定時鐘或等待放置預覽，而非固定 `waitForTimeout` 猜時間）。
- [x] 選單進場時間與 `DESIGN.md` 一致；減少動態效果時不播放進場動畫（沿用現有行為）。
- [x] PRD AC-01.4、SRS FR-04、`DESIGN.md` 的數字同步修訂。
- [x] 現有 e2e（含票 020 的 TC-16）仍通過；其中依賴 450 ms 的等待時間要依新數值調整，並說明調整原因。
- [x] 人工 M-03 有結果：專案擁有者 2026-11-05 在桌面版（Tauri 開發模式 `npm run desktop`）回報「通過，節奏很不錯」（口頭，未逐項記錄；減少動態效果、誤觸一般點擊與拖曳的細項未個別回報）。

## 備註

- 長按太短可能讓一般的點擊或拖曳框選意外叫出選單；若專案擁有者想要很短的時間，要先和票 026（多時段拖曳選取）一起考慮，因為兩者都用「在空白處按下」開始。
- 與票 020 修改同一批檔案（`useRadialPalette.ts`、`index.css`），請在 020 的人工驗收後再做。

共同規則（先讀）：[`issues/README.md`](README.md)。

## 完成紀錄（2026-11-05）

- 常數：`limits.ts` 新增 `RADIAL_LONG_PRESS_MS`（250）、`RADIAL_MOVE_TOLERANCE_PX`（6）、`RADIAL_ENTER_MS`（120）；`useRadialPalette.ts` 引用前兩者；`RadialPalette.tsx` 以 CSS 變數 `--radial-enter` 傳入進場時間，`index.css` 的 `.radial-choice` 改讀該變數（CSS 不再寫死數字）。
- 測試：`e2e/radialSpeed.spec.ts`（TC-17，3 項；凍結時鐘，見測試計畫）。
- 文件：PRD AC-01.4、SRS FR-04、DESIGN.md、PRODUCT.md、ARCHITECTURE.md、SDS 常數表、測試計畫 M-03 與追溯表已同步。
- 「減少動態效果時不播放進場動畫」：沿用既有 CSS（`animation: none`），本票沒有新增自動斷言，也未人工驗證。
- 既有 e2e 的 `waitForTimeout(250)`（等進場動畫）未改：進場縮短後仍足夠，不依賴 450 ms；既有測試都是等選單出現（真實時間），沒有寫死 450。
- **偏差**：(1) 第 4 項驗收「e2e 以固定時鐘」採 Playwright `clock.install`＋`pauseAt`，不是 `setFixedTime`；(2) `PRODUCT.md`、`ARCHITECTURE.md` 屬 demo 作者的描述，只改數字，其餘未動。
- **未驗證**：減少動態效果的人工確認；`test:rust`、`test:desktop` 未跑（本票未動 Rust）；release 版。
- 注意：Playwright 的 `clock.install` 之後時間仍會流動，必須 `pauseAt` 才凍結；負向斷言前要 `settle`（見 `docs/LESSONS.md` 未補，建議由專案擁有者決定是否收錄）。
