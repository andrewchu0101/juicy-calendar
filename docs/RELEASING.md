# 版本與發行步驟

簡短規則，之後發版沿用。第一次依這份流程發行的是 `v0.2.0-beta.1`（2026-11-07）。

## 版本號（SemVer）

格式：`主.次.修補[-預發行]`，Git tag 與 GitHub Release 一律叫 `v<版本>`。

| 情況 | 怎麼升 |
|---|---|
| 新增功能、改變使用者看得到的行為 | 升次版本（0.2.0 → 0.3.0） |
| 只修 bug、文件、不改行為 | 升修補版本（0.2.0 → 0.2.1） |
| 磁碟格式 `schemaVersion` 改變、不相容的改動 | 至少升次版本，並先確認遷移（AGENTS.md 第 8 條） |
| 給另一台電腦驗收的版本 | 加 `-beta.N`（`0.2.0-beta.1`、`-beta.2`…）；序號只在同一個 `X.Y.Z` 內遞增 |
| 驗收通過、準備正式發行 | 去掉後綴（`0.2.0`），發正式 Release（不勾 Pre-release） |

選版號前先查已有的 tag 與 Release（`git tag -l`、`gh release list`），不重用已發布的版號。

## 版本欄位（六處，必須一致）

`package.json`、`package-lock.json`（頂層與 `packages[""]` 兩處）、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`（`juicy-calendar` 那一筆）、`src-tauri/tauri.conf.json`。App 介面不顯示版本；安裝檔名取自 `tauri.conf.json`，免安裝 ZIP 檔名取自 `package.json`。改完用 `grep` 確認沒有舊版號殘留，再跑一次 `npm run test:rust`（會更新 `Cargo.lock`）。

## 發行步驟

1. 確認分支（`main`）、與遠端同步、工作樹乾淨；查已有 tag 與 Release。
2. 版本升級單獨一個 commit：`chore(release): <版本>`，只改上面六處。push。
3. **從這個 commit** 重跑：`npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`、`npm run test:e2e`、`npm run test:desktop`。已知：`test:desktop` 剛編出新 debug 執行檔後的第一次冷啟動可能失敗（票 028），保留初次與重跑結果。
4. 建置（Rust 環境變數見 `issues/README.md` 共同規則第 6 條）：`npx tauri build --bundles nsis`，再 `node scripts/make-portable-zip.mjs`。兩份都來自同一個 commit、同一個 release 執行檔。
5. 檔名帶版本號：`juicy-calendar_<版本>_x64-setup.exe`、`juicy-calendar_<版本>_x64-portable.zip`；附 `SHA256SUMS.txt`（格式同 `sha256sum`，每行 `雜湊 *檔名`）。ZIP 內要有 `juicy-calendar.exe`、`portable.flag`、空的 `data/`、`README.txt`。
6. 驗證：解壓 ZIP 啟動 release 執行檔、確認視窗與工作區。安裝檔在開發機不安裝（會寫 C 槽與登錄），改在乾淨的另一台 Windows 驗收。
7. 發布：`gh release create v<版本> --target <build 的 commit> --prerelease --notes-file …` 附上三個檔案。tag 必須指向實際建置的 commit。
8. 更新 `docs/CLOSEOUT.md`（下載與驗收步驟）與 `docs/HANDOFF.md`。

## 注意
- 預發行版**不簽章**，Windows SmartScreen 會警告（README 有處理方式）。
- 安裝檔缺少 WebView2 時由安裝程式連網下載；NSIS 工具快取在 `src-tauri/target/.tauri`（D 槽，已被 `.gitignore` 排除）。
- 埠 1421 被別的 `npm run dev` 占住時，e2e 用暫時的 Playwright 設定改埠，用完刪除（見 `docs/LESSONS.md`）。
- 在 PowerShell 執行 `npm run test:desktop` 會因 `bash` 解析成 WSL 而失敗，請用 Git Bash。
