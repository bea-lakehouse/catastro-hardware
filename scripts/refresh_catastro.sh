#!/usr/bin/env bash
set -euo pipefail

# Refresh end-to-end de Catastro:
# 1) sync Google Sheets MTR
# 2) backfill Jira si está configurado
# 3) dbt run con +mart_equipos_estado_actual
#
# Uso:
#   ./scripts/refresh_catastro.sh
#
# Opcional:
#   PYTHON_BIN=/ruta/python DBT_BIN=/ruta/dbt ./scripts/refresh_catastro.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/backend/.venv/bin/python}"
DBT_BIN="${DBT_BIN:-$ROOT_DIR/.venv_dbt/bin/dbt}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "ERROR: no encuentro un intérprete usable en $PYTHON_BIN" >&2
  exit 1
fi

if [[ ! -x "$DBT_BIN" ]]; then
  echo "ERROR: no encuentro dbt en $DBT_BIN" >&2
  exit 1
fi

export CATASTRO_ROOT="$ROOT_DIR"
export CATASTRO_DBT_BIN="$DBT_BIN"

"$PYTHON_BIN" - <<'PY'
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv


def print_step(title: str) -> None:
    print(f"\n== {title} ==")


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Falta la variable requerida: {name}")
    return value


root = Path(os.environ["CATASTRO_ROOT"]).resolve()
dbt_bin = Path(os.environ["CATASTRO_DBT_BIN"]).resolve()
env_file = root / ".env"

# Carga segura de .env:
# - si existe, carga valores faltantes
# - respeta variables ya exportadas en la shell
if env_file.exists():
    load_dotenv(env_file, override=False)

sys.path.insert(0, str(root))

from backend.routers.sync import sync_jira_backfill, sync_mtr_google_sheet

summary: dict[str, str] = {
    "google_rows": "n/a",
    "jira_status": "skipped",
    "dbt_status": "not started",
    "affected_model": "analytics.mart_equipos_estado_actual",
}

exit_code = 0

try:
    # Validaciones mínimas antes de empezar.
    require_env("DATABASE_URL")
    require_env("MTR_GOOGLE_SPREADSHEET_ID")
    if not (os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip() or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()):
        raise RuntimeError(
            "Falta GOOGLE_SERVICE_ACCOUNT_FILE o GOOGLE_SERVICE_ACCOUNT_JSON para leer Google Sheets."
        )

    print_step("Sync Google Sheets MTR")
    google_result = sync_mtr_google_sheet(source_name=None, x_sync_secret=None)
    google_rows = int(google_result.get("rows_loaded", 0))
    summary["google_rows"] = str(google_rows)
    print(f"OK: Google Sheets rows_loaded={google_rows}")

    jira_configured = all(
        os.getenv(name, "").strip()
        for name in ("JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN")
    )

    if jira_configured:
        print_step("Jira Backfill")
        hours_back = int(os.getenv("JIRA_SYNC_HOURS_BACK", str(24 * 365)))
        max_results = int(os.getenv("JIRA_SYNC_MAX_RESULTS", "2000"))
        try:
            jira_result = sync_jira_backfill(
                hours_back=hours_back,
                max_results=max_results,
                x_sync_secret=None,
            )
            summary["jira_status"] = (
                f"ok inserted={jira_result.get('inserted', 0)} fetched={jira_result.get('fetched', 0)}"
            )
            print(
                "OK: Jira backfill "
                f"inserted={jira_result.get('inserted', 0)} fetched={jira_result.get('fetched', 0)}"
            )
        except Exception as jira_exc:
            summary["jira_status"] = f"warning ({jira_exc})"
            print(f"WARN: Jira backfill falló, continúo sin bloquear refresh. Detalle: {jira_exc}")
    else:
        summary["jira_status"] = "skipped (missing JIRA_BASE_URL/JIRA_EMAIL/JIRA_API_TOKEN)"
        print_step("Jira Backfill")
        print("SKIP: Jira no está configurado, continúo sin backfill.")

    print_step("Ensure ML Compatibility Views")
    compat_cmd = ["/bin/bash", str(root / "scripts" / "ensure_ml_compatibility.sh")]
    subprocess.run(compat_cmd, cwd=root, check=True)
    print("OK: vistas de compatibilidad ML aseguradas")

    print_step("dbt Run")
    dbt_cmd = [
        str(dbt_bin),
        "run",
        "--project-dir",
        str(root / "dbt_catastro"),
        "--select",
        "+mart_equipos_estado_actual",
        "+mart_estadistica_movimientos_mes_v2",
    ]
    subprocess.run(dbt_cmd, cwd=root, check=True)
    summary["dbt_status"] = "success"
    print("OK: dbt run completado")

except Exception as exc:
    exit_code = 1
    if summary["dbt_status"] == "not started":
        summary["dbt_status"] = "failed before dbt"
    elif summary["dbt_status"] != "success":
        summary["dbt_status"] = "failed"
    print(f"\nERROR: {exc}", file=sys.stderr)

finally:
    print("\n=== Catastro Refresh Summary ===")
    print(f"Google Sheets rows loaded: {summary['google_rows']}")
    print(f"Jira backfill: {summary['jira_status']}")
    print(f"dbt status: {summary['dbt_status']}")
    print(f"Affected mart/model: {summary['affected_model']}")
    sys.exit(exit_code)
PY
