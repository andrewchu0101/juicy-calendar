# 05 SDS — Juicy Calendar

| 項目 | 內容 |
|---|---|
| 版本／狀態 | v0.1 **草稿**（待專案擁有者審查；契約變更時同步更新測試計畫的 TC） |
| 審查者 | 專案擁有者 |
| 日期 | 2026-11-04 |
| 上游 | `docs/04-sad.md`、`docs/03-srs.md`（皆為本輪產出或已確認）；現況來自 `src/` 與 `src-tauri/src/` 的程式碼 |
| 標記 | 「現況」＝程式碼已有；「新增」＝本設計要求、程式碼尚無；「修改」＝現有行為要改 |

## 目錄

- [資料模型與不變量](#資料模型與不變量)
- [API 契約（Tauri 命令）](#api-契約tauri-命令)
- [UI 與模組契約](#ui-與模組契約)
- [變更與未決](#變更與未決)
- [FR／NFR 設計落點](#frnfr-設計落點)

## 資料模型與不變量

資料全在檔案裡，沒有資料庫。生命週期：工作區資料夾由使用者選定（或免安裝版的 `data`），App 在記憶體中維持一份 Zustand 狀態，變更後比對差異、排入佇列、由 Rust 原子寫入；下次開啟時逐檔讀回並以 Zod 驗證。**事件的 `id` 與時間初值由 App 決定**，名稱、顏色、語言由使用者決定。

```text
<工作區>/                      （安裝版：使用者選的資料夾；免安裝版：<執行檔旁>/data）
├── workspace.json            現況，格式版本維持 2
├── settings.json             現況
├── settings.corrupt.json     現況，僅在 settings.json 損毀時產生
├── templates/<id>.json       現況
├── events/<id>.json          現況
└── .juicy.lock               新增，空檔案，只用於檔案鎖，不進前端允許清單
<App 設定資料夾>/              （安裝版：%APPDATA%\app.juicycalendar.timeblock；免安裝版：<執行檔旁>/data）
├── last-workspace.txt        現況（免安裝版不使用）
└── app-settings.json         新增
```

| 欄位 | 型別、格式與可空性 | 預設／約束 | 來源 |
|---|---|---|---|
| `event.id` | 字串，符合 `^[A-Za-z0-9_-]{1,120}$`；檔名必須是 `<id>.json` | App 產生，`evt_` 加隨機字串 | R-2、R-5（現況） |
| `event.title` | 字串，**去掉前後空白後非空，且不超過 30 個使用者看到的字元**（以 `Intl.Segmenter` 的 grapheme 計數） | 預設為模板名稱 | FR-02、R-3（修改） |
| `event.startAt` / `endAt` | 含時差的 ISO 8601 時間 | `endAt` 嚴格晚於 `startAt` | R-5（現況） |
| 事件長度 | `endAt − startAt`，單位分鐘 | **1 ≤ 長度 ≤ 10080**；超出的既有檔案載入時視為壞檔 | FR-02、FR-03、R-5（修改） |
| `event.color` | `#RRGGBB` | 複製自模板 | R-2（現況） |
| `event.templateId` | 字串，載入時不要求模板仍存在 | — | 現況 |
| `template.name` | 同 `event.title` 規則 | 預設六個模板名稱皆符合 | U-11（修改） |
| `template.defaultDuration` | 正數 | 目前不生效（NG-03） | 現況 |
| `workspace.json` | `{schemaVersion, name, createdAt}` | `schemaVersion` 維持 2 | 現況 |
| `settings.json` | `{startHour, endHour, pixelsPerMinute, view, inspectorCollapsed, magnetEnabled}` | 現況不變；**語言不放這裡** | 現況 |
| `app-settings.json` | `{"schemaVersion": 1, "language": "zh-TW" \| "en"}` | 檔案不存在、無法解析或值不合法 → 視為「尚未設定」 | FR-09（新增） |
| `.juicy.lock` | 空檔案；實際的鎖由作業系統持有 | 關閉或行程結束即釋放 | FR-07（新增） |

**可調常數**（集中命名，單位寫在名稱裡，避免散落）：

| 名稱 | 值 | 來源 |
|---|---|---|
| `NAME_MAX_CHARS` | 30 | 專案擁有者決定 |
| `EVENT_MAX_MINUTES` | 10080（7 天） | 專案擁有者決定 |
| `EVENT_MIN_MINUTES` | 1 | 現況 `MIN_EVENT_MINUTES` |
| `NEW_EVENT_MINUTES` | 120 | 現況 |
| `RADIAL_HOLD_MS` / `RADIAL_MOVE_TOLERANCE_PX` | 450 / 6 | 現況 |
| `MAGNET_RADIUS_PX` | 8 | 現況 |
| `SAVE_DEBOUNCE_MS` | 120 | 現況 |

**不變量**：

- I-1 任何已存在的事件，長度都在 `[EVENT_MIN_MINUTES, EVENT_MAX_MINUTES]`，名稱符合 R-3。
- I-2 被拒絕的輸入不進入寫入佇列，因此磁碟上沒有任何變化。
- I-3 任一時刻，一個工作區資料夾只有一個行程持有它的鎖；寫入或讀取工作區內容之前必須已取得鎖。取鎖所建立的空檔案 `.juicy.lock` 是行程鎖定標記，不算修改使用者資料（2026-11-04 決定），所以之後因版本較新而拒絕開啟，也不違反「不修改任何檔案」。
- I-4 前端傳給 Rust 的路徑永遠是工作區內的相對路徑；`.juicy.lock` 與 `app-settings.json` 不在允許清單內。
- I-5 在「選擇資料夾」的流程中，取鎖失敗時，原本開啟的工作區維持開啟，`last-workspace.txt` 不變。
- I-6 兩種語言的字典鍵值完全相同。
- I-7 編輯或刪除模板不改變任何既有事件（事件複製模板顏色，現況）。

**持久性與重試**：每個路徑只保留最新一筆待寫入（後者取代前者）；寫入失敗留在佇列並在下次重試；同一內容重複寫入結果相同（冪等）。`app-settings.json` 只在使用者切換語言時寫入一次。

**初始化與升級**：新工作區最後寫入 `workspace.json`（現況）。工作區格式**不提升版本**：本次沒有新增或改名任何工作區內的欄位，只是載入規則變嚴（長度、名稱），這屬於驗證變更，不是格式變更。判斷「資料夾是否為空」時，要**忽略 `.juicy.lock`**（修改），否則曾被開啟過的空資料夾會被誤認為非空。

## API 契約（Tauri 命令）

呼叫方向都是前端 → Rust，經 `invoke`。**錯誤格式（修改）**：現況回傳英文句子，改為可序列化的結構 `{"code": "<代碼>", "detail": "<診斷文字或 null>"}`；前端依代碼翻譯，`detail` 只用於診斷，不直接顯示給使用者。

| 錯誤代碼 | 意義 | 資料是否改變 |
|---|---|---|
| `WORKSPACE_LOCKED` | 該資料夾已被另一個行程持有 | 否 |
| `NOT_A_WORKSPACE` | 所選資料夾沒有 `workspace.json`（open 模式） | 否 |
| `NO_WORKSPACE_OPEN` | 尚未開啟工作區就呼叫檔案命令 | 否 |
| `PATH_NOT_ALLOWED` | 相對路徑不在允許清單，或跳出工作區 | 否 |
| `IO_ERROR` | 其他檔案系統錯誤；`detail` 為系統訊息 | 視情況（寫入為原子，失敗不留半個檔案） |

### API-01｜`workspace_select(mode)`（FR-05、FR-07；修改）

使用者按「建立／開啟工作區」時呼叫，`mode` 為 `"create"` 或 `"open"`。順序固定：
①跳出原生資料夾選擇視窗 → ②決定根目錄（open：必須有 `workspace.json`；create：空資料夾直接用，否則建立子資料夾）→ ③若根目錄與目前已開啟的相同，直接回傳目前位置（**不重複取鎖**，因為同一行程用另一個把手重鎖會被自己擋住）→ ④**取得 `.juicy.lock` 的獨占鎖**，失敗回傳 `WORKSPACE_LOCKED` 並結束，不寫任何檔案 → ⑤寫入 `last-workspace.txt` → ⑥釋放舊工作區的鎖、換成新根目錄。

- 請求：`{"mode": "open"}`。
- 成功：`{"path": "D:\\Plans\\MyTimeBlock", "initialized": true}`；使用者取消視窗則回傳 `null`。
- 失敗（資料夾被占用）：`{"code": "WORKSPACE_LOCKED", "detail": null}`。資料夾內的檔案與 `last-workspace.txt` 都不被修改。

### API-02｜`workspace_restore()`（FR-05、FR-11；修改）

啟動時還原。安裝版：讀 `last-workspace.txt`，檔案不存在或資料夾已無 `workspace.json` → 回傳 `null`（回到歡迎畫面，不重建）；否則依 API-01 的③④⑥取鎖並回傳位置。**免安裝版**（見 API-07）：啟動時一律開啟執行檔旁的 `data`（不存在就建立，這是 App 自己的資料夾），不讀也不寫 `last-workspace.txt`；`initialized` 為 `false` 時前端走既有的初始化流程建立工作區。取鎖失敗同樣回傳 `WORKSPACE_LOCKED`。`data` 無法建立或寫入時回傳明確的錯誤代碼（`PORTABLE_DATA_UNAVAILABLE`，`detail` 僅供診斷），**不改存**使用者目錄、也不退回歡迎畫面假裝成功。手動切換工作區（API-01）在免安裝版照常運作，但不寫 `last-workspace.txt`，下次啟動仍回到 `data`。

### API-03｜`workspace_close()`（修改）

釋放鎖、清除目前根目錄、刪除 `last-workspace.txt`（安裝版）。工作區未開啟時也成功（冪等）。

### API-04｜`workspace_list(dir)`、`workspace_read(path)`、`workspace_write(path, contents)`、`workspace_remove(path)`（現況，僅錯誤格式修改）

允許清單不變：`workspace.json`、`settings.json`、`settings.corrupt.json`、`templates/<安全名稱>.json`、`events/<安全名稱>.json`。`workspace_write` 為「寫暫存檔、同步、改名」的原子寫入。`workspace_read` 對不存在的檔案回傳 `null`。路徑不合法 → `PATH_NOT_ALLOWED`。

### API-05｜`app_settings_read()`、`app_settings_write(settings)`（FR-09；新增）

- 讀取：回傳 `{"language": "zh-TW"}`，或檔案不存在、損毀、值不合法時回傳 `{"language": null}`（前端改用系統語言偵測）。損毀的檔案**不被修改**，直到使用者下次切換語言才被覆寫。
- 寫入：請求 `{"language": "en"}`，值必須是 `"zh-TW"` 或 `"en"`，否則回傳 `IO_ERROR`（`detail` 說明值不合法）且不寫入。以原子方式寫入 `app-settings.json`。
- 存放位置由 Rust 決定（安裝版 `app_config_dir`，免安裝版 `data`），前端不傳路徑。

### API-06｜`system_info()`（FR-09、FR-10；新增）

回傳 `{"locale": "zh-TW", "hour12": true}`。`locale` 為 Windows 使用者預設語系名稱；`hour12` 依 Windows 的 12/24 小時設定。任一值取不到（非 Windows 或呼叫失敗）為 `null`，前端退回 `navigator.languages` 與 `Intl` 的 `hourCycle`。永不回傳錯誤。

### API-07｜啟動前檢查（非 IPC；FR-08、FR-11、U-12；新增）

在 Tauri 啟動**之前**執行，輸入為「執行檔所在目錄」。

- 免安裝判斷：目錄內存在 `portable.flag` → 免安裝模式，啟動時開啟 `<目錄>/data`，App 設定始終存在該處（不隨手動切換的工作區移動）。
- WebView2 偵測（僅 Windows）：登錄值 `EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}` 的 `pv` 存在且不是 `0.0.0.0`（檢查 64 位元的 `WOW6432Node` 與 `HKCU`）。缺少 → 顯示原生說明視窗後以結束碼 1 結束，**不啟動 Tauri**。視窗文字依 `locale` 內建兩種語言（`zh*` 為繁體中文，其他為英文），內容為「找不到 Microsoft Edge WebView2 執行階段，請用瀏覽器到微軟官方網頁下載後再開啟」並附網址（網址於實作時再確認）。App 本身不連網（NFR-03）。

## UI 與模組契約

### 畫面

- **UI-01｜歡迎畫面**（US-02、US-03）：兩個按鈕「建立／開啟工作區」；新增語言選單（歡迎畫面第一眼就要能切換）；`openError` 顯示由**錯誤代碼翻譯**的文字，代碼來自 API-01、API-02 與前端的 `WorkspaceOpenError`。`WORKSPACE_LOCKED` 的說明：「此工作區已在另一個視窗開啟，請先關閉那個視窗。」（英文版對應）。
- **UI-02｜通知**（US-02）：`issues` 由字串陣列改為結構陣列 `{code, file?, detail?}`，通知元件依代碼翻譯。代碼：`FILE_SKIPPED`（附檔案路徑；原因為格式、檔名、長度或名稱）、`SETTINGS_RESET`（`settings.json` 損毀，已另存 `settings.corrupt.json`）。`saveError` 同樣改為代碼加診斷文字。
- **UI-03｜工具列**：語言選單與歡迎畫面共用同一個元件；時間格式**沒有**設定項目（FR-10）。
- **UI-04｜右側面板**（US-01）：名稱、日期、開始、結束、持續分鐘維持現有欄位與「按 Enter 或離開欄位才提交、Escape 還原」的行為；日期與時間欄位沿用瀏覽器內建控制項（見 SAD 風險）。被拒絕時欄位還原為原值（Q-03）。
- **UI-05｜時間顯示**（FR-10）：區塊上的時間範圍、時間軸標籤、面板的顯示值，統一由 `formatTime` 產生，不再寫死 `HH:mm`。
- **UI-06｜排版**（NFR-07）：文字容器以內容與可用寬度決定尺寸，不寫死像素；區塊太短放不下名稱時，名稱被截斷並仍可由面板看到完整內容（細節於實作票定義）。

### 前端模組

| 模組 | 契約（責任、輸入輸出、失敗行為） | 來源 |
|---|---|---|
| `limits`（新增） | 匯出上表的常數；前端與測試共用唯一來源 | FR-02、FR-03 |
| 引擎 `mutations`（修改） | `validateTitle(raw) → string \| null`：去空白、非空、≤ `NAME_MAX_CHARS`，不合法回傳 `null`。`withEndTime`：結束時間套用在**結束目前所在的日期**，結果必須嚴格晚於開始且長度 ≤ 10080，否則回傳 `null`（**移除**「自動當成隔天」的備援）。`withDuration`：輸入值 ∈ [1, 10080] 才接受，之後才四捨五入。`resizeStart`／`resizeEnd`：長度夾在 [1, 10080]。其餘函式回傳 `null` 表示拒絕，不拋例外 | FR-02、FR-03、R-3 |
| `schemas`／`repository`（修改） | `eventSchema`：加入長度 ≤ 10080 與名稱規則；`templateSchema`：加入名稱規則；壞檔略過並產生 `FILE_SKIPPED`，**不修改該檔**。`WorkspaceOpenError` 攜帶代碼：`NO_WORKSPACE_JSON`、`WORKSPACE_DAMAGED`、`WORKSPACE_TOO_NEW`（附版本號）、`WORKSPACE_LOCKED`、`NOT_A_WORKSPACE`、`OPEN_FAILED`（附診斷文字） | FR-06、R-5 |
| `backend`（修改） | `WorkspaceBackend` 新增 `readAppSettings`、`writeAppSettings`、`systemInfo`；Tauri 版呼叫 API-05、06；**瀏覽器版**（`npm run dev` 與 e2e）以 `localStorage` 與 `navigator` 實作，鎖為無操作。錯誤統一轉為 `{code, detail}` | FR-05、09 |
| `i18n`（新增） | `Language = 'zh-TW' \| 'en'`；字典型別以 `satisfies` 保證鍵值一致；`t(key, params?)`；`detectLanguage(systemLocale, navigatorLanguages) → Language`（以 `zh` 開頭 → `zh-TW`，否則 `en`；兩者都取不到資訊時 → `en`）；`I18nProvider` 讀取 API-05，未設定則用 API-06 偵測；切換即時生效並寫入 API-05。缺鍵：顯示英文，並在測試中失敗 | FR-09、R-7 |
| `formatTime`（新增，屬 i18n） | `formatTime(date, {hour12}) → string`：24 小時制 `13:00`；12 小時制依語言輸出 `1:00 PM` 或 `下午 1:00`。`hour12` 來自 API-06（null 時用 `Intl` 的 `hourCycle`）。繁體中文午夜暫定 `上午 12:00`、正午 `下午 12:00`；日期的星期與月份用 `date-fns` 的 `zh-TW`／`en-US` 語系 | FR-10、R-7 |
| `workspaceSession`（修改） | `enter()` 在取鎖失敗時不進入畫面；`selectWorkspace`／`restoreLastWorkspace` 把錯誤代碼放入 `openError`（結構，不是字串） | FR-07 |

**驗證責任**：Rust 驗證路徑、取鎖、原子寫入與列舉的檔名格式；**前端**驗證檔案內容（Zod）與所有使用者輸入（引擎）。兩邊都不信任對方傳來的值：Rust 不相信前端的路徑；前端不相信磁碟上的內容。

### Rust 模組

| 模組 | 契約 | 來源 |
|---|---|---|
| `workspace_lock`（新增） | `acquire(root) → Result<LockGuard, LockError>`：以 `create(true)`、`write(true)` 開啟 `<root>/.juicy.lock`（**不截斷**），呼叫 `try_lock`；已被占用回傳 `WouldBlock` 對應的 `WORKSPACE_LOCKED`。`LockGuard` 被丟棄即釋放。鎖只在 `WorkspaceState` 持有 | FR-07、ADR-01 |
| `fs_safe`（修改） | 允許清單**不變**；`new_workspace_dir` 的「資料夾是否為空」忽略 `.juicy.lock` | FR-07、R-4 |
| `app_settings`（新增） | `read(dir)`／`write(dir, language)`，`dir` 由呼叫者傳入（測試傳暫存資料夾）；原子寫入；檔名固定為 `app-settings.json` | FR-09 |
| `portable`（新增） | `detect(exe_dir) → Option<PathBuf>`：目錄內有 `portable.flag` 則回傳 `<exe_dir>/data`；以參數傳入目錄，不直接讀 `current_exe` | FR-11、ADR-05 |
| `platform_win`（新增，僅 Windows） | `system_locale() → Option<String>`、`system_hour12() → Option<bool>`、`webview2_installed() → bool`、`show_message(title, text)`。unsafe 只在此模組；非 Windows 編譯時回傳 `None`／`true`／無操作 | FR-08、09、10、ADR-04 |
| `lib.rs`（修改） | `activate()` 負責「取鎖 → remember → 設定根目錄 → 釋放舊鎖」；`WorkspaceState` 同時持有根目錄與 `LockGuard`；啟動入口先跑 API-07；所有命令錯誤改為 `{code, detail}` | API-01～07 |

### 測試注入

- **暫存資料夾**：Rust 測試沿用 `fs_safe` 現有的 `TempDir` 模式，並提到共用的測試輔助；`app_settings`、`workspace_lock`、`portable` 的函式都以目錄為參數，因此不需要碰真實的使用者資料夾。前端的持久化測試使用記憶體版的 `WorkspaceBackend`；e2e 使用瀏覽器版（`localStorage`）。
- **固定時鐘**：不新增時鐘接縫。程式裡取得現在時間的地方（`CalendarGrid` 的現在時刻線、`appStore` 的錨點、`repository` 的 `createdAt`、拖曳回饋的 key）都用全域的 `Date`，所以單元測試用 Vitest 的假計時器、e2e 用 Playwright 的 `page.clock.setFixedTime` 即可固定。時區：Vitest 設定 `TZ=America/New_York`（現況，讓夏令時間測試有意義），e2e 也使用同一時區。
- **雙行程測試**：單一寫入者需要兩個行程才能證明；Rust 單元測試以子行程（測試執行檔自己）持鎖，另一個行程嘗試取鎖，並在強制結束子行程後再嘗試一次（對應 2026-11-04 的實驗）。
- **缺少 WebView2**：以官方環境變數 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` 指向空資料夾，可在這台已安裝 WebView2 的電腦上模擬。

### 打包契約（FR-08、FR-11）

- **安裝檔**：`tauri.conf.json` 的 `bundle.targets` 需新增 `nsis`（目前只有 macOS 的 `app`）；WebView2 採 `downloadBootstrapper`（依 Tauri 文件，**未在本機驗證**）；不簽章；最低系統為 Windows 10 1803 64 位元。
- **免安裝版**：.zip 內含 `juicy-calendar.exe`、空的 `portable.flag`、空的 `data/`、說明檔。
- 這兩者的建置指令、`tauri build` 下載 NSIS 工具時的寫入位置，在做安裝檔那張票之前先向專案擁有者確認（SAD S-02）。

## 變更與未決

| 項目 | 相容性與遷移 |
|---|---|
| 工作區格式 | 不變，仍為版本 2。舊 App 仍能開新 App 寫過的工作區。 |
| 載入規則變嚴 | 長度超過 7 天、名稱超過 30 字的既有檔案，新版載入時會被略過並通知，**檔案不被刪除或修改**（U-10、U-11 已決）。需以版本 2 的樣本資料夾驗證（NFR-04）。 |
| `.juicy.lock` | 新增於工作區資料夾，內容為空。使用者複製資料夾時可忽略。 |
| `app-settings.json` | 新增，位於 App 設定資料夾；缺少時為「尚未設定」，無需遷移。 |
| IPC 錯誤格式 | 由字串改為 `{code, detail}`；前端與 Rust 必須同一個版本一起改，兩邊的測試一併更新。 |
| 通知結構 | `issues`、`openError`、`saveError` 由字串改為結構，涉及 `appStore`、`Notices`、`WelcomeScreen`、`workspaceSession`、`repository` 與其測試。 |
| 瀏覽器版 backend | 需補上對應的 `readAppSettings`、`writeAppSettings`、`systemInfo`，否則 e2e 無法覆蓋語言與時間格式。 |

**會影響實作、須先定案的未決契約**：

| ID | 問題 | 決策人 |
|---|---|---|
| S-01 | ADR-05：以 `portable.flag` 判斷免安裝模式，是否同意 | **已決定（2026-11-05）**：同意，附三項條件，見 SAD ADR-05 |
| S-02 | 做安裝檔前，`tauri build` 下載 NSIS 工具的寫入位置（可能在 C 槽，未驗證）是否接受 | **已決定（2026-11-05）**：選 A，`useLocalToolsDir: true`，見票 016 末段 |
| Q-05 | radial hover 效果樣式（不影響其他契約） | 專案擁有者 |
| — | WebView2 官方下載網址、Windows 10 1803 實機行為，於實作與驗證時確認 | 實作者 |

## FR／NFR 設計落點

| 需求 | 落點 | 備註 |
|---|---|---|
| FR-01 放球建立／取消 | 引擎 `pointerToTime`、`newEventTimes`；`useTemplateDrag`；`appStore.createEventFromTemplate`；持久化層（現況） | 名稱預設為模板名，受 U-11 的 30 字限制 |
| FR-02 拖曳邊緣與命名 | 引擎 `resizeStart／End`（加 7 天上限）、`validateTitle`；`EventBlock` | 修改 |
| FR-03 面板驗證 | 引擎 `withEndTime`、`withDuration`、`validateTitle`；Inspector | 修改：移除自動隔天 |
| FR-04 radial hover | `RadialPalette` 元件與樣式 | **只有落點，沒有細節**：樣式待 Q-05 |
| FR-05 儲存與還原 | 持久化層、`fs_safe`、API-01～04 | 現況 |
| FR-06 載入驗證 | `schemas`、`repository`、通知 | 修改：新增長度與名稱規則、結構化通知 |
| FR-07 單一寫入者 | `workspace_lock`、`activate()`、API-01／02、UI-01 | 新增 |
| FR-08 安裝 | 打包契約、API-07 | 新增；NSIS 與 1803 驗證待做 |
| FR-09 語言 | `i18n`、API-05、API-06、UI-01、UI-03 | 新增 |
| FR-10 時間格式 | `formatTime`、API-06、UI-05 | 新增；原生時間欄位的不一致風險見 SAD |
| FR-11 免安裝版 | `portable`、API-02、API-07、ADR-05 | 新增；WebView2 快取位置未驗證 |
| NFR-01 測試可重複 | 測試計畫與測試輔助（拖曳測試要等拖曳狀態完成） | **不是架構議題**，由測試計畫與實作票承接，已查出原因（`docs/HANDOFF.md`） |
| NFR-02 原子寫入 | `fs_safe::atomic_write`（現況） | 現有 Rust 測試；新增的 `app_settings` 沿用 |
| NFR-03 離線與不對外連線 | 安全政策（CSP）、API-07 不連網（只涵蓋 03b；03c 未達成，見 SRS） | TC-15（03b 前端）、M-06（03c） |
| NFR-04 舊工作區可升級 | 格式不變；樣本資料夾測試 | 設計上不需要遷移 |
| NFR-05 可安裝 | 打包契約 | 人工驗證；1803 可能無環境 |
| NFR-06 效能 | **無設計落點** | 待量測，沒有需求來源，不設計 |
| NFR-07 排版 | UI-06 | **只有原則，沒有逐元件設計**，在實作票與視覺檢查補 |

> 審查重點：欄位、錯誤代碼、命令與資料副作用可直接實作；前後端契約一致；FR／NFR 有落點（上表標出沒有細節的三項：FR-04、NFR-06、NFR-07，以及不屬架構的 NFR-01）；測試者可據此建立獨立預期。
