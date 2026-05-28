from fastapi import APIRouter, Query


router = APIRouter(prefix="/operacion", tags=["Operacion"])


@router.get("/alertas")
def operacion_alertas(
    criticidad: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    tipo_alerta: str | None = Query(default=None),
    id_equipo: str | None = Query(default=None),
    q: str | None = Query(default=None),
    estado_alerta: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    limit: int = Query(250, ge=1, le=1000),
):
    from data_access.operacion import get_operacion_alertas

    return get_operacion_alertas(
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        id_equipo=id_equipo,
        q=q,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
        limit=limit,
    )


@router.get("/resumen")
def operacion_resumen(
    criticidad: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    tipo_alerta: str | None = Query(default=None),
    id_equipo: str | None = Query(default=None),
    q: str | None = Query(default=None),
    estado_alerta: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
):
    from data_access.operacion import get_operacion_resumen

    return get_operacion_resumen(
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        id_equipo=id_equipo,
        q=q,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
    )


@router.get("/sla")
def operacion_sla(
    criticidad: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    tipo_alerta: str | None = Query(default=None),
    id_equipo: str | None = Query(default=None),
    q: str | None = Query(default=None),
    estado_alerta: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    limit: int = Query(250, ge=1, le=1000),
):
    from data_access.operacion import get_operacion_sla

    return get_operacion_sla(
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        id_equipo=id_equipo,
        q=q,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
        limit=limit,
    )


@router.get("/confianza")
def operacion_confianza(
    criticidad: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    tipo_alerta: str | None = Query(default=None),
    id_equipo: str | None = Query(default=None),
    q: str | None = Query(default=None),
    estado_alerta: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    limit: int = Query(250, ge=1, le=1000),
):
    from data_access.operacion import get_operacion_confianza

    return get_operacion_confianza(
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        id_equipo=id_equipo,
        q=q,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
        limit=limit,
    )
