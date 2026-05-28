from fastapi import HTTPException
from fastapi import APIRouter, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

try:
    from backend.db.engine import engine
    from backend.routers.estadisticas import get_equipo_detalle as _get_equipo_detalle_canonico
except ImportError:
    from db.engine import engine
    from routers.estadisticas import get_equipo_detalle as _get_equipo_detalle_canonico


router = APIRouter(prefix="/equipos", tags=["Equipos"])


@router.get("/dashboard")
def equipos_dashboard(limit: int = 400):
    """
    Dashboard desde MTR1202 (asignados + extranjeros).
    Fuente: analytics.mart_dashboard_extranjeros
    """
    sql = text("""
        select
          id_equipo,
          sku,
          cliente_asignado,
          persona_asignada,
          tipo_colaborador,
          estado_equipo,
          condicion,
          plataforma,
          ambito,
          pais,
          ciudad,
          marca,
          modelo,
          detalle_modelo,
          sistema_operativo,
          ambito_laboral,
          ubicacion,
          ciudad_comuna,
          fecha_asignacion,
          fecha_compra
        from analytics.mart_dashboard_extranjeros
        order by sku nulls last, id_equipo
        limit :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"limit": limit}).mappings().all()
    return jsonable_encoder(list(rows))


@router.get("/{id_equipo}")
def equipo_detalle(id_equipo: str):
    return _get_equipo_detalle_canonico(id_equipo)


@router.get("/{id_equipo}/timeline")
def equipo_timeline(
    id_equipo: str,
    limit: int = Query(200, ge=1, le=1000),
):
    try:
        from backend.data_access.timeline import get_equipo_timeline
    except ImportError:
        from data_access.timeline import get_equipo_timeline

    return get_equipo_timeline(id_equipo=id_equipo, limit=limit)


@router.get("/{id_equipo}/audit")
def equipo_audit(
    id_equipo: str,
    origen: str | None = Query(default=None),
    tipo_cambio: str | None = Query(default=None),
    campo_modificado: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    criticidad: str | None = Query(default=None),
    severidad: str | None = Query(default=None),
    limit: int = Query(200, ge=1, le=1000),
):
    try:
        from backend.data_access.audit import get_audit_log
    except ImportError:
        from data_access.audit import get_audit_log

    return get_audit_log(
        id_equipo=id_equipo,
        origen=origen,
        tipo_cambio=tipo_cambio,
        campo_modificado=campo_modificado,
        desde=desde,
        hasta=hasta,
        criticidad=criticidad,
        severidad=severidad,
        limit=limit,
    )
