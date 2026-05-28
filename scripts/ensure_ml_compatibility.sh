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
from pathlib import Path

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

ddl = """
create schema if not exists ml;

create or replace view ml.vw_scores_v2_latest as
with latest as (
  select
    upper(entity_id)::text as entity_id,
    score,
    risk_level,
    alert_code,
    total,
    created_at,
    link_path,
    drivers_json,
    coalesce(model_version, 'v2')::text as model_version,
    row_number() over (
      partition by upper(entity_id)
      order by created_at desc nulls last
    ) as rn
  from analytics.ml_scores_v2_history
)
select
  entity_id,
  score,
  risk_level,
  alert_code,
  total,
  created_at,
  link_path,
  drivers_json,
  model_version
from latest
where rn = 1;

create or replace view analytics.ml_scores_latest as
with latest as (
  select
    upper(entity_id)::text as equipo_id,
    score,
    risk_level,
    alert_code,
    total,
    created_at,
    link_path,
    drivers_json,
    coalesce(model_version, 'v2')::text as model_version,
    row_number() over (
      partition by upper(entity_id)
      order by created_at desc nulls last
    ) as rn
  from analytics.ml_scores_v2_history
)
select
  equipo_id,
  score,
  risk_level as nivel_riesgo,
  alert_code,
  total as ml_total,
  created_at as model_run_at,
  link_path,
  drivers_json,
  false::boolean as fallback_applied,
  model_version,
  null::timestamp as trained_at
from latest
where rn = 1;

create or replace view analytics.ml_scores_v2_latest as
with latest as (
  select
    upper(entity_id)::text as id_equipo,
    score,
    risk_level,
    alert_code,
    total,
    created_at,
    link_path,
    drivers_json,
    coalesce(model_version, 'v2')::text as model_version,
    row_number() over (
      partition by upper(entity_id)
      order by created_at desc nulls last
    ) as rn
  from analytics.ml_scores_v2_history
)
select
  id_equipo,
  score as ml_score,
  risk_level as ml_risk_level,
  alert_code as ml_alert_code,
  total as ml_total,
  created_at as ml_scored_at,
  created_at as model_run_at,
  link_path,
  drivers_json as drivers,
  false::boolean as fallback_applied,
  model_version,
  null::timestamp as trained_at
from latest
where rn = 1;
"""

check_sql = text(
    """
    select
      (select count(*) from ml.vw_scores_v2_latest) as ml_view_rows,
      (select max(created_at) from ml.vw_scores_v2_latest) as ml_view_latest,
      (select count(*) from analytics.ml_scores_latest) as ml_scores_latest_rows,
      (select count(*) from analytics.ml_scores_v2_latest) as ml_scores_v2_latest_rows
    """
)

with engine.begin() as conn:
    conn.execute(text(ddl))
    status = conn.execute(check_sql).mappings().one()

print(
    "OK ml_compatibility_views"
    f" rows={status['ml_view_rows']}"
    f" latest={status['ml_view_latest']}"
    f" analytics_latest_rows={status['ml_scores_latest_rows']}"
    f" analytics_v2_latest_rows={status['ml_scores_v2_latest_rows']}"
)
PY
