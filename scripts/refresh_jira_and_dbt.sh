#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/backend/.venv/bin/python}"
DBT_BIN="${DBT_BIN:-$ROOT_DIR/.venv_dbt/bin/dbt}"
HOURS_BACK="${HOURS_BACK:-8760}"
MAX_RESULTS="${MAX_RESULTS:-2000}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "ERROR: no encuentro python del backend en $PYTHON_BIN" >&2
  exit 1
fi

if [[ ! -x "$DBT_BIN" ]]; then
  echo "ERROR: no encuentro dbt en $DBT_BIN" >&2
  exit 1
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

export CATASTRO_ROOT="$ROOT_DIR"
export CATASTRO_HOURS_BACK="$HOURS_BACK"
export CATASTRO_MAX_RESULTS="$MAX_RESULTS"
export CATASTRO_DBT_BIN="$DBT_BIN"

"$PYTHON_BIN" - <<'PY'
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

root = Path(os.environ["CATASTRO_ROOT"]).resolve()
env_file = root / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)

sys.path.insert(0, str(root))

from backend.routers.sync import sync_jira_backfill

hours_back = int(os.environ["CATASTRO_HOURS_BACK"])
max_results = int(os.environ["CATASTRO_MAX_RESULTS"])
dbt_bin = Path(os.environ["CATASTRO_DBT_BIN"]).resolve()

print("== Jira backfill ==")
jira_result = sync_jira_backfill(
    hours_back=hours_back,
    max_results=max_results,
    x_sync_secret=None,
)
print(
    f"OK: run_id={jira_result.get('run_id')} "
    f"fetched={jira_result.get('fetched', 0)} inserted={jira_result.get('inserted', 0)}"
)

print("\n== dbt run +mart_equipos_estado_actual +mart_timeline_eventos +mart_mtr_jira_reconciliacion ==")
subprocess.run(
    [
        str(dbt_bin),
        "run",
        "--project-dir",
        str(root / "dbt_catastro"),
        "--select",
        "+mart_equipos_estado_actual",
        "+mart_timeline_eventos",
        "+mart_mtr_jira_reconciliacion",
    ],
    cwd=root,
    check=True,
)
print("OK: dbt actualizado")
PY
