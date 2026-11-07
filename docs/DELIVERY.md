# 交付審查與修正紀錄

日期：2026-11-07。基準 HEAD：`d9d7be5`。本次修改未 commit、未 push；預發行包尚未包含修正。

提交前快照說明：下方各輪的「未 commit／push」是當時狀態。專案擁有者隨後已於 2026-11-07 授權提交並推送本次修正與文件；最終 commit 與遠端狀態以 `git log`／`git status` 為準。`.codex/config.toml` 的本機工具核准設定留在工作樹，不納入產品修正提交；預發行包不因 push 自動更新。

## 範圍與狀態

審查涵蓋最早 commit `65bba1c` 到 HEAD：`git diff 65bba1c...HEAD`，另檢視初始匯入以涵蓋基準本身。HEAD 可達歷史共 49 個 commit；全部本地 refs 共 50 個。依據為 AGENTS、CLAUDE、CODING_STANDARD、已確認 PRD／SRS、issues 與測試計畫；SAD／SDS、測試計畫仍屬草稿。

目前尚不可宣稱交付完成。專案擁有者已同意逐項 TDD 修正及測試邊界，並確認磁碟中不足 1 分鐘的事件應視為壞檔。每一輪先展示原因正確的紅燈，取得確認後才修正。

| 審查軸 | 發現 | 狀態 |
|---|---|---|
| 規範 P1 | 寫入失敗後，關閉工作區會清空待重試資料；視窗關閉也未檢查儲存結果 | 工作區整合回歸已修正；原生關窗失敗情境待實測 |
| 規範 P2 | `schemas.ts` 接受小於 1 分鐘的磁碟事件，違反 AGENTS 第 9 條 | 已 TDD 修正並同步 SRS／TC-07 |
| 規範 P2 | `lib.rs` 原生選資料夾標題寫死英文，違反 AGENTS 第 11 條 | 已 TDD 修正，IPC 翻譯回歸通過；實際標題待人工確認 |
| 需求 P1 | 關閉工作區丟棄寫入失敗資料，違反 PRD 寫入失敗規則及 SRS R-4 | 同上，與規範軸同一個問題 |
| 需求 P2 | 捲動後整批拖到日期標題仍寫入，違反 AC-04.3／FR-13 | 已 TDD 修正，多選 13 passed、完整 e2e 95 passed |
| 需求 P2 | 合法 `__proto__` ID 在載入時無通知消失，違反 FR-06／R-5 | 已 TDD 修正，事件與模板回歸通過 |

兩軸各 3 項，共 5 個不重複缺陷；未發現或編造 P3 項目。兩軸最嚴重均為 P1 儲存失敗後關閉造成資料遺失。

## 啟動與實際環境

- 瀏覽器：`npm.cmd run dev`，開啟 `http://localhost:1421`；這個模式使用 localStorage。
- 桌面：`npm.cmd run desktop`。此機需在程序內設定 `RUSTUP_HOME=C:/DevTools/rust/rustup`、`CARGO_HOME=C:/DevTools/rust/cargo`，將 `C:/DevTools/rust/cargo/bin` 加入程序 PATH。
- e2e：程序內設定 `PLAYWRIGHT_BROWSERS_PATH=C:/DevTools/playwright-browsers` 後執行 `npm.cmd run test:e2e`。
- 桌面 smoke：同上述 Rust 環境，使用 `C:/Program Files/Git/bin/bash.exe` 執行 `npm run test:desktop`，避免 PowerShell 將 bash 解成 WSL。
- 作業系統 API 回報 Windows `10.0.19045.0`；Node `v26.13.0`、npm `11.20.0`、Git `2.55.0.windows.5`、rustc／cargo `1.90.0`。
- 獨立瀏覽器工具的 browser version 為 `156.0.8078.80`；完整 e2e 依專案設定使用 WebKit，兩者不能等同 Windows WebView2 人工驗收。
- 無新安裝套件；測試只使用隔離瀏覽器、記憶體 fixture 或 smoke 暫存工作區。

## P1：診斷、紅綠與修正

原因：`flush()` 原本只表示「嘗試過」，不表示全部寫入成功；`stop()` 卻隨即取消訂閱並 dispose，關閉工作區又清空 store。既有測試只涵蓋手動 flush 後恢復成功，未涵蓋儲存失敗時關閉。

新增 `src/services/workspace/workspaceClose.test.ts`，透過公開工作區 API 與隔離 backend 驗證：寫入失敗後關閉不重設工作區；錯誤保留；恢復可補寫；後續編輯仍受訂閱並能在成功關閉前寫入。

紅燈指令：`npm.cmd test -- src/services/workspace/workspaceClose.test.ts`。

```text
1 failed
expected null to be 'fixture'
```

專案擁有者回覆「請修正」後，改為讓 write queue 的 flush 回傳是否已清空，sync 僅在成功時停止；關閉工作區在失敗時返回，保留狀態與訂閱；Tauri 關窗處理在失敗時呼叫 preventDefault。

```text
相關 3 個測試檔：10 passed
完整單元：36 files／444 passed
typecheck：Passed
lint：Passed
build：Passed
git diff --check：Passed
```

P1 後完整 e2e：另用 `node node_modules/vite/bin/vite.js --port 1431 --strictPort` 啟動隔離伺服器，以臨時設定覆寫 baseURL 為 1431、停用 Playwright 的 webServer 管理，執行 `node node_modules/@playwright/test/cli.js test --config .delivery-playwright.config.ts`（上述瀏覽器路徑）。結果 **94 passed（26.6s）、exit 0**。臨時設定已刪除；未改寫原測試或專案 Playwright 設定。這縮小了先前未退出問題的範圍，但不等於已查明原伺服器 teardown 根因。

反向驗證：暫時移除 stop 的失敗保護（不修改測試），同一測試再次因 `null` 而失敗；還原保護後同一測試通過。這證明回歸測試對此缺陷敏感。

## 審查輪已執行的其他驗證（P1 修改前）

| 指令／流程 | 實際結果與限制 |
|---|---|
| `npm.cmd run typecheck`、`npm.cmd run lint`、`npm.cmd run build` | Passed |
| `npm.cmd test` | 35 檔／443 passed |
| `npm.cmd run test:rust` | 43 passed／0 failed |
| Git Bash 執行 `.maintain/check.sh` | hooks、MCP、pre-commit 與 guard 檢查通過 |
| `npm run test:desktop` | 沙箱內第一次因 WebView2 `0x800700AA` 失敗；沙箱外執行成功，6 球、建立 1 事件、路徑越界拒絕、重開 `blocksOnLaunch: 1` 且事件檔不變。這是輔助證據，不是人工驗收 |
| `npm.cmd run test:e2e` | 兩輪均逐項輸出 94 案例通過，但未取得正常退出與最終摘要；不得把它記為整體 Passed。第一輪曾手動中止；第二輪在對話中斷時仍未退出 |

## 實際瀏覽器流程與追溯抽查

獨立隔離 context，1400×900、`en-GB`、`America/New_York`；固定時間 `2026-11-02T17:00:00Z`。流程由瀏覽器工具實際執行，不使用真實工作區：

1. 按 Create workspace，拖 Coding 球到週一 10:30；放開前等待放置預覽到達目標。得到 `15:30Z–17:30Z` 的 120 分鐘事件；命名為 `Delivery probe` 並等待存入 localStorage。
2. 雙擊名稱，輸入三個空白並 Enter。前後全部工作區儲存字串逐位元組相同；監看 Storage 的 setItem／removeItem，呼叫清單為 `[]`；畫面回原名稱。
3. reload 後仍有 1 個事件，顯示 `Delivery probe`、`10:30–12:30`，儲存內容相同。

追溯抽查：PRD **AC-01.3**（空白名稱拒絕、不改檔）→ SRS **FR-02／R-3** → `EventBlock.tsx` 的名稱輸入介面 `event-title-input`（面板為 SDS 草稿 UI-04）→ 測試計畫 **TC-03** → `e2e/core.spec.ts` 的 `[TC-03][AC-01.3,FR-02,R-3]` 測試，對空字串、全空白及 31 字逐項斷言顯示原名稱與事件檔 SHA-256 相同。該案例在兩輪 e2e 均輸出通過；完整程序退出狀態仍未確認。

## 版控與秘密檢查

掃描全部本地 refs 的 1,000 個歷史 object、623 個 blob 版本，僅回報路徑與命中種類，不輸出憑證內容。未發現常見 OpenAI／GitHub／AWS 金鑰或私鑰標頭，未發現 SQLite 檔頭，以及 `.env`、資料庫、副檔名私鑰、node_modules、venv／site-packages 等可疑追蹤路徑；未讀取任何 `.env` 內容。這是指定特徵的掃描結果，不保證能辨認所有形式的秘密。

審查開始前已有 CLOSEOUT／HANDOFF 修改；瀏覽器工具核准流程另在 `.codex/config.toml` 加入工具核准設定。均保留，不自動提交或還原。

## 未完成與人工驗收

`__proto__` P2 已修正（2026-11-07）：先前紅燈為 14 passed／1 failed，預期有 1 個合法事件、實際為 `[]`。專案擁有者確認後，repository 收集容器改為無原型物件，讓外部 ID 不會觸發 prototype setter；事件與模板正常列舉、無通知、原檔不變。相關載入與重開測試 16 passed；完整單元 36 檔／445 passed，typecheck／lint／build Passed。暫時改回舊容器，同一回歸再次失敗，還原修正後全單元通過。

「不足 1 分鐘」已確認並修正：TC-07 同時放入 30 秒與恰好 1 分鐘事件，只載入後者、通知前者且零寫入／刪除。原紅燈 15 passed／1 failed 的原因是接受 30 秒事件；修正後載入測試 16 passed，完整單元 36 檔／446 passed，typecheck／lint／build Passed。schemas 引用唯一的 EVENT_MIN_MINUTES 常數；移除下限時同一測試再次失敗，還原後全單元通過。SRS R-5 與 TC-07 已同步使用者確認的下限；只收緊載入驗證，檔案結構與版本維持不變，不改寫被拒絕的檔案。

日期標題拖曳回歸已確認並修正：`e2e/multiSelect.spec.ts` 新增 `[TC-18][AC-04.3,FR-13] ... sticky date header ...`，框選兩個事件、捲動 80 px、拖到 sticky day-header，確認拖曳預覽出現與命中標題後才放開。原紅燈是兩個事件從 `15:00Z` 變成 `13:30Z`；改為用 elementFromPoint 與 columns.contains 檢查實際可見命中後，拒絕且檔案與選取維持不變。多選 13 passed、完整 WebKit e2e 95 passed（30.8s，exit 0），單元 446 passed、typecheck／lint／build Passed。暫時還原舊矩形判斷，同一回歸再次失敗；還原修正後完整 e2e 通過。臨時設定已移除、隔離測試伺服器已停止。

原生對話框標題翻譯已確認並修正：`tauriDialog.test.ts` 原先因 IPC 缺少 `title: 建立工作區` 而紅燈；使用者確認後沿用既有 welcome.create／welcome.open 字典，傳入當下選定語言的標題。Rust 接收 title，拒絕全空白／控制字元後交給原生對話框；原本寫死英文已移除。測試覆蓋繁中「建立工作區／開啟工作區」與英文兩種模式；移除 title 傳遞時同一測試再次失敗，還原後完整單元 37 檔／447 passed，Rust 43 passed、完整 WebKit e2e 95 passed（28.4s／exit 0）、typecheck／lint／build Passed，debug no-bundle 建置成功。桌面 smoke 重跑通過（建立 1 個事件、路徑越界拒絕、重開 blocksOnLaunch: 1 且事件檔不變）；維護檢查通過。

原生 UI 嘗試使用本次編譯的隔離免安裝副本（`.playwright-mcp/native-title-review-20261107`，獨立 data、語言 zh-TW、測試用版本 99 manifest），成功讀到繁中歡迎畫面。Computer Use 點擊時回報 `coordinate input geometry is unavailable`，擷取畫面另有 `FrameArrived timed out`，未能可靠開啟資料夾對話框；沒有把 IPC 測試宣稱為原生標題實測。只關閉了此隔離副本的行程；未開啟真實工作區。

- 5 個審查缺陷的程式修正與自動回歸已完成，沒有刻意保留的紅燈；原生標題仍需人工檢查。
- 原生標題人工檢查：開啟上述隔離副本（版本 99 提醒是測試預期，為了停留歡迎畫面），分別按「建立工作區／開啟工作區」，核對視窗標題相同；兩次都按取消，不選取真實工作區。需要英文對照時切 English 再重複。
- P1 原生關窗的「儲存失敗會保留視窗」尚未實際操作驗證；現有 smoke 只涵蓋正常儲存關閉。不得用瀏覽器流程代替這項驗收。
- e2e 程序未退出仍待診斷；原票 028 冷啟動與已凍結項不因綠色重試而自動結案。
- M-01、M-02、M-04、M-05、M-06、M-08、M-09 等人工驗收仍見 CLOSEOUT；沒有新增人工驗收通過的宣稱。測試必須另建隔離工作區，不使用既有工作資料。
- 未重新打包 NSIS 或更新 Release；未 commit、未 push。
