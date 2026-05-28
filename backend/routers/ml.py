import numpy as np
import pandas as pd
from datetime import date
from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/timeline/{id_equipo}")
def ml_equipo_timeline(id_equipo: str):
    sql = """
    with base as (
      select
        fecha_evento,
        coalesce(tipo_evento, tipo_movimiento, 'EVENTO')::text as tipo_evento,
        coalesce(cliente, cliente_evento, cliente_ref, '')::text as cliente,
        coalesce(persona, persona_ref, '')::text as persona,
        coalesce(location_ingreso, location_ref, pais_regla, '')::text as location_ref,
        coalesce(marca, '')::text as marca,
        coalesce(modelo, '')::text as modelo,
        coalesce(mac_win, '')::text as mac_win,
        coalesce(condicion, '')::text as condicion
      from analytics.v_mtr1203_timeline_latest
      where upper(coalesce(id_equipo, '')) = upper(:id_equipo)
    )
    select
      fecha_evento,
      tipo_evento,
      cliente,
      persona,
      location_ref,
      marca,
      modelo,
      mac_win,
      condicion
    from base
    order by fecha_evento asc, tipo_evento asc
    """
    try:
        with engine.connect() as c:
            rows = [dict(r._mapping) for r in c.execute(sql_text(sql), {"id_equipo": id_equipo}).fetchall()]
        return {
            "id_equipo": id_equipo,
            "count": len(rows),
            "data": rows,
        }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"ml timeline error: {e}")



@router.get("/anomalias")
def listar_anomalias(limit: int = 200):
    """
    MVP: retorna anomalías (por ahora vacío para no romper UI).
    Cuando conectes tu pipeline real (IsolationForest/LOF),
    aquí devolvemos rows con id, tipo, mensaje, sku, nro_serie, etc.
    """
    rows = []
    return {"rows": rows}


@router.get("/anomalias/{anomalia_id}")
def get_anomalia(anomalia_id: str):
    # MVP: sin detalle aún
    raise HTTPException(status_code=404, detail="Anomalía no encontrada")
