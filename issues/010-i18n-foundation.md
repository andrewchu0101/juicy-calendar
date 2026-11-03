# 010：多語系基礎：語言選單、偵測與設定持久

**大小：** L　**狀態：** ready-for-agent（前置票完成後才能開始）

**成果（What to build）：** 歡迎畫面出現語言選單；第一次啟動依系統語言決定繁體中文或英文，切換立即生效，重新啟動後仍維持。語言設定存在這台電腦的 App 設定（不跟工作區走）。歡迎畫面本身完整翻譯，作為端到端的樣板。

**Blocked by：** 006、007

**對應 TC／人工：** TC-11（偵測、持久）、TC-10（`app_settings`）；AC-03.2、FR-09

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`、`npm run test:e2e`

**要讀的規格段落：** `docs/04-sad.md` ADR-02、ADR-03；`docs/05-sds.md` API-05、API-06、`i18n` 與 `app_settings` 契約；`docs/03-srs.md` R-7；測試計畫 TC-10、TC-11

## 驗收條件

- [ ] 先寫 TC-11 與 `app_settings` 測試並看到紅燈。
- [ ] 偵測：`zh-TW`、`zh-HK`、`zh-CN`、`zh` → 繁體中文；`en-US`、`ja-JP` → 英文；取不到任何資訊 → 英文。
- [ ] 字典型別保證兩種語言鍵值完全相同（缺鍵時型別檢查失敗）。
- [ ] Rust `app_settings`：不存在、損毀、值不合法 → 讀回 `null` 且損毀檔不被修改；寫入 `en` 讀回 `en`；寫入 `fr` 被拒絕且不改檔；目錄以參數傳入，測試用暫存資料夾。
- [ ] `platform_win` 只做 `system_locale`（僅 Windows；其他平台回傳空值）；unsafe 只在此模組。
- [ ] 瀏覽器版 backend 補上對應實作（`localStorage` 與 `navigator`）。
- [ ] e2e：Playwright 設為 `zh-TW` 時歡迎畫面為繁體中文，`en-US` 時為英文；現有 e2e（`en-US`）維持通過。
- [ ] 損毀的 `app-settings.json` 使用偵測結果，直到使用者下次切換語言才被覆寫。
- [ ] 沒有新增任何套件。

## 備註

一張票涵蓋 Rust、兩種 backend 與歡迎畫面；耦合度高，拆開會產生中間狀態無法編譯。

共同規則（先讀）：[`issues/README.md`](README.md)。
