#!/usr/bin/env bash
# Select a working interpreter, not a Windows Store alias or a stale launcher.
if [ -n "${COURSE_PYTHON:-}" ] && "$COURSE_PYTHON" -c 'import sys; assert sys.version_info >= (3,11)' >/dev/null 2>&1; then
  export COURSE_PYTHON
else
  COURSE_PYTHON=""
  for candidate in python3 python python3.12 python3.11; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; assert sys.version_info >= (3,11)' >/dev/null 2>&1; then
      COURSE_PYTHON=$(command -v "$candidate")
      export COURSE_PYTHON
      break
    fi
  done
  if [ -z "$COURSE_PYTHON" ]; then
    echo "No working Python >=3.11 for maintenance checks; set COURSE_PYTHON to its executable path." >&2
    return 1
  fi
fi
