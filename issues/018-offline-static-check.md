# 018：離線靜態檢查

**大小：** S　**狀態：** 實作完成（M-06 正式監看待專案擁有者；試跑發現 WebView2 連線，待決定）

**成果（What to build）：** 用測試保證 App 執行時不對外連線：安全政策只允許本機 IPC，原始碼沒有對外的網路呼叫；並把 M-06 的人工監看方法定案。

**Blocked by：** 無（可立即開始）

**對應 TC／人工：** NFR-03；M-06

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`

**要讀的規格段落：** `docs/03-srs.md` NFR-03；`docs/04-sad.md` 信任邊界；測試計畫 M-06

## 驗收條件

- [x] 測試讀取打包設定的安全政策，斷言只允許本機與 IPC 的連線來源，沒有外部網域。
- [x] 測試掃描原始碼，沒有對外網路呼叫（`fetch`、`XMLHttpRequest`、`WebSocket` 等指向外部位址）；掃描方式寫在測試裡並說明其限制。
- [x] 在 `docs/06-test-plan.md` 把 M-06 的監看工具與步驟寫成可重做的流程（仍標「未執行」）。

## 備註

靜態檢查不能取代實際的網路監看，所以 M-06 仍保留為人工。

共同規則（先讀）：[`issues/README.md`](README.md)。

## 實作紀錄與偏差（2026-11-05）

- 新增 `src/offline/offline.test.ts`（19 項，TC-15）、`src/test-support/cspCheck.ts`（CSP 白名單檢查）、`src/test-support/networkCalls.ts`（用專案已有的 `typescript` 解析原始碼，抓網路 API 呼叫與外部網址；另有 HTML／CSS 掃描）。沒有新增套件，沒有改動任何設定檔（`.mjs` 之外的 ESLint 全域設定也沒動）。
- 先紅後綠的項目：CSP 檢查器（空殼回傳 `[]`；本機來源誤報 `http://ipc.localhost`）、網路 API 掃描（空殼）、本機 `import('./x')` 被誤報、外部網址、HTML／CSS 掃描。其中一次綠燈後前一個測試多出 2 筆（`new WebSocket('wss://…')` 與 `import('https://…')` 的參數被網址規則又報一次），測試不動，改實作讓已被呼叫規則報過的參數不重複回報。
- **特徵化（加入時沒有紅燈）**：通配符、只有協定的來源、裸網域等 8 個 CSP 案例（白名單寫法已涵蓋）；對真實 `tauri.conf.json` 與真實原始碼的掃描（現況本來就乾淨）。為了證明它們不是空轉，做了變異檢查：①把 `https://evil.example` 暫時加進 `connect-src` → 2 項轉紅；②在 `src/offline` 暫時放一個 `fetch('https://evil.example/track')` 的檔案 → 1 項轉紅，指出檔案與行號。兩者都已還原（`git diff` 確認設定檔沒有變動、暫存檔已刪）。
- 掃描有「檔案數大於 30、含 `app/main.tsx`、含 `index.html` 與 `src/app/index.css`」的檢查，避免空掃描假通過。
- 掃描限制已寫在測試裡與測試計畫 TC-15：看不到間接呼叫、第三方套件的連線、執行期組出的網址、Rust 端、WebView 執行階段本身的連線。
- M-06 已寫成可重做的流程（PowerShell 內建指令、不需系統管理員、不需安裝東西），仍標「未執行」；文件裡的腳本已用「從文件原樣抽出」的方式試跑可執行。

## 重大發現：WebView2 執行階段在 App 啟動後就會對外連線（待專案擁有者決定）

- 預跑（2026-11-05，Windows 11，WebView2 156.0.4314.58，免安裝版 release 執行檔；5 次嘗試、3 次有效、2 次因啟動失敗而無效，完整表格見 `docs/06-test-plan.md`「M-06 預跑紀錄」；有效的 3 次中 2 次對 `2603:1046:c11:802::2:443`、1 次對 `…c11:805::2:443`）：App 啟動後 3 秒內，子行程 `msedgewebview2.exe`（`--embedded-browser-webview=1`）就建立 TCP 連線。
- 這不是我們的程式碼：CSP 與原始碼掃描都乾淨；是 WebView2（Microsoft Edge 執行階段）自己的背景連線。位址的擁有者我**沒有查證**，不宣稱是哪個服務。
- 影響：SRS NFR-03「App 執行時不對外連線」在字面上**可能做不到**；M-06 照現狀跑會失敗。這是規格層級的決定，我不自己選。依專案擁有者指示（2026-11-05），NFR-03 已在 SRS 拆成 03a／03b／03c 三個要求，調查範圍另開票 024。可能的方向（未驗證）：①修改 NFR-03 的寫法，把 WebView2 執行階段的背景連線排除並明講；②研究能否用 Tauri 視窗的 `additionalBrowserArgs`（或環境變數 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`）關掉背景網路，再實測連線是否消失，也要評估這會不會影響功能；③兩者並行。
- 另一個發現（流程面）：用 `kill` 強制結束 App 會留下孤兒的 `msedgewebview2.exe`，占住資料夾，下一次啟動會因「資源正在使用中」失敗。我試跑時留下的 3 個孤兒行程已用 PID 結束，現在殘留為 0。這也提醒：測試與 M-06 一律正常關閉（`CloseMainWindow`）。

## 未驗證
①M-06 的正式 5 分鐘以上操作監看；②連線的對象與用途；③`pktmon`／資源監視器的交叉確認（沒試跑）；④在乾淨機器、安裝版上是否同樣會連線；⑤Rust 端（Cargo 依賴、capabilities）沒有掃；⑥WebView2 瀏覽器參數能否關掉背景連線（未研究、未實測）；⑦`npm run test:e2e` 本輪沒跑。
