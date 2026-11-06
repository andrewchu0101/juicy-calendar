# 026c：整批刪除選中的區塊

**大小：** S　**狀態：** 完成（2026-11-06；M-09 手感待專案擁有者；未 commit）

**成果（What to build）：** 有區塊被選中時按 `Delete` 或 `Backspace`，立即刪除所有選中的區塊，整批算一個可復原步驟。

**Blocked by：** 026a。

**對應 TC／人工：** TC-18 第 4、8 項；AC-04.4、FR-14；M-09

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

**要讀的規格段落：** `docs/01-brief.md` G-08；`docs/02-prd.md` US-04；`docs/03-srs.md` FR-12～FR-14、R-9；`docs/06-test-plan.md` TC-18；`docs/LESSONS.md`

## 驗收條件

- [x] store：`deleteSelected` 一次提交、一次復原（TC-18 第 4 項）。
- [x] 鍵盤：`Delete`／`Backspace` 刪除全部選中的區塊，不問確認；單選的行為不變。
- [x] 對應事件檔被刪除；復原一次全部回來且內容一致（TC-18 第 8 項）。
- [x] 現有 e2e 全過。

## 備註

- 右側面板在多選時不顯示，所以不新增面板上的刪除鈕。

## 完成紀錄（2026-11-06）

- 測試與結果見 `docs/06-test-plan.md` TC-18 與追溯表（`typecheck`、`lint` Passed；`npm test` 405；`test:e2e` 連續 3 次皆 80 passed）。
- 檔案：`appStore.ts`（`deleteSelected`）、`useKeyboardShortcuts.ts`（`Delete`／`Backspace` 改呼叫 `deleteSelected`，單選也走同一條）。
- **未驗證**：M-09 手感（桌面版）；`test:rust`、`test:desktop` 未跑。

共同規則（先讀）：[`issues/README.md`](README.md)。
