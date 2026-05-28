#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/bea/Desktop/Catastro"
LOG_DIR="$ROOT/logs"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

mkdir -p "$LOG_DIR"

exec >>"$LOG_DIR/catastro_daily_refresh.log" 2>>"$LOG_DIR/catastro_daily_refresh.error.log"

echo ""
echo "=== [$STAMP] Catastro refresh start ==="
cd "$ROOT"

if /bin/bash "$ROOT/scripts/refresh_catastro.sh"; then
  echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Catastro refresh end status=success ==="
else
  status=$?
  echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Catastro refresh end status=failed code=$status ===" >&2
  exit "$status"
fi
