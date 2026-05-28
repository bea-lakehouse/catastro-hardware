from fastapi import APIRouter
from sqlalchemy import text

try:
    from backend.db.engine import engine
except ImportError:
    from db.engine import engine

router = APIRouter(prefix="/home", tags=["Home"])

@router.get("/kpis")
def home_kpis():
    sql = text("""
        SELECT
            count(*) AS equipos_total,

            count(*) FILTER (WHERE alertas_severidad = 'CRITICAL') AS criticos,
            count(*) FILTER (WHERE alertas_severidad = 'WARN')     AS warn,
            count(*) FILTER (WHERE alertas_severidad = 'INFO')     AS info,

            count(*) FILTER (WHERE flag_renovar)          AS renovar,
            count(*) FILTER (WHERE flag_rotacion_alta)    AS rotacion_alta,
            count(*) FILTER (WHERE flag_sin_asignacion)   AS sin_asignacion,

            count(*) FILTER (WHERE ml_score IS NOT NULL)  AS con_ml,
            count(*) FILTER (WHERE ml_risk_level = 'Alta') AS riesgo_ml_alto
        FROM analytics.mart_equipos_estado_actual
    """)

    with engine.connect() as conn:
        row = dict(conn.execute(sql).mappings().first())

    return row
