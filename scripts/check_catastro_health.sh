#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/backend/.venv/bin/python}"

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

export CATASTRO_ROOT="$ROOT_DIR"

"$PYTHON_BIN" - <<'PY'
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

root = Path(os.environ["CATASTRO_ROOT"]).resolve()
env_file = root / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)

database_url = os.getenv("DATABASE_URL", "").strip()
if not database_url:
    raise SystemExit("FAIL: falta DATABASE_URL")

engine = create_engine(database_url)
failures: list[str] = []
utc_now = datetime.now(timezone.utc)
mtr_max_age_hours = int(os.getenv("CHECK_MTR_MAX_AGE_HOURS", "168"))
jira_max_age_hours = int(os.getenv("CHECK_JIRA_MAX_AGE_HOURS", "72"))

base_url = os.getenv("JIRA_BASE_URL", "").strip()
email = os.getenv("JIRA_EMAIL", "").strip()
token = os.getenv("JIRA_API_TOKEN", "").strip()

if base_url and email and token:
    try:
        response = requests.get(
            f"{base_url.rstrip('/')}/rest/api/3/myself",
            auth=(email, token),
            headers={"Accept": "application/json"},
            timeout=30,
        )
        if response.status_code != 200:
            failures.append(f"jira_auth={response.status_code}")
        else:
            print("OK jira_auth=200")
    except Exception as exc:  # noqa: BLE001
        failures.append(f"jira_auth_error={exc}")
else:
    failures.append("jira_auth=missing_env")

with engine.connect() as conn:
    stg_count = conn.execute(text("select count(*) from analytics.stg_jira_issues")).scalar() or 0
    print(f"OK stg_jira_issues_count={stg_count}")
    if int(stg_count) == 0:
        failures.append("stg_jira_issues_empty")

    latest_runs = conn.execute(
        text(
            """
            with latest as (
              select distinct on (source_type, source_name)
                source_type,
                source_name,
                status,
                started_at,
                finished_at,
                rows_loaded
              from raw.sync_runs
              where (source_type, source_name) in (
                ('google_sheets', 'mtr'),
                ('jira', 'issue_snapshot_backfill')
              )
              order by source_type, source_name, started_at desc
            )
            select * from latest
            """
        )
    ).mappings().all()
    for row in latest_runs:
        key = f"{row['source_type']}:{row['source_name']}"
        print(
            f"OK latest_run[{key}]={row['status']} rows={row['rows_loaded']} started_at={row['started_at']}"
        )
        if str(row["status"]).upper() != "SUCCESS":
            failures.append(f"latest_run_not_success={key}")

    freshness_rows = conn.execute(
        text(
            """
            select 'mtr_google_sheet_rows' as source_name, count(*) as row_count, max(inserted_at) as latest_ts
            from raw.mtr_google_sheet_rows
            union all
            select 'jira_issues' as source_name, count(*) as row_count, max(inserted_at) as latest_ts
            from raw.jira_issues
            """
        )
    ).mappings().all()
    for row in freshness_rows:
        source_name = str(row["source_name"])
        latest_ts = row["latest_ts"]
        row_count = int(row["row_count"] or 0)
        print(f"OK raw[{source_name}] rows={row_count} latest={latest_ts}")
        if row_count == 0 or latest_ts is None:
            failures.append(f"raw_empty={source_name}")
            continue
        age_hours = (utc_now - latest_ts.astimezone(timezone.utc)).total_seconds() / 3600
        max_age = mtr_max_age_hours if source_name == "mtr_google_sheet_rows" else jira_max_age_hours
        if age_hours > max_age:
            failures.append(f"raw_stale={source_name}:{age_hours:.1f}h")

    mart_status = conn.execute(
        text(
            """
            select count(*) as row_count, max(_loaded_at) as latest_loaded_at
            from analytics.mart_equipos_estado_actual
            """
        )
    ).mappings().one()
    print(
        f"OK mart_equipos_estado_actual rows={mart_status['row_count']} latest_loaded_at={mart_status['latest_loaded_at']}"
    )
    if int(mart_status["row_count"] or 0) == 0:
        failures.append("mart_empty")

    ml_status = conn.execute(
        text(
            """
            select
              to_regclass('ml.vw_scores_v2_latest') is not null as ml_v2_source_present,
              to_regclass('analytics.int_ml_scores_v2_latest') is not null as ml_v2_latest_present,
              to_regclass('analytics.mart_equipos_estado_actual') is not null as mart_present
            """
        )
    ).mappings().one()
    print(
        "OK "
        f"ml_v2_source_present={ml_status['ml_v2_source_present']} "
        f"ml_v2_latest_present={ml_status['ml_v2_latest_present']} "
        f"mart_present={ml_status['mart_present']}"
    )

    ml_v2_latest = {"row_count": 0, "latest_scored_at": None}
    if bool(ml_status["ml_v2_latest_present"]):
        ml_latest = conn.execute(
            text(
                """
                select count(*) as row_count, max(created_at) as latest_scored_at
                from analytics.int_ml_scores_v2_latest
                """
            )
        ).mappings().one()
        ml_v2_latest = dict(ml_latest)
        print(
            f"OK int_ml_scores_v2_latest rows={ml_latest['row_count']} latest_scored_at={ml_latest['latest_scored_at']}"
        )

    ml_v3_status = {"row_count": 0, "latest_scored_at": None}
    if bool(ml_status["mart_present"]):
        ml_v3 = conn.execute(
            text(
                """
                select
                  count(*) filter (where coalesce(ml_source_available_v3, false)) as row_count,
                  max(ml_scored_at_v3) filter (where coalesce(ml_source_available_v3, false)) as latest_scored_at
                from analytics.mart_equipos_estado_actual
                """
            )
        ).mappings().one()
        ml_v3_status = dict(ml_v3)
        print(
            f"OK mart_ml_v3 rows={ml_v3['row_count']} latest_scored_at={ml_v3['latest_scored_at']}"
        )

    ml_v2_rows = int(ml_v2_latest.get("row_count") or 0)
    ml_v3_rows = int(ml_v3_status.get("row_count") or 0)
    if not bool(ml_status["ml_v2_source_present"]) and ml_v3_rows == 0:
        failures.append("ml_source_missing")
    if ml_v2_rows == 0 and ml_v3_rows == 0:
        failures.append("ml_scores_unavailable")

    required_columns = {
        "id_equipo",
        "estado_operativo",
        "jira_open_count",
        "jira_status_name",
        "jira_board_bucket",
        "flag_sin_asignacion",
        "priority_final_rank",
        "ml_source_available",
    }
    rows = conn.execute(
        text(
            """
            select column_name
            from information_schema.columns
            where table_schema = 'analytics'
              and table_name = 'mart_equipos_estado_actual'
            """
        )
    ).fetchall()
    actual_columns = {str(row[0]) for row in rows}
    missing = sorted(required_columns - actual_columns)
    if missing:
        failures.append(f"mart_missing_columns={','.join(missing)}")
    else:
        print("OK mart_columns=expected_set")

if failures:
    print("FAIL " + " | ".join(failures))
    raise SystemExit(1)

print("OK all_checks=pass")
PY
