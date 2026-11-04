#!/usr/bin/env bash
# pre-commit 的回歸規格（AGENTS.md 第 16 條：寫檔時反斜線被吃成控制字元）。
# 每條在暫存假 repo 裡 stage 內容再跑 hook，判準是「這顆 commit 引入了什麼」。
# 行為變更必須先改這張表。執行：bash .githooks/test-pre-commit.sh
set -u
cd "$(dirname "$0")"
HOOK="$PWD/pre-commit"
fail=0

# run_case <名稱> <ALLOW|BLOCK> <腳本>   腳本在假 repo 內執行，負責建立並 stage 檔案
run_case() {
  local name="$1" want="$2" setup="$3" tmp out code
  tmp=$(mktemp -d)
  out=$(
    cd "$tmp" || exit 9
    git init -q
    git config core.autocrlf false
    printf 'seed\n' > seed.txt
    git add seed.txt
    git -c user.email=t@t -c user.name=t commit -qm fixture
    eval "$setup"
    bash "$HOOK" 2>&1
  )
  code=$?
  rm -rf "$tmp"
  local got=ALLOW; [ "$code" -ne 0 ] && got=BLOCK
  if [ "$got" = "$want" ]; then
    printf 'ok    %s\n' "$name"
  else
    printf 'FAIL  %s（想要 %s，得到 %s，exit %s）\n' "$name" "$want" "$got" "$code"; fail=1
  fi
  LAST_OUT="$out"
}

stage() { git add -- "$1"; }

run_case "乾淨的中文與英文 markdown"       ALLOW 'printf "# 標題\n路徑 D:/x/y\n" > a.md; stage a.md'
run_case "BEL（反斜線 a 被吃掉）在 md"      BLOCK 'printf "%%APPDATA%%\ax\n" > a.md; stage a.md'
run_case "ESC 在 ts"                        BLOCK 'printf "const x = 1;\033[0m\n" > a.ts; stage a.ts'
run_case "DEL 在 json"                      BLOCK 'printf "{\"a\":1}\177\n" > a.json; stage a.json'
run_case "NUL 在 md（git 會當成二進位）"     BLOCK 'printf "text\0more\n" > a.md; stage a.md'
run_case "NUL 在 rs"                        BLOCK 'printf "fn main(){}\0\n" > a.rs; stage a.rs'
run_case "Tab 在 md（反斜線 t 被吃掉）"      BLOCK 'printf "D:\DevCache\tmp\n" > a.md; stage a.md'
run_case "Tab 在 sh 是正常的"                ALLOW 'printf "if true; then\n\techo hi\nfi\n" > a.sh; stage a.sh'
run_case "CRLF 換行不算"                     ALLOW 'printf "line\r\nline2\r\n" > a.txt; stage a.txt'
run_case "真正的二進位檔（png）放行"          ALLOW 'printf "\211PNG\r\n\032\n\0\0\0\rIHDR" > a.png; stage a.png'
run_case "沒 stage 的壞檔不擋"                ALLOW 'printf "x\ay\n" > bad.md'
run_case "舊 commit 的壞檔不擋無關的 commit"   ALLOW 'printf "x\ay\n" > old.md; git add old.md; git -c user.email=t@t -c user.name=t commit -qm old --no-verify; printf "ok\n" > b.md; stage b.md'
run_case "刪除檔案不擋"                       ALLOW 'git rm -q seed.txt'
run_case "只動到壞檔舊行以外的新檔（乾淨）"     ALLOW 'printf "hi\n" > new.ts; stage new.ts'

# 訊息要指到檔名並提示規則 16
run_case "BEL 檔：訊息含檔名" BLOCK 'printf "a\ab\n" > docs-note.md; stage docs-note.md'
case "$LAST_OUT" in *docs-note.md*) printf 'ok    訊息含檔名\n';; *) printf 'FAIL  訊息沒有檔名：%s\n' "$LAST_OUT"; fail=1;; esac
case "$LAST_OUT" in *16*) printf 'ok    訊息提到規則 16\n';; *) printf 'FAIL  訊息沒有提到規則 16\n'; fail=1;; esac

exit $fail
