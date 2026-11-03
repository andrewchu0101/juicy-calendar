# 文件模板：六份各司其職的工程文件

依你專案的工作流程進行；不要先複製所有空表。`＜＞` 是替換處，教學提示不放進成品。固定路徑讓通用 skills 及下一個對話能找到成果。

| 模板 → 產出 | 要回答的審查問題 | 何時 |
|---|---|---|
| [01 Brief](01-brief.md) → `docs/01-brief.md` | 問題有何證據，做完怎樣算成功？ | 專案起始 |
| [02 PRD](02-prd.md) → `docs/02-prd.md` | 誰做什麼，成功和拒絕時看見什麼？ | 需求定義 |
| [03 SRS](03-srs.md) → `docs/03-srs.md` | 規則與邊界是否足以獨立算出預期？ | 規則收斂 |
| [04 SAD](04-sad.md) → `docs/04-sad.md` | 責任、信任邊界、故障與取捨是否合理？ | 設計階段 |
| [05 SDS](05-sds.md) → `docs/05-sds.md` | 資料與介面契約能否讓兩人獨立實作？ | 設計階段 |
| [06 Test Plan](06-test-plan.md) → `docs/06-test-plan.md` | 重要風險如何驗、什麼證據支持交付？ | 實作前 |

模板以公開工程實務整理，並非 Google 內部模板的複製。版面依讀者要做的事選擇：背景與理由用短段落；有順序或少量例外用列點；要比較同一組欄位、掃描編號或追查證據時用表格。表格儘量維持 2–4 欄，長敘述放在表格外。模板的 `＜＞` 是提示，不要求逐格填表。

只填與本次風險相關的內容；不適用寫原因，未知寫負責人和決策期限，沒有來源的數據記為待量測。每個 Gate 由人審查；狀態為草稿時不可當成已確認輸入。先讓一條需求接到測試與操作結果。

設計依據：[Google 公開的設計文件與文件維護原則](https://abseil.io/resources/swe-book/html/ch10.html)、[Google code review 的設計／測試檢查](https://google.github.io/eng-practices/review/reviewer/looking-for.html)、[Microsoft 依工作負載取捨品質屬性](https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework)。這些是方法來源；六份文件與 Gate 的編排是本模板自己的設計。

[TRACEABILITY](07-TRACEABILITY.md)定義編號；[LESSONS](08-LESSONS.md)只記實際偏差與解法，沒有新發現時不湊紀錄。

[agent-rules](../agent-templates/AGENTS.safe.md)是各專案 `AGENTS.md` 的參考範本，不覆蓋專案既有的 `AGENTS.md`；專案特有決策再補進「本專案」段。[hooks](../agent-templates/hooks/README.md)是選用示範，專案骨架完成後再考慮。

## 交接與維護文件

| 模板 → 產出 | 用途 |
|---|---|
| [09 HANDOFF](09-HANDOFF.md) → `docs/HANDOFF.md` | 換人、換工具、收工時的交接摘要 |
| [10 CURRENT_STATUS](10-CURRENT_STATUS.md) → `docs/CURRENT_STATUS.md` | 里程碑層級的整體狀態；區分已實作／已測試／已驗收／已提交／已推送／已合併 |
| [11 TROUBLESHOOTING](11-TROUBLESHOOTING.md) | 卡關症狀對照與救援流程 |

提示詞卡在 [agent-templates/prompts/](../agent-templates/prompts/README.md)。

## 各階段的人工審查

| 階段 | 人要確認什麼 |
|---|---|
| Brief | 問題有來源或標為待確認；目標可驗；影響範圍的決策已定 |
| PRD | 有成功與失敗條件；每條 AC 可判斷；沒有新增範圍 |
| SRS | 每個 AC 有對應 FR；規則能獨立算出預期值 |
| 設計（SAD/SDS） | 責任與信任邊界明確；介面可讓兩人獨立實作 |
| 測試計畫 | 每個 TC 有來源與人確認的預期值；高風險有案例；未執行不標通過 |
| 拆票 | 票能在新對話獨立接手；依賴是真的 |
| 實作 | 親眼看過紅燈的原因；測試真的跑過；拒絕輸入不產生副作用 |
| 交付 | 他人能依 README 啟動；有測試與人工證據；沒有秘密與資料庫 |
