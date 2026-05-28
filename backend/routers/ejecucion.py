from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

try:
    from backend.data_access.ejecucion import (
        get_case_detail,
        get_execution_kpis,
        get_execution_queue,
        mutate_case_tracking,
    )
except ImportError:
    from data_access.ejecucion import (
        get_case_detail,
        get_execution_kpis,
        get_execution_queue,
        mutate_case_tracking,
    )


router = APIRouter(prefix="/ejecucion", tags=["Ejecucion"])


class ExecutionCasePayload(BaseModel):
    case_key: str
    case_type: str
    source_module: str
    source_ref: str | None = None
    id_equipo: str | None = None
    cliente: str | None = None
    severity: str | None = None
    source: str | None = None
    title: str | None = None
    summary: str | None = None
    suggested_action: str | None = None
    owner_sugerido: str | None = None
    owner_real: str | None = None
    estado_seguimiento: str | None = None
    comentario_operativo: str | None = None
    actor: str | None = None


def _normalized_reason(value: str | None) -> str:
    return " ".join(str(value or "").strip().split())


@router.get("/queue")
def ejecucion_queue(
    q: str | None = Query(default=None),
    owner: str | None = Query(default=None),
    cliente: str | None = Query(default=None),
    severidad: str | None = Query(default=None),
    fuente: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    limit: int = Query(60, ge=1, le=1000),
):
    return get_execution_queue(
        q=q,
        owner=owner,
        cliente=cliente,
        severidad=severidad,
        fuente=fuente,
        estado=estado,
        limit=limit,
    )


@router.get("/kpis")
def ejecucion_kpis():
    return get_execution_kpis()


@router.get("/cases/{case_key:path}")
def ejecucion_case_detail(case_key: str):
    return get_case_detail(case_key)


@router.post("/cases/take")
def ejecucion_take_case(payload: ExecutionCasePayload):
    return mutate_case_tracking(
        case=payload.model_dump(),
        action="take",
        actor=payload.actor,
        owner_real=payload.owner_real,
        comentario_operativo=payload.comentario_operativo,
    )


@router.post("/cases/assign")
def ejecucion_assign_case(payload: ExecutionCasePayload):
    return mutate_case_tracking(
        case=payload.model_dump(),
        action="assign",
        actor=payload.actor,
        owner_real=payload.owner_real,
        comentario_operativo=payload.comentario_operativo,
    )


@router.post("/cases/status")
def ejecucion_status_case(payload: ExecutionCasePayload):
    normalized_status = str(payload.estado_seguimiento or "").upper().strip()
    if normalized_status in {"ESCALADO", "DESCARTADO"} and not _normalized_reason(payload.comentario_operativo):
        raise HTTPException(
            status_code=422,
            detail=f"Debes dejar un motivo operativo antes de marcar el caso como {normalized_status}.",
        )

    return mutate_case_tracking(
        case=payload.model_dump(),
        action="status",
        actor=payload.actor,
        owner_real=payload.owner_real,
        estado_seguimiento=payload.estado_seguimiento,
        comentario_operativo=payload.comentario_operativo,
    )


@router.post("/cases/comment")
def ejecucion_comment_case(payload: ExecutionCasePayload):
    return mutate_case_tracking(
        case=payload.model_dump(),
        action="comment",
        actor=payload.actor,
        owner_real=payload.owner_real,
        comentario_operativo=payload.comentario_operativo,
    )
