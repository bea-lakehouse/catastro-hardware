from __future__ import annotations

from typing import Any


def preferred_ml_version(payload: dict[str, Any]) -> str:
    if payload.get("ml_score_v3") is not None:
        return "v3"
    return "v2"


def build_ml_versions_payload(payload: dict[str, Any]) -> dict[str, Any]:
    selected = preferred_ml_version(payload)
    return {
        "selected": selected,
        "v2": {
            "version": "v2",
            "score": payload.get("ml_score_v2", payload.get("ml_score")),
            "risk_level": payload.get("ml_risk_level_v2", payload.get("ml_risk_level")),
            "alert_code": payload.get("ml_alert_code_v2", payload.get("ml_alert_code")),
            "source_available": payload.get("ml_source_available_v2", payload.get("ml_source_available")),
        },
        "v3": {
            "version": "v3",
            "score": payload.get("ml_score_v3"),
            "risk_level": payload.get("ml_risk_level_v3"),
            "alert_code": payload.get("ml_alert_code_v3"),
            "main_driver": payload.get("ml_main_driver_v3"),
            "reason": payload.get("ml_risk_reason_v3"),
            "drivers": payload.get("ml_drivers_json_v3"),
            "source_available": payload.get("ml_source_available_v3"),
        },
        "comparison": {
            "score_delta_v3_vs_v2": payload.get("ml_score_delta_v3_vs_v2"),
        },
    }


def build_ml_v3_summary(payload: dict[str, Any]) -> str | None:
    main = payload.get("ml_main_driver_v3")
    reason = payload.get("ml_risk_reason_v3")
    alert = payload.get("ml_alert_code_v3")
    return next((value for value in [main, reason, alert] if value), None)
