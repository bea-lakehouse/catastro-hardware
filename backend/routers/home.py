from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

try:
    from backend.db.engine import engine
except ImportError:
    from db.engine import engine

try:
    from backend.services import sync_store
except ImportError:
    from services import sync_store

router = APIRouter(prefix="/home", tags=["Home"])
logger = logging.getLogger("uvicorn.error")
ROOT_DIR = Path(__file__).resolve().parents[2]
DBT_RUN_RESULTS_PATH = ROOT_DIR / "dbt_catastro" / "target" / "run_results.json"


def _jira_dashboard_enabled() -> bool:
    raw = os.getenv("CATASTRO_JIRA_ENABLED", "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _rows(conn, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    result = conn.execute(text(sql), params or {}).mappings().all()
    return [dict(r) for r in result]


def _row(conn, sql: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    result = conn.execute(text(sql), params or {}).mappings().first()
    return dict(result) if result else {}


def _relation_exists(conn, relation_name: str) -> bool:
    return bool(
        conn.execute(
            text("select to_regclass(:relation_name) is not null"),
            {"relation_name": relation_name},
        ).scalar()
    )


def _short_error(error: Any, limit: int = 160) -> str | None:
    if error is None:
        return None
    text_value = " ".join(str(error).split())
    if not text_value:
        return None
    if len(text_value) <= limit:
        return text_value
    return f"{text_value[: limit - 1].rstrip()}…"


def _sync_run(conn, source_type: str, source_name: str, *, success_only: bool = False) -> dict[str, Any]:
    status_filter = "and status = 'SUCCESS'" if success_only else ""
    return _row(
        conn,
        f"""
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
          and source_name = :source_name
          {status_filter}
        order by started_at desc
        limit 1
        """,
        {"source_type": source_type, "source_name": source_name},
    )


def _dbt_run_health() -> dict[str, Any]:
    if not DBT_RUN_RESULTS_PATH.exists():
        return {
            "status": "ERROR",
            "latest_attempt_at": None,
            "latest_success_at": None,
            "error_short": "No hay artefacto reciente de dbt run disponible.",
            "selected_models": [],
        }

    try:
        payload = json.loads(DBT_RUN_RESULTS_PATH.read_text())
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "ERROR",
            "latest_attempt_at": None,
            "latest_success_at": None,
            "error_short": _short_error(exc),
            "selected_models": [],
        }

    metadata = payload.get("metadata") or {}
    args = payload.get("args") or {}
    results = payload.get("results") or []
    statuses = {str(item.get("status") or "").lower() for item in results}
    failed = [item for item in results if str(item.get("status") or "").lower() not in {"success", "warn", "skipped"}]
    latest_attempt_at = metadata.get("generated_at") or metadata.get("invocation_started_at")
    latest_success_at = latest_attempt_at if not failed and results else None
    error_short = _short_error((failed[0] or {}).get("message")) if failed else None
    selected_models = [str(item) for item in args.get("select") or []]

    return {
        "status": "SUCCESS" if results and not failed and statuses else "ERROR",
        "latest_attempt_at": latest_attempt_at,
        "latest_success_at": latest_success_at,
        "error_short": error_short,
        "selected_models": selected_models,
    }


def _integration_status_label(status: str) -> str:
    return {
        "SUCCESS": "Operativo",
        "DEGRADED": "Modo degradado",
        "ERROR": "No disponible",
    }.get(status, "No disponible")


def _build_integration_health_card(
    *,
    key: str,
    title: str,
    status: str,
    headline: str,
    latest_attempt_at: Any = None,
    latest_success_at: Any = None,
    rows_processed: int | None = None,
    rows_basis: str | None = None,
    error_short: str | None = None,
    source_active: str | None = None,
    impact: str | None = None,
    suggested_action: str | None = None,
) -> dict[str, Any]:
    return {
        "key": key,
        "title": title,
        "status": status,
        "status_label": _integration_status_label(status),
        "headline": headline,
        "latest_attempt_at": latest_attempt_at,
        "latest_success_at": latest_success_at,
        "rows_processed": rows_processed,
        "rows_basis": rows_basis,
        "error_short": error_short,
        "source_active": source_active,
        "impact": impact,
        "suggested_action": suggested_action,
    }


def _mtr_disponibles_row(conn) -> dict[str, Any]:
    if _relation_exists(conn, "analytics.stg_mtr_google_sheet_equipos_disponibles"):
        return _row(
            conn,
            """
            select
              count(*) as disponibles_mtr,
              count(*) filter (
                where lower(coalesce(modelo, '')) like '%iphone%'
                   or lower(coalesce(modelo, '')) like '%galaxy%'
                   or lower(coalesce(modelo, '')) like '%vivo%'
                   or lower(coalesce(marca, '')) like '%vivo%'
              ) as disponibles_celulares,
              count(*) filter (where lower(coalesce(modelo, '')) like '%ipad%') as disponibles_tablets,
              count(*) filter (
                where not (
                  lower(coalesce(modelo, '')) like '%iphone%'
                  or lower(coalesce(modelo, '')) like '%galaxy%'
                  or lower(coalesce(modelo, '')) like '%vivo%'
                  or lower(coalesce(marca, '')) like '%vivo%'
                  or lower(coalesce(modelo, '')) like '%ipad%'
                )
              ) as disponibles_equipos
            from analytics.stg_mtr_google_sheet_equipos_disponibles
            """,
        )

    if _relation_exists(conn, "raw.mtr_equipos_disponibles"):
        return _row(
            conn,
            """
            select
              count(*) as disponibles_mtr,
              count(*) filter (
                where lower(coalesce(modelo,'')) like '%iphone%'
                   or lower(coalesce(modelo,'')) like '%galaxy%'
                   or lower(coalesce(modelo,'')) like '%vivo%'
                   or lower(coalesce(marca,'')) like '%vivo%'
              ) as disponibles_celulares,
              count(*) filter (where lower(coalesce(modelo,'')) like '%ipad%') as disponibles_tablets,
              count(*) filter (
                where not (
                  lower(coalesce(modelo,'')) like '%iphone%'
                  or lower(coalesce(modelo,'')) like '%galaxy%'
                  or lower(coalesce(modelo,'')) like '%vivo%'
                  or lower(coalesce(marca,'')) like '%vivo%'
                  or lower(coalesce(modelo,'')) like '%ipad%'
                )
              ) as disponibles_equipos
            from raw.mtr_equipos_disponibles
            """,
        )

    return {
        "disponibles_mtr": 0,
        "disponibles_celulares": 0,
        "disponibles_tablets": 0,
        "disponibles_equipos": 0,
    }


def _platform_case() -> str:
    return """
        case
          when lower(coalesce(marca, '')) like '%apple%'
            or lower(coalesce(modelo, '')) like '%mac%'
            then 'Mac'
          when lower(coalesce(marca, '')) like '%dell%'
            or lower(coalesce(marca, '')) like '%hp%'
            or lower(coalesce(marca, '')) like '%lenovo%'
            or lower(coalesce(last_event_detalle, '')) like '%windows%'
            then 'Windows'
          else 'Otros'
        end
    """


def _active_operational_predicate(alias: str = "") -> str:
    prefix = f"{alias}." if alias else ""
    return f"coalesce({prefix}es_activo_operativo, upper(coalesce({prefix}estado_operativo, 'ACTIVO')) <> 'BAJA')"


def _overview_block(conn) -> dict[str, Any]:
    active_expr = _active_operational_predicate()
    ml_risk_expr = "coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'Sin score')"
    ml_score_expr = "coalesce(ml_score_v3, ml_score, 0)"
    summary = _row(
        conn,
        f"""
        select
          count(*) filter (where {active_expr}) as activos_totales,
          count(*) filter (where {active_expr} and upper(coalesce(estado_operativo, '')) = 'ASIGNADO') as asignados,
          count(*) filter (where {active_expr} and upper(coalesce(estado_operativo, '')) in ('DISPONIBLE', 'STAND_BY')) as disponibles,
          count(*) filter (where not {active_expr}) as bajas,
          count(*) filter (where {active_expr} and coalesce(flag_sin_asignacion, false)) as sin_asignacion,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'Alta') as riesgo_alto,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'Media') as riesgo_medio,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'Baja') as riesgo_bajo,
          count(*) filter (where {active_expr} and coalesce(jira_open_count, 0) > 0) as equipos_con_jira,
          count(*) filter (where {active_expr} and {ml_score_expr} > 0) as equipos_con_ml,
          count(*) filter (where {active_expr} and coalesce(alertas_severidad, '') = 'CRITICAL') as alertas_criticas,
          count(*) filter (where {active_expr} and coalesce(alertas_severidad, '') = 'WARN') as alertas_warn,
          max(_loaded_at) as mart_actualizado_at
        from analytics.mart_equipos_estado_actual
        """,
    )

    if not _jira_dashboard_enabled():
        summary["equipos_con_jira"] = 0

    reconciliation = _reconciliation_summary(conn)
    summary.update(reconciliation)
    summary["riesgo_ml_disponible"] = bool(summary.get("equipos_con_ml"))
    return summary


def _reconciliation_summary(conn) -> dict[str, Any]:
    if _relation_exists(conn, "analytics.mart_confianza_dato"):
        summary = _row(
            conn,
            """
            select
              count(*) filter (where conciliacion_estado = 'CONCILIADO') as equipos_conciliados,
              count(*) filter (
                where conciliacion_estado in (
                  'ESTADO_DISTINTO',
                  'ASIGNADO_JIRA_DISPONIBLE_MTR',
                  'RESERVADO_JIRA_ASIGNADO_MTR',
                  'JIRA_SIN_MATCH_MTR',
                  'CREADO_JIRA_SIN_INGRESO_MTR'
                )
              ) as inconsistencias_mtr_jira,
              count(*) filter (where conciliacion_estado in ('JIRA_SIN_MATCH_MTR', 'JIRA_SOLO')) as jira_sin_match_mtr,
              count(*) filter (where conciliacion_estado in ('MTR_SIN_MATCH_JIRA', 'MTR_SOLO')) as mtr_sin_match_jira,
              count(*) filter (where conciliacion_estado = 'CREADO_JIRA_SIN_INGRESO_MTR') as creados_jira_sin_ingreso_mtr
            from analytics.mart_confianza_dato
            """,
        )

        extra = {
            "reservas_jira_pendientes": 0,
            "asignados_sin_respaldo_cruzado": 0,
        }

        if _relation_exists(conn, "analytics.mart_operacion_alertas"):
            extra = _row(
                conn,
                """
                select
                  count(*) filter (where tipo_alerta = 'jira_reservado_mtr_asignado') as reservas_jira_pendientes,
                  count(*) filter (
                    where tipo_alerta in (
                      'inconsistencia_operativa_mtr_jira',
                      'mtr_sin_jira',
                      'jira_reservado_mtr_asignado'
                    )
                  ) as asignados_sin_respaldo_cruzado
                from analytics.mart_operacion_alertas
                """,
            )

        return {
            "equipos_conciliados": int(summary.get("equipos_conciliados") or 0),
            "inconsistencias_mtr_jira": int(summary.get("inconsistencias_mtr_jira") or 0),
            "jira_sin_match_mtr": int(summary.get("jira_sin_match_mtr") or 0),
            "mtr_sin_match_jira": int(summary.get("mtr_sin_match_jira") or 0),
            "creados_jira_sin_ingreso_mtr": int(summary.get("creados_jira_sin_ingreso_mtr") or 0),
            "reservas_jira_pendientes": int(extra.get("reservas_jira_pendientes") or 0),
            "asignados_sin_respaldo_cruzado": int(extra.get("asignados_sin_respaldo_cruzado") or 0),
        }

    if not _relation_exists(conn, "analytics.mart_mtr_jira_reconciliacion"):
        return {
            "equipos_conciliados": 0,
            "inconsistencias_mtr_jira": 0,
            "jira_sin_match_mtr": 0,
            "mtr_sin_match_jira": 0,
            "creados_jira_sin_ingreso_mtr": 0,
            "reservas_jira_pendientes": 0,
            "asignados_sin_respaldo_cruzado": 0,
        }

    return _row(
        conn,
        """
        select
          count(*) filter (where conciliacion_estado = 'CONCILIADO') as equipos_conciliados,
          count(*) filter (where coalesce(flag_inconsistencia_mtr_jira, false)) as inconsistencias_mtr_jira,
          count(*) filter (where coalesce(flag_jira_sin_match_mtr, false)) as jira_sin_match_mtr,
          count(*) filter (where coalesce(flag_mtr_sin_match_jira, false)) as mtr_sin_match_jira,
          count(*) filter (where coalesce(flag_creado_jira_sin_ingreso_mtr, false)) as creados_jira_sin_ingreso_mtr,
          count(*) filter (where coalesce(flag_reserva_jira_pendiente, false)) as reservas_jira_pendientes,
          count(*) filter (where coalesce(flag_asignado_sin_respaldo_cruzado, false)) as asignados_sin_respaldo_cruzado
        from analytics.mart_mtr_jira_reconciliacion
        """,
    )


def _top_inconsistencias_fast(conn) -> list[dict[str, Any]]:
    if not _relation_exists(conn, "analytics.mart_operacion_alertas"):
        return []

    return _rows(
        conn,
        """
        select
          a.id_equipo,
          coalesce(nullif(m.cliente, ''), 'SIN_CLIENTE') as cliente,
          case
            when a.tipo_alerta = 'jira_reservado_mtr_asignado' then 'RESERVADO_JIRA_ASIGNADO_MTR'
            when a.tipo_alerta = 'creado_jira_sin_ingreso_mtr' then 'CREADO_JIRA_SIN_INGRESO_MTR'
            when a.tipo_alerta = 'jira_sin_mtr' then 'JIRA_SIN_MATCH_MTR'
            when a.tipo_alerta = 'mtr_sin_jira' then 'MTR_SIN_MATCH_JIRA'
            else 'ESTADO_DISTINTO'
          end as conciliacion_estado,
          coalesce(nullif(m.jira_estado_equipo, ''), 'SIN_ESTADO') as jira_estado,
          coalesce(nullif(m.estado_operativo, ''), 'SIN_ESTADO') as mtr_estado
        from analytics.mart_operacion_alertas a
        left join analytics.mart_equipos_estado_actual m
          on upper(m.id_equipo) = upper(a.id_equipo)
        where a.tipo_alerta in (
          'inconsistencia_operativa_mtr_jira',
          'mtr_sin_jira',
          'jira_sin_mtr',
          'creado_jira_sin_ingreso_mtr',
          'jira_reservado_mtr_asignado'
        )
        order by a.fecha_detectada desc nulls last, a.id_equipo asc
        limit 8
        """,
    )


def _operations_block(conn) -> dict[str, Any]:
    active_expr = _active_operational_predicate()
    top_clientes = _rows(
        conn,
        f"""
        select
          coalesce(nullif(cliente, ''), 'SIN_CLIENTE') as cliente,
          count(*) as equipos
        from analytics.mart_equipos_estado_actual
        where {active_expr}
        group by 1
        order by equipos desc, cliente asc
        limit 8
        """,
    )

    tipo_colaborador = _rows(
        conn,
        f"""
        select
          case
            when lower(coalesce(tipo_colaborador, '')) = 'core' then 'Core'
            when lower(coalesce(tipo_colaborador, '')) = 'staffing' then 'Staffing'
            else 'Otros'
          end as grupo,
          count(*) as equipos
        from analytics.mart_equipos_estado_actual
        where {active_expr}
        group by 1
        order by equipos desc, grupo asc
        """,
    )

    plataforma = _rows(
        conn,
        f"""
        select
          {_platform_case()} as grupo,
          count(*) as equipos
        from analytics.mart_equipos_estado_actual
        where {active_expr}
        group by 1
        order by equipos desc, grupo asc
        """,
    )

    senales = _row(
        conn,
        f"""
        select
          count(*) filter (where {active_expr} and coalesce(flag_sin_asignacion, false)) as sin_asignacion,
          count(*) filter (where not {active_expr}) as en_baja,
          count(*) filter (where {active_expr} and coalesce(priority_final_rank, 999) <= 25) as prioridad_alta,
          count(*) filter (
            where {active_expr}
              and (
                coalesce(alertas_severidad, '') in ('CRITICAL', 'WARN')
                or coalesce(jira_open_count, 0) > 0
              )
          ) as con_alerta_relevante
        from analytics.mart_equipos_estado_actual
        """,
    )

    focos = _rows(
        conn,
        f"""
        select
          id_equipo,
          coalesce(nullif(cliente, ''), 'SIN_CLIENTE') as cliente,
          coalesce(nullif(estado_operativo, ''), 'SIN_ESTADO') as estado_operativo,
          coalesce(priority_final_rank, 999) as priority_final_rank,
          coalesce(nullif(alertas_resumen, ''), 'Sin alertas') as alertas_resumen,
          coalesce(jira_open_count, 0) as jira_open_count,
          last_event_date
        from analytics.mart_equipos_estado_actual
        where {active_expr}
        order by priority_final_rank asc nulls last, priority_final_sort_key desc nulls last, id_equipo asc
        limit 8
        """,
    )

    return {
        "top_clientes": top_clientes,
        "tipo_colaborador": tipo_colaborador,
        "plataforma": plataforma,
        "senales": senales,
        "focos_operativos": focos,
    }


def _planning_block(conn) -> dict[str, Any]:
    active_expr = _active_operational_predicate()
    resumen = _row(
        conn,
        f"""
        select
          count(*) filter (where {active_expr} and coalesce(flag_renovar, false)) as renovar_mart,
          count(*) filter (where {active_expr} and coalesce(flag_renovar_regla, false)) as renovar_politica,
          count(*) filter (where {active_expr} and coalesce(flag_dar_baja_regla, false)) as salida_legacy,
          count(*) filter (where {active_expr} and coalesce(presion_nivel, '') = 'alta') as presion_alta,
          count(*) filter (where {active_expr} and coalesce(presion_nivel, '') = 'media') as presion_media,
          count(*) filter (where {active_expr} and coalesce(elegible_dev, false)) as elegibles_dev
        from analytics.mart_equipos_estado_actual
        """,
    )

    modelos_criticos = _rows(
        conn,
        f"""
        with normalizados as (
          select
            case
              when lower(coalesce(marca, '')) = 'apple'
               and lower(coalesce(modelo, '')) like '%a2141%'
                then 'Apple MacBook Pro - Model A2141'
              else coalesce(nullif(concat_ws(' ', marca, modelo), ''), 'SIN_MODELO')
            end as modelo,
            coalesce(nullif(accion_regla_modelo, ''), 'REVISAR') as accion
          from analytics.mart_equipos_estado_actual
          where {active_expr}
            and (
              coalesce(flag_renovar_regla, false)
              or coalesce(flag_dar_baja_regla, false)
            )
        )
        select
          modelo,
          accion,
          count(*) as equipos
        from normalizados
        group by 1, 2
        order by equipos desc, modelo asc
        limit 8
        """,
    )

    bolsa_acciones = _rows(
        conn,
        f"""
        select
          id_equipo,
          coalesce(nullif(cliente, ''), 'SIN_CLIENTE') as cliente,
          coalesce(nullif(concat_ws(' ', marca, modelo), ''), 'SIN_MODELO') as modelo,
          coalesce(nullif(accion_regla_modelo, ''), 'REVISAR') as accion,
          coalesce(priority_final_rank, 999) as priority_final_rank,
          coalesce(nullif(priority_final_motivo, ''), 'Sin motivo') as motivo
        from analytics.mart_equipos_estado_actual
        where {active_expr}
          and (
            coalesce(flag_renovar_regla, false)
            or coalesce(flag_dar_baja_regla, false)
            or coalesce(flag_sin_asignacion, false)
          )
        order by priority_final_rank asc nulls last, id_equipo asc
        limit 8
        """,
    )

    acciones_sugeridas: list[dict[str, Any]] = []
    if int(resumen.get("renovar_politica") or 0) > 0:
        acciones_sugeridas.append(
            {
                "titulo": "Priorizar renovación por política",
                "detalle": f"{int(resumen['renovar_politica'])} equipos ya entran en renovación por regla.",
            }
        )
    if int(resumen.get("salida_legacy") or 0) > 0:
        acciones_sugeridas.append(
            {
                "titulo": "Planificar salida de modelos legacy",
                "detalle": f"{int(resumen['salida_legacy'])} equipos aparecen marcados para baja/recambio por modelo.",
            }
        )
    if int(resumen.get("presion_alta") or 0) > 0 or int(resumen.get("presion_media") or 0) > 0:
        acciones_sugeridas.append(
            {
                "titulo": "Cruzar parque con presión de stock",
                "detalle": (
                    f"Presión alta: {int(resumen.get('presion_alta') or 0)}"
                    f" · presión media: {int(resumen.get('presion_media') or 0)}."
                ),
            }
        )
    if not acciones_sugeridas:
        acciones_sugeridas.append(
            {
                "titulo": "Sin acciones urgentes por política",
                "detalle": "Hoy no aparecen reglas activas de renovación o baja que obliguen un plan inmediato.",
            }
        )

    return {
        "resumen": resumen,
        "modelos_criticos": modelos_criticos,
        "bolsa_acciones": bolsa_acciones,
        "acciones_sugeridas": acciones_sugeridas,
    }


def _action_today_block(conn) -> dict[str, Any]:
    jira_enabled = _jira_dashboard_enabled()
    active_expr = _active_operational_predicate()
    acciones = _rows(
        conn,
        f"""
        with base as (
          select
            id_equipo,
            coalesce(nullif(cliente, ''), 'SIN_CLIENTE') as cliente,
            coalesce(nullif(concat_ws(' ', marca, modelo), ''), 'SIN_MODELO') as modelo,
            coalesce(nullif(estado_operativo, ''), 'SIN_ESTADO') as estado_operativo,
            coalesce(nullif(alertas_resumen, ''), 'Sin alertas') as alertas_resumen,
            coalesce(priority_final_rank, 999) as priority_final_rank,
            coalesce(nullif(priority_final_motivo, ''), 'Sin motivo') as priority_final_motivo,
            coalesce(jira_open_count, 0) as jira_open_count,
            coalesce(flag_sin_asignacion, false) as flag_sin_asignacion,
            coalesce(flag_renovar_regla, false) as flag_renovar_regla,
            coalesce(flag_dar_baja_regla, false) as flag_dar_baja_regla,
            coalesce(nullif(accion_regla_modelo, ''), 'REVISAR') as accion_regla_modelo,
            {active_expr} as es_activo_operativo
          from analytics.mart_equipos_estado_actual
        )
        select
          id_equipo,
          cliente,
          modelo,
          estado_operativo,
          alertas_resumen,
          priority_final_rank,
          priority_final_motivo,
          jira_open_count,
          case
            when jira_open_count > 0 then 'Revisar Jira'
            when flag_dar_baja_regla then 'Salida / recambio'
            when flag_renovar_regla then 'Renovar'
            when flag_sin_asignacion then 'Asignar o reasignar'
            else accion_regla_modelo
          end as accion_recomendada
        from base
        where es_activo_operativo
          and (
            jira_open_count > 0
            or flag_dar_baja_regla
            or flag_renovar_regla
            or flag_sin_asignacion
          )
        order by priority_final_rank asc, jira_open_count desc, id_equipo asc
        limit 12
        """,
    )

    if not jira_enabled:
        acciones = [
            {
                **item,
                "jira_open_count": 0,
            }
            for item in acciones
            if item.get("accion_recomendada") != "Revisar Jira"
        ]

    resumen = {
        "total": len(acciones),
        "sin_asignacion": sum(1 for item in acciones if item.get("accion_recomendada") == "Asignar o reasignar"),
        "renovar": sum(1 for item in acciones if item.get("accion_recomendada") == "Renovar"),
        "salida": sum(1 for item in acciones if item.get("accion_recomendada") == "Salida / recambio"),
        "jira": 0 if not jira_enabled else sum(1 for item in acciones if item.get("accion_recomendada") == "Revisar Jira"),
    }

    return {
        "resumen": resumen,
        "rows": acciones,
    }


def _integrations_block(conn) -> dict[str, Any]:
    sync_store.ensure_sync_tables()
    sync_rows = sync_store.latest_runs(limit=12)
    health_snapshot = sync_store.health_snapshot()
    jira_enabled = _jira_dashboard_enabled()

    latest_by_source: dict[str, dict[str, Any]] = {}
    for row in sync_rows:
        source_type = str(row.get("source_type") or "").strip().lower()
        if source_type and source_type not in latest_by_source:
            latest_by_source[source_type] = row

    google_attempt = _sync_run(conn, "google_sheets", "mtr")
    google_success = _sync_run(conn, "google_sheets", "mtr", success_only=True)
    jira_attempt = _sync_run(conn, "jira", "issue_snapshot_backfill")
    jira_success = _sync_run(conn, "jira", "issue_snapshot_backfill", success_only=True)
    dbt_health = _dbt_run_health()

    google_status = "SUCCESS" if str(google_attempt.get("status") or "").upper() == "SUCCESS" else "ERROR"
    google_health = _build_integration_health_card(
        key="google_sheets",
        title="Google Sheets / MTR",
        status=google_status,
        headline="Google Sheets operativo" if google_status == "SUCCESS" else "Google Sheets no disponible",
        latest_attempt_at=google_attempt.get("finished_at") or google_attempt.get("started_at"),
        latest_success_at=google_success.get("finished_at") or google_success.get("started_at"),
        rows_processed=int(google_success.get("rows_loaded") or 0) if google_success else None,
        rows_basis="última ejecución exitosa" if google_success else None,
        error_short=_short_error(google_attempt.get("error")) if google_status != "SUCCESS" else None,
        source_active="MTR / Google Sheets",
        impact=(
            "Catastro está leyendo la fuente principal del parque operativo."
            if google_status == "SUCCESS"
            else "La fuente principal del parque no pudo actualizarse y el dashboard puede mostrar datos anteriores."
        ),
        suggested_action=(
            "Sin acción inmediata."
            if google_status == "SUCCESS"
            else "Revisar conexión o permisos del Sheet."
        ),
    )

    jira_attempt_status = str(jira_attempt.get("status") or "").upper()
    jira_error = _short_error(jira_attempt.get("error"))
    jira_error_text = str(jira_attempt.get("error") or "").lower()
    jira_has_history = bool(jira_attempt or jira_success)
    jira_is_503 = "503" in jira_error_text or "service unavailable" in jira_error_text or "temporarily unavailable" in jira_error_text
    jira_is_auth_error = any(token in jira_error_text for token in ("401", "403", "unauthorized", "forbidden", "credencial", "token", "authentication", "rechazó"))

    if jira_attempt_status == "SUCCESS":
        jira_status = "SUCCESS"
        jira_message = "Jira operativo"
        jira_impact = "Catastro está mostrando workflow administrativo y validación cruzada actualizada."
        jira_action = "Sin acción inmediata."
    elif jira_is_503:
        jira_status = "DEGRADED"
        jira_message = "Jira temporalmente no disponible"
        jira_impact = "Catastro sigue operativo usando MTR / Google Sheets como fuente principal. Los componentes Jira se muestran como no actualizados."
        jira_action = "Reintentar sync más tarde."
    elif jira_is_auth_error:
        jira_status = "ERROR"
        jira_message = "Jira no disponible"
        jira_impact = "Catastro sigue operativo usando MTR / Google Sheets como fuente principal, pero sin actualización administrativa desde Jira."
        jira_action = "Revisar credenciales Jira."
    elif not jira_enabled and not jira_has_history:
        jira_status = "ERROR"
        jira_message = "Jira no disponible"
        jira_impact = "Catastro sigue operativo usando MTR / Google Sheets como fuente principal."
        jira_action = "Habilitar Jira cuando se requiera trazabilidad administrativa."
    else:
        jira_status = "ERROR"
        jira_message = "Jira no disponible"
        jira_impact = "Catastro sigue operativo usando MTR / Google Sheets como fuente principal, pero sin actualización administrativa desde Jira."
        jira_action = "Revisar el último error y reintentar el sync."

    jira_health = _build_integration_health_card(
        key="jira",
        title="Jira",
        status=jira_status,
        headline=jira_message,
        latest_attempt_at=jira_attempt.get("finished_at") or jira_attempt.get("started_at"),
        latest_success_at=jira_success.get("finished_at") or jira_success.get("started_at"),
        rows_processed=int(jira_success.get("rows_loaded") or 0) if jira_success else None,
        rows_basis="última ejecución exitosa" if jira_success else None,
        error_short=jira_error if jira_status != "SUCCESS" else None,
        source_active="MTR / Google Sheets" if jira_status != "SUCCESS" else "Jira + MTR / Google Sheets",
        impact=jira_impact,
        suggested_action=jira_action,
    )

    dbt_status = str(dbt_health.get("status") or "ERROR").upper()
    mart_health = (health_snapshot.get("analytics") or {}).get("mart_equipos_estado_actual") or {}
    dbt_health_card = _build_integration_health_card(
        key="dbt_marts",
        title="dbt marts",
        status=dbt_status,
        headline="dbt marts operativas" if dbt_status == "SUCCESS" else "dbt marts no disponibles",
        latest_attempt_at=dbt_health.get("latest_attempt_at"),
        latest_success_at=dbt_health.get("latest_success_at"),
        rows_processed=int(mart_health.get("row_count") or 0) if mart_health else None,
        rows_basis="filas visibles en mart actual" if mart_health else None,
        error_short=dbt_health.get("error_short"),
        source_active="analytics.mart_equipos_estado_actual",
        impact=(
            "Los paneles están consumiendo marts actualizadas."
            if dbt_status == "SUCCESS"
            else "Los paneles pueden quedar desalineados si la actualización de dbt no terminó correctamente."
        ),
        suggested_action="Sin acción inmediata." if dbt_status == "SUCCESS" else "Revisar el último dbt run.",
    )

    integration_health = [google_health, jira_health, dbt_health_card]
    degraded_mode_active = (
        jira_status in {"DEGRADED", "ERROR"}
        and google_status == "SUCCESS"
        and dbt_status == "SUCCESS"
    )

    if not jira_enabled and not jira_has_history:
        return {
            "ultimas_syncs": latest_by_source,
            "degraded_mode_active": degraded_mode_active,
            "health_cards": integration_health,
            "jira": {
                "available": False,
                "message": jira_message,
                "top_equipos": [],
                "board_summary": [],
                "board_cards": [],
                "equipos_con_issues": 0,
                "issues_abiertos": 0,
                "max_dias_issue_abierto": None,
                "ultimo_evento_jira_at": None,
                "reconciliation": _reconciliation_summary(conn),
                "top_inconsistencias": [],
            },
        }

    if _relation_exists(conn, "raw.jira_issues"):
        jira_resumen = _row(
            conn,
            """
            with issue_rollup as (
              select
                upper(id_equipo) as id_equipo,
                count(*) as jira_open_count,
                max((current_date - coalesce(created_at::date, current_date))::int) as jira_days_open_max
              from analytics.stg_jira_issues
              where nullif(trim(coalesce(id_equipo, '')), '') is not null
              group by 1
            )
            select
              (select count(*) from issue_rollup) as equipos_con_issues,
              (select count(*) from analytics.stg_jira_issues) as issues_abiertos,
              (select max(jira_days_open_max) from issue_rollup) as max_dias_issue_abierto,
              (select max(updated_at) from analytics.stg_jira_issues) as ultimo_evento_jira_at
            """,
        )

        jira_top = _rows(
            conn,
            """
            with issue_rollup as (
              select
                upper(id_equipo) as id_equipo,
                count(*) as jira_open_count,
                max((current_date - coalesce(created_at::date, current_date))::int) as jira_days_open_max
              from analytics.stg_jira_issues
              where nullif(trim(coalesce(id_equipo, '')), '') is not null
              group by 1
            )
            select
              r.id_equipo,
              coalesce(nullif(m.cliente, ''), 'SIN_CLIENTE') as cliente,
              r.jira_open_count,
              r.jira_days_open_max,
              coalesce(m.priority_final_rank, 999) as priority_final_rank
            from issue_rollup r
            left join analytics.mart_equipos_estado_actual m
              on upper(m.id_equipo) = r.id_equipo
            order by r.jira_open_count desc, priority_final_rank asc, r.id_equipo asc
            limit 6
            """,
        )

        jira_board = _rows(
            conn,
            """
            with board as (
              select
                coalesce(nullif(board_bucket, ''), 'SIN_BUCKET') as bucket,
                count(*) as issues
              from raw.jira_issues
              group by 1
            )
            select
              bucket,
              issues
            from board
            order by issues desc, bucket asc
            """,
        )
    else:
        jira_resumen = _row(
            conn,
            """
            select
              count(*) filter (where coalesce(jira_open_count, 0) > 0) as equipos_con_issues,
              sum(coalesce(jira_open_count, 0)) as issues_abiertos,
              max(jira_days_open_max) as max_dias_issue_abierto,
              max(jira_last_event_at) as ultimo_evento_jira_at
            from analytics.mart_equipos_estado_actual
            """,
        )

        jira_top = _rows(
            conn,
            """
            select
              id_equipo,
              coalesce(nullif(cliente, ''), 'SIN_CLIENTE') as cliente,
              coalesce(jira_open_count, 0) as jira_open_count,
              jira_days_open_max,
              coalesce(priority_final_rank, 999) as priority_final_rank
            from analytics.mart_equipos_estado_actual
            where coalesce(jira_open_count, 0) > 0
            order by jira_open_count desc, priority_final_rank asc, id_equipo asc
            limit 6
            """,
        )

        jira_board = _rows(
            conn,
            """
            with board as (
              select
                coalesce(nullif(jira_board_bucket, ''), 'SIN_BUCKET') as bucket,
                sum(coalesce(jira_open_count, 0)) as issues
              from analytics.mart_equipos_estado_actual
              where coalesce(jira_open_count, 0) > 0
              group by 1
            )
            select
              bucket,
              issues
            from board
            order by issues desc, bucket asc
            """,
        )
    top_inconsistencias = _top_inconsistencias_fast(conn)

    mtr_disponibles = _mtr_disponibles_row(conn)
    reconciliation = _reconciliation_summary(conn)

    bucket_counts = {str(row.get("bucket") or "SIN_BUCKET"): int(row.get("issues") or 0) for row in jira_board}
    jira_board_cards = [
        {
            "title": "Disponibilidad y recuperación",
            "detail": "Cruce entre disponible operativo actual en MTR y casos abiertos por recuperar en Jira.",
            "metrics": [
                {"label": "Disponibles MTR", "value": int(mtr_disponibles.get("disponibles_mtr") or 0), "href": "/activos?estado=DISPONIBLE"},
                {"label": "Equipos", "value": int(mtr_disponibles.get("disponibles_equipos") or 0), "href": "/activos?estado=DISPONIBLE&clase=equipo"},
                {"label": "Celulares", "value": int(mtr_disponibles.get("disponibles_celulares") or 0), "href": "/activos?estado=DISPONIBLE&clase=celular"},
                {"label": "Tablets", "value": int(mtr_disponibles.get("disponibles_tablets") or 0), "href": "/activos?estado=DISPONIBLE&clase=tablet"},
                {"label": "Por recuperar", "value": bucket_counts.get("POR_RECUPERAR", 0), "href": "/activos?jira_bucket=POR_RECUPERAR"},
            ],
        },
        {
            "title": "Asignación y resguardo",
            "detail": "Cards activas visibles hoy en el board Jira operativo.",
            "metrics": [
                {"label": "Asignados", "value": bucket_counts.get("ASIGNADO", 0), "href": "/activos?jira_bucket=ASIGNADO"},
                {"label": "Reservados", "value": bucket_counts.get("RESERVADO", 0), "href": "/activos?jira_bucket=RESERVADO"},
                {"label": "Resguardos", "value": bucket_counts.get("RESGUARDO", 0), "href": "/activos?jira_bucket=RESGUARDO"},
                {"label": "En progreso", "value": bucket_counts.get("EN_PROGRESO", 0), "href": "/activos?jira_bucket=EN_PROGRESO"},
            ],
        },
        {
            "title": "Estados críticos",
            "detail": "Casos que apuntan a salida, desperfecto u obsolescencia en el board.",
            "metrics": [
                {"label": "Defectuosos", "value": bucket_counts.get("DEFECTUOSO", 0), "href": "/activos?jira_bucket=DEFECTUOSO"},
                {"label": "Obsoletos", "value": bucket_counts.get("OBSOLETO", 0), "href": "/activos?jira_bucket=OBSOLETO"},
                {"label": "Dado de baja", "value": bucket_counts.get("BAJA", 0), "href": "/activos?jira_bucket=BAJA"},
            ],
        },
    ]

    return {
        "ultimas_syncs": latest_by_source,
        "degraded_mode_active": degraded_mode_active,
        "health_cards": integration_health,
        "jira": {
            "available": jira_status == "SUCCESS",
            "message": None if jira_status == "SUCCESS" else jira_message,
            **jira_resumen,
            "top_equipos": jira_top,
            "board_summary": jira_board,
            "board_cards": jira_board_cards,
            "reconciliation": reconciliation,
            "top_inconsistencias": top_inconsistencias,
        },
    }


@router.get("/dashboard")
def home_dashboard():
    payload: dict[str, Any] = {
        "overview": None,
        "operations": None,
        "planning": None,
        "integrations": None,
        "errors": {},
    }

    with engine.connect() as conn:
        for key, builder in (
            ("overview", _overview_block),
            ("action_today", _action_today_block),
            ("operations", _operations_block),
            ("planning", _planning_block),
            ("integrations", _integrations_block),
        ):
            try:
                payload[key] = builder(conn)
            except Exception as exc:  # noqa: BLE001 - queremos degradar por bloque
                logger.exception("home_dashboard block failed: %s", key)
                payload["errors"][key] = "No fue posible cargar este bloque con datos actuales."

    return payload


@router.get("/equipos")
def home_equipos(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    severidad: str | None = None,
    estado: str | None = None,
    riesgo_ml: str | None = None,
    has_ml: bool | None = None,
    search: str | None = None,
):
    filters = []
    params = {"limit": limit, "offset": offset}

    if severidad:
        filters.append("alertas_severidad = :severidad")
        params["severidad"] = severidad

    if estado:
        filters.append("estado_equipo = :estado")
        params["estado"] = estado

    if riesgo_ml:
        filters.append("ml_risk_level = :riesgo_ml")
        params["riesgo_ml"] = riesgo_ml

    if has_ml is True:
        filters.append("ml_score IS NOT NULL")
    if has_ml is False:
        filters.append("ml_score IS NULL")

    if search:
        filters.append(
            """
            (
              id_equipo ILIKE :search
              OR coalesce(
                nullif(to_jsonb(t)->>'persona_asignada',''),
                nullif(to_jsonb(t)->>'asignado_a',''),
                nullif(to_jsonb(t)->>'persona',''),
                nullif(to_jsonb(t)->>'responsable',''),
                nullif(to_jsonb(t)->>'owner',''),
                nullif(to_jsonb(t)->>'persona_responsable','')
              ) ILIKE :search
              OR cliente ILIKE :search
            )
            """
        )
        params["search"] = f"%{search}%"

    where_clause = "WHERE " + " AND ".join(filters) if filters else ""

    sql = f"""
        SELECT *
        FROM analytics.mart_equipos_estado_actual t
        {where_clause}
        ORDER BY
            priority_rank ASC,
            ml_score DESC NULLS LAST,
            dias_a_vencer ASC NULLS LAST
        LIMIT :limit OFFSET :offset
    """

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().all()

    def _pick_persona(r: dict[str, Any]):
        for k in (
            "last_event_persona",
            "persona_asignada",
            "asignado_a",
            "persona",
            "responsable",
            "owner",
            "persona_responsable",
        ):
            v = r.get(k)
            if v is not None and str(v).strip() != "":
                return v
        return None

    rows = [dict(r) for r in rows]
    for r in rows:
        r["persona_asignada"] = _pick_persona(r)

    for r in rows:
        cliente = (r.get("cliente") or "").lower().strip()

        if cliente == "acid labs":
            r["tipo_colaborador"] = "core"
            r["factor_colaborador"] = 1
            r["segmento_destino"] = "core"
            r["motivo_tipo_colaborador"] = "Cliente Acid Labs => CORE"
        elif cliente == "latam":
            r["tipo_colaborador"] = "staffing"
            r["factor_colaborador"] = -1
            r["segmento_destino"] = "staffing"
            r["motivo_tipo_colaborador"] = "Cliente Latam => STAFFING"

    return {
        "limit": limit,
        "offset": offset,
        "count": len(rows),
        "rows": rows,
    }


@router.get("/kpis")
def home_kpis():
    sql = text(
        """
        SELECT
            count(*) AS equipos_total,
            count(*) FILTER (WHERE alertas_severidad = 'CRITICAL') AS criticos,
            count(*) FILTER (WHERE alertas_severidad = 'WARN')     AS warn,
            count(*) FILTER (WHERE alertas_severidad = 'INFO')     AS info,
            count(*) FILTER (WHERE flag_renovar)          AS renovar,
            count(*) FILTER (WHERE flag_rotacion_alta)    AS rotacion_alta,
            count(*) FILTER (WHERE flag_sin_asignacion)   AS sin_asignacion,
            count(*) FILTER (WHERE ml_score IS NOT NULL)  AS con_ml,
            count(*) FILTER (WHERE ml_risk_level = 'Alta') AS riesgo_ml_alto
        FROM analytics.mart_equipos_estado_actual
        """
    )

    with engine.connect() as conn:
        row = dict(conn.execute(sql).mappings().first())

    return row
