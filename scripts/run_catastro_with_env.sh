#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-}"

if [[ -z "$ENV_FILE" ]]; then
  echo "Uso: $0 /ruta/a/.env.cloudsql" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe el archivo de entorno: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

echo "== Catastro con entorno alternativo =="
echo "ENV_FILE=$ENV_FILE"
echo "DATABASE_URL=${DATABASE_URL:-<missing>}"
echo

exec "$ROOT_DIR/scripts/refresh_catastro.sh"
