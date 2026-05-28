from __future__ import annotations

import json
import logging
import math
import os
import re
from typing import Any

import requests
from sqlalchemy import text

try:
    from backend.db.engine import get_connection
    from backend.services.jira_fields import (
        extract_equipo_id_from_fields,
        extract_status_category,
        normalize_board_bucket,
    )
except ImportError:
    from db.engine import get_connection
    from services.jira_fields import (
        extract_equipo_id_from_fields,
        extract_status_category,
        normalize_board_bucket,
    )


logger = logging.getLogger(__name__)


RAW_JIRA_DDL = """
create schema if not exists raw;

create table if not exists raw.jira_issues (
  issue_id text primary key,
  issue_key text not null,
  equipo_id text null,
  summary text null,
  status_name text null,
  status_category_id text null,
  status_category_key text null,
  status_category_name text null,
  board_bucket text null,
  priority_name text null,
  labels jsonb null,
  assignee_display_name text null,
  reporter_display_name text null,
  project_id text null,
  project_key text null,
  project_name text null,
  created_at timestamptz null,
  updated_at timestamptz null,
  status_category_changed_at timestamptz null,
  raw jsonb not null,
  inserted_at timestamptz not null default now()
);

alter table raw.jira_issues add column if not exists equipo_id text null;
alter table raw.jira_issues add column if not exists status_category_id text null;
alter table raw.jira_issues add column if not exists status_category_key text null;
alter table raw.jira_issues add column if not exists status_category_name text null;
alter table raw.jira_issues add column if not exists board_bucket text null;
alter table raw.jira_issues add column if not exists priority_name text null;
alter table raw.jira_issues add column if not exists labels jsonb null;
alter table raw.jira_issues add column if not exists status_category_changed_at timestamptz null;
alter table raw.jira_issues add column if not exists reporter_display_name text null;
alter table raw.jira_issues add column if not exists project_id text null;
alter table raw.jira_issues add column if not exists project_key text null;
alter table raw.jira_issues add column if not exists project_name text null;

create index if not exists ix_jira_issues_issue_key
  on raw.jira_issues(issue_key);

create index if not exists ix_jira_issues_updated_at
  on raw.jira_issues(updated_at desc);

create index if not exists ix_jira_issues_equipo_id
  on raw.jira_issues(equipo_id);

create index if not exists ix_jira_issues_project_key
  on raw.jira_issues(project_key);
"""


JQL_SCOPE_CLAUSE_RE = re.compile(
    r"\b(project|created|updated|key)\b\s*(=|!=|>=|<=|>|<|~|!~|\bin\b|\bnot\s+in\b|\bis\b)",
    re.IGNORECASE,
)


def _jira_auth() -> tuple[str, str, str]:
    base_url = os.getenv("JIRA_BASE_URL")
    email = os.getenv("JIRA_EMAIL")
    token = os.getenv("JIRA_API_TOKEN")

    if not base_url or not email or not token:
        raise RuntimeError("Faltan JIRA_BASE_URL, JIRA_EMAIL o JIRA_API_TOKEN.")

    return base_url, email, token


def _jira_session() -> tuple[str, requests.Session]:
    base_url, email, token = _jira_auth()
    session = requests.Session()
    session.auth = (email, token)
    session.headers.update({"Accept": "application/json"})
    return base_url, session


def _ensure_jira_authenticated(base_url: str, session: requests.Session) -> None:
    response = session.get(f"{base_url}/rest/api/3/myself", timeout=60)
    if response.status_code >= 400:
        body_short = " ".join((response.text or "").split())[:300]
        auth = getattr(session, "auth", None)
        email = auth[0] if isinstance(auth, tuple) and len(auth) >= 1 else None
        token = auth[1] if isinstance(auth, tuple) and len(auth) >= 2 else None
        logger.warning(
            "jira_myself_auth_failed base_url=%s email=%s token_len=%s status_code=%s body=%s",
            base_url,
            email,
            len(token) if isinstance(token, str) else None,
            response.status_code,
            body_short,
        )
    if response.status_code == 401:
        raise RuntimeError(
            "Jira rechazó la autenticación. Revisa JIRA_EMAIL/JIRA_API_TOKEN y confirma que el token siga vigente."
        )
    if response.status_code == 403:
        raise RuntimeError(
            "Jira autenticó la cuenta pero no autoriza consultar la API. Revisa permisos del usuario o alcance del token."
        )
    response.raise_for_status()


def _search_issues(
    base_url: str,
    session: requests.Session,
    *,
    jql: str,
    fields: list[str],
    max_results: int,
    next_page_token: str | None = None,
) -> dict[str, Any]:
    endpoints = (
        (
            "POST",
            {
                "jql": jql,
                "maxResults": max_results,
                "fields": fields,
                "fieldsByKeys": False,
                **({"nextPageToken": next_page_token} if next_page_token else {}),
            },
        ),
        (
            "GET",
            {
                "jql": jql,
                "maxResults": max_results,
                "fields": fields,
                **({"nextPageToken": next_page_token} if next_page_token else {}),
            },
        ),
    )
    last_error: Exception | None = None

    for method, payload in endpoints:
        try:
            if method == "POST":
                response = session.post(f"{base_url}/rest/api/3/search/jql", json=payload, timeout=60)
            else:
                response = session.get(f"{base_url}/rest/api/3/search/jql", params=payload, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code in (400, 404, 405, 410):
                last_error = RuntimeError(f"Jira rechazó {method} /rest/api/3/search/jql en esta instancia.")
                continue
            raise

    if last_error is not None:
        raise last_error
    raise RuntimeError("No se pudo consultar Jira en /rest/api/3/search/jql.")


def _ensure_safe_jql(jql: str) -> str:
    normalized = " ".join((jql or "").split())
    if not normalized:
        raise RuntimeError("La consulta JQL quedó vacía.")
    if not JQL_SCOPE_CLAUSE_RE.search(normalized):
        raise RuntimeError(
            "La consulta JQL debe incluir al menos una restricción por project, created, updated o key."
        )
    return normalized


def build_issue_snapshot_jql(hours_back: int | None) -> str:
    explicit_jql = os.getenv("JIRA_SYNC_JQL", "").strip()
    if explicit_jql:
        return _ensure_safe_jql(explicit_jql)

    days_back = 365
    if hours_back and hours_back > 0:
        days_back = max(1, math.ceil(int(hours_back) / 24))
    project_key = os.getenv("JIRA_PROJECT_KEY", "").strip() or "SKU"
    jql = (
        f"project = {project_key} "
        f"AND (statusCategory != Done OR updated >= -{days_back}d) "
        "ORDER BY updated DESC"
    )
    return _ensure_safe_jql(jql)


def fetch_issue_snapshots(*, hours_back: int | None = None, max_results: int = 1000) -> list[dict[str, Any]]:
    base_url, session = _jira_session()
    _ensure_jira_authenticated(base_url, session)
    next_page_token: str | None = None
    items: list[dict[str, Any]] = []
    jql = build_issue_snapshot_jql(hours_back)
    fields = [
        "summary",
        "status",
        "assignee",
        "reporter",
        "project",
        "priority",
        "labels",
        "created",
        "updated",
        "statuscategorychangedate",
    ]
    custom_key = os.getenv("JIRA_EQUIPO_CUSTOMFIELD", "").strip()
    if custom_key:
        fields.append(custom_key)

    while len(items) < max_results:
        page_size = min(50, max_results - len(items))
        result = _search_issues(
            base_url,
            session,
            jql=jql,
            fields=fields,
            max_results=page_size,
            next_page_token=next_page_token,
        )
        issues = result.get("issues") or []
        if not issues:
            break
        items.extend(issues)
        next_page_token = result.get("nextPageToken")
        if result.get("isLast", False) or not next_page_token:
            break

    return items[:max_results]


def _normalize_issue(issue: dict[str, Any]) -> dict[str, Any]:
    fields = (issue or {}).get("fields") or {}
    status = fields.get("status") or {}
    priority = fields.get("priority") or {}
    assignee = fields.get("assignee") or {}
    reporter = fields.get("reporter") or {}
    project = fields.get("project") or {}
    category_id, category_key, category_name = extract_status_category(fields)
    status_name = (status or {}).get("name")
    equipo_id = extract_equipo_id_from_fields(fields)

    return {
        "issue_id": str((issue or {}).get("id") or "").strip(),
        "issue_key": str((issue or {}).get("key") or "").strip(),
        "equipo_id": equipo_id,
        "summary": fields.get("summary"),
        "status_name": status_name,
        "status_category_id": category_id,
        "status_category_key": category_key,
        "status_category_name": category_name,
        "board_bucket": normalize_board_bucket(status_name, category_key, category_name),
        "priority_name": (priority or {}).get("name"),
        "labels": fields.get("labels") or [],
        "assignee_display_name": (assignee or {}).get("displayName"),
        "reporter_display_name": (reporter or {}).get("displayName"),
        "project_id": str((project or {}).get("id") or "").strip() or None,
        "project_key": str((project or {}).get("key") or "").strip() or None,
        "project_name": str((project or {}).get("name") or "").strip() or None,
        "created_at": fields.get("created"),
        "updated_at": fields.get("updated"),
        "status_category_changed_at": fields.get("statuscategorychangedate"),
        "raw": issue,
    }


def store_issue_snapshots(issues: list[dict[str, Any]]) -> int:
    upsert_sql = text(
        """
        insert into raw.jira_issues
          (
            issue_id,
            issue_key,
            equipo_id,
            summary,
            status_name,
            status_category_id,
            status_category_key,
            status_category_name,
            board_bucket,
            priority_name,
            labels,
            assignee_display_name,
            reporter_display_name,
            project_id,
            project_key,
            project_name,
            created_at,
            updated_at,
            status_category_changed_at,
            raw,
            inserted_at
          )
        values
          (
            :issue_id,
            :issue_key,
            :equipo_id,
            :summary,
            :status_name,
            :status_category_id,
            :status_category_key,
            :status_category_name,
            :board_bucket,
            :priority_name,
            cast(:labels as jsonb),
            :assignee_display_name,
            :reporter_display_name,
            :project_id,
            :project_key,
            :project_name,
            cast(:created_at as timestamptz),
            cast(:updated_at as timestamptz),
            cast(:status_category_changed_at as timestamptz),
            cast(:raw as jsonb),
            now()
          )
        on conflict (issue_id) do update
        set issue_key = excluded.issue_key,
            equipo_id = excluded.equipo_id,
            summary = excluded.summary,
            status_name = excluded.status_name,
            status_category_id = excluded.status_category_id,
            status_category_key = excluded.status_category_key,
            status_category_name = excluded.status_category_name,
            board_bucket = excluded.board_bucket,
            priority_name = excluded.priority_name,
            labels = excluded.labels,
            assignee_display_name = excluded.assignee_display_name,
            reporter_display_name = excluded.reporter_display_name,
            project_id = excluded.project_id,
            project_key = excluded.project_key,
            project_name = excluded.project_name,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            status_category_changed_at = excluded.status_category_changed_at,
            raw = excluded.raw,
            inserted_at = now()
        """
    )

    stored = 0
    with get_connection() as conn:
        conn.execute(text(RAW_JIRA_DDL))
        for issue in issues:
            row = _normalize_issue(issue)
            if not row["issue_id"] or not row["issue_key"]:
                continue
            conn.execute(
                upsert_sql,
                {
                    "issue_id": row["issue_id"],
                    "issue_key": row["issue_key"],
                    "equipo_id": row["equipo_id"],
                    "summary": row["summary"],
                    "status_name": row["status_name"],
                    "status_category_id": row["status_category_id"],
                    "status_category_key": row["status_category_key"],
                    "status_category_name": row["status_category_name"],
                    "board_bucket": row["board_bucket"],
                    "priority_name": row["priority_name"],
                    "labels": json.dumps(row["labels"]),
                    "assignee_display_name": row["assignee_display_name"],
                    "reporter_display_name": row["reporter_display_name"],
                    "project_id": row["project_id"],
                    "project_key": row["project_key"],
                    "project_name": row["project_name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "status_category_changed_at": row["status_category_changed_at"],
                    "raw": json.dumps(row["raw"]),
                },
            )
            stored += 1
        conn.commit()

    return stored
