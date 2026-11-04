#!/usr/bin/env bash
# 模板的檢查入口：只驗 hook 與 MCP 在 Claude Code / Codex 兩邊同步，並跑 guard 回歸測試。
# 全綠 exit 0；任何一項紅了 exit 1。
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1
fail=0
run() { local n=$1; shift; local o; if o=$("$@" 2>&1); then printf '✓ %s\n' "$n"; else printf '✗ %s\n' "$n"; printf '%s\n' "$o" | sed 's/^/    /'; fail=1; fi; }
for s in .maintain/check-*.sh; do [ -f "$s" ] && run "$(basename "$s")" bash "$s"; done
for t in .githooks/test-*.sh; do [ -f "$t" ] && run "$t" bash "$t"; done
for t in agent-templates/hooks/test-*.sh; do [ -f "$t" ] && run "$t" bash "$t"; done
if command -v jq >/dev/null 2>&1; then
  for t in .claude/hooks/test-*.sh; do [ -f "$t" ] && run "$t" bash "$t"; done
else
  printf '! 略過 guard 測試：找不到 jq（沒有 jq 時 guard hook 不會攔截任何指令）\n'
fi
exit $fail
