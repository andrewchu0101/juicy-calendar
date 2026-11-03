# 016：NSIS 安裝檔與 README

**大小：** M　**狀態：** 未就緒：等待 S-02 決定

**成果（What to build）：** 提供 Windows 的 NSIS 安裝檔：缺少 WebView2 時由安裝程式連網下載微軟官方版本；不簽章；最低支援 Windows 10 1803 64 位元。README 補上 Windows 安裝、解除安裝、SmartScreen 警告的處理，以及「工作區資料夾不要放在雲端同步資料夾」的建議。

**Blocked by：** 000，以及 **S-02 決定**（`tauri build` 下載 NSIS 工具的寫入位置，我預期在 C 槽）

**對應 TC／人工：** M-01；AC-03.1、FR-08、NFR-05

**驗收指令：** 人工 M-01（乾淨 Windows）；`npm run typecheck`、`npm run lint`、`npm test`

**要讀的規格段落：** `docs/05-sds.md` 打包契約；`docs/04-sad.md` 風險表；`docs/03-srs.md` FR-08、NFR-05

## 驗收條件

- [ ] **執行 `tauri build` 之前，先查證並向專案擁有者說明 NSIS 工具的下載與寫入位置，取得同意後才執行**（`CLAUDE.md` 3.3）。
- [ ] 打包設定新增 NSIS 目標；WebView2 採 `downloadBootstrapper`，**先對照 Tauri 官方文件確認設定值**（SDS 標為未驗證）。
- [ ] M-01：乾淨 Windows 安裝、啟動、建立工作區、完成 AC-01.1 的流程、解除安裝；解除安裝後工作區資料夾與檔案仍在。記錄環境版本與證據。
- [ ] Windows 10 1803 若沒有環境，記為「未驗證」，不宣稱通過。
- [ ] README 步驟能被他人照做；建置產物不進版控。

共同規則（先讀）：[`issues/README.md`](README.md)。
