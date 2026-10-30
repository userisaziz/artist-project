#!/usr/bin/env bash
# Start the API, the admin web app and the mobile web app together in one terminal. Ctrl+C stops all.
#
#   ./dev.sh            API on http://localhost:8000, admin on http://localhost:5173, mobile web on http://localhost:8081
#   ./dev.sh --lan      also listen on 0.0.0.0 so a phone on your Wi-Fi can reach the API
#   ./dev.sh --device   like --lan, but run Expo in the foreground instead of mobile web, so the Expo Go QR shows here
#   --clear             combine with any mode to reset Metro's cache (use when bundling hangs or shows stale code)
#
# Assumes the one-time setup from README.md is done (backend/.venv, backend/.env, the databases).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST=127.0.0.1
DEVICE=0
CLEAR_FLAG=
for arg in "$@"; do
  case "$arg" in
    --lan) HOST=0.0.0.0 ;;
    --device) HOST=0.0.0.0; DEVICE=1 ;;
    --clear) CLEAR_FLAG=--clear ;;
    *) echo "unknown option: $arg (use --lan, --device, --clear)" >&2; exit 2 ;;
  esac
done

# A leftover server from an earlier run would make Metro move to 8082 and Expo Go load from the stale one.
require_free_port() { # require_free_port <port> <service>
  local pid
  pid=$(lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true)
  pid=${pid%%$'\n'*}
  [[ -z $pid ]] && return
  echo "port $1 ($2) is already in use by PID $pid: $(ps -o command= -p "$pid" | cut -c1-80)" >&2
  echo "stop it first: kill $pid" >&2
  exit 1
}
require_free_port 8000 api
require_free_port 5173 admin
require_free_port 8081 mobile
command -v watchman >/dev/null || echo "note: watchman not installed, Metro falls back to a slower file crawler (brew install watchman)" >&2

[[ -x "$ROOT/backend/.venv/bin/python" ]] || { echo "backend/.venv missing — see Quick start in README.md" >&2; exit 1; }
[[ -f "$ROOT/backend/.env" ]] || { echo "backend/.env missing — cp backend/.env.example backend/.env" >&2; exit 1; }
[[ -d "$ROOT/admin/node_modules" ]] || (cd "$ROOT/admin" && npm install)
[[ -d "$ROOT/mobile/node_modules" ]] || (cd "$ROOT/mobile" && npm install)

# Prefix each line with a colored service tag, highlight errors, and keep the full log in logs/<service>.log.
# Metro's "NN% building" progress lines are filtered from the terminal (they never carry errors).
mkdir -p "$ROOT/logs"
c_off=$'\e[0m'; c_err=$'\e[1;31m'; c_api=$'\e[36m'; c_admin=$'\e[32m'; c_mobile=$'\e[33m'
[[ -t 1 ]] || { c_off= c_err= c_api= c_admin= c_mobile=; }  # no ANSI codes when piped/not a terminal

prefix() { # prefix <service> <color> <tag>
  local name=$1 color=$2 tag=$3 line
  shopt -s nocasematch  # match Error/ERROR/error etc. case-insensitively
  : > "$ROOT/logs/$name.log"
  while IFS= read -r line; do
    printf '%s\n' "$line" >> "$ROOT/logs/$name.log"
    if [[ "$line" =~ error|exception|traceback|failed ]]; then
      printf '%s%s %s %s\n' "$c_err" "$tag" "$line" "$c_off"
    else
      printf '%s%s%s %s\n' "$color" "$tag" "$c_off" "$line"
    fi
  done
}

cleanup() {
  trap - INT TERM EXIT
  kill 0 2>/dev/null || true  # the whole process group: uvicorn, vite and their children
}
trap cleanup INT TERM EXIT

echo "→ applying migrations"
(cd "$ROOT/backend" && .venv/bin/alembic upgrade head)

(cd "$ROOT/backend" && exec .venv/bin/uvicorn app.main:app --reload --host "$HOST" --port 8000 2>&1) | prefix api "$c_api" "[api]    " &
(cd "$ROOT/admin" && exec npm run dev -- --host "$HOST" 2>&1) | prefix admin "$c_admin" "[admin]  " &
[[ $DEVICE == 1 ]] || (cd "$ROOT/mobile" && exec npm run web -- ${CLEAR_FLAG:+"$CLEAR_FLAG"} 2>&1 | tr '\r' '\n' | grep -vE --line-buffered '^[[:space:]]*[0-9]+([.][0-9]+)?%') | prefix mobile "$c_mobile" "[mobile] " &

echo "→ API        http://localhost:8000/docs"
echo "→ Admin      http://localhost:5173"
if [[ $DEVICE == 1 ]]; then
  echo "→ Mobile     Expo Go QR below"
else
  echo "→ Mobile web http://localhost:8081"
fi
echo "→ Full logs: logs/{api,admin,mobile}.log"
# Expo only draws the QR and key shortcuts when attached to a real terminal, so it runs unpiped in the foreground.
if [[ $DEVICE == 1 ]]; then
  (cd "$ROOT/mobile" && npx expo start ${CLEAR_FLAG:+"$CLEAR_FLAG"})
else
  wait
fi
