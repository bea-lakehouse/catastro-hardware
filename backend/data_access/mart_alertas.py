import os
from sqlalchemy import create_engine, text


def _get_engine():
    """
    Compat:
    - si db.py define get_engine() -> úsalo
    - si db.py expone engine -> úsalo
    - si no, crea engine desde DATABASE_URL
    """
    try:
        from backend.db.engine import get_engine  # type: ignore
        return get_engine()
    except Exception:
        try:
            from db.engine import get_engine  # type: ignore
            return get_engine()
        except Exception:
            pass

    try:
        from backend.db.engine import engine  # type: ignore
        return engine
    except Exception:
        try:
            from db.engine import engine  # type: ignore
            return engine
        except Exception:
            pass

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set and no engine found in db.py")
    return create_engine(db_url)


def get_mart_alertas_acciones(limit: int = 5000):
    """
    Lee analytics.mart_alertas_acciones (dbt) y devuelve grupos por tipo/prioridad
    (columnas REALES en tu ti_ops)
    """
    sql = """
    select
      tipo_accion,
      prioridad,
      count(*) as total
    from analytics.mart_alertas_acciones
    group by tipo_accion, prioridad
    order by
      prioridad,
      tipo_accion
    limit :limit
    """

    eng = _get_engine()
    with eng.connect() as conn:
        res = conn.execute(text(sql), {"limit": int(limit)})
        return [dict(r._mapping) for r in res]
