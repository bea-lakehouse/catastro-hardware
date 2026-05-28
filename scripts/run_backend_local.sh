#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/backend/.venv/bin/python}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "ERROR: no encuentro python del backend en $PYTHON_BIN" >&2
  exit 1
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

echo "== Catastro backend local =="
echo "ROOT: $ROOT_DIR"
echo "PYTHON: $PYTHON_BIN"
echo "URL: http://127.0.0.1:$PORT"

cd "$ROOT_DIR"
exec "$PYTHON_BIN" -m uvicorn backend.main:app --reload --host "$HOST" --port "$PORT"
