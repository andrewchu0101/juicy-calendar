# 011：翻譯日曆與工具列

**大小：** M　**狀態：** ready-for-agent（前置票完成後才能開始）

**成果（What to build）：** 日曆格線、工具列、時間軸選單等介面文字完整翻譯為繁體中文與英文；星期與月份使用對應語系。

**Blocked by：** 010

**對應 TC／人工：** TC-11（字典）；FR-09

**驗收指令：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`

**要讀的規格段落：** `docs/05-sds.md` `i18n` 契約；`docs/03-srs.md` R-7

## 驗收條件

- [ ] 日曆與工具列的每個固定文字、`aria-label`、`title` 都改由字典提供；英文版與現在相同，現有 e2e 仍通過。
- [ ] 繁體中文版的星期與月份由 `date-fns` 的 `zh-TW` 語系產生，不新增套件。
- [ ] 切換語言立即反映，不需重新整理。

## 備註

與 012、013、019 會修改同一批介面檔案，請依序做，不要同時做。

共同規則（先讀）：[`issues/README.md`](README.md)。
