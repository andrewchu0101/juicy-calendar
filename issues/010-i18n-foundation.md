# 010：多語系基礎：語言選單、偵測與設定持久

**大小：** L　**狀態：** 完成（2026-11-04；桌面版實機讀寫設定檔為 Manual Pending）

**成果（What to build）：** 歡迎畫面出現語言選單；第一次啟動依系統語言決定繁體中文或英文，切換立即生效，重新啟動後仍維持。語言設定存在這台電腦的 App 設定（不跟工作區走）。歡迎畫面本身完整翻譯，作為端到端的樣板。

**Blocked by：** 006、007

**對應 TC／人工：** TC-11（偵測、持久）、TC-10（`app_settings`）；AC-03.2、FR-09

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`、`npm run test:e2e`

**要讀的規格段落：** `docs/04-sad.md` ADR-02、ADR-03；`docs/05-sds.md` API-05、API-06、`i18n` 與 `app_settings` 契約；`docs/03-srs.md` R-7；測試計畫 TC-10、TC-11

## 驗收條件

- [x] 先寫 TC-11 與 `app_settings` 測試並看到紅燈。
- [x] 偵測：`zh-TW`、`zh-HK`、`zh-CN`、`zh` → 繁體中文；`en-US`、`ja-JP` → 英文；取不到任何資訊 → 英文。
- [x] 字典型別保證兩種語言鍵值完全相同（缺鍵時型別檢查失敗）。
- [x] Rust `app_settings`：不存在、損毀、值不合法 → 讀回 `null` 且損毀檔不被修改；寫入 `en` 讀回 `en`；寫入 `fr` 被拒絕且不改檔；目錄以參數傳入，測試用暫存資料夾。
- [x] `platform_win` 只做 `system_locale`（僅 Windows；其他平台回傳空值）；unsafe 只在此模組。
- [x] 瀏覽器版 backend 補上對應實作（`localStorage` 與 `navigator`）。
- [x] e2e：Playwright 設為 `zh-TW` 時歡迎畫面為繁體中文，`en-US` 時為英文；現有 e2e（`en-US`）維持通過。
- [x] 損毀的 `app-settings.json` 使用偵測結果，直到使用者下次切換語言才被覆寫。
- [x] 沒有新增任何套件。

## 備註

一張票涵蓋 Rust、兩種 backend 與歡迎畫面；耦合度高，拆開會產生中間狀態無法編譯。

共同規則（先讀）：[`issues/README.md`](README.md)。

## 實際偏差與未驗證（2026-11-04）

- **沒有 `I18nProvider`**：SDS 寫 React context；實作用 zustand store（專案已有）加 `useT()` hook，效果相同、測試環境不需要 DOM。
- **`serde_json`**：從 `[dev-dependencies]` 搬到 `[dependencies]`（專案擁有者同意）。`Cargo.lock`、`package.json`、`package-lock.json` 沒有變動，無新增套件。
- **儲存失敗是錯誤通知**（專案擁有者決定）：`setLanguage` 不再拒絕，改由 `i18n` store 的 `saveError`（代碼 `LANGUAGE_SAVE_FAILED`）傳達，獨立於 `appStore`；先前寫的「儲存失敗時 `setLanguage` 會拒絕」測試因此被取代。只在歡迎畫面顯示。
- **`system_info.hour12` 固定 `null`**（票 013）；瀏覽器版 `systemInfo.locale` 取 `navigator.languages[0]`。
- **改動票以外的既有檔案**：`persistence.test.ts` 內自組的 `WorkspaceBackend` 補三個預設方法（介面新增才能編譯），沒動斷言。
- **暫存資料夾輔助**：`app_settings` 測試內放了一份小的 `TempDir`，未抽成共用（SDS 建議共用）。
- **未驗證**：見 `docs/06-test-plan.md` AC-03.2 列的 Manual Pending 與「未涵蓋」。
