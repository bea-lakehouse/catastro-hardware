import logging

from fastapi import APIRouter, HTTPException

try:
    from backend.routers.estadisticas import get_equipo_detalle as _get_equipo_detalle_canonico
except ImportError:
    from routers.estadisticas import get_equipo_detalle as _get_equipo_detalle_canonico

try:
    from backend.services.ml_v3 import build_ml_versions_payload, build_ml_v3_summary
except ImportError:
    from services.ml_v3 import build_ml_versions_payload, build_ml_v3_summary

router = APIRouter(prefix="/ml", tags=["ml"])
logger = logging.getLogger("uvicorn.error")


@router.get("/v2/explain/{id_equipo}")
def explain_v2(id_equipo: str):
    """
    Wrapper legacy del explain ML v2.
    Fuente canónica: /estadisticas/equipos/{id_equipo}
    """
    try:
        detalle = _get_equipo_detalle_canonico(id_equipo)
    except HTTPException:
        raise
    except Exception:
        logger.exception("ml_v2 explain failed for %s", id_equipo)
        raise HTTPException(status_code=500, detail="ml_v2_explain failed")

    if not detalle:
        raise HTTPException(status_code=404, detail="Not Found")

    ml_versions = build_ml_versions_payload(detalle)
    selected = ml_versions.get(ml_versions.get("selected", "v2"), {}) if isinstance(ml_versions, dict) else {}

    score = (
        selected.get("score")
        or detalle.get("ml_score_v3")
        or detalle.get("ml_score_v2")
        or detalle.get("ml_score")
        or 0
    )
    nivel = (
        selected.get("risk_level")
        or detalle.get("ml_risk_level_v3")
        or detalle.get("ml_risk_level_v2")
        or detalle.get("ml_risk_level")
        or "BAJO"
    )
    alert_code = (
        selected.get("alert_code")
        or detalle.get("ml_alert_code_v3")
        or detalle.get("ml_alert_code_v2")
        or detalle.get("ml_alert_code")
    )
    scored_at = detalle.get("ml_scored_at_v3") or detalle.get("ml_scored_at")

    return {
        "equipo_id": detalle.get("id_equipo") or id_equipo,
        "score": score,
        "nivel_riesgo": nivel,
        "alert_code": alert_code,
        "model_run_at": scored_at,
        "ml_total": None,
        "link_path": detalle.get("ml_link_path"),
        "drivers_json": detalle.get("ml_drivers_json"),
        "model_version": None,
        "ml_score": score,
        "ml_risk_level": nivel,
        "ml_alert_code": alert_code,
        "ml_scored_at": scored_at,
        "ml_explain_summary": detalle.get("ml_explain_summary"),
        "ml_score_v2": detalle.get("ml_score_v2", score),
        "ml_risk_level_v2": detalle.get("ml_risk_level_v2", nivel),
        "ml_alert_code_v2": detalle.get("ml_alert_code_v2", alert_code),
        "ml_score_v3": detalle.get("ml_score_v3"),
        "ml_risk_level_v3": detalle.get("ml_risk_level_v3"),
        "ml_alert_code_v3": detalle.get("ml_alert_code_v3"),
        "ml_main_driver_v3": detalle.get("ml_main_driver_v3"),
        "ml_risk_reason_v3": detalle.get("ml_risk_reason_v3"),
        "ml_explain_summary_v3": build_ml_v3_summary(detalle),
        "ml_versions": ml_versions,
        "ml_version": detalle.get("ml_version") or ("v3" if detalle.get("ml_score_v3") is not None else "v2"),
    }
