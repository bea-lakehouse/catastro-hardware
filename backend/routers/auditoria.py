from fastapi import APIRouter, Query

try:
    from backend.data_access.audit import get_audit_log
    from backend.data_access.audit import get_audit_summary
except ImportError:
    from data_access.audit import get_audit_log
    from data_access.audit import get_audit_summary


router = APIRouter(tags=["Auditoria"])


@router.get("/auditoria")
def auditoria(
    id_equipo: str | None = Query(default=None),
    q: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    tipo_cambio: str | None = Query(default=None),
    campo_modificado: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    criticidad: str | None = Query(default=None),
    severidad: str | None = Query(default=None),
    limit: int = Query(200, ge=1, le=1000),
):
    return get_audit_log(
        id_equipo=id_equipo,
        q=q,
        origen=origen,
        tipo_cambio=tipo_cambio,
        campo_modificado=campo_modificado,
        desde=desde,
        hasta=hasta,
        criticidad=criticidad,
        severidad=severidad,
        limit=limit,
    )


@router.get("/auditoria/resumen")
def auditoria_resumen(
    id_equipo: str | None = Query(default=None),
    q: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    tipo_cambio: str | None = Query(default=None),
    campo_modificado: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    criticidad: str | None = Query(default=None),
    severidad: str | None = Query(default=None),
):
    return get_audit_summary(
        id_equipo=id_equipo,
        q=q,
        origen=origen,
        tipo_cambio=tipo_cambio,
        campo_modificado=campo_modificado,
        desde=desde,
        hasta=hasta,
        criticidad=criticidad,
        severidad=severidad,
    )
