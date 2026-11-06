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

- 右側面板在多選時不顯示。**2026-11-06 修訂**：專案擁有者選擇新增可見入口（見末段「追加：選取列」），不放在右側面板，而是多選時另顯示一條選取列。

## 完成紀錄（2026-11-06）

- 測試與結果見 `docs/06-test-plan.md` TC-18 與追溯表（`typecheck`、`lint` Passed；`npm test` 405；`test:e2e` 連續 3 次皆 80 passed）。
- 檔案：`appStore.ts`（`deleteSelected`）、`useKeyboardShortcuts.ts`（`Delete`／`Backspace` 改呼叫 `deleteSelected`，單選也走同一條）。
- **未驗證**：M-09 手感（桌面版）；`test:rust`、`test:desktop` 未跑。

## 桌面版驗證（2026-11-06，專案擁有者要求；未 commit，未改程式碼）

環境：Windows 11 組建 10.0.26200、WebView2 156.0.4314.58；以目前原始碼 `npx tauri build --no-bundle`（exit 0，Rust 1.90.0）編出 `src-tauri/target/release/juicy-calendar.exe`（2026-11-06 23:37，與 `D:/DevCache/m09/app/` 的複本雜湊相同）。暫存工作區在 `D:/DevCache/m09/app/data`（免安裝模式，不碰真實工作區）。

方法與限制：透過 WebView2 遠端除錯埠（只在我啟動的程序用環境變數開啟）以 Playwright 連到**真正的 Tauri webview**，建立三個活動（週一 10:00、週二 10:00、週一 16:00）、框選前兩個；滑鼠操作（拖球、框選）是 CDP 送的，**不是**作業系統層的真實滑鼠；鍵盤另以 Win32 `keybd_event` 送**真實作業系統按鍵**，並在頁面端記錄收到的事件。

結果：
- CDP 合成按鍵：`Delete`、`Backspace` 各一次——刪掉選中的兩個、留下第三個；`Ctrl+Z` 一次全部回來。
- 作業系統層真實按鍵，每次送鍵前確認 App 為前景視窗：`Delete` 5/5、`Backspace` 5/5 通過；每輪頁面都收到對應的 `keydown`；刪除後畫面剩 1 個區塊、磁碟剩 1 個事件檔；一次真實 `Ctrl+Z` 後回到 3 個，事件檔與刪除前**逐位元組相同**（SHA-256 比對）。存活的是週一 16:00 那一個。
- **中途的失敗（原因是我的測試方法，不是 App）**：未檢查前景視窗的早期嘗試中，真實 `Delete` 一次、真實 `Backspace` 一次沒有刪除；其後那次 `Ctrl+Z` 復原了更早的操作，弄亂測試狀態，我清掉暫存工作區重做。加上「確認前景」後 10/10 通過。**推測**是按鍵送到別的視窗（沒有直接抓到證據）；若你手動測遇到沒反應，先確認點過視窗內部、焦點不在輸入框。
- 沒有發現需要修的 bug，**沒有改任何原始碼**。

介面現況：單選時右側面板有「刪除事件」鈕；**多選時面板不顯示，畫面上沒有刪除入口，也沒有任何快捷鍵提示**（票上原先決定不在面板加刪除鈕）。是否新增可見入口，待專案擁有者決定。

共同規則（先讀）：[`issues/README.md`](README.md)。

## 追加：選取列（2026-11-06，專案擁有者選方案 1；未 commit）

- **成果**：多選（2 個以上）時，日曆上方的工具列區域顯示「已選 N 個事件」與紅字「刪除」鈕（**2026-11-07 修訂**：原本放在日曆區右上角、與右側面板同位置，會蓋住「週日」標題，專案擁有者要求改放工具列）；按下立即刪除全部選中的區塊，不問確認，整批一個可復原步驟。單選與未選時不顯示。
- **設計決定（我定的，專案擁有者可改）**：位置在工具列（行內項目，`flex-wrap` 空間不足時換行；寬視窗時放得進同一行，日曆不位移）；文字用「事件」（與既有「刪除事件」一致）；不顯示快捷鍵提示文字；按鈕與鍵盤走同一個 `deleteSelected`。
- **檔案**：新增 `src/features/calendar/components/SelectionBar.tsx`；`src/app/AppShell.tsx` 掛上；`src/i18n/dictionary.ts` 新增 `selection.count`、`selection.deleteAria`（zh-TW、en）。SRS FR-14 已補一句。
- **測試**（先紅後綠）：e2e `multiSelect.spec.ts` 新增 3 項（點「刪除」鈕一次刪兩個、一次復原且檔案一致；單選與未選不顯示且不與面板同時出現；鍵盤刪除後列消失、未選的區塊不動）；字典測試新增 2 列。紅燈：e2e 收到 `element(s) not found`（`selection-bar`），字典收到鍵名 `selection.count`。後兩項 e2e 在實作後才加，沒有紅燈（特徵化）；突變檢查（讓單選也顯示）使「不顯示」那項轉紅（預期 0、收到 1），已還原。
- **結果**：`typecheck`、`lint` Passed；`npm test` 441/441；`npm run test:e2e` 83 passed（用暫時設定改埠 1431，因為 1421 被使用者的 `npm run dev` 占住；暫時設定檔已刪除）。
- **桌面版驗證（2026-11-06，Windows 11 組建 26200，重新編譯 23:53:58 的 `juicy-calendar.exe`，暫存工作區 `D:/DevCache/m09/app/data`）**：框選由 CDP 模擬；**刪除鈕以真實作業系統滑鼠點擊**（`SetCursorPos`＋`mouse_event`，點前確認 App 為前景視窗，座標由視窗客戶區原點與 devicePixelRatio=1 換算）。點擊後畫面剩 1 個區塊（週一 16:00）、磁碟剩 1 個事件檔、選取列消失；真實 `Ctrl+Z` 一次後回到 3 個區塊、3 個事件檔，三個區塊的時間與刪除前相同。截圖確認外觀：右上角圓角浮動列「已選 2 個事件　刪除」。本次**沒有**逐位元組比對復原後的檔案（鍵盤路徑在前一輪已比對過，走同一個 `deleteSelected`／`undo`）。
- **遮擋問題已處理（2026-11-07）**：選取列改放工具列。新增 `e2e/selectionBar.spec.ts` 6 項（英文、繁中 × 1400×900、900×560、900×560＋深色偏好）：檢查列在工具列內、不與 7 個日期標題／區塊／工具列控制項的外框相交、這些元素的中心點沒被遮住、無橫向捲動、寬視窗日曆不位移、刪除鈕與「週」按鈕與下拉選單的可操作性（`trial` 點擊）。先紅後綠：紅燈 6/6（`selection bar is not inside the toolbar`、`bar overlaps day header`、`day header is covered by selection-delete`），綠燈 6/6。截圖（`LAYOUT_SCREENSHOT_DIR` 可存）目視：週日標題、活動、工具皆可見。限制：專案目前**沒有深色模式**，`colorScheme: dark` 只證明偏好深色時版面與可操作性不變，不是在驗深色配色；窄視窗時 900×560 在目前文字長度下選取列仍放在第一行，**沒有刻意構造到需要換行的情況**，換行只由 `flex-wrap` 保證。**右側面板遮擋工具列／週日標題的問題另記，這輪不處理**（見 `docs/HANDOFF.md`）。
- **桌面版重測（2026-11-07，重新編譯 00:04:11 的 `juicy-calendar.exe`，暫存工作區）**：框選（CDP 模擬）→ 整批移動（拖週一 10:30 到週二 12:30，兩個選中區塊一起 +1 天 +2 小時，第三個不動）→ **真實滑鼠**點選取列「刪除」→ 剩 1 個區塊、1 個檔 → **真實 Ctrl+Z** 一次回到 3 個區塊 3 個檔（移動後的位置）→ 再一次 Ctrl+Z 撤銷移動回到原位。
- **未驗證**：M-09 手感由專案擁有者親手測；窄視窗實際需要換行時的樣子。

