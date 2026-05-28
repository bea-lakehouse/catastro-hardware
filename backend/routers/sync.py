from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

router = APIRouter(prefix="/api/sync", tags=["sync"])
logger = logging.getLogger("uvicorn.error")


def _sync_store():
    try:
        from backend.services import sync_store as mod
    except ImportError:
        from services import sync_store as mod
    return mod


def _google_sync():
    try:
        from backend.services import google_sheets_sync as mod
    except ImportError:
        from services import google_sheets_sync as mod
    return mod


def _jira_sync():
    try:
        from backend.services import jira_sync as mod
    except ImportError:
        from services import jira_sync as mod
    return mod


def _check_secret(secret_header: str | None) -> None:
    env = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
    expected = os.getenv("SYNC_API_SECRET", "").strip()
    if env not in {"dev", "development", "local"} and not expected:
        raise HTTPException(status_code=503, detail="Sync unavailable")
    if expected and secret_header != expected:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/runs")
def sync_runs(limit: int = Query(20, ge=1, le=100)):
    store = _sync_store()
    return {"rows": store.latest_runs(limit=limit)}


@router.get("/health/details")
def sync_health_details():
    store = _sync_store()
    try:
        return store.health_snapshot()
    except Exception:
        logger.exception("sync_health_details failed")
        raise HTTPException(status_code=500, detail="sync_health_details failed")


@router.post("/mtr/google-sheet")
def sync_mtr_google_sheet(
    source_name: str | None = Query(default=None, description="Nombre lógico del rango configurado"),
    x_sync_secret: str | None = Header(default=None),
):
    _check_secret(x_sync_secret)

    google_sync = _google_sync()
    store = _sync_store()
    spreadsheet_id = google_sync.get_spreadsheet_id()
    configured_ranges = google_sync.get_configured_ranges()
    selected: dict[str, str]
    if source_name:
        if source_name not in configured_ranges:
            raise HTTPException(status_code=404, detail=f"source_name no configurado: {source_name}")
        selected = {source_name: configured_ranges[source_name]}
    else:
        selected = configured_ranges

    run_id = store.create_run(
        "google_sheets",
        "mtr",
        metadata={"spreadsheet_id": spreadsheet_id, "sources": list(selected.keys())},
    )

    try:
        total_rows = 0
        by_source: list[dict[str, Any]] = []
        for name, sheet_range in selected.items():
            payload = google_sync.fetch_sheet_range(spreadsheet_id, sheet_range)
            rows = google_sync.rows_from_values(payload.get("values") or [])
            loaded = store.replace_google_sheet_rows(
                run_id=run_id,
                source_name=name,
                spreadsheet_id=spreadsheet_id,
                sheet_range=sheet_range,
                rows=rows,
            )
            total_rows += loaded
            by_source.append({"source_name": name, "sheet_range": sheet_range, "rows_loaded": loaded})

        store.finish_run(run_id, rows_loaded=total_rows, metadata={"spreadsheet_id": spreadsheet_id, "sources": by_source})
        return {"ok": True, "run_id": run_id, "rows_loaded": total_rows, "sources": by_source}
    except Exception as exc:
        logger.exception("sync_mtr_google_sheet failed")
        store.fail_run(run_id, str(exc))
        raise HTTPException(status_code=500, detail="sync_mtr_google_sheet failed")


@router.post("/jira/backfill")
def sync_jira_backfill(
    hours_back: int = Query(default=24 * 365, ge=1, le=24 * 3650),
    max_results: int = Query(default=2000, ge=1, le=5000),
    x_sync_secret: str | None = Header(default=None),
):
    _check_secret(x_sync_secret)

    jira_sync = _jira_sync()
    store = _sync_store()
    jql = jira_sync.build_issue_snapshot_jql(hours_back)
    run_id = store.create_run(
        "jira",
        "issue_snapshot_backfill",
        metadata={"hours_back": hours_back, "max_results": max_results, "jql": jql},
    )

    try:
        issues = jira_sync.fetch_issue_snapshots(hours_back=hours_back, max_results=max_results)
        inserted = jira_sync.store_issue_snapshots(issues)
        store.finish_run(
            run_id,
            rows_loaded=inserted,
            metadata={"hours_back": hours_back, "fetched": len(issues), "inserted": inserted, "jql": jql},
        )
        return {
            "ok": True,
            "run_id": run_id,
            "hours_back": hours_back,
            "jql": jql,
            "fetched": len(issues),
            "inserted": inserted,
        }
    except Exception as exc:
        logger.exception("sync_jira_backfill failed")
        store.fail_run(run_id, str(exc))
        raise HTTPException(status_code=500, detail="sync_jira_backfill failed")
