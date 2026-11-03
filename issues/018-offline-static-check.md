# 018：離線靜態檢查

**大小：** S　**狀態：** ready-for-agent

**成果（What to build）：** 用測試保證 App 執行時不對外連線：安全政策只允許本機 IPC，原始碼沒有對外的網路呼叫；並把 M-06 的人工監看方法定案。

**Blocked by：** 無（可立即開始）

**對應 TC／人工：** NFR-03；M-06

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`

**要讀的規格段落：** `docs/03-srs.md` NFR-03；`docs/04-sad.md` 信任邊界；測試計畫 M-06

## 驗收條件

- [ ] 測試讀取打包設定的安全政策，斷言只允許本機與 IPC 的連線來源，沒有外部網域。
- [ ] 測試掃描原始碼，沒有對外網路呼叫（`fetch`、`XMLHttpRequest`、`WebSocket` 等指向外部位址）；掃描方式寫在測試裡並說明其限制。
- [ ] 在 `docs/06-test-plan.md` 把 M-06 的監看工具與步驟寫成可重做的流程（仍標「未執行」）。

## 備註

靜態檢查不能取代實際的網路監看，所以 M-06 仍保留為人工。

共同規則（先讀）：[`issues/README.md`](README.md)。
