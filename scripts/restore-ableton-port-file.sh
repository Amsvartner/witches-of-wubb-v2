#!/usr/bin/env bash
#
# Restore $TMPDIR/ableton-js-server.port without restarting Ableton Live.
#
# The AbletonJS remote script writes this file once, at Live startup. macOS
# periodically purges old files from the per-user temp dir, so a Live instance
# left running for days loses the file while the script keeps listening — and
# the backend then hangs at "Client is bound and listening" until
# ABLETON_START_TIMEOUT_MS expires. This script finds the remote script's UDP
# socket in the running Live process and rewrites the file.
#
# Usage:
#   yarn fix-ableton-port          # auto-detect the port
#   yarn fix-ableton-port 64817    # write an explicit port
#
# macOS only. Only writes a file in the temp dir; never touches Live.

set -euo pipefail

PORT_FILE_DIR="${TMPDIR:-$(getconf DARWIN_USER_TEMP_DIR)}"
PORT_FILE="${PORT_FILE_DIR%/}/ableton-js-server.port"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

port="${1:-}"

if [[ -z "$port" ]]; then
  live_pids=$(pgrep -f "Ableton Live.*/MacOS/Live" || true)
  [[ -n "$live_pids" ]] || fail "Ableton Live doesn't appear to be running. Start Live, which also rewrites the port file itself."

  # The AbletonJS remote script is the only thing in Live that binds a UDP
  # socket to 127.0.0.1 specifically (Link and others bind to *).
  ports=$(lsof -nP -a -iUDP $(printf -- '-p %s ' $live_pids) 2>/dev/null \
    | awk '$9 ~ /^127\.0\.0\.1:[0-9]+$/ { sub(/^127\.0\.0\.1:/, "", $9); print $9 }' \
    | sort -u)

  if [[ -z "$ports" ]]; then
    fail "Live is running but has no UDP socket on 127.0.0.1 — the AbletonJS control surface probably isn't loaded. Check Live: Preferences → Link/Tempo/MIDI → Control Surface."
  elif [[ $(wc -l <<<"$ports") -gt 1 ]]; then
    fail "Found several candidate UDP ports on 127.0.0.1: $(tr '\n' ' ' <<<"$ports")— rerun with the right one, e.g.: yarn fix-ableton-port <port>"
  fi
  port="$ports"
fi

[[ "$port" =~ ^[0-9]+$ ]] || fail "Not a valid port: $port"
port=$((10#$port)) # force base 10: leading zeros would otherwise be read as octal
((port > 0 && port < 65536)) || fail "Not a valid port: $port"

if [[ -f "$PORT_FILE" && "$(cat "$PORT_FILE")" == "$port" ]]; then
  echo "$PORT_FILE already contains $port — nothing to do."
  exit 0
fi

printf '%s' "$port" > "$PORT_FILE"
echo "Wrote port $port to $PORT_FILE. If the backend isn't running, start it again (yarn start-backend)."
