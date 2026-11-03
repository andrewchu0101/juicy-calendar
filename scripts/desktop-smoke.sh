#!/usr/bin/env bash
# Launch verification against the real desktop app: creates a workspace on disk, drops a ball,
# closes through the normal close path, then relaunches and checks that the data survives.
set -euo pipefail
cd "$(dirname "$0")/.."

npx tauri build --debug --no-bundle >/dev/null
binary=src-tauri/target/debug/juicy-calendar
workspace="$(mktemp -d)/SmokeWorkspace"
mkdir -p "$workspace"
trap 'rm -rf "$(dirname "$workspace")"' EXIT

run() {
  JUICY_SMOKE_WORKSPACE="$workspace" JUICY_SMOKE_SCRIPT="$PWD/scripts/$1" "$binary" &
  local pid=$!
  # The app must exit by itself: this proves the close handler flushes and is allowed to destroy.
  for _ in $(seq 1 30); do
    kill -0 "$pid" 2>/dev/null || { wait "$pid"; return $?; }
    sleep 1
  done
  kill "$pid"
  echo "FAIL: the window did not close within 30s"
  return 1
}

fail() { echo "FAIL: $1"; exit 1; }

run desktop-smoke.js
echo "Report:"; cat "$workspace/settings.corrupt.json"; echo
report="$workspace/settings.corrupt.json"
for expected in '"ballCount": 6' '"ballImage": "none"' '"stylesLoaded": true' '"ghostShown": true' \
  '"blocksAfterDrop": 1' '"droppedTime": "10:30–12:30"' '"readTraversal": "rejected"' \
  '"writeAbsolute": "rejected"' '"writeNested": "rejected"' '"listOutside": "rejected"'; do
  grep -qF "$expected" "$report" || fail "report is missing $expected"
done
[ -f "$workspace/workspace.json" ] || fail "workspace.json was not created"
[ "$(ls "$workspace/templates" | wc -l | tr -d ' ')" = 6 ] || fail "templates were not seeded"
[ "$(ls "$workspace/events" | wc -l | tr -d ' ')" = 1 ] || fail "the event was not written to disk"
[ -z "$(find "$workspace" -name '*.tmp')" ] || fail "temp files were left behind"
[ ! -e /tmp/juicy-escape.json ] || fail "a write escaped the workspace"
event_before="$(cat "$workspace"/events/*.json)"

run desktop-smoke-reopen.js
echo "Reopen report:"; cat "$report"; echo
grep -qF '"blocksOnLaunch": 1' "$report" || fail "the event did not survive a restart"
[ "$(cat "$workspace"/events/*.json)" = "$event_before" ] || fail "reopening modified the event file"

echo "Desktop smoke test passed"
