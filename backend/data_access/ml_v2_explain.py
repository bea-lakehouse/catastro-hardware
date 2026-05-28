from sqlalchemy import text

try:
    from backend.db.engine import engine
except ImportError:
    from db.engine import engine

SQL = text("""
select
  s.equipo_id,
  s.score           as ml_score,
  s.nivel_riesgo    as ml_risk_level,
  s.alert_code      as ml_alert_code,
  s.ml_total        as ml_total,
  s.model_run_at    as ml_scored_at,
  s.link_path       as ml_link_path,
  h.drivers_json    as drivers_json
from analytics.ml_scores_latest s
left join lateral (
  select drivers_json
  from analytics.ml_scores_v2_history
  where entity_id = s.equipo_id
  order by created_at desc
  limit 1
) h on true
where s.equipo_id = :id_equipo
limit 1
""")

def get_ml_v2_explain(id_equipo: str):
    with engine.connect() as conn:
        return conn.execute(SQL, {"id_equipo": id_equipo}).mappings().first()
