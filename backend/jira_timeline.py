import os


def jira_enabled() -> bool:
    return str(os.getenv("JIRA_TIMELINE_ENABLED", "0")).strip() in {"1","true","True","yes","YES"}

import requests
from typing import Any, Dict, List

JIRA_BASE_URL = os.getenv("JIRA_BASE_URL", "").rstrip("/")
JIRA_EMAIL = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "")
JIRA_ENABLED = os.getenv("JIRA_TIMELINE_ENABLED", "1") == "1"

def _auth():
    if not (JIRA_EMAIL and JIRA_API_TOKEN):
        return None
    return (JIRA_EMAIL, JIRA_API_TOKEN)

def _safe(x: Any) -> str:
    return "" if x is None else str(x)

def fetch_issue_changelog(issue_key: str, limit_items: int = 50) -> List[Dict[str, Any]]:
    if not (JIRA_ENABLED and JIRA_BASE_URL and issue_key):
        return []
    if not _auth():
        return []

    url = f"{JIRA_BASE_URL}/rest/api/3/issue/{issue_key}"
    params = {"expand": "changelog", "fields": "summary"}

    try:
        r = requests.get(url, params=params, auth=_auth(), timeout=20)
        if r.status_code >= 400:
            return []
        data = r.json()
    except Exception:
        return []

    histories = (data.get("changelog") or {}).get("histories") or []
    rows: List[Dict[str, Any]] = []

    for h in histories:
        created = _safe(h.get("created"))
        author = h.get("author") or {}
        user = _safe(author.get("displayName") or author.get("name") or "Jira")

        for it in (h.get("items") or []):
            field = _safe(it.get("field") or "Cambio")
            frm = _safe(it.get("fromString"))
            to = _safe(it.get("toString"))
            detalle = (f"{frm} → {to}".strip() if (frm or to) else field)

            rows.append({
                "historia_id": f"JIRA-{issue_key}-{_safe(h.get('id') or created)}-{field}",
                "fecha_evento": created,
                "tipo_evento": field,
                "detalle_evento": detalle,
                "usuario_evento": user,
                "origen_evento": "jira",
                "dias_hasta_siguiente_evento": None,
            })

    rows.sort(key=lambda x: x.get("fecha_evento") or "", reverse=True)
    return rows[: max(0, int(limit_items))]

def merge_mtr_and_jira(mtr_rows: List[Dict[str, Any]], jira_rows: List[Dict[str, Any]], limit: int = 50) -> List[Dict[str, Any]]:
    merged = list(mtr_rows or []) + list(jira_rows or [])
    merged.sort(key=lambda x: x.get("fecha_evento") or "", reverse=True)
    return merged[: max(0, int(limit))]
