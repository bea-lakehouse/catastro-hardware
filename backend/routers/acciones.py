from fastapi import APIRouter, HTTPException
from sqlalchemy import text

try:
    from backend.data_access.mart_alertas import get_mart_alertas_acciones
    from backend.db.engine import engine
except ImportError:
    from data_access.mart_alertas import get_mart_alertas_acciones
    from db.engine import engine

router = APIRouter(prefix="/acciones", tags=["acciones"])


@router.get("/grupos")
@router.get("/grupos/")
def acciones_grupos(limit: int = 5000):
    try:
        rows = get_mart_alertas_acciones(limit=limit)
        return {
            "rows": rows,
            "count": sum(int(r.get("total", 0)) for r in rows),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{accion_id}")
def accion_detalle(accion_id: str):
    """Detalle de una acción (para el drawer). Fuente: analytics.mart_alertas_acciones + estado local."""
    q = text(
        """
        select
          a.*,
          coalesce(e.estado, 'PENDIENTE') as estado
        from analytics.mart_alertas_acciones a
        left join acciones_estado e
          on e.accion_id = a.accion_id
        where a.accion_id = :accion_id
        limit 1
        """
    )
    with engine.connect() as conn:
        row = conn.execute(q, {"accion_id": accion_id}).mappings().first()
    if not row:
        return {"detail": "Not Found"}
    return dict(row)
