from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Iterable

from sqlalchemy import text

try:
    from backend.db.engine import get_connection
except ImportError:
    from db.engine import get_connection


DDL = """
create schema if not exists raw;

create table if not exists raw.sync_runs (
  run_id bigserial primary key,
  source_type text not null,
  source_name text not null,
  status text not null default 'RUNNING',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  rows_loaded integer not null default 0,
  metadata jsonb null,
  error text null
);

create index if not exists ix_sync_runs_source
  on raw.sync_runs(source_type, source_name, started_at desc);

create table if not exists raw.mtr_google_sheet_rows (
  id bigserial primary key,
  run_id bigint not null references raw.sync_runs(run_id) on delete cascade,
  source_name text not null,
  spreadsheet_id text not null,
  sheet_range text not null,
  row_number integer not null,
  row_data jsonb not null,
  inserted_at timestamptz not null default now()
);

create index if not exists ix_mtr_google_sheet_rows_run
  on raw.mtr_google_sheet_rows(run_id, source_name, row_number);
"""


def ensure_sync_tables() -> None:
    with get_connection() as conn:
        conn.execute(text(DDL))
        conn.commit()


def create_run(source_type: str, source_name: str, metadata: dict[str, Any] | None = None) -> int:
    ensure_sync_tables()
    sql = text(
        """
        insert into raw.sync_runs (source_type, source_name, status, metadata)
        values (:source_type, :source_name, 'RUNNING', cast(:metadata as jsonb))
        returning run_id
        """
    )
    with get_connection() as conn:
        run_id = conn.execute(
            sql,
            {
                "source_type": source_type,
                "source_name": source_name,
                "metadata": json.dumps(metadata or {}),
            },
        ).scalar_one()
        conn.commit()
        return int(run_id)


def finish_run(run_id: int, *, rows_loaded: int = 0, metadata: dict[str, Any] | None = None) -> None:
    sql = text(
        """
        update raw.sync_runs
        set status = 'SUCCESS',
            finished_at = now(),
            rows_loaded = :rows_loaded,
            metadata = case
              when :metadata is null then metadata
              else cast(:metadata as jsonb)
            end
        where run_id = :run_id
        """
    )
    with get_connection() as conn:
        conn.execute(
            sql,
            {
                "run_id": int(run_id),
                "rows_loaded": int(rows_loaded),
                "metadata": json.dumps(metadata) if metadata is not None else None,
            },
        )
        conn.commit()


def fail_run(run_id: int, error: str, metadata: dict[str, Any] | None = None) -> None:
    sql = text(
        """
        update raw.sync_runs
        set status = 'ERROR',
            finished_at = now(),
            error = :error,
            metadata = case
              when :metadata is null then metadata
              else cast(:metadata as jsonb)
            end
        where run_id = :run_id
        """
    )
    with get_connection() as conn:
        conn.execute(
            sql,
            {
                "run_id": int(run_id),
                "error": error[:4000],
                "metadata": json.dumps(metadata) if metadata is not None else None,
            },
        )
        conn.commit()


def replace_google_sheet_rows(
    *,
    run_id: int,
    source_name: str,
    spreadsheet_id: str,
    sheet_range: str,
    rows: Iterable[dict[str, Any]],
) -> int:
    rows = list(rows)
    delete_sql = text("delete from raw.mtr_google_sheet_rows where source_name = :source_name")
    insert_sql = text(
        """
        insert into raw.mtr_google_sheet_rows
          (run_id, source_name, spreadsheet_id, sheet_range, row_number, row_data)
        values
          (:run_id, :source_name, :spreadsheet_id, :sheet_range, :row_number, cast(:row_data as jsonb))
        """
    )

    with get_connection() as conn:
        conn.execute(delete_sql, {"source_name": source_name})
        for idx, row in enumerate(rows, start=1):
            conn.execute(
                insert_sql,
                {
                    "run_id": int(run_id),
                    "source_name": source_name,
                    "spreadsheet_id": spreadsheet_id,
                    "sheet_range": sheet_range,
                    "row_number": idx,
                    "row_data": json.dumps(row),
                },
            )
        conn.commit()

    return len(rows)


def latest_runs(limit: int = 20) -> list[dict[str, Any]]:
    ensure_sync_tables()
    sql = text(
        """
        select
          run_id,
          source_type,
          source_name,
          status,
          started_at,
          finished_at,
          rows_loaded,
          metadata,
          error
        from raw.sync_runs
        order by started_at desc
        limit :limit
        """
    )
    with get_connection() as conn:
        rows = conn.execute(sql, {"limit": int(limit)}).mappings().all()
    return [dict(r) for r in rows]


def _hours_since(value: Any) -> float | None:
    if value is None:
        return None
    if getattr(value, "tzinfo", None) is None:
        value = value.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return round((now - value.astimezone(timezone.utc)).total_seconds() / 3600, 2)


def latest_run_for(source_type: str, source_name: str | None = None) -> dict[str, Any] | None:
    ensure_sync_tables()
    sql = text(
        """
        select
          run_id,
          source_type,
          source_name,
          status,
          started_at,
          finished_at,
          rows_loaded,
          metadata,
          error
        from raw.sync_runs
        where source_type = :source_type
          and (:source_name is null or source_name = :source_name)
        order by started_at desc
        limit 1
        """
    )
    with get_connection() as conn:
        row = conn.execute(sql, {"source_type": source_type, "source_name": source_name}).mappings().first()
    return dict(row) if row else None


def health_snapshot() -> dict[str, Any]:
    ensure_sync_tables()

    with get_connection() as conn:
        mtr_raw = conn.execute(
            text(
                """
                select
                  count(*) as row_count,
                  max(inserted_at) as latest_inserted_at,
                  max(run_id) as latest_run_id
                from raw.mtr_google_sheet_rows
                """
            )
        ).mappings().one()

        jira_raw = conn.execute(
            text(
                """
                select
                  count(*) as row_count,
                  max(inserted_at) as latest_inserted_at
                from raw.jira_issues
                """
            )
        ).mappings().one()

        mart_rel = conn.execute(
            text("select to_regclass('analytics.mart_equipos_estado_actual') as relname")
        ).scalar()
        if mart_rel:
            mart = conn.execute(
                text(
                    """
                    select
                      count(*) as row_count,
                      max(_loaded_at) as latest_loaded_at
                    from analytics.mart_equipos_estado_actual
                    """
                )
            ).mappings().one()
        else:
            mart = {"row_count": 0, "latest_loaded_at": None}

        stg_jira_rel = conn.execute(
            text("select to_regclass('analytics.stg_jira_issues') as relname")
        ).scalar()
        if stg_jira_rel:
            stg_jira = conn.execute(
                text(
                    """
                    select
                      count(*) as row_count,
                      count(*) filter (where id_equipo is not null) as linked_rows,
                      max(inserted_at) as latest_inserted_at
                    from analytics.stg_jira_issues
                    """
                )
            ).mappings().one()
        else:
            stg_jira = {"row_count": 0, "linked_rows": 0, "latest_inserted_at": None}

        ml_rel = conn.execute(
            text("select to_regclass('ml.vw_scores_v2_latest') as relname")
        ).scalar()
        ml_latest_rel = conn.execute(
            text("select to_regclass('analytics.int_ml_scores_v2_latest') as relname")
        ).scalar()
        if ml_latest_rel:
            ml_v2_latest = conn.execute(
                text(
                    """
                    select
                      count(*) as row_count,
                      max(created_at) as latest_scored_at
                    from analytics.int_ml_scores_v2_latest
                    """
                )
            ).mappings().one()
        else:
            ml_v2_latest = {"row_count": 0, "latest_scored_at": None}

        if mart_rel:
            ml_v3_latest = conn.execute(
                text(
                    """
                    select
                      count(*) filter (where coalesce(ml_source_available_v3, false)) as row_count,
                      max(ml_scored_at_v3) filter (where coalesce(ml_source_available_v3, false)) as latest_scored_at
                    from analytics.mart_equipos_estado_actual
                    """
                )
            ).mappings().one()
        else:
            ml_v3_latest = {"row_count": 0, "latest_scored_at": None}

        ml_latest = dict(ml_v2_latest)
        if int(ml_latest.get("row_count") or 0) == 0 and int(ml_v3_latest.get("row_count") or 0) > 0:
            ml_latest = dict(ml_v3_latest)

    return {
        "sync_runs": {
            "google_sheets_mtr": latest_run_for("google_sheets", "mtr"),
            "jira_issue_snapshot_backfill": latest_run_for("jira", "issue_snapshot_backfill"),
        },
        "raw": {
            "mtr_google_sheet_rows": {
                **dict(mtr_raw),
                "freshness_hours": _hours_since(mtr_raw["latest_inserted_at"]),
            },
            "jira_issues": {
                **dict(jira_raw),
                "freshness_hours": _hours_since(jira_raw["latest_inserted_at"]),
            },
        },
        "analytics": {
            "stg_jira_issues": {
                **dict(stg_jira),
                "freshness_hours": _hours_since(stg_jira["latest_inserted_at"]),
            },
            "mart_equipos_estado_actual": {
                **dict(mart),
                "freshness_hours": _hours_since(mart["latest_loaded_at"]),
            },
        },
        "ml": {
            "source_relation_present": bool(ml_rel),
            "latest_relation_present": bool(ml_latest_rel),
            "latest_scores": {
                **dict(ml_latest),
                "freshness_hours": _hours_since(ml_latest["latest_scored_at"]),
            },
            "v2_latest_scores": {
                **dict(ml_v2_latest),
                "freshness_hours": _hours_since(ml_v2_latest["latest_scored_at"]),
            },
            "v3_latest_scores": {
                **dict(ml_v3_latest),
                "freshness_hours": _hours_since(ml_v3_latest["latest_scored_at"]),
            },
        },
    }
