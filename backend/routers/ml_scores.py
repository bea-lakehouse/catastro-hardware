from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import create_engine, text
import logging
import os

router = APIRouter(prefix="/ml", tags=["ml"])
logger = logging.getLogger("uvicorn.error")

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL no está seteada en el ambiente")

eng = create_engine(DB_URL, pool_pre_ping=True)

SQL = """
with latest_hist as (
  select
    entity_id as equipo_id,
    score,
    risk_level as nivel_riesgo,
    alert_code,
    created_at as model_run_at,
    total as ml_total,
    link_path,
    drivers_json,
    model_version,
    row_number() over (
      partition by entity_id
      order by created_at desc
    ) as rn
  from analytics.ml_scores_v2_history
),
mart as (
  select
    id_equipo as equipo_id,
    ml_score_v2,
    ml_risk_level_v2,
    ml_alert_code_v2,
    ml_score_v3,
    ml_risk_level_v3,
    ml_alert_code_v3,
    ml_main_driver_v3,
    ml_risk_reason_v3,
    ml_version,
    ml_score_delta_v3_vs_v2,
    ml_source_available_v3
  from analytics.mart_equipos_estado_actual
)
select
  coalesce(m.equipo_id, h.equipo_id) as equipo_id,
  h.score,
  h.nivel_riesgo,
  h.alert_code,
  h.model_run_at,
  h.ml_total,
  h.link_path,
  h.drivers_json,
  h.model_version,
  m.ml_score_v2,
  m.ml_risk_level_v2,
  m.ml_alert_code_v2,
  m.ml_score_v3,
  m.ml_risk_level_v3,
  m.ml_alert_code_v3,
  m.ml_main_driver_v3,
  m.ml_risk_reason_v3,
  m.ml_version,
  m.ml_score_delta_v3_vs_v2,
  m.ml_source_available_v3
from latest_hist h
full outer join mart m
  on upper(m.equipo_id) = upper(h.equipo_id)
where coalesce(h.rn, 1) = 1
order by coalesce(h.model_run_at, now()) desc, coalesce(m.equipo_id, h.equipo_id) asc
limit :limit
"""

@router.get("/v2/scores")
def ml_v2_scores(limit: int = Query(default=200, ge=1, le=2000)):
    try:
        with eng.connect() as conn:
            rows = conn.execute(text(SQL), {"limit": limit}).mappings().all()

        out = []
        for r in rows:
            d = dict(r)
            d["ml_score"] = d.get("score")
            d["ml_risk_level"] = d.get("nivel_riesgo")
            d["ml_alert_code"] = d.get("alert_code")
            d["ml_scored_at"] = d.get("model_run_at")
            d["ml_version"] = d.get("ml_version") or ("v3" if d.get("ml_score_v3") is not None else "v2")
            out.append(d)

        return {"rows": out, "count": len(out)}
    except Exception as e:
        logger.exception("ml_v2_scores failed")
        raise HTTPException(status_code=500, detail="ml_v2_scores failed")
