from fastapi import APIRouter, Query

try:
    from backend.data_access.timeline import get_equipo_timeline
except ImportError:
    from data_access.timeline import get_equipo_timeline

# Wrapper legado no canónico.
# La ruta efectiva en la app vive en backend/routers/equipos.py -> /equipos/{id_equipo}/timeline
# y ambas delegan al mismo data_access para evitar divergencias de contrato.
router = APIRouter(prefix="/equipos", tags=["equipos"])

@router.get("/{id_equipo}/timeline")
def equipo_timeline(
    id_equipo: str,
    limit: int = Query(200, ge=1, le=1000)
):
    try:
        from backend.data_access.timeline import get_equipo_timeline as _f
    except ImportError:
        from data_access.timeline import get_equipo_timeline as _f

    return _f(id_equipo=id_equipo, limit=limit)
