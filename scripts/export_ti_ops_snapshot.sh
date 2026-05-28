#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_DB_URL="postgresql://usuario:password@127.0.0.1:5432/ti_ops"
DATABASE_URL_VALUE="${DATABASE_URL:-${TI_OPS_DATABASE_URL:-$DEFAULT_DB_URL}}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups/ti_ops}"
TIMESTAMP="${TIMESTAMP:-$(date +%Y%m%d-%H%M%S)}"
SNAPSHOT_DIR="$BACKUP_ROOT/$TIMESTAMP"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PSQL_BIN="${PSQL_BIN:-psql}"

mkdir -p "$SNAPSHOT_DIR"

if ! command -v "$PG_DUMP_BIN" >/dev/null 2>&1; then
  echo "ERROR: no encuentro pg_dump en PATH ni en PG_DUMP_BIN=$PG_DUMP_BIN" >&2
  exit 1
fi

if ! command -v "$PSQL_BIN" >/dev/null 2>&1; then
  echo "ERROR: no encuentro psql en PATH ni en PSQL_BIN=$PSQL_BIN" >&2
  exit 1
fi

sanitize_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit

raw = sys.argv[1]
parts = urlsplit(raw)
host = parts.hostname or ""
port = f":{parts.port}" if parts.port else ""
user = parts.username or ""
userinfo = f"{user}:***@" if user else ""
netloc = f"{userinfo}{host}{port}"
print(urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment)))
PY
}

echo "== Catastro / freeze local ti_ops =="
echo "Base origen: $(sanitize_url "$DATABASE_URL_VALUE")"
echo "Destino backup: $SNAPSHOT_DIR"

PLAIN_SQL_FILE="$SNAPSHOT_DIR/ti_ops_cloudsql.sql"
CUSTOM_DUMP_FILE="$SNAPSHOT_DIR/ti_ops_local_restore.dump"
SCHEMA_ONLY_FILE="$SNAPSHOT_DIR/ti_ops_schema_only.sql"
MANIFEST_FILE="$SNAPSHOT_DIR/manifest.txt"

"$PG_DUMP_BIN" \
  --dbname="$DATABASE_URL_VALUE" \
  --no-owner \
  --no-acl \
  --quote-all-identifiers \
  --format=plain \
  --file="$PLAIN_SQL_FILE"

gzip -f "$PLAIN_SQL_FILE"

"$PG_DUMP_BIN" \
  --dbname="$DATABASE_URL_VALUE" \
  --format=custom \
  --file="$CUSTOM_DUMP_FILE"

"$PG_DUMP_BIN" \
  --dbname="$DATABASE_URL_VALUE" \
  --schema-only \
  --no-owner \
  --no-acl \
  --quote-all-identifiers \
  --file="$SCHEMA_ONLY_FILE"

{
  echo "snapshot_timestamp=$TIMESTAMP"
  echo "source_database=$(sanitize_url "$DATABASE_URL_VALUE")"
  echo "plain_sql_gz=$(basename "$PLAIN_SQL_FILE").gz"
  echo "custom_dump=$(basename "$CUSTOM_DUMP_FILE")"
  echo "schema_only=$(basename "$SCHEMA_ONLY_FILE")"
  echo "note=Esta snapshot congela la base local actual para migracion de prueba a Cloud SQL sin tocar la operacion viva."
} > "$MANIFEST_FILE"

echo
echo "OK: snapshot creada."
echo "- Cloud SQL import: $PLAIN_SQL_FILE.gz"
echo "- Restore local rapido: $CUSTOM_DUMP_FILE"
echo "- Solo esquema: $SCHEMA_ONLY_FILE"
echo "- Manifiesto: $MANIFEST_FILE"
