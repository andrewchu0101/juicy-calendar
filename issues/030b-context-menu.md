# 030b：事件與日曆空白處右鍵選單

**大小：** M　**狀態：** 已實作，自動回歸完成（493 單元、47 Rust、141 e2e）；桌面人工待驗收　**Blocked by：** 無；依賴 030a 已具備的 action

**讀取：** AGENTS.md、CLAUDE.md、CODING_STANDARD.md、docs/LESSONS.md、030；PRD US-07、SRS FR-18／19 與 R-12、SDS UI-08、Test Plan TC-21 及 TC-19。

## 完成條件

- [x] 已選事件保留整組、未選事件單選它、空白右鍵保留選取；不寫檔、不進歷史。
- [x] 單選複製／改名／刪除、多選複製／刪除；空白貼上／復原／重做，顯示快捷鍵與正確停用狀態。
- [x] 與快捷鍵共用 action；貼上鎖定右鍵按下位置，游標移向選單不改目標。
- [x] Escape／點外部／捲動／切換檢視關閉且保留選取，關閉點擊不穿透；方向鍵／Enter／焦點返回可用。
- [x] 手勢進行中不開選單；輸入原生選單保留，標題／時間軸／模板／設定背景無自訂選單；左鍵舊行為維持。
- [ ] 中英、900×560 選單可用；桌面人工結果單獨標記，不以 e2e 代替。

瀏覽器中英與最小視窗已自動驗證並檢視截圖；Windows WebView2 原生選單／焦點／手感人工尚未做，因此最後一項保留待驗收。執行證據與實際偏差見 Test Plan、HANDOFF 及 LESSONS。使用者後續明確授權直接完成 030b／030c，取代下方逐個紅燈等待人確認及另開對話的流程限制；仍不 commit／push。

## 範圍、紅燈與驗收

`useMarqueeSelect.ts` 目前先清選取再判斷主鍵：優先新增 TC-21.1，舊實作應因右鍵清掉多選而失敗，貼出輸出待人確認後修正。擴及 EventBlock、CalendarGrid、AppShell、useKeyboardShortcuts、必要選單元件／hook、i18n 字典及對應單元與新 e2e/contextMenu.spec.ts。與 030a 共用 action，不新增 Rust／格式／套件。

執行 typecheck、lint、npm test、test:e2e（含 TC-18、19 舊手勢），回填 Test Plan／HANDOFF；人工未做標待驗收。每個正確紅燈等人確認；舊測試期待需變先列依據。共同規則見 issues/README.md；新對話 `$implement-gaston`，不自動提交。
