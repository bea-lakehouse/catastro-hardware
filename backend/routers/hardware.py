from typing import Optional, List, Dict, Any 


SQL_EQUIPO_DETALLE = """
select
  id_equipo,
  estado_equipo,
  persona_asignada,
  cliente,
  localizacion,
  ciudad_comuna,
  fecha_compra,
  last_event_date,
  last_event_type,
  last_event_persona,
  last_event_detalle,
  movimientos_12m,
  personas_distintas_12m,
  dias_desde_compra,
  dias_desde_ultimo_evento,
  fecha_vencimiento_renovacion,
  dias_a_vencer,
  flag_renovar,
  flag_rotacion_alta,
  flag_sin_asignacion,

  -- ML (sin tocarlo, solo expone lo que ya existe en mart)
  ml_score,
  ml_risk_level,
  ml_alert_code,
  ml_total,
  ml_scored_at,
  ml_link_path,

  -- Jira
  jira_open_count,
  jira_days_open_max,
  jira_last_event_at,

  -- Alertas
  alertas_severidad,
  alertas_resumen,
  alertas_json,
  alertas_codigos,

  -- Politica
  tipo_colaborador,
  factor_colaborador,
  motivo_tipo_colaborador,
  segmento_destino,
  elegible_dev,
  generacion_categoria,

  -- Presion stock
  presion_stock,
  presion_nivel,
  stock_disponible,
  demanda_ingresos,
  demanda_jira,

  -- Prioridades
  priority_rank,
  priority_final_rank,
  priority_final_sort_key,

  _loaded_at
from analytics.mart_equipos_estado_actual
where id_equipo = %(id_equipo)s
limit 1
"""


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db  # o como tengas importado get_db

router = APIRouter(prefix="/hw", tags=["hardware"])


@router.get("/estado_actual")
def estado_actual_equipo(
    sku: Optional[int] = Query(None),
    nro_serie: Optional[str] = Query(None),
    asset_tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Devuelve el estado actual de un equipo.
    Nota: en la BD la columna sku es TEXT, por eso casteamos el parámetro a str.
    """
    filtros = []
    params: dict = {}

    if sku is not None:
        filtros.append("sku = :sku")
        # IMPORTANTE: sku en la tabla es TEXT → enviamos string
        params["sku"] = str(sku)

    if nro_serie:
        filtros.append("nro_serie = :nro_serie")
        params["nro_serie"] = nro_serie

    if asset_tag:
        filtros.append("asset_tag = :asset_tag")
        params["asset_tag"] = asset_tag

    if not filtros:
        raise HTTPException(
            status_code=400,
            detail="Debes indicar sku, nro_serie o asset_tag",
        )

    where_clause = " AND ".join(filtros)

    sql = f"""
        SELECT *
        FROM activos.equipos
        WHERE {where_clause}
        ORDER BY fecha_compra NULLS FIRST, id
        LIMIT 1
    """

    row = db.execute(text(sql), params).mappings().first()
    if not row:
        return {}

    return dict(row)

# =========================================================
# /hw/equipos  → inventario actual desde activos.equipos
# =========================================================
@router.get("/equipos")
def listar_equipos(
    anio_desde: int,
    anio_hasta: int,
    cliente: Optional[str] = None,
    pais: Optional[str] = None,
    estado: Optional[str] = None,
    tipo_equipo: Optional[str] = None,
    sku: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Lista de equipos desde activos.equipos.
    Devuelve [] si no hay datos (nunca None).
    Ajusta nombres de columnas según tu tabla real.
    """

    # OJO: ajusta aquí las columnas para que calcen con activos.equipos
    sql = """
        SELECT
            e.id,
            e.asset_tag,
            e.sku,
            e.nro_serie,
            e.fecha_compra,
            e.estado,
            e.tipo_equipo,
            e.marca,
            e.modelo,
            e.cpu,
            e.cliente_actual,
            e.persona_actual,
            e.pais_actual,
            e.ciudad_actual,
            e.perfil_actual
        FROM activos.equipos e
        WHERE date_part('year', e.fecha_compra) BETWEEN :anio_desde AND :anio_hasta
    """

    params: Dict[str, Any] = {
        "anio_desde": anio_desde,
        "anio_hasta": anio_hasta,
    }

    if cliente:
        sql += " AND e.cliente_actual = :cliente"
        params["cliente"] = cliente

    if pais:
        sql += " AND e.pais_actual = :pais"
        params["pais"] = pais

    if estado:
        sql += " AND lower(e.estado) = lower(:estado)"
        params["estado"] = estado

    if tipo_equipo:
        sql += " AND e.tipo_equipo = :tipo_equipo"
        params["tipo_equipo"] = tipo_equipo

    if sku:
        sql += " AND e.sku = :sku"
        params["sku"] = sku

    sql += " ORDER BY e.fecha_compra LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    result = db.execute(text(sql), params)
    rows = [dict(r) for r in result.mappings()]

    print("DEBUG /hw/equipos → filas:", len(rows))
    return rows


@router.get("/historia")
def historia_equipo(
    sku: Optional[int] = Query(None),
    nro_serie: Optional[str] = Query(None),
    asset_tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:

    if sku is None and not nro_serie and not asset_tag:
        return []

    filtros = []
    params: Dict[str, Any] = {}

    if sku is not None:
        filtros.append("sku = :sku")
        params["sku"] = str(sku)

    if nro_serie:
        filtros.append("nro_serie = :nro_serie")
        params["nro_serie"] = nro_serie.strip()

    if asset_tag:
        filtros.append("asset_tag = :asset_tag")
        params["asset_tag"] = asset_tag.strip()

    where = " AND ".join(filtros)

    # 1️⃣ Historia real
    sql_hist = f"""
        SELECT *
        FROM activos.historia_hw
        WHERE {where}
        ORDER BY fecha_evento NULLS LAST, id
    """
    hist = db.execute(text(sql_hist), params).mappings().all()
    if hist:
        return [dict(r) for r in hist]

    # 2️⃣ Fallback: estado actual desde dbt
    sql_base = f"""
        SELECT *
        FROM analytics.stg_equipos
        WHERE {where}
        ORDER BY fecha_compra NULLS FIRST, equipo_id
        LIMIT 1
    """
    row = db.execute(text(sql_base), params).mappings().first()
    return [dict(row)] if row else []


    
@router.get("/kpi/anual")
def kpi_anual(
    anio_desde: int,
    anio_hasta: int,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Devuelve KPI anuales desde activos.vw_kpi_anual.
    De momento hace SELECT *; ajusta columnas según la view.
    """

    sql = """
        SELECT *
        FROM activos.vw_kpi_anual
        WHERE anio BETWEEN :anio_desde AND :anio_hasta
        ORDER BY anio
    """

    params = {
        "anio_desde": anio_desde,
        "anio_hasta": anio_hasta,
    }

    result = db.execute(text(sql), params)
    rows = [dict(r) for r in result.mappings()]

    print("DEBUG /hw/kpi/anual → filas:", len(rows))
    return rows


# =========================================================
# /hw/resumen → ejemplo sencillo de resumen
# =========================================================
@router.get("/resumen")
def resumen_hw(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Resumen simple de hardware usando activos.equipos.
    Ajusta columnas según tu modelo real.
    """

    sql = """
        SELECT
            count(*) AS total_equipos,
            count(*) FILTER (WHERE lower(estado) = 'baja') AS equipos_baja,
            count(*) FILTER (WHERE lower(estado) <> 'baja') AS equipos_vigentes
        FROM activos.equipos
    """

    result = db.execute(text(sql))
    row = result.mappings().first()
    return dict(row) if row else {}

