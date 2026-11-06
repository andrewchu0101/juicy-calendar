# 023：工具列語言選單

**大小：** S　**狀態：** 完成（2026-11-05，未 commit；選單位置／樣式為實作者假設，待專案擁有者確認；人工操作未做）

**成果（What to build）：** 在日曆工具列加入語言選單，與歡迎畫面共用同一個元件（SDS UI-03）。使用者在日曆畫面切換語言，介面立即改變，不需重新整理，重開後維持。

**Blocked by：** 010、011（皆已完成）

**對應 TC／人工：** TC-11；FR-09

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

**要讀的規格段落：** `docs/05-sds.md` UI-01、UI-03；`docs/03-srs.md` FR-09、R-7；`src/components/WelcomeScreen.tsx`（現有語言選單）；`docs/LESSONS.md`

## 驗收條件

- [x] 工具列有語言選單，與歡迎畫面共用同一個元件（不複製一份）。
- [x] 在日曆畫面切換語言，工具列、格線、標題立即改變，不需重新整理（e2e：同一頁面內切換，前後比對文字）。
- [x] 重新載入後語言維持（沿用 `app-settings`，不新增儲存位置）。
- [x] 儲存失敗時沿用既有 `saveError` 代碼顯示，不顯示診斷文字。
- [x] 選單本身的標籤與選項名稱（`繁體中文`、`English`）兩種語言下都正確。
- [x] 補完票 011 未勾選的「切換語言立即反映」，並回頭勾選。

## 備註

與 012、013、019 會修改同一批介面檔案，請依序做。選單放在工具列的位置與樣式規格未定，開工前先問專案擁有者。

共同規則（先讀）：[`issues/README.md`](README.md)。

## 結果（2026-11-05）

- 新增 `src/components/LanguageMenu.tsx`（唯一一份選單與 `saveError` 顯示），`WelcomeScreen.tsx`（`className="absolute top-4 right-4"`）與 `CalendarToolbar.tsx`（放在工具列右側群組最後）都使用它。
- 紅燈：單元 3 項、e2e 4 項，原因見測試計畫追溯表 AC-03.2（票 023）列。
- **假設（需確認）**：票內說「位置與樣式規格未定，開工前先問專案擁有者」。你要求直接完成，我採最小假設——放工具列最右、沿用歡迎畫面的圓角下拉。若要改位置，只需改 `CalendarToolbar.tsx` 一行。
- 已回頭勾選票 011 的「切換語言立即反映」。
- 驗證：`npm test` 387 passed；完整 e2e 3 次皆 68 passed、清單相同；`--repeat-each=30 --workers=8` 120/120。
- 未驗證：桌面版（Tauri）與人工操作。

## 桌面版補驗證（2026-11-07）
桌面版工具列語言選單：兩語言各自命名、切換即時反映且免重載、重開保留。細節見 `docs/evidence/desktop-verification-2026-11-07.md`。選單位置與樣式仍是實作者假設，待專案擁有者確認。
