import logging
import os
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from backend.jira_webhook import router as jira_router
    from backend.routers import estadisticas
    from backend.routers.acciones import router as acciones_router
    from backend.routers.asignaciones import router as asignaciones_router
    from backend.routers.asignaciones_extranjeros import (
        router as asignaciones_extranjeros_router,
    )
    from backend.routers.auditoria import router as auditoria_router
    from backend.routers.compras import router as compras_router
    from backend.routers.catastro_historico import router as catastro_historico_router
    from backend.routers.equipos import router as equipos_router
    from backend.routers.ejecucion import router as ejecucion_router
    from backend.routers.home import router as home_router
    from backend.routers.home_kpis import router as home_kpis_router
    from backend.routers.ml_scores import router as ml_scores_router
    from backend.routers.ml_v2 import router as ml_v2_router
    from backend.routers.operacion import router as operacion_router
    from backend.routers.ranking import router as ranking_router
    from backend.routers.sync import router as sync_router
except ImportError:
    from jira_webhook import router as jira_router
    from routers import estadisticas
    from routers.acciones import router as acciones_router
    from routers.asignaciones import router as asignaciones_router
    from routers.asignaciones_extranjeros import router as asignaciones_extranjeros_router
    from routers.auditoria import router as auditoria_router
    from routers.compras import router as compras_router
    from routers.catastro_historico import router as catastro_historico_router
    from routers.equipos import router as equipos_router
    from routers.ejecucion import router as ejecucion_router
    from routers.home import router as home_router
    from routers.home_kpis import router as home_kpis_router
    from routers.ml_scores import router as ml_scores_router
    from routers.ml_v2 import router as ml_v2_router
    from routers.operacion import router as operacion_router
    from routers.ranking import router as ranking_router
    from routers.sync import router as sync_router

app = FastAPI()
logger = logging.getLogger("uvicorn.error")


def _cors_origins() -> list[str]:
    env = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
    default_dev = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:52345",
        "http://localhost:52345",
    ]
    raw = os.getenv("BACKEND_CORS_ORIGINS", "").strip()
    configured = [value.strip() for value in raw.split(",") if value.strip()]
    if env in {"dev", "development", "local"}:
        return configured or default_dev
    return configured



app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code < 500:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error("HTTPException 500 [%s] %s %s: %s", request_id, request.method, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": "Internal server error", "request_id": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.exception("Unhandled exception [%s] %s %s", request_id, request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
    )

app.include_router(asignaciones_extranjeros_router)
app.include_router(estadisticas.router)
app.include_router(catastro_historico_router)
app.include_router(asignaciones_router)
app.include_router(auditoria_router)

@app.get("/health")
def health():
    return {"status": "ok"}

# Jira webhook
app.include_router(jira_router)



app.include_router(ml_scores_router)
app.include_router(ml_v2_router)
app.include_router(home_router)
app.include_router(operacion_router)
app.include_router(ejecucion_router)
app.include_router(ranking_router)
app.include_router(equipos_router)
app.include_router(acciones_router)
app.include_router(home_kpis_router)
app.include_router(compras_router)
app.include_router(sync_router)
