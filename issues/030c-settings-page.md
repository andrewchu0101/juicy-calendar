# 030c：集中設定頁

**大小：** M　**狀態：** 已實作，自動回歸完成（493 單元、47 Rust、141 e2e）；原生人工待驗收　**Blocked by：** 030b 已整合

**讀取：** AGENTS.md、CLAUDE.md、CODING_STANDARD.md、docs/LESSONS.md、030；PRD US-06、SRS FR-17 與 R-11／12、SAD ADR-02／05、SDS UI-07、Test Plan TC-20。

## 完成條件

- [x] 工作區工具列入口與返回，獨立頁面集中語言／時段／磁吸／縮放，即改即存；返回位置與選取保留。
- [x] 工具列與歡迎語言控制保留；語言 App 全域、其餘工作區隔離、portable 保存位置不變（沿用原 API／路徑；原生實機未重驗）。
- [x] 非法輸入還原、不入列／寫檔；頁面縮放 0.5..3，舊檔 0.4..4 可載入且未操作時原值保留，不偷偷夾值。
- [x] 設定頁事件快捷鍵停用，文字操作正常；不出現手動時間格式、深色模式或模板時長設定。
- [x] 儲存失敗沿用既有語言錯誤行為，中英／最小視窗可用，重開一致（瀏覽器已驗；Windows 原生人工待驗收）。

證據與偏差見 Test Plan／HANDOFF／LESSONS。使用者後續明確授權同一對話直接完成 030b／030c，後續紅燈由代理自行確認；沒有新增套件、Rust／IPC／磁碟格式變更，未 commit／push。

## 範圍、紅燈與驗收

App／AppShell、CalendarToolbar、新設定頁元件、appStore.updateSettings 與命令隔離、schemas 的共用驗證接縫、i18n 字典及對應單元／整合與新 e2e/settings.spec.ts。沿用 API-05／settings.json；不改既有磁碟合法範圍、格式或 Rust。

優先測 TC-20.3：非法 startHour 值在舊 updateSettings 被直接合併，核對狀態與零寫入，貼出原因正確紅燈等人確認後修正。保留工具列測試期待，不能靠刪除／放寬通過。

執行 typecheck、lint、npm test、test:e2e，回歸 TC-06／11／12／18～21 與 layout；回填 Test Plan／HANDOFF。每個正確紅燈等人確認；需改舊測試先列 AC／FR 依據。共同規則見 issues/README.md；新對話 `$implement-gaston`，不自動提交。
