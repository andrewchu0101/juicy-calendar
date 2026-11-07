# 017：免安裝 .zip 組裝腳本

**大小：** S　**狀態：** 實作完成（M-02 於 2026-11-07 依專案擁有者口頭回報通過；README.txt 文字審閱仍待）

**成果（What to build）：** 提供一個腳本，把執行檔、空的 `portable.flag`、空的 `data` 資料夾與說明檔組成免安裝 .zip。

**Blocked by：** 015、016

**對應 TC／人工：** M-02；AC-03.4、FR-11

**驗收指令：** 人工 M-02

**要讀的規格段落：** `docs/05-sds.md` 打包契約；測試計畫 M-02

## 驗收條件

- [x] 腳本可重複執行、輸出到不進版控的位置。`scripts/make-portable-zip.mjs`；輸出在 `src-tauri/target/portable`（`.gitignore` 排除，已用 `git check-ignore` 確認）；重跑會清掉舊版面，`data` 內的使用者資料不會漏進新包（TC-14）。
- [x] M-02：解壓到任意資料夾執行、建立區塊並切換語言；把整個資料夾複製到另一處（有條件則另一台電腦）執行，區塊與語言設定相同。**2026-11-07 專案擁有者口頭回報人工驗收通過**；我沒有親眼看到，未逐項記錄環境、是否用另一台電腦、也未記 `README.txt` 審閱結果（該審閱仍視為待辦）。
- [x] 缺少 WebView2 時的行為，依票 014 與 S-01、U-12 的決定記錄。說明檔 `README.txt` 寫明：顯示說明後結束、請用瀏覽器到微軟官方頁面自行下載、程式本身不連網；網址與票 014 的說明視窗相同。實際行為由票 014 驗證，本票只記錄文字。

共同規則（先讀）：[`issues/README.md`](README.md)。

## 實作紀錄與偏差（2026-11-05）

- 新增 `scripts/make-portable-zip.mjs` 與 `scripts/make-portable-zip.test.ts`（TC-14，7 項，先紅後綠）。壓縮用 Windows 內建 `System32/tar.exe -a`（bsdtar），沒有新增套件；Git Bash 的 GNU tar 做不了 zip，所以腳本明確指向 bsdtar。
- 用法：`npm run portable`（先 `tauri build --no-bundle`，會寫入 `src-tauri/target/release`，不下載工具；再執行 `node scripts/make-portable-zip.mjs`），輸出 `src-tauri/target/portable/juicy-calendar_<版本>_x64-portable.zip`。
- **偏差一（已獲同意）**：`vitest.config.ts` 的 `include` 加入 `scripts/**/*.test.ts`（票以外的檔案）。
- **偏差二（已獲同意）**：`package.json` 新增 `npm run portable`，等於 `tauri build --no-bundle` 加 `node scripts/make-portable-zip.mjs`，一個指令做出 zip。
- **偏差三**：免安裝版要用 `tauri build --no-bundle` 的執行檔，不能直接用 NSIS 建置後的 `target/release` 執行檔（那次建置會在 exe 上寫入 NSIS 的 bundle 類型資訊）。腳本沒有強制這點，只在「找不到執行檔」時提示 `--no-bundle`。
- **偏差四**：zip 內含 `data/` 目錄條目，空資料夾解壓後仍在（TC-14 第 4 項實測）；就算沒有，App 也會在啟動時建立 `data`。
- `README.txt` 為雙語提案文字（CRLF 換行），**待專案擁有者審閱**。
- 實機：`tauri build --no-bundle` 1m05s；zip 2.95 MB；解壓到全新資料夾後啟動 release 版，8 秒內旁邊建出 `data`（`workspace.json`、`settings.json`、6 個模板、`.juicy.lock`），`%APPDATA%/app.juicycalendar.timeblock` 沒有被建立。測試用的行程是手動結束的，不是正常關閉。
- **未驗證**：①M-02 的人工流程（建立區塊、切換語言、複製資料夾到另一處或另一台電腦、再執行）；②zip 在乾淨的 Windows 上解壓與執行；③release 版從 zip 啟動後的畫面與操作（只確認檔案出現，沒有看畫面）；④Windows 檔案總管內建解壓是否保留空的 `data/`（只用 bsdtar 驗證）；⑤SmartScreen 對這個未簽章 zip 內 exe 的反應；⑥`README.txt` 在記事本中的顯示（CRLF 與 UTF-8 無 BOM，記事本通常能辨識，但沒實測）。

## 補充（2026-11-07）
M-02 自動化部分通過：組裝 zip（內含空的 `data/`）→ `Expand-Archive` 解壓 → 執行 → 建立區塊、切 English → 複製整個資料夾到另一處 → 區塊與語言相同。細節見 `docs/evidence/desktop-verification-2026-11-07.md`。**未驗證**：另一台電腦、檔案總管內建解壓、SmartScreen、README.txt 文字審閱（待專案擁有者）。
