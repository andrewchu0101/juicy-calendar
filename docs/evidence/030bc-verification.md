# 030b／030c 驗證紀錄（2026-11-08）

**2026-11-09 beta.3 補驗**：設定頁時間軸起點／終點加 `(hr)`，使用頁面專用中英字典鍵，原工具列文字保留。重新執行完整 Vitest 493 passed、設定頁 e2e 8 passed、typecheck／lint／release build 與獨立核心流程均 exit 0；重新檢視中英 900×560 截圖並更新本目錄圖片。原完整 e2e 141／Rust 47 為下述上一輪結果，本次純文案／版號調整沒有重新宣稱這兩組完整檢查已再跑。免安裝 ZIP 解壓後比對 exe SHA、空 data、空 portable.flag 均通過；沒有執行 App 開啟真實工作區。

**發布結果**：`102ae1917047aee691e88cef9c497b50df745c41` 已推送至 origin/main，annotated tag `v0.2.0-beta.3` 解析至同一提交。[私人儲存庫預發行](https://github.com/andrewchu0101/juicy-calendar/releases/tag/v0.2.0-beta.3) 已發布，附 portable ZIP 與 SHA256SUMS；GitHub ZIP digest `c32de3723cefa66e2787eb5f340789220042bc3847f410f43de33350d8a1dc32` 與本機一致。沒有新的 NSIS 安裝包；本機桌面捷徑仍指向同步更新的 release exe。後續只另提交本筆發布結果文件，標籤與建置來源不變。

## 環境與命令

- 工作目錄：`D:/Project/Fun/juicy-calendar/juicy-calendar`，分支 `main`，HEAD `1c261c4`。開始前已有 030a 與規格未提交變更，本輪保留，沒有 commit／push。
- Windows、Node `C:/Program Files/nodejs/node.exe` v24.22.0。專案為 Node／TypeScript，隔離依賴使用專案 `node_modules`，沒有 Python venv；未使用全域測試套件或假設 shell 已啟用虛擬環境。
- WebKit 瀏覽器位於 `D:/DevTools/playwright-browsers`。Vite 以明確 Node 執行 `node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1441 --strictPort`。
- `test-results/030b-red/playwright.config.ts` 繼承正式設定，只改 baseURL 至上述獨立伺服器、停用 webServer、設定絕對相對關係正確的 testDir 與暫存 outputDir；worker 設為 1，避開已知未解的並行 fixture 風險，沒有改測試條件／timeout／retries。
- TEMP／TMP 指向 `D:/Project/Fun/juicy-calendar/juicy-calendar/test-results/030b-red`。單元／整合使用 `buildWorkspaceFixture` 記憶體 backend；e2e／smoke 使用每次獨立且可拋棄的 browser context 與 localStorage JSON 工作區；未開啟真實使用者工作區。

所有命令均由 `& 'C:/Program Files/nodejs/node.exe'` 執行下列專案工具：

```text
node_modules/typescript/bin/tsc --noEmit
node_modules/eslint/bin/eslint.js .
node_modules/vitest/vitest.mjs run
node_modules/vite/bin/vite.js build
node_modules/@playwright/test/cli.js test --config test-results/030b-red/playwright.config.ts --workers=1
test-results/030b-red/core-flow.mjs
```

## 紅綠證據與追溯

使用者先逐項確認紅燈；後來明確指示「直接把030b跟030c完成」，並以 continue 恢復工作，後續紅燈由代理自行確認才實作。

| 需求／TC | 舊行為或建置中失敗（先紅） | 修正／綠燈 |
|---|---|---|
| AC-07.2、FR-18；21.1 | 框選兩個事件後右鍵空白，預期 2、實際 0 | 主鍵檢查提前，保留原多選 |
| AC-07.2、FR-18；21.2 | 空白右鍵找不到 menu；後續找不到停用的 Paste 項目；再後續按 Paste 事件仍 1、預期 2 | 選單、disabled 狀態與共用 pasteCopied action 依序完成 |
| AC-07.1、FR-18；21.2 | 未選事件右鍵仍 false；Copy／Rename 項目不存在 | 依選取規則處理，呼叫 copySelected／setEditing／deleteSelected；刪除一次復原 |
| AC-07.2、FR-18；21.2 | 空白選單找不到 Undo | Undo／Redo 使用共用 action、past／future 決定停用 |
| AC-07.3、FR-19、R-12；21.4 | Escape／點外部／捲動後 menu 仍 1（預期 0）；Copy 未取得焦點 | 補關閉、外部點擊隔離、鍵盤巡覽與焦點返回；Enter 可執行；view／anchor 改變時關閉 |
| AC-07.3、FR-19；21.6 | 900×560，右緣 1037.296875 > 900 | 定位運算放 engine，按量測尺寸限制位置 |
| AC-07.3、FR-19、R-12；21.5 | 先開過選單、再拖事件時送 contextmenu，menu 1（預期 0） | primary pointer session／draft／框選／模板拖曳隔離 |
| AC-06.3、FR-17、R-11；20.3 | startHour -1 被合併，settings.json 寫入 1 次；未知語言被寫入 App 設定 | patch／language schema 先驗證；拒絕保持狀態參照與零寫入 |
| AC-06.1、FR-17；20.1 | 找不到 Settings 入口 | 工作區工具列入口、獨立頁、返回原 mounted 日曆，保留日期／捲動／選取 |
| AC-06.1／06.2、FR-17；20.2 | 找不到設定欄位；建置中關磁吸後改縮放，磁吸又 true | 設定頁集中既有四類設定；patch 不使用磁碟 default，保存／重開／工具列同步 |
| AC-06.3、FR-17、R-12；20.5 | 設定頁 Delete 刪掉來源事件 | 全域快捷鍵接 enabled 狀態，設定頁停用事件命令、保留文字欄操作 |

## 補驗與實際偏差

- 已有共用實作而新增即通過的案例屬特徵化：21.3 固定目標與 150 分鐘長度、多選／原生輸入／排除區域、首次 radial／框選拒絕、20.3 其餘邊界、20.4 舊值、20.5 其餘命令與語言失敗行為。沒有宣稱這些全都曾取得新的業務紅燈。
- 設定頁保存情境一次改時段、磁吸、縮放，屬一個保存整合情境；未逐欄建立獨立紅綠循環。
- TC-21.3 新測試誤加時間 en dash 兩旁空格，先揭露、經使用者「請修正」後改成既有 TC-12／FR-10／R-7 契約的 `11:00–13:30`；日期、時間與長度斷言未放寬。另一本已通過的語言失敗情境，新測試句子誤寫，對齊既有字典 `無法儲存語言設定。`，仍精確比對且拒絕顯示診斷內容。這兩者不是業務紅燈。
- 完整單元第一次 489 passed／1 failed，TC-11 抓到快捷鍵字串硬編碼；改走雙語字典後完整 493 passed。沒有修改掃描測試或舊期待。
- 完整 e2e 第一輪 139 passed／2 failed（9.0m／exit 1）：兩個舊 `selectionBar.spec.ts` 寬視窗中英案例，日曆頂端預期 64px、實際 102px。縮成 `selectionBar.spec.ts --grep wide --workers=1` 仍 2 failed（exit 1）；DOM 探針量到工具列可用 1284px，子項寬度 136.52／110.08／153.72／905.83px，加間距即溢出換行；只隱藏新增 Settings 按鈕便回到 64px，證實原因。設定入口改為具有雙語 accessible name／title 的 32px 齒輪按鈕，控制組間距縮為 8px；原測試不改，layout／selectionBar 共 12 passed（39.8s／exit 0）。其後完整回歸結果見下節，沒有以重跑冒充已解原因。
- 一個暫存截圖腳本初跑 import 相對路徑錯誤，修正後成功；核心 smoke 首次 reload 後立即 count 得 0，補等待第 2 個事件載入後保持同一精確數量／保存條件通過。追加檢視切換 probe 時 accessible name 誤用 `Day`，改回既有字典的 `day` 後通過。均為輔助腳本修正，不算產品紅燈。
- Impeccable context launcher 缺少 engine 且禁止自動下載；已直接讀 PRODUCT／DESIGN 及 skill 參考，在既有視覺系統下實作，未安裝工具或改設計系統文件。
- 沒有刻意偏離已確認產品需求；無新套件、Rust／IPC／磁碟格式變更。設定頁以保留但隱藏日曆的方式返回原位置，選單手勢／焦點生命週期留在 UI；時間／定位運算仍在 engine。選單生命週期 effect 同時管理註冊與 cleanup，超過 25 行目標但保持資源釋放順序，不為行數拆成散落的 listener。

## 執行結果

- Passed：typecheck、lint、build；完整 Vitest 41 檔／493 tests（exit 0）。
- Passed：前一輪目標 e2e 26 tests（1.4m／exit 0）；後續新增命令／語言錯誤補驗納入完整回歸。
- Passed：獨立英文 900×560 瀏覽器核心流程——事件 Copy → 固定目標 Paste（11:00–13:30）→ Rename → 設定磁吸／縮放 → 返回保留選取 → reload 保存一致（exit 0）。
- Passed：上述核心流程追加直接呼叫既有 day 工具列控制（普通外部點擊刻意會先被選單吃掉），驗證開啟選單時切換檢視會關閉選單並保留來源選取。
- Passed：`D:/DevTools/rust/cargo/bin/cargo.exe test --offline --manifest-path src-tauri/Cargo.toml`：47 passed，main／doc-tests 0 failed，exit 0。RUSTUP_HOME／CARGO_HOME 明確指向 `D:/DevTools/rust/rustup`／`D:/DevTools/rust/cargo`，TEMP／TMP 同上述暫存目錄；本輪沒有 Rust 產品變更。
- 已檢視 900×560 截圖：[英文設定](030bc-settings-en-900.png)、[繁中設定](030bc-settings-zh-900.png)、[繁中右鍵選單](030bc-context-menu-zh-900.png)；均為瀏覽器證據。
- Passed：修正後完整 WebKit e2e **141 passed／0 failed（9.3m／exit 0）**，含 TC-18 舊手勢、TC-19、TC-20、TC-21、雙語 layout／selectionBar／時間格式。暫存輸出 `test-results/030b-red/full-e2e.log`；第一輪失敗紀錄保留於 `initial-full-e2e.log`，不能用最終成功掩蓋修正經過。
- 最終 source 上的完整 Vitest 再驗 **41 檔／493 passed（19.11s／exit 0，maxWorkers=2）**，typecheck／lint／build 亦通過。既有 tracked e2e 檔案差異檢查為空，未改舊測試期待。

## 未驗證

Windows WebView2 原生右鍵／焦點／手感（TC-21.6 桌面人工）、本輪 portable 實機保存位置與桌面 smoke／人工未做；不以 WebKit 自動化冒充。未執行 NSIS 打包，未重驗多 worker 穩定性；030a 已知並行 fixture 風險仍保留。
