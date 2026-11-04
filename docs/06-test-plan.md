# 06 Test Plan — Juicy Calendar

| 項目 | 內容 |
|---|---|
| 版本／狀態 | v0.1 **草稿**。專案擁有者已於 2026-11-04 回覆提案中的六個衝突與決定項（見「已決」）；整份 TC 清單的最終確認待審查 |
| 負責人／審查者 | 專案擁有者 |
| 日期 | 2026-11-04 |
| 上游 | `docs/02-prd.md`、`docs/03-srs.md`（已確認）、`docs/04-sad.md`、`docs/05-sds.md`（草稿） |
| 執行證據 | **全部標「未執行」**。這份計畫寫成時，尚未執行任何本計畫新增的 TC |

## 範圍、風險與策略

這個產品最怕的是**使用者的排程被覆寫、損毀或默默消失**，其次是核心拖曳流程在 Windows 上不穩，導致我們沒有可信的回歸判斷。策略：能以純函式驗的規則放在單元層（引擎、格式化），資料與檔案行為放在整合層（記憶體版 backend），跨行程與路徑安全放在 Rust 層，真實的拖曳放在 e2e，而安裝、免安裝、缺少 WebView2、視覺與系統設定相關的承諾只能人工驗。

- R1 資料被覆寫或損毀（高）：後果是使用者資料遺失。以整合與 Rust 測試驗證（TC-06、07、08、10），因為要看磁碟位元組與寫入次數；對應 FR-05、06、AC-02.1、02.2。
- R2 輸入驗證改動（高）：結束早於開始改為拒絕、7 天與 30 字上限、日期嚴格驗證，皆改變現有行為，容易迴歸。以單元測試驗證（TC-03、04、05），因為預期值可由規格手算；對應 FR-02、03。
- R3 單一寫入者（高）：兩個視窗互相覆寫。以 Rust 雙行程測試驗證（TC-09），因為必須有兩個行程才證明得了；對應 FR-07、AC-02.3。
- R4 核心拖曳流程在 Windows 不穩（高）：e2e 結果每次不同，所有回歸判斷失去可信度。**先修測試輔助函式**（見「實作前置」），再以 e2e 驗證（TC-01、02）；對應 NFR-01、G-03。
- R5 多語系與時間格式（中）：漏譯、格式不一致。以單元測試加人工驗證（TC-11、12、M-04、M-05）；對應 FR-09、10、NFR-07。
- R6 安裝、免安裝、缺少 WebView2（中）：使用者無法打開。只能人工驗證（M-01、02、07）；對應 FR-08、11、NFR-05。
- R7 舊工作區相容與載入規則變嚴（中）：舊資料被略過。以整合測試驗證（TC-07 的基底即版本 2 樣本）；對應 NFR-04。
- R8 hover 動畫（低）：體驗問題，且樣式未決（Q-05）。人工（M-03），目前受阻。

**不測範圍**（及原因）：效能 NFR-06（沒有基準與需求來源，待量測）；深色模式（G-06 不屬本次）；現有功能（模板編輯、復原與重做、刪除、日與週檢視、縮放、磁吸）沿用既有的 48 項單元測試、29 項 e2e 與 5 項 Rust 測試，不重寫；macOS 與 Linux（NG-06）；檔案鎖在雲端同步資料夾與網路磁碟的行為（未實測，列為已知風險）。

**實作前置**：第一張實作／修復票是「修好拖曳測試輔助函式」：在放開滑鼠之前，等到畫面出現放置預覽，再 `mouse.up()`（已查出的原因與證據見 `docs/HANDOFF.md`）。在它完成之前，TC-01、TC-02 與所有 e2e 的結果不可信，**不列入退出條件的證據**。

## 環境、資料與判定方式

- **執行環境**（2026-11-03～04 觀察）：Windows 11 Home 10.0.26200；Node 24.22.0、npm 11.19.1；Rust 1.99.1（`D:\DevTools\rust`，不在 PATH，要在程序內設 `RUSTUP_HOME`、`CARGO_HOME` 並把 `D:\DevTools\rust\cargo\bin` 加進 PATH）；WebView2 156.0.4314.58；Playwright WebKit 在 `D:\DevTools\playwright-browsers`（使用者環境變數 `PLAYWRIGHT_BROWSERS_PATH`）。
- **指令**：`npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`、`npm run test:e2e`。
- **環境限制**：e2e 使用 Playwright 的 WebKit，不是 Windows 上真正的 WebView2；`npm run test:desktop` 是 bash 腳本，README 說只在 macOS 驗證過，在 Windows **未驗證**。所以 WebView2 上的真實行為只能靠人工流程。
- **隔離資料**：Vitest 使用記憶體版 `WorkspaceBackend`；e2e 使用瀏覽器版（`localStorage`）；Rust 測試使用暫存資料夾，建議在執行程序內把 `TEMP` 設為 `D:\DevCache\tmp`，讓暫存寫入留在 D 槽。**任何測試都不得開啟使用者的真實工作區**。
- **可重建資料**：所有 fixture 由測試程式碼，依本文件列出的固定值產生；不複製任何真實資料。預設六個模板為 Coding `#E98B87`、Study `#83B9D0`、Exercise `#A9C98D`、Reading `#9C91CE`、Rest `#E9B96E`、Personal `#E5A5BD`（來自現有種子資料）。
- **固定時鐘與時區**：現在時間為週一 2026-11-02 12:00（美東 EST，UTC−5；夏令時間已於 11/1 結束），時區 `America/New_York`。Vitest 用假計時器，e2e 用 Playwright 的 `page.clock.setFixedTime`。
- **判定方式**：預期值由規格與下列人工算例獨立求得，**不呼叫實作函式當 oracle**。每個拒絕案例同時核對「錯誤」與「資料沒變」：資料沒變 ＝ 檔案清單相同、每個檔案的 SHA-256 相同、寫入佇列長度為 0（單元層以事件物件逐欄相同代替）。
- **預期的紅燈**：TC-03、04、05（上限部分）、07（長度與名稱變體）、09、10、11、12 對應的行為目前還不存在或不同，**開始時應失敗**；實作者必須先看到失敗原因正確，再轉綠。TC-01、02、06 對應現有行為。

**已決**（2026-11-04，專案擁有者）：①`.juicy.lock` 是行程鎖定標記，不算修改使用者資料；②不存在的日期（例如 2026-02-30）必須拒絕，現有程式會自動進位，需修改；③繁體中文 12 小時制午夜暫定 `上午 12:00`、正午 `下午 12:00`，其餘細節等 UI 實作再微調，TC-12 這部分為暫定、不阻塞；④取不到任何語言資訊時預設英文；⑤7 天上限以經過的絕對分鐘計算；⑥第一張實作票是修好拖曳輔助函式。

## 測試案例

| TC | 主要風險／需求 | 層級 |
|---|---|---|
| TC-01 | R4；AC-01.1、FR-01、02 放球、調整、命名 | e2e |
| TC-02 | R4；AC-01.2、FR-01 拒絕放球且資料沒變 | e2e |
| TC-03 | R2；AC-01.3、FR-02 名稱規則與 30 字邊界 | 單元 |
| TC-04 | R2；FR-03 面板輸入邊界 | 單元 |
| TC-05 | R2；FR-02、U-04 拖曳邊緣上下限 | 單元 |
| TC-06 | R1；AC-02.1、FR-05 重開後一致 | 整合 |
| TC-07 | R1、R7；AC-02.2、FR-06、NFR-04 壞檔略過且不改檔 | 整合 |
| TC-08 | R1；FR-06 拒絕開啟 | 整合 |
| TC-09 | R3；AC-02.3、FR-07 單一寫入者 | Rust 雙行程 |
| TC-10 | R1；NFR-02、FR-09、FR-11 Rust 邊界 | Rust 單元 |
| TC-11 | R5；AC-03.2、FR-09 語言 | 單元＋e2e |
| TC-12 | R5；AC-03.3、FR-10 時間格式化 | 單元 |

### TC-01｜放球、調整、命名（AC-01.1、FR-01、FR-02）

層級：e2e；選這層因為要真實的指標拖曳。前置：新建工作區（六個預設模板），固定時鐘。

1. 把 Coding 球放到週一欄 10:30。預期：事件開始 `2026-11-02T15:30:00Z`、結束 `2026-11-02T17:30:00Z`（120 分鐘）；名稱 `Coding`；顏色 `#E98B87`；`templateId` 為 `coding`。
2. 把下緣拖到 13:00。預期：結束 `2026-11-02T18:00:00Z`，長度 150 分鐘，開始不變。
3. 雙擊命名「寫 PRD」並按 Enter。預期：名稱為「寫 PRD」。

最終：`events/` 剛好 1 個檔；側邊仍有 6 顆球；全程沒有操作任何輸入欄位。執行方式：`npm run test:e2e`（待修好輔助函式）。

### TC-02｜拒絕放球（AC-01.2、FR-01）

層級：e2e。前置：新建工作區，記下事件檔清單與每檔的雜湊。

1. 拖曳球並在日曆外放開。預期：事件檔數量前後都是 0；清單與雜湊相同；出現碎片回饋並於短時間內消失；球仍可再次拖曳。
2. 拖曳球移到日曆欄內顯示放置預覽後按 Escape 再放開。預期：同上，沒有事件被建立。

### TC-03｜名稱規則（AC-01.3、FR-02）

層級：單元（引擎的 `validateTitle`）；預期值為純規格推導。

| 輸入 | 預期 |
|---|---|
| 空字串、`   `（全空白） | 拒絕 |
| `  寫 PRD  ` | 接受，存為「寫 PRD」（5 字） |
| 30 個中文字、30 個英文字母、30 個 `👨‍👩‍👧`（以使用者看到的字元計） | 接受 |
| 30 個字後再加兩個空白 | 接受（去空白後 30 字） |
| 31 個中文字、31 個英文字母、31 個 `👨‍👩‍👧` | 拒絕 |

拒絕時：事件物件與修改前逐欄相同、寫入佇列長度為 0。另以 e2e 補一條：把名稱清空並按 Enter，畫面仍顯示「寫 PRD」，磁碟事件檔雜湊不變。

### TC-04｜面板輸入邊界（FR-03、Q-04）

層級：單元（引擎的 `withEndTime`、`withDuration`、`withStartTime`、`withDate`）。事件為週一 10:30–12:30（`15:30Z–17:30Z`）。

| 輸入 | 預期 |
|---|---|
| 結束 `10:30`、`09:00` | 拒絕（不再當成隔天） |
| 結束 `10:31` | 接受，長度 1 分鐘 |
| 結束 `23:59` | 接受，長度 809 分鐘 |
| 結束 `24:00`、`9:5` | 拒絕（格式） |
| 持續分鐘 `0`、`0.4`、`abc`、空白 | 拒絕 |
| 持續分鐘 `1`、`1.4` | 接受，長度 1 分鐘 |
| 持續分鐘 `1.5` | 接受，長度 2 分鐘 |
| 持續分鐘 `900` | 接受，結束 `2026-11-03T06:30:00Z`（週二 01:30） |
| 持續分鐘 `10080` | 接受，結束 `2026-11-09T15:30:00Z` |
| 持續分鐘 `10081`、`10080.4`、`1e12` | 拒絕 |
| 開始 `09:15` | 接受，開始 09:15、結束 11:15（長度 120 不變） |
| 日期 `2026-11-03` | 接受，變成週二 `2026-11-03T15:30Z–17:30Z` |
| 日期 `2026-02-30` | 拒絕（不存在的日期；現有程式會進位，需修改） |

另一個事件為週一 23:00–週二 01:00：結束 `02:00` → 週二 02:00（180 分鐘）；`22:00` → 週二 22:00（1380 分鐘）；`23:00` → 週二 23:00（1440 分鐘），皆接受。拒絕時事件逐欄相同、寫入佇列長度為 0。

### TC-05｜拖曳邊緣上下限（FR-02、U-04）

層級：單元（引擎的 `resizeStart`、`resizeEnd`）。事件週一 10:30–12:30（`15:30Z–17:30Z`）。

- 下緣拖到 09:00 → 結束 `2026-11-02T15:31:00Z`（長度夾在 1 分鐘），開始不變。
- 上緣拖到 13:00 → 開始 `2026-11-02T17:29:00Z`（長度夾在 1 分鐘），結束不變。
- 下緣拖到很遠 → 結束 `2026-11-09T15:30:00Z`（長度 10080）。
- 上緣拖到很遠 → 開始 `2026-10-26T17:30:00Z`（長度 10080，以經過時間算；牆鐘顯示週一 10/26 13:30，因為跨越夏令時間結束日）。

### TC-06｜重開後一致（AC-02.1、FR-05）

層級：整合（記憶體版 backend，先寫入、再重新載入）。建立 3 個事件：

| 名稱 | 模板 | 開始 → 結束（UTC） | 顏色 |
|---|---|---|---|
| 寫 PRD | Coding | `2026-11-02T15:30Z` → `17:30Z` | `#E98B87` |
| 讀書 | Study | `2026-11-03T14:00Z` → `15:30Z`（週二 09:00–10:30） | `#83B9D0` |
| 休息 | Rest | `2026-11-04T19:15Z` → `19:45Z`（週三 14:15–14:45） | `#E9B96E` |

預期：重新載入後恰好這 3 個事件，開始、結束、名稱、顏色逐欄相同；`events/` 有 3 個檔；6 個模板不變；`workspace.json` 的位元組不變。

### TC-07｜壞檔略過且不改檔（AC-02.2、FR-06、NFR-04）

層級：整合；記錄所有寫入。基底：格式版本 2 的工作區，含 6 個模板與 2 個好事件（這同時驗證舊工作區可開啟，NFR-04）。分別加入下列壞檔各一次：

- (a) 內容 `{not json`
- (b) `endAt` 等於 `startAt`
- (c) 長度 10081 分鐘
- (d) 名稱 31 個字
- (e) 檔名與 `id` 不符
- (f) 顏色為 `red`

預期（每一種）：開啟成功；顯示那 2 個好事件；通知列出該檔案；壞檔的 SHA-256 開啟後不變；載入過程對 `events/` 的寫入次數為 0。接著編輯其中一個好事件並關閉：只有該事件的檔案改變，壞檔雜湊仍不變。

### TC-08｜拒絕開啟（FR-06）

層級：整合。分別準備：①`workspace.json` 版本為 3；②沒有 `workspace.json`；③`workspace.json` 無法解析。預期：依序得到 `WORKSPACE_TOO_NEW`、`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`；沒有進入主畫面；資料夾中除了行程鎖定標記 `.juicy.lock`（已決，不算修改）之外，檔案清單與每檔雜湊完全不變。

### TC-09｜單一寫入者（AC-02.3、FR-07）

層級：Rust，兩個行程（測試執行檔自己當子行程）；對應 2026-11-04 的實驗。前置：暫存資料夾。

1. 行程 A 對資料夾取得鎖。預期：成功。
2. 行程 B 嘗試取得。預期：回傳 `WORKSPACE_LOCKED`；`.juicy.lock` 的大小與修改時間不變；資料夾沒有新增任何檔案；其餘檔案雜湊不變。
3. 強制結束行程 A。
4. 行程 B 再試。預期：成功。

另兩條：同一行程再次選擇目前已開啟的資料夾，回傳目前位置、不被自己擋住；在「選擇資料夾」流程取鎖失敗時，原本開啟的工作區維持開啟、`last-workspace.txt` 不變。

### TC-10｜Rust 邊界（NFR-02、FR-09、FR-11）

層級：Rust 單元，暫存資料夾。

- 路徑允許清單：`../x.json`、`events/../../x.json`、`.juicy.lock`、`app-settings.json`、絕對路徑，一律 `PATH_NOT_ALLOWED`。
- 現有的原子寫入與允許清單測試（5 項）保留並全數通過。
- `app_settings`：檔案不存在、損毀、值不合法 → 讀回 `null`，且損毀檔案位元組不變；寫入 `en` 後讀回 `en`；寫入 `fr` → 拒絕且不改檔。
- `portable::detect`：目錄內有 `portable.flag` → 回傳 `<目錄>/data`；沒有 → `None`。
- `new_workspace_dir`：只含 `.juicy.lock` 的資料夾視為空，可直接使用。

### TC-11｜語言（AC-03.2、FR-09）

層級：單元＋e2e（瀏覽器版 backend）。

| 系統語系 | 預期 |
|---|---|
| `zh-TW`、`zh-HK`、`zh-CN`、`zh` | 繁體中文 |
| `en-US`、`ja-JP` | 英文 |
| 取不到任何語言資訊 | 英文（已決） |

- 兩種語言字典的鍵值完全相同（缺鍵測試必須失敗）。
- 切換為 `en` 後重新讀取設定 → 仍是 `en`。
- `app-settings.json` 損毀 → 使用偵測結果，且該檔案位元組不變，直到使用者下一次切換語言。

### TC-12｜時間格式化（AC-03.3、FR-10）

層級：單元（`formatTime`）。2026-11-02 當地 13:05：24 小時制 → `13:05`；12 小時制英文 → `1:05 PM`；12 小時制繁體 → `下午 1:05`。午夜 00:00 → 24 小時制 `00:00`、英文 `12:00 AM`、繁體 `上午 12:00`；正午 12:00 → 24 小時制 `12:00`、英文 `12:00 PM`、繁體 `下午 12:00`。**午夜與正午的繁體寫法為暫定，不阻塞退出**；時間範圍（例如區塊上的 `10:30–12:30`）在 12 小時制的寫法規格未定，本 TC 不驗，見缺口。

## 人工驗收與缺陷處理

以下全部目前為「**未執行**」。失敗時記錄：重現步驟、預期與實際、影響、修復後要重跑的 TC；受阻或未執行都保留原狀態，不改寫成通過。證據放在 `docs/evidence/`（執行時建立，截圖與備註以 TC／M 編號命名）。

| 編號 | 操作與預期 | 對應 | 狀態 |
|---|---|---|---|
| M-01 | 乾淨的 Windows：執行安裝檔 → 啟動 → 建立工作區 → 完成 TC-01 的流程 → 解除安裝。預期：App 被移除，工作區資料夾與其中檔案仍在；README 的步驟可照做。Windows 10 1803 若沒有環境，標「未驗證」 | AC-03.1、FR-08、NFR-05 | 未執行 |
| M-02 | 免安裝版解壓到任意資料夾 → 執行 → 建立區塊並切換語言 → 把整個資料夾複製到另一處或另一台電腦 → 執行。預期：區塊與語言設定相同；工作區檔案在執行檔旁的 `data` | AC-03.4、FR-11 | 未執行 |
| M-03 | 在日曆空白處按住左鍵 450 ms 叫出 radial 選單，把游標移到球上，再開啟系統的減少動態效果。預期：效果出現與消失、減少動態時不播放、球身純色 | AC-01.4、FR-04 | 受阻（Q-05 樣式未決） |
| M-04 | 把視窗縮到最小（900×560），名稱用 30 個全形字，兩種語言各一次。預期：文字不溢出、不遮蓋其他元件 | NFR-07 | 未執行 |
| M-05 | 把 Windows 的時間格式在 12 與 24 小時之間切換（結束後還原），檢查區塊、右側面板、時間軸。預期：全部一致；若面板的原生時間欄位與其他不一致，記為已知限制 | AC-03.3、FR-10 | 未執行；**需專案擁有者操作，會改系統設定** |
| M-06 | 使用 App 期間監看它的網路連線。預期：零連線。監看方法待定 | NFR-03 | 未執行 |
| M-07 | 以官方環境變數把 WebView2 指向空資料夾來模擬缺少。預期：顯示說明視窗（語言依系統）、結束碼為 1、Tauri 沒有啟動 | FR-08、U-12 | 未執行 |

## 進入／退出條件

- **進入**：SRS 已確認；SAD 與 SDS 經審查；TC 預期值經專案擁有者確認；環境與資料可重建；第一張實作票（修好拖曳輔助函式）完成。
- **退出**（全部達成才標交付通過，否則不標）：
  1. TC-01～TC-12 實際執行並通過；新規則的 TC 都曾看到「原因正確的紅燈」。
  2. M-01、M-02、M-04、M-05 有結果；M-03 在 Q-05 決定前維持「受阻」並明記。
  3. 每條 AC、FR、NFR 在下表有 TC、人工流程或明確缺口。
  4. NFR-01：連續重複執行 e2e，通過與失敗的清單必須一致。重複次數 N **沒有依據**；暫定「至少連續 3 次」，首次實測後由專案擁有者定案。
  5. 阻塞缺陷已處理；剩餘風險與負責人已記錄。
- **失敗後的處理**：不放寬斷言、不刪測試、不重跑到綠；先分類（環境、規格、測試、實作），保留完整輸出，一次只驗一個原因（`/diagnosing-bugs`）。

## 追溯與執行證據

| 需求 | TC／人工 | 證據、執行日期與結果 | 缺口／缺陷 |
|---|---|---|---|
| AC-01.1、FR-01、FR-02 | TC-01、TC-03、TC-05、M-01 | TC-01：2026-11-04，`npm run test:e2e` 連續 3 次皆 Passed（標註於 `e2e/core.spec.ts`）；其餘見下列各列 | M-01 未做；TC-05 見下列 FR-02 邊緣上下限列 |
| AC-01.2 | TC-02 | 2026-11-04，3 次皆 Passed（舊版，只驗「沒有事件」）。2026-11-04（票 004a）補強為核對事件檔清單與每檔 SHA-256（兩種拒絕情境），並驗證之後球仍可拖曳；`npx playwright test -g TC-02 --repeat-each=40 --workers=8`：修正前 6/40 失敗（Escape 後 `drop-ghost` 殘留），修正後 40/40、`--repeat-each=120` 120/120 通過；完整 e2e 連續 3 次為 32／31（magnet 測試 1 次失敗）／32 passed | 碎片回饋「短時間內消失」仍未斷言；完整 e2e 3 次清單**不一致**（magnet 間歇失敗，見 LESSONS），NFR-01 尚未達成 |
| AC-01.3、U-11 | TC-03 | 2026-11-04（票 003），Windows 11、Node 24.22.0、記憶體版 backend／WebKit e2e：單元 `validateTitle.test.ts` 11 項、store `nameLimit.test.ts` 9 項；完整 `npm test` 69 passed／0 failed；`typecheck`、`lint` Passed；`npm run test:e2e` 32 passed（含 3 項新 TC-03 e2e：雙擊命名、面板名稱、模板編輯器）。先紅後綠：單元紅燈 3 失敗（31 字被接受，專案擁有者已確認）；store 紅燈 9 失敗（store 不驗證名稱）；e2e 以暫時把 `NAME_MAX_CHARS` 改成 1000 做變異檢查，3 項皆因「31 字被接受」失敗，之後還原 | 拒絕時的寫入佇列長度 0 以「記憶體 backend 的 `write` 呼叫數為 0」驗證；e2e 的磁碟雜湊為瀏覽器版 localStorage，非真實磁碟。e2e 曾有 1 次 TC-02 間歇失敗（見 LESSONS） |
| FR-02 邊緣上下限、U-04（拖曳） | TC-05 | 2026-11-04（票 005），Windows 11、Node 24.22.0、TZ America/New_York：單元 `src/features/calendar/engine/resizeBounds.test.ts` 4 項；紅燈 2 失敗／2 通過（1 分鐘下限本來就有，7 天上限缺，實際收到 `2027-03-01T00:00:00Z`、`2026-01-01T00:00:00Z`），綠燈 4/4。e2e `e2e/core.spec.ts` 2 項 TC-05（下緣、上緣拖到 ±14000 px）通過；變異檢查（暫把 `EVENT_MAX_MINUTES` 改成 100000000）兩項紅燈，已還原。完整 `npm test` 73/73；`typecheck`、`lint` Passed | 面板持續分鐘欄**仍無 7 天上限**（屬票 004／TC-04）；桌面版 Tauri 手動拖曳未驗收（改以 e2e）；完整 e2e 3 次為 33／33／34 passed，各有 1 項不相關的間歇失敗 |
| AC-01.4、FR-04 | M-03 | 未執行 | **缺口**：受阻於 Q-05 |
| FR-03 | TC-04 | 未執行 | |
| AC-02.1、FR-05 | TC-06 | 2026-11-04，`npx vitest run src/services/persistence/reopen.test.ts` 1/1 Passed；完整 `npm test` 49/49 Passed（Windows 11、Node 24.22.0、記憶體版 backend、假時鐘 2026-11-02 12:00 EST）。先紅後綠：紅燈原因為空 fixture（`This folder has no workspace.json.`） | 重開驗證用記憶體版 backend，**未驗證**真實磁碟寫入；`.juicy.lock` 等屬 TC-09／10 |
| AC-02.2、FR-06、NFR-04 | TC-07、TC-08 | TC-08 **僅代碼部分**（票 006，2026-11-04，Windows 11、Rust 1.99.1）：Rust `opening_a_folder_without_workspace_json_fails_with_not_a_workspace` 通過，並確認資料夾沒有新增檔案；先紅後綠（紅燈 `left: IoError right: NotAWorkspace`）。**TC-07（票 008，2026-11-04，Windows 11、Node 24.22.0、記憶體版 backend、假時鐘）**：`npx vitest run src/services/persistence/loadRules.test.ts` 14/14 Passed（(a)～(f) 加 (g) 模板名稱 31 字，各測「載入」與「編輯好事件後關閉」）；紅燈 3 失敗／11 通過，(c)(d) 為 `evt_bad` 被當成好事件載入、(g) 為模板數 7 而非 6，(a)(b)(e)(f) 本來就通過（特徵化）；綠燈後完整 `npm test` 123/123、`typecheck`、`lint` Passed。通知原因現在可區分（`invalid JSON`、`file name does not match id`、`name is empty or too long`、`event is longer than the maximum length`）。`npm run test:e2e`（票 008 完成後，同日）：第 1 次 33 passed／1 failed（既有的 `overlapping events…`，收到 `Mon 10:30` 而非 `Mon 11:00`，LESSONS 已記載的間歇失敗，與載入規則無關）；該項單獨重跑 1/1 通過；整套重跑 34/34 通過。**未驗證**：真實磁碟（Rust backend）載入、桌面版手動開啟舊工作區。**TC-08 前端部分與通知代碼（票 007，2026-11-04，Windows 11、Node 24.22.0、記憶體版 backend）**：`openErrors.test.ts`（TC-08 三情境，每個都核對資料夾每檔 SHA-256 不變；`FILE_SKIPPED`、`SETTINGS_RESET`）、`workspaceSession.test.ts`（`WORKSPACE_LOCKED`、`WORKSPACE_TOO_NEW` 帶版本號、`OPEN_FAILED` 診斷只放 `detail`）、`saveError.test.ts`、`notices.test.ts`（英文對照表）。完整 `npm test` 109/109、`typecheck`、`lint` Passed；`npm run test:e2e` 單次 34/34 Passed（含 magnet 測試，本次未失敗）。先紅後綠：`WORKSPACE_TOO_NEW`、`FILE_SKIPPED`、`WORKSPACE_LOCKED`、`saveError`、對照表皆見原因正確的紅燈（收到舊字串或缺少 `code`／函式）；`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`、`SETTINGS_RESET`、`WORKSPACE_TOO_NEW` 版本號、`OPEN_FAILED` 診斷因與前一步同一次改動一併完成，改以變異檢查（暫改程式使其出錯，測試因原因正確而失敗，之後還原並確認檔案相同） | TC-08 以記憶體版 backend 驗證，**未驗證**真實磁碟與原生對話框（`workspace_select` 只測抽出的 `choose_root`）；NFR-01 的「連續 3 次 e2e」本票只跑 1 次。**偏差**：①`saveError` 畫面不再附加診斷句（原本會顯示 `String(error)`，等於洩漏 `detail`），因 `writeQueue` 的 `onResult` 簽章有既有測試而未改；②`OPEN_FAILED` 畫面為 `Could not open the workspace.`，不再附加診斷句；③`WorkspaceOpenError.message` 仍是英文句子（日誌與既有 `/newer/` 斷言用，非畫面文字）；④`BackendError.message` 改讀對照表，句子不變 |
| AC-02.3、FR-07 | TC-09 | 票 009（2026-11-04，Windows 11、Rust 1.90.0、`npm run test:rust` 15 passed／0 failed）。TC-09 雙行程：`workspace_lock::tests::second_process_is_refused_until_the_first_is_killed`（測試執行檔自己當子行程 A；B 被拒得 `WORKSPACE_LOCKED`，`.juicy.lock` 大小為 0 且大小與修改時間不變、檔案清單與其他檔案位元組不變；`kill` A 後 B 取鎖成功）。第二條：`reselecting_the_open_workspace_returns_its_location_without_locking_itself_out`、`..._by_another_spelling_...`（大小寫不同，僅 Windows；突變檢查：比對改成原始路徑相等即紅燈 `Err(WorkspaceLocked)`）。第三條：`failed_lock_keeps_the_open_workspace_and_the_remembered_one`。TC-10：`a_folder_holding_only_the_lock_file_counts_as_empty`；`.juicy.lock` 不在允許清單由既有 `resolve_rejects_paths_outside_the_allow_list_with_path_not_allowed` 證明（原本就通過，無紅燈）。先紅後綠：紅燈原因依序為 `left: Ok(()) right: Err(WorkspaceLocked)`、`unwrap_err` 收到 `Ok`（沒取鎖）、`Err(WorkspaceLocked)` 被自己擋住、`MyTimeBlock` 子資料夾被誤建。另跑 `typecheck`、`lint`、`npm test`（123 passed）皆 Passed | **未驗證**：兩個真實 App 行程指向同一資料夾（人工，會動到真實設定資料夾，待確認）；`workspace_select`／`workspace_restore` 命令本身（含原生對話框）無單元測試，僅測 `activate_in`；除錯用 `JUICY_SMOKE_WORKSPACE` 路徑不取鎖；雲端同步資料夾與網路磁碟**未涵蓋** |
| AC-03.1、FR-08、NFR-05 | M-01、M-07 | 未執行 | Windows 10 1803 可能無環境 |
| AC-03.2、FR-09 | TC-11、TC-10（`app_settings`） | 票 010（2026-11-04，Windows 11、Node 24.22.0、Rust 1.90.0、WebKit e2e、`TEMP=D:\DevCache\tmp`）：單元 `detectLanguage.test.ts` 9 項（`zh-TW`／`zh-HK`／`zh-CN`／`zh`→繁中；`en-US`／`ja-JP`／取不到→英文；系統語系優先於 navigator）、`dictionary.test.ts` 3 項（鍵值相同、無空字串、`@ts-expect-error` 缺鍵；突變：刪一鍵 `typecheck` 出現 TS 錯誤）、`i18n.test.ts` 16 項、`browserBackend.test.ts` 12 項、`tauriAppSettings.test.ts` 15 項。Rust `app_settings` 5 項（不存在、6 種損毀／不合法內容→`None` 且位元組不變、寫 `en`／`zh-TW` 讀回、寫 `fr` 被拒且不建檔不改檔、損毀檔只被下一次有效寫入覆寫）、`platform_win` 3 項（`locale_from_utf16` 解析與 6 種無效緩衝區、Windows 回傳語系形狀）。e2e `e2e/language.spec.ts` 10 項（6 組系統語言、儲存的語言優先、損毀值用偵測且位元組不變直到下次切換、切換即時生效且重載後維持、儲存失敗顯示紅底錯誤且不含診斷文字）。完整檢查：`npm run typecheck`、`npm run lint` Passed；`npm test` 19 檔 181 passed／0 failed；`npm run test:rust` 23 passed／0 failed；`npm run test:e2e` 44 passed／0 failed（原有 34 + 新增 10，單次）；`npm run test:desktop` Passed。先紅後綠；突變檢查（都變紅）：`read` 拿掉白名單、瀏覽器版拿掉讀／寫驗證、`systemInfo` 不攔錯、`readAppSettings` 不驗證回傳、`locale_from_utf16` 放寬、`initLanguage` 偷寫檔、`setLanguage` 等存檔才切換、讀設定失敗不攔、成功後不清錯誤、把診斷文字塞進狀態、歡迎畫面不顯示錯誤。 | **Manual Pending**：桌面版實際讀寫 `%APPDATA%\app.juicycalendar.timeblock\app-settings.json`（會寫真實設定資料夾，待同意）；三個 Tauri 命令本身（需要 `AppHandle`）無單元測試，`test:desktop` 只證明 App 能啟動，因為讀設定失敗會被吞掉，不能證明命令成功。**未涵蓋**：Windows 使用者語系與顯示語言不同的機器（只在 `zh-TW` 這台）；非 Windows 的 `platform_win` 分支只編譯、未在該平台執行；日曆畫面內沒有語言選單，工作區開啟後無法切換語言（FR-09「設定可切換」目前只涵蓋歡迎畫面，後續票 011／012 補）；切換後的錯誤通知只在歡迎畫面。**偏差**：見票 010 的偏差註記 |
| AC-03.2、FR-09（票 011：日曆與工具列） | TC-11 | 票 011（2026-11-04，Windows 10 Pro、Node v26.13.0、Rust 1.90.0、WebKit e2e）：新增單元 `dateFormat.test.ts` 10 項（zh-TW／en 的 `EEE`、`EEEE`、`MMM`、`MMMM`）、`rangeLabel.test.ts` 10 項（單日、同月、跨月、跨年週 × 兩種語言，加空陣列）、`hiddenEventsTitle.test.ts` 5 項（英文單複數）、`dictionary.test.ts` 加 16 項（15 個字串的英文／中文字面值與參數）。紅燈皆為斷言失敗（zh-TW 拿到英文、字典缺鍵拿到鍵名、`1 events`），綠燈後做突變檢查（日期語系固定英文、移除跨年分支）皆變紅。e2e 新增 `e2e/calendar-language.spec.ts` 3 項（英文維持原文字與 title／aria-label；zh-TW 工具列、星期、標題、`+N` 說明、事件名稱輸入框；歡迎畫面選語言後日曆立即套用）；突變（日期欄位固定英文）使 zh-TW 項變紅。完整：`typecheck`、`lint`、`build` Passed；`npm test` 22 files／222 passed；`test:e2e` 連續 2 次皆 47 passed／0 failed | **未驗證**：桌面版（Tauri）中文介面人工操作；日曆畫面上「切換語言立即反映」（沒有選單，歸票 023，目前僅驗證「歡迎畫面選語言後進入日曆」）；`test:rust`、`test:desktop` 本票未動 Rust 未跑；中文字串為提案翻譯待審；跨年週的中文寫法為我依英文原則推出，待確認。時間軸選單的 `00:00` 標籤屬票 013 |
| AC-03.3、FR-10 | TC-12、M-05 | 未執行 | 12 小時制時間範圍寫法未定；原生欄位不一致風險 |
| AC-03.4、FR-11 | TC-10（偵測）、M-02 | 未執行 | WebView2 快取位置未驗證 |
| NFR-01 | 實作前置票、退出條件 4 | 2026-11-04，Windows 11、node 24.22.0：修復前 3 次 22／9／16 通過（失敗清單各異）；修復後 3 次皆 29 passed／0 failed，清單一致 | N=3 仍為暫定，待專案擁有者定案 |
| NFR-02 | TC-10 | 票 006（2026-11-04，Windows 11、Node 24.22.0、Rust 1.99.1）：`test:rust` 9 passed（原有 5 項保留，新增 4 項：`serializes_as_code_and_detail_with_screaming_snake_case_codes`（JSON 形狀；變異檢查把 `rename_all` 改 `camelCase` 即紅燈）、`resolve_rejects_paths_outside_the_allow_list_with_path_not_allowed`、`file_commands_without_an_open_workspace_fail_with_no_workspace_open`、`opening_a_folder_without_workspace_json_fails_with_not_a_workspace`）；前端 `backendError.test.ts` 12 項、`tauriBackend.test.ts` 8 項；完整 `npm test` 93/93、`typecheck`、`lint` Passed；`test:desktop` Passed。先紅後綠，各循環紅燈原因均為預期代碼不符 | TC-10 的 `app_settings` 已於票 010 執行（見 AC-03.2 列）；`portable::detect` **未執行**（票 015）；`new_workspace_dir` 忽略 `.juicy.lock` 已於票 009 執行。`serde_json` 經同意加入 dev-dependencies。symlink／跳出工作區改回 `PATH_NOT_ALLOWED` 的測試只能在 unix 跑，Windows 未驗證。煙霧測試只確認「rejected」，未確認代碼 |
| NFR-03 | M-06 | 未執行 | 監看方法待定 |
| NFR-06 | 無 | — | **缺口**：待量測，不設 TC |
| NFR-07 | M-04 | 未執行 | |
| G-03（基準線，票 000） | `typecheck`、`lint`、`npm test`、`test:rust`、`test:desktop` | 2026-11-04，Windows 11、node 24.22.0、Rust 1.99.1：`typecheck` Passed；`lint` Passed；`npm test` 48 passed／0 failed；`test:rust` 5 passed／0 failed；`test:desktop`（bash 腳本，Git Bash）Passed，輸出 `Desktop smoke test passed`（建立工作區、拖放一顆球得 10:30–12:30、重開後 `blocksOnLaunch: 1`，路徑穿越類寫入全被拒絕）。`npm run desktop` 視窗出現、Vite 回 HTTP 200 | 人工「建立工作區、關閉、重開還原」尚待人工驗收；`test:e2e` 不在此票範圍，仍不穩定 |
| G-03（基準線，票 000，第二台電腦） | `typecheck`、`lint`、`npm test`、`test:rust`、`test:desktop`、`npm run desktop` | 2026-11-04，Windows 10 Pro 10.0.19045、node v26.13.0、Rust 1.90.0、HEAD `6592827`：`typecheck` Passed；`lint` Passed；`npm test` 181 passed／0 failed；`test:rust` 23 passed／0 failed；`test:desktop` Passed（輸出 `Desktop smoke test passed`，拖放得 10:30–12:30、重開後 `blocksOnLaunch: 1`、越界寫入全被拒絕）。`npm run desktop` 視窗出現且 Responding、`http://localhost:1421/` 回 HTTP 200 | 人工「建立工作區、關閉、重開還原」：專案擁有者回報已驗收完成（2026-11-04，無截圖，依回報記錄）；Vite 只監聽 `::1`；`tauri dev` 對 `target` 內 exe／pdb 有 `EBUSY` 檔案監看警告（不影響啟動）；`test:e2e` 不在此票範圍 |

票完成時更新實際指令、通過／失敗數與人工證據；區分「已設計」「已實作」「已執行通過」。目前所有列都只到「已設計」。

## C4/C5 選用：模型評測

不適用：本產品沒有模型或其他非決定性元件。

> 審查重點：每個 TC 有來源與人確認的預期值；高風險有案例；未執行不標通過。
