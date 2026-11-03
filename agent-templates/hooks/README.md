# 範本 hook：把紅線從「建議」變成「做不到」

寫在 `AGENTS.md` 的規則，AI 大部分時候會遵守，但不是每一次。
真正不能破的紅線，要用 hook 擋：**它只能攔截已登記且匹配的事件；不是完整安全隔離。**

| Hook | 擋什麼 | 適用 |
|---|---|---|
| [`pytest-on-stop.sh`](./pytest-on-stop.sh) | 匹配的 Stop 事件中，改過 `.py` 而測試沒過則阻擋一次 | Claude Code |

回歸規格：[`test-pytest-on-stop.sh`](./test-pytest-on-stop.sh)，由維護者的 `.maintain/check.sh` 自動執行。

---

## 裝到你的專案（Claude Code）

先完成骨架並確認虛擬環境測試指令能跑。此範本預設未啟用。

1. 複製 hook（在 repo 根目錄執行）：

   ```bash
   mkdir -p .claude/hooks
   cp agent-templates/hooks/pytest-on-stop.sh .claude/hooks/
   ```

2. 在專案的 `.claude/settings.json` 加上：

   ```json
   {
     "hooks": {
       "Stop": [
         {
           "hooks": [
             { "type": "command", "command": "bash .claude/hooks/pytest-on-stop.sh" }
           ]
         }
       ]
     }
   }
   ```

   這個 repo 的 `settings.json` **已經有** `hooks` 區塊（`PreToolUse` 的 guard），把 `Stop` 那一段併進去，不要整個覆蓋 —— 蓋掉的話 guard 就消失了。

3. 確認它有作用：故意改壞一行程式碼，請 agent「結束這個任務」。它應該會被擋下，並開始修。

預設使用專案虛擬環境的 `python -m pytest -q`，可辨識 Windows 路徑。要覆寫測試指令時，在 settings 的 command 前面加環境變數，例如
`PYTEST_CMD="python -m pytest -q" bash .claude/hooks/pytest-on-stop.sh`。

---

## Codex

Codex 也有 lifecycle hooks（在 Codex 裡打 `/hooks` 查看與管理），但設定格式和 Claude Code 不同。
⚠️ 這支 hook 尚未在 Codex 上驗證。Codex 使用者目前請靠 `AGENTS.tdd.md` 的文字規則，
並在每次 agent 說完成時，**自己跑一次測試**。

---

## 它擋不住什麼

這支 hook 只能保證「結束時測試是綠的」，**擋不住順序**：AI 先寫實作、後補測試，它也會放行。
「先看到紅燈」這件事，目前靠人在對話中盯 —— 所以在每個實作迭代中，要由你親眼確認紅燈的失敗原因。
