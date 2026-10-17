#!/bin/sh
# usage: shot.sh <path-under-design> <out-dir> [extra shoot flags]
p="$1"; o="$2"; shift 2
PLAYWRIGHT_DIR=/c/Users/Dflame/Music/pay-/design/tools node /c/Users/Dflame/.claude/skills/studio/scripts/shoot.mjs "http://127.0.0.1:8787/$p" --out "/c/Users/Dflame/Music/pay-/design/$o" "$@"
