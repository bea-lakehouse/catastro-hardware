from __future__ import annotations

from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Query
from sqlalchemy import text

# ✅ Compat host + docker:
# - Host: backend/db.py
# - Docker: /app/db.py (módulo "db")
try:
    from backend.db import get_connection  # type: ignore
except Exception:
    from db.engine import get_connection  # type: ignore


router = APIRouter(prefix="/equipos", tags=["ranking"])


def _csv(values: Optional[str]) -> Optional[List[str]]:
    if values is None:
        return None
    parts = [v.strip() for v in values.split(",")]
    parts = [v for v in parts if v]
    return parts or None


@router.get("/ranking")
def get_ranking(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),

    severidad: Optional[str] = Query(None, description="CSV: CRITICAL,WARNING,OK"),
    segmento: Optional[str] = Query(None, description="CSV: Core,Dev,..."),
    tipo_colaborador: Optional[str] = Query(None, description="CSV: core,staffing,unknown"),
    ml: Optional[str] = Query(None, description="CSV: HIGH,MEDIUM,LOW"),
    presion: Optional[str] = Query(None, description="CSV: ALTA,MEDIA,BAJA"),
    renovar: Optional[bool] = Query(None),
) -> Dict[str, Any]:
    where = ["equipo_id is not null"]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    def add_in(col: str, key: str, csv_val: Optional[str]):
        vals = _csv(csv_val)
        if not vals:
            return
        where.append(f"{col} = ANY(:{key})")
        params[key] = vals

    add_in("alertas_severidad", "sev", severidad)
    add_in("segmento_destino", "seg", segmento)
    add_in("tipo_colaborador", "tc", tipo_colaborador)
    add_in("ml_risk_level", "ml", ml)
    add_in("presion_nivel", "pr", presion)

    if renovar is not None:
        where.append("flag_renovar = :renovar")
        params["renovar"] = renovar

    where_sql = " and ".join(where)

    sql = text(f"""
      select *
      from analytics.mart_ranking_global
      where {where_sql}
      order by priority_final_sort_key asc, priority_final_rank asc
      limit :limit offset :offset
    """)

    sql_count = text(f"""
      select count(*) as total
      from analytics.mart_ranking_global
      where {where_sql}
    """)

    with get_connection() as conn:
        rows = [dict(r) for r in conn.execute(sql, params).mappings().fetchall()]
        total = conn.execute(sql_count, params).scalar_one()

    return {"total": total, "limit": limit, "offset": offset, "rows": rows}
