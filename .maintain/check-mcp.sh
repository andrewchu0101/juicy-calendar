#!/usr/bin/env bash
# 同兩個 MCP，Claude Code 寫在 .mcp.json，Codex 寫在 .codex/config.toml。
# 兩邊不同步不會噴錯，只會讓其中一個工具少了能力或用到另一個版本 —— 所以由這支擋。
#
# 無輸出 = 同步。有輸出時 exit 1。

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

# tomllib 要 Python 3.11 以上（需要 3.11+）
source .maintain/python.sh || exit 1
"$COURSE_PYTHON" - <<'PY'
import json, sys, tomllib
claude = json.load(open(".mcp.json"))["mcpServers"]
codex = tomllib.load(open(".codex/config.toml", "rb")).get("mcp_servers", {})
problems = []
for name in sorted(set(claude) | set(codex)):
    if name not in claude:
        problems.append(f"只有 Codex 有：{name}")
    elif name not in codex:
        problems.append(f"只有 Claude Code 有：{name}")
    elif [claude[name].get("command")] + claude[name].get("args", []) != [codex[name].get("command")] + codex[name].get("args", []):
        problems.append(f"指令不一樣：{name}")
problems and print("\n".join(problems))
sys.exit(1 if problems else 0)
PY
