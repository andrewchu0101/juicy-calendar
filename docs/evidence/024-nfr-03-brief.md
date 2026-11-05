# NFR-03 調查與決策簡報（票 024）

日期：2026-11-05。環境：Windows 10 Pro 19045、WebView2 Runtime 156.0.4314.58（取自行程路徑）、Node 24.22.0、Rust 1.90.0（`cargo tree --offline --locked`）。
本文件**只記錄證據與取捨**，不改 SRS 的 NFR-03，也沒有改 App 行為（`git diff` 內沒有產品程式碼因本票而變）。

## 1. 一頁摘要

| 要求 | 現況 | 證據 |
|---|---|---|
| NFR-03a 所有功能可離線使用 | **未驗證**（已補人工項目 M-08，尚未執行） | 沒有在斷網環境實測；靜態上沒有發現功能依賴網路 |
| NFR-03b App 自有程式與依賴不主動對外連線 | **未發現**對外連線能力（靜態）；**不等於證明沒有**（見限制） | §2 |
| NFR-03c 含 WebView2 的行程樹零對外連線 | **未達成**：兩台機器、兩種 Windows 都觀察到 `msedgewebview2.exe` 對外 443 連線 | §3 |

## 2. NFR-03b 靜態稽核

指令與輸出摘要（皆唯讀）：

| 檢查 | 指令／做法 | 結果 | 結論 |
|---|---|---|---|
| Rust 依賴樹 | `cargo tree --offline --locked -e normal --prefix none`，Windows 目標再以 `--target x86_64-pc-windows-msvc`；共 268 個不重複項目 | 沒有 `reqwest`、`hyper`、`h2`、`ureq`、`curl`、`isahc`、`surf`、`tungstenite`、`rustls`、`native-tls`、`openssl`、`sentry`、`socket2`、`mio`、`quinn`、`hickory`／`trust-dns` | 未發現 HTTP 客戶端、socket 或遙測套件 |
| `tokio`（由 `tauri` 引入） | `cargo tree -i tokio -e features` | 啟用的功能為 `fs`、`io-util`、`rt`、`rt-multi-thread`、`sync`、`bytes`、`default`（輸出中沒有 `net`） | 未發現 tokio 網路功能；我只看到這份功能清單，沒有逐一對照 tokio 文件 |
| `http`、`url`、`urlpattern` | `cargo tree -i http` | `http` 由 `tauri-utils` 引入（型別用途） | 這些是型別／解析套件，本身不連線；**無法判斷**其在 Tauri 內部的全部用途 |
| `wry`、`webview2-com`、`tao` | 同上 | 存在（Tauri 的 WebView 主機） | 它們負責載入 WebView2；網路行為屬於 03c 範圍 |
| `tauri-plugin-dialog`（→`rfd`、`tauri-plugin-fs`） | 同上 | 原生檔案對話框、檔案外掛 | 未發現網路能力 |
| Tauri 權限 | 讀 `src-tauri/capabilities/default.json` | 只有 `core:default`、`core:window:allow-destroy` | 沒有 http／shell／opener／updater 權限 |
| Tauri 設定 | 讀 `src-tauri/tauri.conf.json` | CSP `connect-src` 只有 `ipc: http://ipc.localhost`；沒有 updater 設定 | 未發現 |
| Rust 原始碼 | `grep` 網址與 `TcpStream`／`UdpSocket`／`std::net`／`ShellExecute`／`opener` | 只有 `preflight.rs` 三處 `https://developer.microsoft.com/microsoft-edge/webview2/`（說明視窗文字與其測試）；沒有任何開啟網址的程式 | 未發現 |
| npm 正式依賴 | `package.json`：`@dnd-kit/core`、`@tauri-apps/api`、`date-fns`、`react`、`react-dom`、`zod`、`zustand` | 沒有 HTTP 客戶端或分析套件；`npm ls` 中的 `undici-types` 是 `@types/node` 的型別 | 未發現 |
| 實際打包產物 | `vite build` 到暫存資料夾後掃描 | `XMLHttpRequest`、`new WebSocket`、`EventSource`、`sendBeacon`、`serviceWorker`、`importScripts` 皆 0；`fetch(` 1 處，是 Vite 的 modulepreload 輔助（對同源 `href`）；`http(s)://` 字串只有 XML／SVG 命名空間、JSON Schema 識別字、React 錯誤說明網址、date-fns 文件網址 | 未發現（這些字串不是請求） |

**安裝階段的網路（獨立於執行期）**：`tauri.conf.json` 的 `webviewInstallMode` 為 `downloadBootstrapper`（Tauri 預設）。依 Tauri 文件摘要，這個模式在缺少 WebView2 時**需要網路**下載引導程式。這影響「安裝」是否能離線（NFR-03a 的安裝部分），不影響已安裝後的執行。**未實測**（需要沒有 WebView2 的機器）。

**限制**：只看原始碼、鎖定檔與打包字串；沒有對編譯後的 Rust 執行檔做動態分析；`cargo tree` 的功能清單只是依賴圖，不保證每個程式路徑都沒被執行。

## 3. M-06 預跑 #2（Windows 10；**不是正式 M-06**）

環境：Windows 10 Pro 19045（先前預跑是 Windows 11 26200）、WebView2 156.0.4314.58、App 0.1.0 免安裝版 release 執行檔（`npx tauri build --no-bundle`＋`scripts/make-portable-zip.mjs`，解壓到全新資料夾）。取樣方式同測試計畫（`Get-NetTCPConnection`，3 秒一次）。**只閒置，沒有做 M-06 規定的操作**；60～90 秒，不是 5 分鐘。

| 條件 | 取樣長度 | 非本機端點 | 首次出現 | 行程 | 關閉後殘留 |
|---|---|---|---|---|---|
| 後續啟動（`%LOCALAPPDATA%/app.juicycalendar.timeblock/EBWebView` 建立於 2026-11-04） | 60 s | `150.171.28.11:443`（IPv4，Established） | +57 s | `msedgewebview2.exe` | 0 |
| 後續啟動（第二次） | 60 s | 同上 | +60 s | `msedgewebview2.exe` | 0 |
| **首次啟動**（以程序範圍的 `WEBVIEW2_USER_DATA_FOLDER` 指到全新資料夾；6 個 WebView2 行程使用它） | 90 s | 同上 | +60 s | `msedgewebview2.exe` | 0 |

- 與 Windows 11 預跑的差異：位址是 IPv4 而非 IPv6；出現在約 60 秒而不是約 3 秒。**原因不明**（可能是機器、Windows 版本、網路環境或取樣時機不同；沒有查證）。
- 位址擁有者與用途：對 `150.171.28.11` 做反向 DNS 查詢（`Resolve-DnsName -Type PTR`）無紀錄。**未查證**，不憑位址前綴下結論。
- 發現：App 的 WebView2 資料夾**不在免安裝包內**，而在 `%LOCALAPPDATA%/app.juicycalendar.timeblock/EBWebView`。這與 README.txt 的「整個資料夾搬走」承諾有關（票 015 的待確認項「WebView2 快取位置」在此得到答案：在 `%LOCALAPPDATA%`，但是否能改到免安裝資料夾內未測）。
- 限制：3 秒取樣、只看 TCP；沒有 UDP、DNS；沒有 `pktmon`（需要系統管理員，未取得同意）；沒有安裝版；沒有做規定的操作。

## 4. 有文件支持的控制方式（只評估，**全部未實測**）

文件擷取日：2026-11-05。**取得不全**：WebView2 隱私頁（`.../webview2/concepts/privacy`）回 404，所以「WebView2 執行期傳送哪些資料、能否關閉」**沒有答案**；Tauri 設定頁被截斷，`additionalBrowserArgs` 與 `webviewInstallMode` 各項描述只來自頁面摘要，不是逐字文字。

| 控制方式 | 出處 | 文件宣稱 | 副作用／風險 | 需管理員或改系統設定 | 安裝版／免安裝版 | 對 03c 的判斷 |
|---|---|---|---|---|---|---|
| 瀏覽器旗標（`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`、Tauri `additionalBrowserArgs`） | <https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags> | 「For production apps, do not use these flags.」旗標「might be removed or altered at any time」；環境變數僅適合本機；提升權限的 App 會忽略環境變數設定的旗標 | 旗標清單約 105 項，我讀到的只有名稱，**沒有一項被文件描述為「停止對外連線」**；改旗標可能改變行為且不被長期支援 | 環境變數／登錄：是（改使用者設定）；程式碼內設定：否 | 皆可，但 Tauri 文件提醒不同瀏覽器參數的 webview 需不同資料目錄（摘要） | 文件不支持用旗標達成 03c；**未採用** |
| Fixed Version Runtime（Tauri `webviewInstallMode: fixedRuntime`） | <https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution> | 「The WebView2 Runtime on the client isn't automatically updated.」二進位檔「over 250 MB」 | 套件變大（Tauri 摘要約 +180 MB）；自行負責安全更新；**文件沒說它不會對外連線**，只說不自動更新 | 否（隨 App 附帶） | 兩種都可 | 只可能消除「自動更新」類流量；是否消除觀察到的 443 連線**未知，要實測** |
| `UpdatesSuppressed` 原則 | <https://learn.microsoft.com/deployedge/webview2-enterprise> | 讓 IT 管理員設定每日抑制 Edge 與 WebView2 Runtime 自動更新的時段，用來控制頻寬與流量 | 屬於整台電腦的原則，不是 App 能自帶的設定 | 是（系統原則／登錄，需管理員） | 只在被管理的電腦有效 | 只涵蓋更新流量，且不由 App 掌控；不適合當產品承諾 |
| `DowngradeVersion` 原則 | 同上 | 讓特定 App 暫時使用較舊的 Runtime | 與網路無關 | 是 | — | 與 03c 無關，僅列出 |
| `offlineInstaller`／`embedBootstrapper` 安裝模式 | <https://v2.tauri.app/reference/config/>（摘要，未逐字） | `offlineInstaller` 不需網路，安裝檔約 +127 MB；`downloadBootstrapper`（預設）需網路 | 只影響**安裝階段**，不影響執行期 | 否 | 安裝版 | 與 03a 的安裝部分有關，與 03c 無關 |

**沒有依據、不採用**：網路上流傳的「停用遙測」旗標清單、改 Edge 的瀏覽器原則（文件明說瀏覽器原則不適用於 WebView2 Runtime：「Policies for Microsoft Edge don't apply to the WebView2 Runtime and WebView2 apps.」）。

## 5. 需要專案擁有者決定的事

1. **03c 要保留、改寫還是拆開？** 選項與取捨：
   - **保留並接受目前未達成**：誠實，但產品對外不能宣稱「完全不連網」。
   - **改寫成「App 自有程式不連線；WebView2 瀏覽器行程可能依其更新機制連線」**：與目前證據一致；需修改 SRS NFR-03 與 Brief 的限制文字（SRS U-13）。
   - **保留 03c 並採某個控制**：目前**沒有任何有文件支持且已證實有效的控制**；Fixed Version 是唯一值得實測的候選，代價是套件 +180 MB 以上與更新責任，且效果未知。
2. 是否同意我做以下需要同意的步驟：①安裝版 M-06（要把 NSIS 安裝檔裝到 C 槽，並從私有 draft release 下載）；②`pktmon`（需管理員）交叉確認 UDP／DNS；③實測 Fixed Version Runtime（需下載 >250 MB 並修改 `tauri.conf.json` 做實驗，不合入）。
3. 正式 M-06 需要有人在視窗裡做完規定操作（建立工作區、拖球、命名、拖移、調整、切語言、復原重做、關閉再開）並持續 5 分鐘以上；我無法可靠地用自動化驅動這些視窗操作。

## 6. 本票尚未完成的部分

- 正式 M-06（免安裝版與安裝版，各分首次與後續啟動）：**未執行**。本文件第 3 節只是閒置預跑。
- 控制方式的實測：**未做**（沒有同意；Fixed Version 需要大量下載與改設定）。
- WebView2 執行期資料傳送的官方說明：**取得失敗**（隱私頁 404），需另找來源。
- NFR-03a 斷網實測：已加入人工項目 M-08，**未執行**。
