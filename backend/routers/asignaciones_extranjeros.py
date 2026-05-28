import os
from typing import Any, Dict, List, Optional
from datetime import date, datetime

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/estadisticas", tags=["Estadisticas"])

# -----------------------------
# helpers
# -----------------------------
def _pg_dsn() -> str:
    dsn = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_DSN")
    if dsn:
        return dsn

    host = os.getenv("PGHOST", "db")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "")
    dbname = os.getenv("PGDATABASE", "postgres")

    if password:
        return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    return f"postgresql://{user}@{host}:{port}/{dbname}"

def _jsonable(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v

# -----------------------------
# endpoint
# -----------------------------
@router.get("/asignaciones-extranjeros-mes")
def asignaciones_extranjeros_mes(
    limit: int = 120,
    order: str = "desc",
    months: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Serie mensual desde analytics.mart_asignaciones_extranjeros_mes
    - order: asc | desc
    - months: últimos N meses (desde max(mes))
    """

    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit debe estar entre 1 y 1000")

    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="order debe ser asc o desc")

    if months is not None and (months < 1 or months > 240):
        raise HTTPException(status_code=400, detail="months debe estar entre 1 y 240")

    order_sql = "asc" if order == "asc" else "desc"

    sql = f"""
        with base as (
            select
                mes,
                asignaciones_extranjero_total,
                asignaciones_extranjero_core,
                asignaciones_extranjero_staffing,
                asignaciones_extranjero_mac,
                asignaciones_extranjero_win
            from analytics.mart_asignaciones_extranjeros_mes
        ),
        mx as (
            select max(mes) as max_mes from base
        )
        select *
        from base
        where (%(months)s is null)
           or mes >= (
                select (max_mes - ((%(months)s - 1) * interval '1 month'))::date
                from mx
           )
        order by mes {order_sql}
        limit %(limit)s
    """

    try:
        import psycopg2
        import psycopg2.extras
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"psycopg2 no disponible: {e}")

    try:
        with psycopg2.connect(_pg_dsn()) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, {"limit": limit, "months": months})
                rows = cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando mart: {e}")

    data: List[Dict[str, Any]] = [
        {k: _jsonable(v) for k, v in dict(r).items()}
        for r in rows
    ]

    return {
        "order": order,
        "months": months,
        "limit": limit,
        "count": len(data),
        "data": data,
    }
