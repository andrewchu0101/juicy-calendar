# 026b：整批移動選中的區塊

**大小：** M　**狀態：** 完成（2026-11-06；M-09 手感待專案擁有者；未 commit）

**成果（What to build）：** 拖曳任一個已選中的區塊，所有選中的區塊一起移動，保持彼此的時間差；放開時一次提交、可一次復原；Escape 或在日曆外放開整批回原位。

**Blocked by：** 026a。

**對應 TC／人工：** TC-18 第 2、4、7 項；AC-04.2、AC-04.3、FR-13；M-09

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

**要讀的規格段落：** `docs/01-brief.md` G-08；`docs/02-prd.md` US-04；`docs/03-srs.md` FR-12～FR-14、R-9；`docs/06-test-plan.md` TC-18；`docs/LESSONS.md`

## 驗收條件

- [x] 引擎：整批位移純函式，被抓住的區塊依 R-1 磁吸，其他區塊套同一時間差，長度不變、可跨天（TC-18 第 2 項）。
- [x] store：`moveEvents` 一次提交、一次復原（TC-18 第 4 項）。
- [x] 拖曳中所有選中的區塊同步預覽；放開才一次寫入。
- [x] Escape、在日曆外放開：整批回原位，事件檔不變，選取不變（TC-18 第 7 項）。
- [x] 沒有拖曳的點擊或雙擊：選取縮成那一個。
- [x] 單一區塊的拖曳與縮放行為不變，現有 e2e 全過。

## 備註

- 「在日曆以外」以指標是否在日曆欄區域之外判定，只套用在整批移動；單一區塊移動維持現況。

## 完成紀錄（2026-11-06）

- 測試與結果見 `docs/06-test-plan.md` TC-18 與追溯表（`typecheck`、`lint` Passed；`npm test` 405；`test:e2e` 連續 3 次皆 80 passed）。
- 檔案：`mutations.ts`（`moveEventsTogether`）、`appStore.ts`（`moveEvents`）、`useEventInteractions.ts`（整批手勢、日曆外放開拒絕）、`CalendarGrid.tsx`（預覽）。
- 磁吸沿用 R-1（8 px 內才吸附），不是固定 30 分鐘；規格已據此寫。訪談時我曾說成「30 分鐘吸附」，那是不精確的說法。
- **桌面手動驗收**：（2026-11-06 專案擁有者用重新編譯的 Windows 桌面版手動測過：從空白處拖出框、框選兩個活動、拖其中一個讓兩個一起移動，三步通過；M-09 的其餘項目——Escape、視窗外放開、一般點擊與長按不受影響、手感評語——未回報）。
- **未驗證**：M-09 其餘項目（Escape、視窗外放開）；`test:rust`、`test:desktop` 未跑。

共同規則（先讀）：[`issues/README.md`](README.md)。
