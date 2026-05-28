import pandas as pd
from sqlalchemy import text

def get_mart_alertas_acciones(engine, limit=5000):
    """
    Devuelve grupos para el panel de acciones.
    Fuente real: analytics.mart_alertas_acciones (id_equipo, estado, alerta)

    Para no romper el frontend, entregamos:
      tipo_accion := alerta
      prioridad  := estado (default PENDIENTE)
      total      := count(*)
    """
    q = text("""
        select
          a.alerta as tipo_accion,
          coalesce(nullif(btrim(a.estado), ''), 'PENDIENTE') as prioridad,
          count(*) as total
        from analytics.mart_alertas_acciones a
        group by 1, 2
        order by 2, 1
        limit :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(q, {"limit": int(limit)}).mappings().all()
    return [dict(r) for r in rows]


