# 013：時間格式跟隨 Windows

**大小：** M　**狀態：** 實作完成（2026-11-04）；M-05 於 2026-11-07 依專案擁有者口頭回報通過

**成果（What to build）：** 區塊上的時間範圍、時間軸標籤、面板顯示值，一律依 Windows 的 12 或 24 小時設定顯示，與介面語言無關；App 不提供切換設定。

**Blocked by：** 010

**對應 TC／人工：** TC-12、M-05；AC-03.3、FR-10

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:rust`；人工 M-05

**要讀的規格段落：** `docs/04-sad.md` ADR-04；`docs/05-sds.md` API-06、`formatTime`；`docs/03-srs.md` R-7；測試計畫 TC-12、M-05

## 驗收條件

- [x] 先寫 TC-12 並看到紅燈。（`formatTime`：9 項失敗，皆為斷言失敗）
- [x] 2026-11-02 當地 13:05：24 小時制 `13:05`；12 小時制英文 `1:05 PM`、繁體 `下午 1:05`。午夜、正午的繁體寫法暫定 `上午 12:00`、`下午 12:00`，**不阻塞**；時間範圍在 12 小時制的寫法未定，不驗。
- [x] Rust 以 Windows 區域設定 API 取得 12/24 小時，直接宣告函式、不新增套件；取不到回傳空值，前端退回瀏覽器的 `hourCycle`；解析邏輯為可單獨測試的純函式。（`GetLocaleInfoEx` 讀 `LOCALE_SSHORTTIME`，`hour12_from_time_pattern`／`pattern_from_utf16` 為純函式）
- [x] 程式中不再有寫死的 `HH:mm` 顯示格式。（`hardcodedTimeFormat.test.ts`；例外：面板兩個 `<input type="time">` 的 `value` 是 HTML 規定的資料格式，專案擁有者同意）
- [x] 人工 M-05：由專案擁有者切換 Windows 時間格式後檢查一致性，記錄結果；原生時間欄位若不一致，記為已知限制。**2026-11-07 專案擁有者口頭回報「時間格式沒問題」，記為通過。**我沒有親眼看到，未逐項記錄切換了哪些格式與語言組合；原生時間欄位的 AM/PM 不一致仍依下方「已知限制」處理。

## 備註

M-05 會改系統設定，必須由專案擁有者操作，做完要還原。

## 實作偏差與決定（2026-11-04）

- 12 小時制的時間範圍寫法為暫定（專案擁有者同意）：兩端各自 `formatTime`、以 `–` 相接，例如 `10:30 AM–12:30 PM`、`上午 10:30–下午 12:30`。
- Playwright 預設語系由 `en-US` 改 `en-GB`（專案擁有者同意）：瀏覽器模式的 `hour12` 退回 `Intl`，`en-US` 是 12 小時制，會讓約 6 處既有的 24 小時斷言變紅；12 小時制另以 `time-format.spec.ts` 的 `en-US`／`zh-TW` 驗證。
- `resolveHour12`：Windows 與 `Intl` 都沒有資訊時用 24 小時制（規格沒寫，我的選擇）。
- `initLanguage` 現在每次啟動都讀 `systemInfo`（原本只在沒有儲存語言時才讀），讀取失敗視為「不知道」，不阻擋啟動。
- 舊的 `formatTimeRange` 從引擎移到 `src/i18n/formatTimeRange.ts`（顯示格式屬於 i18n）。
- **`test:desktop` 的斷言已修（專案擁有者同意）**：`scripts/desktop-smoke.sh` 原本斷言 `"droppedTime": "10:30–12:30"`，真實視窗在 12 小時制 Windows 回報 `10:30 AM–12:30 PM`（腳本還會讀到真實的 `app-settings.json`，所以同時依賴 12/24 小時設定與已儲存的語言）。改為驗證 `10:30` 與 `12:30` 兩個時刻依序出現，顯示格式由 TC-12 負責。修正後 `test:desktop` Passed。

## 已知限制（2026-11-04，專案擁有者在桌面版觀察；已同意接受）

- 條件：Windows 為 `zh-TW`、12 小時制（`tt hh:mm`，上午／下午），App 切成英文。
- 現象：右側面板的 Start、End 欄位名稱已是英文，但兩個 `<input type="time">` 內的 AM/PM 仍顯示 `上午`／`下午`。
- 原因（推論，未在 WebView2 內另做實驗）：原生時間欄位的 12 小時制文字由 WebView2 依 Windows 語系決定，不受 App 字典控制；`index.html` 寫死 `<html lang="en">`，欄位仍顯示中文，可見頁面 `lang` 不是決定因素。SAD 風險表（`docs/04-sad.md` 第 146 列）已預先記載「原生欄位與 App 其餘時間可能不一致」。
- 處理：本票不處理。人工 M-05 時一併記錄；使用說明（票 016 的 README）寫明。若日後要消除，選項是（a）以 `--lang` 類的 WebView2 啟動參數讓欄位跟 App 語言（整個程式一次性、切換語言需重啟，且未驗證有效）或（b）自製時間輸入控制項（與 SRS U-02「只跟隨系統」相反，需重新決定）。

共同規則（先讀）：[`issues/README.md`](README.md)。
