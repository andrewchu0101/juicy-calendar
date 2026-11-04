# Juicy Calendar —— agent 工作規則

> 來源：`agent-templates/AGENTS.safe.md`，併入接手前 demo 的專案規則。
> 與 `CLAUDE.md`（初始化與協作流程）、`CODING_STANDARD.md`（程式碼規範）並用。

## 規格在哪

- 需求以 `docs/02-prd.md` 與 `docs/03-srs.md` 為準，設計以 `docs/04-sad.md` 與 `docs/05-sds.md` 為準，測試以 `docs/06-test-plan.md` 為準。PRD 與 SRS 已確認（2026-11-04）；SAD、SDS 與測試計畫為草稿，與已確認文件衝突時以已確認者為準並回報我。工作票在 `issues/`，共同規則見 `issues/README.md`。
- 規格沒寫的現有行為，依據是 `PRODUCT.md`、`DESIGN.md`、`ARCHITECTURE.md`；三份是 demo 作者的描述，**不等於已確認規格**。
- 文件之間、或文件與程式衝突時，**停下來問我**，不要自己選一個。
- 規格沒寫的行為，不要自己決定。列出來問我。

## 怎麼跑

```bash
npm install            # 安裝
npm run dev            # 瀏覽器模式 http://localhost:1421（localStorage backend）
npm run desktop        # Tauri 桌面版（需要 Rust，見 CLAUDE.md 第 8 節）
npm run typecheck && npm run lint && npm test
npm run test:rust      # 需要 cargo
npm run test:e2e       # Playwright（WebKit）
npm run build
```

說「完成」之前，必須跑過相關測試指令，並把結果貼出來。

## 範圍

- 一次只做一張票。發現需要改票以外的檔案，先問我。
- 不重構與這張票無關的程式碼。

## 套件

- **不准新增任何套件**，除非先說明理由並得到我同意。
- 允許的套件以 `package.json` 與 `src-tauri/Cargo.toml` 現有的為準。

## 秘密

- API key、密碼、token 一律從環境變數讀取，不准寫進任何檔案。
- 不准讀取或印出 `.env` 的內容。
- 範例設定檔用 `.env.example`，值一律填 `changeme`。

## 輸入與輸出

- 所有外部輸入（使用者輸入、磁碟上的 JSON、IPC 參數）都要驗證格式，驗證失敗就拒絕，不要猜。
- 從磁碟讀入的內容一律經過 Zod（`src/services/persistence/schemas.ts`）。
- 錯誤訊息不准包含堆疊追蹤或本機絕對路徑。

## 本專案

1. 所有時間與幾何運算只放在 `src/features/calendar/engine/`，不在元件或 Rust 重複。
2. 元件不碰持久化。事件的改動一律走 `appStore` 的 action。
3. 指標手勢狀態留在 hook 內，手勢結束時才一次 commit 進 store。
4. Rust 只做原生能力，不放行事曆、事件或模板邏輯。
5. IPC 不傳絕對路徑。新增檔案種類要加 allow-list 並寫 Rust 測試。
6. 球維持純色（見 `DESIGN.md`）。
7. 新事件一律 120 分鐘，不加吸附以外的重疊處理（見 `PRODUCT.md`）。
8. 改動磁碟格式必須提升 `schemaVersion` 並處理遷移。
9. 事件與模板名稱不得超過 30 個使用者看到的字元；事件長度必須在 1 到 10080 分鐘（經過時間）。常數只在 `limits` 一處定義。
10. 被拒絕的輸入一律還原原值、不進寫入佇列、不寫檔。
11. IPC 錯誤是 `{code, detail}`；介面文字只能來自 i18n 字典，不得直接顯示 `detail`。
12. `.juicy.lock` 與 `app-settings.json` 不進前端的路徑允許清單；Windows 原生呼叫與 unsafe 只放在 `platform_win`。
13. 時間顯示一律用 `formatTime`，不得寫死 `HH:mm`；現在時間用全域 `Date`，測試以假計時器或 Playwright 時鐘固定。
14. 新規則的測試要先看到原因正確的紅燈再實作；e2e 的拖曳在放開滑鼠前必須等放置預覽出現。
15. 打包 NSIS 前先問我（可能寫入 C 槽）；測試不得開啟使用者的真實工作區。
16. Windows 路徑與反斜線：寫進檔案、`!` 指令或腳本的 Windows 路徑一律用正斜線（`D:/Project/...`）。必須用 Python 寫入含反斜線的文字時，用原始字串（Python 的 r 前綴字串，例如 r'D:/x'），寫完檢查檔案裡沒有控制字元（反斜線加 t 會變成 Tab，反斜線加 a 會變成 BEL）。

## 不准做的事

- 不准 `git push --force`、不准 `git add -A`、不准合併 PR。
- 不准刪除或修改測試來讓測試通過。
