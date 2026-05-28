from __future__ import annotations

import os
import hashlib
import json
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

try:
    from backend.db.engine import get_connection
    from backend.services.jira_fields import extract_equipo_id_from_fields
except ImportError:
    from db.engine import get_connection
    from services.jira_fields import extract_equipo_id_from_fields

router = APIRouter(prefix="/api/jira", tags=["jira"])

def extract_equipo_id(payload: dict) -> Optional[str]:
    issue = payload.get("issue") or {}
    fields = issue.get("fields") or {}
    return extract_equipo_id_from_fields(fields)

def make_event_id(payload: dict) -> str:
    issue_key = (payload.get("issue") or {}).get("key")
    ts = payload.get("timestamp")
    ev = payload.get("webhookEvent")

    if issue_key and ts and ev:
        return f"jira:{issue_key}:{ts}:{ev}"

    raw = json.dumps(payload, sort_keys=True).encode("utf-8")
    return "jira:hash:" + hashlib.sha256(raw).hexdigest()

@router.post("/webhook")
async def jira_webhook(
    request: Request,
    x_jira_webhook_secret: Optional[str] = Header(default=None),
):
    secret = os.getenv("JIRA_WEBHOOK_SECRET")
    if secret and x_jira_webhook_secret != secret:
        raise HTTPException(status_code=403, detail="Forbidden")

    payload = await request.json()
    event_id = make_event_id(payload)

    issue = payload.get("issue") or {}
    issue_key = issue.get("key")
    equipo_id = extract_equipo_id(payload)

    sql = text("""
        insert into raw.raw_jira_webhook_events
        (event_id, webhook_event, issue_key, equipo_id, payload)
        values (:event_id, :webhook_event, :issue_key, :equipo_id, :payload)
    """)

    try:
        with get_connection() as conn:
            conn.execute(sql, {
                "event_id": event_id,
                "webhook_event": payload.get("webhookEvent"),
                "issue_key": issue_key,
                "equipo_id": equipo_id,
                "payload": json.dumps(payload),
            })
            conn.commit()
    except IntegrityError:
        return {"ok": True, "deduped": True}

    return {"ok": True, "event_id": event_id, "equipo_id": equipo_id}
