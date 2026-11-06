# 026a：框選多個區塊（含與 radial 分流）

**大小：** M　**狀態：** 完成（2026-11-06；M-09 手感待專案擁有者；未 commit）

**成果（What to build）：** 在日曆空白處按下後快速拖曳畫出框，放開時與框相交的可見區塊成為選取；與 radial 長按分流；多選時右側面板不顯示。

**Blocked by：** 票 025（已完成）。

**對應 TC／人工：** TC-18 第 1、3、5、6 項；AC-04.1、FR-12；M-09

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

**要讀的規格段落：** `docs/01-brief.md` G-08；`docs/02-prd.md` US-04；`docs/03-srs.md` FR-12～FR-14、R-9；`docs/06-test-plan.md` TC-18；`docs/LESSONS.md`

## 驗收條件

- [x] 引擎：框與矩形相交的純函式，單元測試（TC-18 第 1 項）。
- [x] store：`selectedEventIds` 與 `selectMany`；`select`、`setEditing`、`hydrate`、`reset`、復原會清掉或過濾多選；單選欄位在多選時為空（TC-18 第 3 項）。
- [x] 手勢：250 ms 內移動超過 6 px → 框選；滿 250 ms 仍是 radial，之後不變成框選（TC-18 第 5 項）。
- [x] 放開時碰到的可見區塊被選中；隱藏區塊不被選中（無專屬斷言，見完成紀錄）；沒碰到任何區塊就清除；新選取取代舊選取。
- [x] 框選中按 Escape 還原到框選前；沒有進行中的手勢時 Escape 清除（現況）；點選中的區塊（不拖曳）縮成一個（TC-18 第 6 項）。
- [x] 框選不寫任何檔案；右側面板在多選時不顯示。
- [x] 現有 e2e 全過。

## 備註

- 框的樣式由實作者決定（半透明方框，沿用 `DESIGN.md` 的色彩），留待專案擁有者試用。
- 沒有新的使用者可見文字，不新增 i18n 項目。
- radial 的時間與容許值用 `limits.ts` 的常數，不重複寫數字。

## 完成紀錄（2026-11-06）

- 測試與結果見 `docs/06-test-plan.md` TC-18 與追溯表（`typecheck`、`lint` Passed；`npm test` 405；`test:e2e` 連續 3 次皆 80 passed）。
- 檔案：`useMarqueeSelect.ts`（新）、`CalendarGrid.tsx`（框的覆蓋層與選取外觀）、`appStore.ts`（`selectedEventIds`、`selectMany`）、`pointer.ts`（`rectFromPoints`、`rectsIntersect`）、`EventBlock.tsx`（沿用既有 `data-event-id`）。
- 框選以畫面上已渲染的區塊 `data-event-id` 比對，所以隱藏區塊天生不會被選中；沒有專屬測試。
- 偏差：Escape 清除選取是**現況**（`useKeyboardShortcuts.ts` 本來就有），不是新行為，這一點訪談時我說錯了，規格已更正。
- 框的樣式（半透明 ink 方框）待專案擁有者試用。
- **桌面手動驗收**：（2026-11-06 專案擁有者用重新編譯的 Windows 桌面版手動測過：從空白處拖出框、框選兩個活動、拖其中一個讓兩個一起移動，三步通過；M-09 的其餘項目——Escape、視窗外放開、一般點擊與長按不受影響、手感評語——未回報）。
- **未驗證**：M-09 其餘項目；`test:rust`、`test:desktop` 未跑。

共同規則（先讀）：[`issues/README.md`](README.md)。
