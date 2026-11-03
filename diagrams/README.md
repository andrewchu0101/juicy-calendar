# diagrams — 主要流程圖（D 卡）

來源：`docs/03-srs.md`（v0.2）。只畫 SRS 已定的行為；未畫的行為列在各圖的「此圖未畫」卡片。
產生日期：2026-11-04。工具：archify 3.2.0，`finalize workflow --quality showcase`。

| 圖 | 對應 SRS | 來源檔 | 成品 |
|---|---|---|---|
| 放球建立區塊 | FR-01、AC-01.1、AC-01.2 | `01-place-ball.candidate.json` | `01-place-ball.html` |
| 調整與命名區塊 | FR-02、FR-03、AC-01.1、AC-01.3 | `02-edit-block.candidate.json` | `02-edit-block.html` |
| 開啟工作區 | FR-05（還原）、FR-06、FR-07、AC-02.1～02.3 | `03-open-workspace.candidate.json` | `03-open-workspace.html` |

## 驗證證據（對應目前這份 HTML 的位元組）

| 圖 | 驗證收據 | 結果 |
|---|---|---|
| 01 | `review-2/01-place-ball/` | validate、deliver、check、browser-check 皆 pass |
| 02 | 本資料夾 `02-edit-block.finalize*.json`、`02-edit-block.browser-check.json` | 同上 |
| 03 | `review-3/03-open-workspace/` | 同上 |

- 01、03 在第一次產出後調整過欄位順序與連線方向（見下），所以收據在 `review-2`、`review-3`；較早的收據已刪除，因為它們對應的是舊版 HTML。
- 已核對：三份 HTML 與來源檔的 SHA-256，皆與最新收據記載相同。
- `visual-check/<圖名>/`：亮色／暗色、1440×900／2048×1320 的截圖。**亮色 2048×1320 三張由我實際看過**；暗色與 1440 寬只有自動檢查，未人工看過。

## 畫圖時的調整（不影響需求內容）

- 01：把「拒絕路徑」欄移到最下面，避免「寫入」虛線穿過「不產生副作用」的欄位而被誤讀。
- 03：同樣調整欄位順序，並把「已在其他視窗開啟」與「workspace.json 不可用」兩條拒絕線改成直接往下連。

## 需要你對照 SRS 確認的畫法

1. 圖 3 先檢查「已在其他視窗開啟」再讀 `workspace.json`。SRS 沒規定先後，這是畫圖需要（圖中已註明）。
2. 圖 1 的 Escape 連線繞到圖的右緣再回到「不建立區塊」，路徑較長但不經過任何節點。
3. 圖 2 的「Escape 取消命名」只寫在「保持原名稱」節點的說明裡，沒有獨立的連線。
4. 圖 1 的「寫入事件檔」用虛線表示非同步：SRS R-4 說寫入是排入佇列、失敗會重試，但沒說畫面更新與寫入的先後。

## 未畫的 SRS 行為

FR-04（radial hover 動畫）、FR-08（安裝）、FR-09（語言）、FR-10（時間格式）、FR-11（免安裝版）：這些不是含驗證與拒絕分支的操作流程，未畫成 workflow。
