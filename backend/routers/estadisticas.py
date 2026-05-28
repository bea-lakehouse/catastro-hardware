import logging
import os
import re
from typing import Any
from datetime import date, datetime, timedelta
from math import ceil
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import inspect, text as sql_text, bindparam
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text

try:
    from backend.db.engine import get_engine
except ImportError:
    from db.engine import get_engine

try:
    from backend.services.ml_v3 import build_ml_versions_payload, build_ml_v3_summary
except ImportError:
    from services.ml_v3 import build_ml_versions_payload, build_ml_v3_summary

router = APIRouter(prefix="/estadisticas", tags=["estadisticas"])
engine = get_engine()




logger = logging.getLogger("uvicorn.error")


MTR_EXECUTIVE_SOURCE = (
    "analytics.int_mtr_eventos_dedup_stats + analytics.fct_movimientos_detalle + "
    "analytics.stg_mtr_google_sheet_equipos_disponibles + analytics.mart_equipos_estado_actual"
)

SANTIAGO_TZ = ZoneInfo("America/Santiago")
MTR_STOCK_OVERRIDE_BY_MONTH: dict[date, dict[str, Any]] = {}
MTR_OPERATIONAL_HORIZON_DAYS = int(os.getenv("MTR_OPERATIONAL_HORIZON_DAYS", "7"))


def _today_santiago() -> date:
    return datetime.now(SANTIAGO_TZ).date()


def _month_start(value: date | None = None) -> date:
    base = value or _today_santiago()
    return base.replace(day=1)


def _operational_today_santiago() -> date:
    return _today_santiago() + timedelta(days=MTR_OPERATIONAL_HORIZON_DAYS)


def _operational_month_start() -> date:
    return _month_start(_operational_today_santiago())


def _next_month_start(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _month_state(value: date | None) -> str | None:
    if value is None:
        return None
    return "en_curso" if value >= _operational_month_start() else "cerrado"


def _decorate_month_row(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    mes_value = out.get("mes")
    estado_mes = out.get("estado_mes") or _month_state(mes_value)
    fecha_ultima_actualizacion = out.get("fecha_ultima_actualizacion") or out.get("acumulado_hasta")
    total_ingresos = _first_non_empty(out.get("total_ingresos"), out.get("ingresos"), out.get("mtr_ingresos_total"), 0)
    total_salidas = _first_non_empty(out.get("total_salidas"), out.get("salidas"), out.get("mtr_salidas_total"), 0)
    stock_disponible = _first_non_empty(
        out.get("stock_disponible"),
        out.get("oferta_disponible_mes"),
        out.get("disponibles_mtr_actual"),
        out.get("disponibles_equipos_actual"),
        0,
    )
    gap = _first_non_empty(out.get("gap"), out.get("gap_operativo_estimado"), out.get("gap_vs_oferta_actual_ref"), 0)

    out["estado_mes"] = estado_mes
    out["fecha_ultima_actualizacion"] = fecha_ultima_actualizacion
    out["fuente"] = out.get("fuente") or MTR_EXECUTIVE_SOURCE
    out["total_ingresos"] = int(total_ingresos or 0)
    out["total_salidas"] = int(total_salidas or 0)
    out["ingresos_mtr_original"] = int(out.get("ingresos_mtr_original") or out.get("mtr_ingresos_total") or 0)
    out["ingresos_personas"] = int(_first_non_empty(out.get("ingresos_personas"), out.get("total_ingresos"), out.get("ingresos"), out.get("mtr_ingresos_total"), 0) or 0)
    out["salidas_mtr_original"] = int(out.get("salidas_mtr_original") or out.get("mtr_salidas_total") or 0)
    out["salidas_personas"] = int(_first_non_empty(out.get("salidas_personas"), out.get("total_salidas"), out.get("salidas"), out.get("mtr_salidas_total"), 0) or 0)
    out["movimientos_internos"] = int(out.get("movimientos_internos") or 0)
    out["movimientos_internos_sin_impacto"] = int(_first_non_empty(out.get("movimientos_internos_sin_impacto"), out.get("ingresos_internos"), 0) or 0)
    out["cambios_equipo_real"] = int(out.get("cambios_equipo_real") or 0)
    out["ingresos_hardware"] = int(out.get("ingresos_hardware") or 0)
    out["reasignaciones_hardware"] = int(out.get("reasignaciones_hardware") or 0)
    out["equipos_reutilizados"] = int(_first_non_empty(out.get("equipos_reutilizados"), out.get("reasignaciones_hardware"), 0) or 0)
    out["equipos_retornados"] = int(_first_non_empty(out.get("equipos_retornados"), out.get("devoluciones_hardware"), out.get("devoluciones"), out.get("salidas_hardware"), 0) or 0)
    out["equipos_baja"] = int(out.get("equipos_baja") or 0)
    out["salidas_hardware"] = int(out.get("salidas_hardware") or 0)
    out["devoluciones_hardware"] = int(_first_non_empty(out.get("devoluciones_hardware"), out.get("devoluciones"), out.get("salidas_hardware"), 0) or 0)
    out["nuevos_con_equipo"] = int(_first_non_empty(out.get("nuevos_con_equipo"), out.get("ingresos_nuevos_con_equipo"), 0) or 0)
    out["nuevos_sin_equipo"] = int(_first_non_empty(out.get("nuevos_sin_equipo"), out.get("ingresos_nuevos_sin_equipo"), 0) or 0)
    out["nacionales_con_equipo_asignado"] = int(out.get("nacionales_con_equipo_asignado") or 0)
    out["nacionales_pendientes_equipo"] = int(out.get("nacionales_pendientes_equipo") or 0)
    out["internacionales_con_equipo_asignado"] = int(out.get("internacionales_con_equipo_asignado") or 0)
    out["internacionales_sin_equipo_no_requerido"] = int(out.get("internacionales_sin_equipo_no_requerido") or 0)
    out["personas_resueltas_con_equipo"] = int(
        _first_non_empty(
            out.get("personas_resueltas_con_equipo"),
            out["ingresos_personas"] - out["nuevos_sin_equipo"],
            0,
        ) or 0
    )
    out["asignaciones"] = int(out.get("asignaciones") or 0)
    out["devoluciones"] = int(out.get("devoluciones") or 0)
    out["presion_compra"] = int(out.get("presion_compra") or 0)
    out["stock_disponible"] = int(stock_disponible or 0)
    out["gap"] = int(gap or 0)
    out["delta_ingresos_vs_mtr_original"] = int(out.get("delta_ingresos_vs_mtr_original") or (out["ingresos_personas"] - out["ingresos_mtr_original"]))
    out["delta_salidas_vs_mtr_original"] = int(out.get("delta_salidas_vs_mtr_original") or (out["salidas_personas"] - out["salidas_mtr_original"]))
    conteo_validado = out.get("conteo_validado_mtr_original")
    if conteo_validado is None:
        conteo_validado = (
            out["delta_ingresos_vs_mtr_original"] == 0
            and out["delta_salidas_vs_mtr_original"] == 0
        )
    out["conteo_validado_mtr_original"] = bool(conteo_validado)
    out["estado_validacion_mtr_original"] = (
        out.get("estado_validacion_mtr_original")
        or ("VALIDADO" if out["conteo_validado_mtr_original"] else "PENDIENTE_CONCILIACION")
    )
    out["cambios_equipo_real_base"] = int(out.get("cambios_equipo_real_base") or 0)
    out["cambios_reemplazos_mtr"] = (
        int(out["cambios_reemplazos_mtr"])
        if out.get("cambios_reemplazos_mtr") is not None
        else None
    )
    out["override_manual_aplicado"] = bool(out.get("override_manual_aplicado") or False)
    out["override_scope"] = out.get("override_scope")
    out["override_note"] = out.get("override_note")
    coherencia_operacional = out.get("coherencia_operacional_ingresos")
    if coherencia_operacional is None:
        coherencia_operacional = (
            out["ingresos_personas"]
            == out["movimientos_internos_sin_impacto"]
            + out["nuevos_con_equipo"]
            + out["nuevos_sin_equipo"]
            + out["internacionales_sin_equipo_no_requerido"]
        )
    out["coherencia_operacional_ingresos"] = bool(coherencia_operacional)
    out["estado_coherencia_operacional"] = (
        out.get("estado_coherencia_operacional")
        or ("COHERENTE" if out["coherencia_operacional_ingresos"] else "REVISAR_SEMANTICA")
    )

    override = MTR_STOCK_OVERRIDE_BY_MONTH.get(_month_start(mes_value) if isinstance(mes_value, date) else None)
    if override:
        out["stock_disponible"] = int(override["stock_disponible"])
        if "disponibles_mtr_actual" in out:
            out["disponibles_mtr_actual"] = int(override["disponibles_mtr_actual"])
        if "disponibles_equipos_actual" in out:
            out["disponibles_equipos_actual"] = int(override["disponibles_equipos_actual"])
        out["override_manual_aplicado"] = True
        out["override_scope"] = override["override_scope"]
        existing_note = str(out.get("override_note") or "").strip()
        override_note = str(override["override_note"]).strip()
        out["override_note"] = (
            f"{existing_note} {override_note}".strip() if existing_note and override_note not in existing_note else override_note
        )

    if estado_mes == "en_curso" and out["fecha_ultima_actualizacion"] is None:
        out["fecha_ultima_actualizacion"] = _operational_today_santiago()

    out["is_mes_en_curso"] = estado_mes == "en_curso"
    out["hasta_fecha"] = out["fecha_ultima_actualizacion"] if estado_mes == "en_curso" else None
    return out


def _internal_api_error(context: str, exc: Exception) -> HTTPException:
    logger.exception("%s failed", context)
    return HTTPException(status_code=500, detail=f"{context} failed")


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _active_operational_predicate(has_column, alias: str = "") -> str:
    prefix = f"{alias}." if alias else ""
    if has_column("es_activo_operativo"):
        return f"coalesce({prefix}es_activo_operativo, true)"
    if has_column("estado_operativo"):
        return f"coalesce(upper(nullif(trim({prefix}estado_operativo), '')), 'ACTIVO') <> 'BAJA'"
    return "true"


def _ml_driver_summary(drivers: Any) -> str | None:
    if drivers is None:
        return None
    if isinstance(drivers, dict):
        pieces = []
        for key, value in drivers.items():
            if value in (None, "", [], {}):
                continue
            label = str(key).replace("_", " ").strip()
            if isinstance(value, (int, float)):
                pieces.append(f"{label}: {value}")
            elif isinstance(value, list):
                flat = [str(x).strip() for x in value if str(x).strip()]
                if flat:
                  pieces.append(f"{label}: {', '.join(flat[:3])}")
            else:
                pieces.append(f"{label}: {value}")
        return " · ".join(pieces[:3]) if pieces else None
    if isinstance(drivers, list):
        flat = [str(x).strip() for x in drivers if str(x).strip()]
        return " · ".join(flat[:3]) if flat else None
    return str(drivers).strip() or None


def _ml_explain_summary(alert_code: Any, motivo: Any, drivers: Any) -> str | None:
    return _first_non_empty(motivo, alert_code, _ml_driver_summary(drivers))


def _gap_recommendation(empresa: str, pressure_score: float) -> tuple[str, str]:
    if pressure_score < 1:
        return ("Presión baja", "La cobertura inmediata sigue siendo suficiente para la demanda reciente.")
    if pressure_score <= 1.5:
        return ("Presión media", "La cobertura inmediata está ajustada y conviene monitorear el siguiente ciclo estratégico.")
    if empresa == "Acid Labs":
        return ("Presión alta", "La presión actual es alta y valida activar la estrategia bimensual de compra.")
    if empresa == "2Brains":
        return ("Presión alta", "La presión actual es alta y valida activar la estrategia planificada de compra.")
    return ("Presión alta", "La cobertura inmediata está por debajo de la presión operativa reciente.")


def _gap_no_pressure_recommendation() -> tuple[str, str]:
    return (
        "Sin presión activa",
        "No hay presión MTR reciente que active compra inmediata; la brecha visible corresponde solo al colchón mínimo de resguardo.",
    )


def _analytics_relation_names(insp) -> set[str]:
    names: set[str] = set()
    try:
        names.update(insp.get_table_names(schema="analytics"))
    except Exception:
        pass
    try:
        names.update(insp.get_view_names(schema="analytics"))
    except Exception:
        pass
    return names


def _build_mtr_detail_cte(insp) -> str:
    relation_names = _analytics_relation_names(insp)
    candidates = [
        "stg_mtr_google_sheet_equipos_asignados",
        "stg_mtr_equipos_asignados",
        "stg_mtr_equipos_asignados_detalle",
    ]

    relation = next((name for name in candidates if name in relation_names), None)
    if relation is None:
        return """
        mtr_detail as (
            select
                null::text as id_equipo,
                null::text as cliente,
                null::text as persona_asignada,
                null::text as tipo_colaborador,
                null::text as marca,
                null::text as modelo,
                null::text as localizacion,
                null::text as ciudad_comuna,
                null::text as condicion,
                null::text as plataforma
            where 1 = 0
        )
        """

    try:
        rel_cols = {c["name"] for c in insp.get_columns(relation, schema="analytics")}
    except Exception:
        rel_cols = set()

    def txt(col: str) -> str:
        return f"nullif(trim({col}), '')" if col in rel_cols else "null::text"

    tipo_exprs = []
    if "tipo_colaborador" in rel_cols:
        tipo_exprs.append("nullif(trim(tipo_colaborador), '')")
    if "tipo_colaborador_mtr" in rel_cols:
        tipo_exprs.append("nullif(trim(tipo_colaborador_mtr), '')")
    tipo_expr = f"coalesce({', '.join(tipo_exprs)})" if tipo_exprs else "null::text"

    return f"""
        mtr_detail as (
            select
                upper(id_equipo) as id_equipo,
                {txt('cliente')} as cliente,
                {txt('persona_asignada')} as persona_asignada,
                {tipo_expr} as tipo_colaborador,
                {txt('marca')} as marca,
                {txt('modelo')} as modelo,
                {txt('localizacion')} as localizacion,
                {txt('ciudad_comuna')} as ciudad_comuna,
                {txt('condicion')} as condicion,
                {txt('plataforma')} as plataforma
            from analytics.{relation}
            where id_equipo is not null
        )
        """


def _movement_current_month_relation(insp) -> str:
    relation_names = _analytics_relation_names(insp)
    if "int_mtr_eventos_dedup_stats" in relation_names:
        return "analytics.int_mtr_eventos_dedup_stats"
    if "stg_mtr_eventos_clean" in relation_names:
        return "analytics.stg_mtr_eventos_clean"
    return "analytics.mart_historia_eventos"

def _apply_backfill_xlsx(c, rows):
    """Backfill modelo_txt/mac_win/condicion desde analytics.equipos_backfill_xlsx.
    Devuelve dict con stats para debug (temporal).
    """
    stats = {
        'nrows': len(rows),
        'need': 0,
        'table_count': None,
        'got_rows': 0,
        'hit_rows': 0,
        'sample': [],
        'error': None
}
    try:
        need = []
        for r in rows:
            sku = r.get('id_equipo') or r.get('equipo_asignado_actual')
            if not sku:
                continue
            if (r.get('modelo_txt') is None) or (r.get('mac_win') is None) or (r.get('condicion') is None):
                need.append(str(sku).strip().upper())

        if not need:
            return stats

        skus = sorted(set([x for x in need if x]))
        stats['need'] = len(skus)
        stats['sample'] = skus[:8]

        try:
            stats['table_count'] = c.execute(sql_text('select count(*)::int from analytics.equipos_backfill_xlsx')).scalar() or 0
        except Exception as e:
            stats['error'] = f'table_count: {e!r}'

        q = sql_text(
            """
            select upper(id_equipo) as id_equipo, modelo_txt, mac_win, condicion
            from analytics.equipos_backfill_xlsx
            where upper(id_equipo) in :ids
            """
        ).bindparams(bindparam('ids', expanding=True))

        bf_rows = c.execute(q, {'ids': skus}).mappings().all()
        stats['got_rows'] = len(bf_rows)
        bf = {str(x['id_equipo']).upper(): dict(x) for x in bf_rows}

        hit = 0
        for r in rows:
            key = str((r.get('id_equipo') or r.get('equipo_asignado_actual') or '')).strip().upper()
            if not key:
                continue
            x = bf.get(key)
            if not x:
                continue
            changed = False
            if r.get('modelo_txt') is None and x.get('modelo_txt'):
                r['modelo_txt'] = x['modelo_txt']; changed = True
            if r.get('mac_win') is None and x.get('mac_win'):
                r['mac_win'] = x['mac_win']; changed = True
            if r.get('condicion') is None and x.get('condicion'):
                r['condicion'] = x['condicion']; changed = True
            if changed:
                hit += 1

        stats['hit_rows'] = hit
        return stats
    except Exception as e:
        stats['error'] = f'backfill: {e!r}'
        return stats

def _has_table(engine, schema: str, name: str) -> bool:
    try:
        insp = inspect(engine)
        schema = schema or "public"
        return (name in insp.get_table_names(schema=schema)) or (name in insp.get_view_names(schema=schema))
    except Exception:
        return False


def _mtr_disponibles_sql() -> str:
    if _has_table(engine, "analytics", "stg_mtr_google_sheet_equipos_disponibles"):
        return """
        select
          count(*) as disponibles_mtr_actual,
          count(*) filter (
            where lower(coalesce(modelo, '')) like '%iphone%'
               or lower(coalesce(modelo, '')) like '%galaxy%'
               or lower(coalesce(modelo, '')) like '%vivo%'
               or lower(coalesce(marca, '')) like '%vivo%'
          ) as disponibles_celulares_actual,
          count(*) filter (where lower(coalesce(modelo, '')) like '%ipad%') as disponibles_tablets_actual,
          count(*) filter (
            where not (
              lower(coalesce(modelo, '')) like '%iphone%'
              or lower(coalesce(modelo, '')) like '%galaxy%'
              or lower(coalesce(modelo, '')) like '%vivo%'
              or lower(coalesce(marca, '')) like '%vivo%'
              or lower(coalesce(modelo, '')) like '%ipad%'
            )
          ) as disponibles_equipos_actual
        from analytics.stg_mtr_google_sheet_equipos_disponibles
        """

    if _has_table(engine, "raw", "mtr_equipos_disponibles"):
        return """
        select
          count(*) as disponibles_mtr_actual,
          count(*) filter (
            where lower(coalesce(modelo,'')) like '%iphone%'
               or lower(coalesce(modelo,'')) like '%galaxy%'
               or lower(coalesce(modelo,'')) like '%vivo%'
               or lower(coalesce(marca,'')) like '%vivo%'
          ) as disponibles_celulares_actual,
          count(*) filter (where lower(coalesce(modelo,'')) like '%ipad%') as disponibles_tablets_actual,
          count(*) filter (
            where not (
              lower(coalesce(modelo,'')) like '%iphone%'
              or lower(coalesce(modelo,'')) like '%galaxy%'
              or lower(coalesce(modelo,'')) like '%vivo%'
              or lower(coalesce(marca,'')) like '%vivo%'
              or lower(coalesce(modelo,'')) like '%ipad%'
            )
          ) as disponibles_equipos_actual
        from raw.mtr_equipos_disponibles
        """

    return """
    select
      0 as disponibles_mtr_actual,
      0 as disponibles_celulares_actual,
      0 as disponibles_tablets_actual,
      0 as disponibles_equipos_actual
    """


@router.get("/movimientos-mes")
def movimientos_mes(limit: int = 12):
    return movimientos_mes_2026(limit=limit)


@router.get("/resumen-operacion-mensual")
def resumen_operacion_mensual(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    current_month = _operational_month_start()
    date_from = date_from or date(current_month.year, 1, 1)
    date_to = date_to or current_month
    sql = f"""
    with meses as (
      select generate_series(
        date_trunc('month', cast(:date_from as date)),
        date_trunc('month', cast(:date_to as date)),
        interval '1 month'
      )::date as mes
    ),
    mtr as (
      select
        mes::date as mes,
        coalesce(total_ingresos, 0) as ingresos,
        coalesce(total_salidas, 0) as salidas,
        coalesce(stock_activo, 0) as stock_activo
      from analytics.mart_estadistica_movimientos_mes_v2
      where mes >= date_trunc('month', cast(:date_from as date))
        and mes <= date_trunc('month', cast(:date_to as date))
    ),
    sku_mes as (
      select
        m.mes,
        e.id_equipo,
        max(e.fecha_evento) as max_fecha_evento
      from meses m
      join analytics.mart_historia_eventos e
        on e.fecha_evento < (m.mes + interval '1 month')
      group by 1, 2
    ),
    cierre as (
      select
        s.mes,
        e.id_equipo,
        upper(coalesce(e.tipo_evento, '')) as tipo_evento
      from sku_mes s
      join analytics.mart_historia_eventos e
        on e.id_equipo = s.id_equipo
       and e.fecha_evento = s.max_fecha_evento
    ),
    snapshot_historico as (
      select
        m.mes,
        count(*) filter (where c.tipo_evento = 'ASIGNACION') as equipos_asignados,
        count(*) filter (where c.tipo_evento = 'DEVOLUCION') as equipos_disponibles,
        count(*) filter (where c.tipo_evento in ('RECUPERAR', 'POR RECUPERAR', 'RECUPERADO')) as equipos_por_recuperar
      from meses m
      left join cierre c on c.mes = m.mes
      group by 1
    ),
    jira_actual as (
      select
        count(*) filter (where coalesce(jira_open_count, 0) > 0) as equipos_con_issues_jira,
        sum(coalesce(jira_open_count, 0)) as issues_jira_abiertos,
        count(*) filter (where upper(coalesce(jira_board_bucket, '')) = 'POR_RECUPERAR') as jira_por_recuperar
      from analytics.mart_equipos_estado_actual
    ),
    mtr_actual as (
      {_mtr_disponibles_sql()}
    )
    select
      m.mes,
      coalesce(mt.ingresos, 0) as ingresos,
      coalesce(mt.salidas, 0) as salidas,
      coalesce(sn.equipos_asignados, 0) as equipos_asignados_historico,
      coalesce(sn.equipos_disponibles, 0) as equipos_disponibles_historico,
      coalesce(sn.equipos_por_recuperar, 0) as equipos_por_recuperar_historico,
      coalesce(mt.stock_activo, 0) as stock_activo,
      coalesce(j.equipos_con_issues_jira, 0) as equipos_con_issues_jira,
      coalesce(j.issues_jira_abiertos, 0) as issues_jira_abiertos,
      coalesce(j.jira_por_recuperar, 0) as jira_por_recuperar_actual,
      coalesce(ma.disponibles_mtr_actual, 0) as disponibles_mtr_actual,
      coalesce(ma.disponibles_equipos_actual, 0) as disponibles_equipos_actual,
      coalesce(ma.disponibles_celulares_actual, 0) as disponibles_celulares_actual,
      coalesce(ma.disponibles_tablets_actual, 0) as disponibles_tablets_actual
    from meses m
    left join mtr mt on mt.mes = m.mes
    left join snapshot_historico sn on sn.mes = m.mes
    cross join jira_actual j
    cross join mtr_actual ma
    order by m.mes asc
    """

    sql_board_actual = (
    """
    select
      coalesce(nullif(jira_board_bucket_top, ''), 'SIN_BUCKET') as bucket,
      sum(coalesce(jira_open_count, 0)) as issues
    from analytics.mart_mtr_jira_reconciliacion
    where coalesce(in_jira, false)
      and coalesce(jira_open_count, 0) > 0
    group by 1
    order by issues desc, bucket asc
    """
    if _has_table(engine, "analytics", "mart_mtr_jira_reconciliacion")
    else
    """
    select
      coalesce(nullif(jira_board_bucket, ''), 'SIN_BUCKET') as bucket,
      sum(coalesce(jira_open_count, 0)) as issues
      from analytics.mart_equipos_estado_actual
    where coalesce(jira_open_count, 0) > 0
    group by 1
    order by issues desc, bucket asc
    """
    )

    sql_jira_mensual = """
    with meses as (
      select generate_series(
        date_trunc('month', cast(:date_from as date)),
        date_trunc('month', cast(:date_to as date)),
        interval '1 month'
      )::date as mes
    ),
    creados as (
      select
        date_trunc('month', created_at)::date as mes,
        count(*) as issues_creados,
        count(distinct id_equipo) filter (where id_equipo is not null) as equipos_con_issue_nuevo
      from analytics.stg_jira_issues
      where created_at is not null
        and created_at::date >= cast(:date_from as date)
        and created_at::date <= cast(:date_to as date)
      group by 1
    ),
    actualizados as (
      select
        date_trunc('month', updated_at)::date as mes,
        count(*) as issues_actualizados
      from analytics.stg_jira_issues
      where updated_at is not null
        and updated_at::date >= cast(:date_from as date)
        and updated_at::date <= cast(:date_to as date)
      group by 1
    ),
    cerrados as (
      select
        date_trunc('month', status_category_changed_at)::date as mes,
        count(*) filter (where lower(coalesce(status_category_key, '')) = 'done') as issues_cerrados
      from analytics.stg_jira_issues
      where status_category_changed_at is not null
        and status_category_changed_at::date >= cast(:date_from as date)
        and status_category_changed_at::date <= cast(:date_to as date)
      group by 1
    )
    select
      m.mes,
      coalesce(c.issues_creados, 0) as issues_creados,
      coalesce(c.equipos_con_issue_nuevo, 0) as equipos_con_issue_nuevo,
      coalesce(a.issues_actualizados, 0) as issues_actualizados,
      coalesce(x.issues_cerrados, 0) as issues_cerrados
    from meses m
    left join creados c on c.mes = m.mes
    left join actualizados a on a.mes = m.mes
    left join cerrados x on x.mes = m.mes
    order by m.mes asc
    """

    sql_month_meta = """
    select
      mes,
      estado_mes,
      fecha_ultima_actualizacion,
      fuente,
      total_ingresos,
      total_salidas,
      ingresos_mtr_original,
      ingresos_personas,
      salidas_mtr_original,
      salidas_personas,
      movimientos_internos,
      movimientos_internos_sin_impacto,
      cambios_equipo_real_base,
      cambios_reemplazos_mtr,
      ingresos_hardware,
      reasignaciones_hardware,
      equipos_reutilizados,
      cambios_equipo_real,
      cambios_equipo_real_base,
      cambios_reemplazos_mtr,
      devoluciones_hardware,
      equipos_retornados,
      equipos_baja,
      nuevos_con_equipo,
      nuevos_sin_equipo,
      presion_compra,
      stock_disponible,
      gap,
      override_manual_aplicado,
      override_scope,
      override_note,
      delta_ingresos_vs_mtr_original,
      delta_salidas_vs_mtr_original,
      conteo_validado_mtr_original,
      estado_validacion_mtr_original
    from analytics.mart_estadistica_movimientos_mes_v2
    where mes >= date_trunc('month', cast(:date_from as date))
      and mes <= date_trunc('month', cast(:date_to as date))
    """

    try:
        with engine.connect() as c:
            rows = [dict(r._mapping) for r in c.execute(sql_text(sql), {"date_from": date_from, "date_to": date_to}).fetchall()]
            board_actual = [dict(r._mapping) for r in c.execute(sql_text(sql_board_actual)).fetchall()]
            jira_mensual = [dict(r._mapping) for r in c.execute(sql_text(sql_jira_mensual), {"date_from": date_from, "date_to": date_to}).fetchall()]
            month_meta_rows = [dict(r._mapping) for r in c.execute(sql_text(sql_month_meta), {"date_from": date_from, "date_to": date_to}).fetchall()]
            if _has_table(engine, "analytics", "mart_confianza_dato"):
                reconciliation = dict(c.execute(sql_text("""
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
                """)).mappings().one())

                extra = (
                    dict(c.execute(sql_text("""
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
                    """)).mappings().one())
                    if _has_table(engine, "analytics", "mart_operacion_alertas")
                    else {
                        "reservas_jira_pendientes": 0,
                        "asignados_sin_respaldo_cruzado": 0,
                    }
                )

                reconciliation.update(extra)
            elif _has_table(engine, "analytics", "mart_mtr_jira_reconciliacion"):
                reconciliation = dict(c.execute(sql_text("""
                    select
                      count(*) filter (where conciliacion_estado = 'CONCILIADO') as equipos_conciliados,
                      count(*) filter (where coalesce(flag_inconsistencia_mtr_jira, false)) as inconsistencias_mtr_jira,
                      count(*) filter (where coalesce(flag_jira_sin_match_mtr, false)) as jira_sin_match_mtr,
                      count(*) filter (where coalesce(flag_mtr_sin_match_jira, false)) as mtr_sin_match_jira,
                      count(*) filter (where coalesce(flag_creado_jira_sin_ingreso_mtr, false)) as creados_jira_sin_ingreso_mtr,
                      count(*) filter (where coalesce(flag_reserva_jira_pendiente, false)) as reservas_jira_pendientes,
                      count(*) filter (where coalesce(flag_asignado_sin_respaldo_cruzado, false)) as asignados_sin_respaldo_cruzado
                    from analytics.mart_mtr_jira_reconciliacion
                """)).mappings().one())
            else:
                reconciliation = {
                    "equipos_conciliados": 0,
                    "inconsistencias_mtr_jira": 0,
                    "jira_sin_match_mtr": 0,
                    "mtr_sin_match_jira": 0,
                    "creados_jira_sin_ingreso_mtr": 0,
                    "reservas_jira_pendientes": 0,
                    "asignados_sin_respaldo_cruzado": 0,
                }

        meta_by_month = {row["mes"]: row for row in month_meta_rows}
        rows = [
            _decorate_month_row({
                **row,
                **(meta_by_month.get(row.get("mes")) or {}),
            })
            for row in rows
        ]

        ultimo = rows[-1] if rows else {}
        board_index = {str(r.get("bucket") or "SIN_BUCKET"): int(r.get("issues") or 0) for r in board_actual}
        return {
            "date_from": date_from,
            "date_to": date_to,
            "count": len(rows),
            "rows": rows,
            "operacion_actual": {
                "mtr_disponibles_total": int(ultimo.get("disponibles_mtr_actual") or 0),
                "mtr_disponibles_equipos": int(ultimo.get("disponibles_equipos_actual") or 0),
                "mtr_disponibles_celulares": int(ultimo.get("disponibles_celulares_actual") or 0),
                "mtr_disponibles_tablets": int(ultimo.get("disponibles_tablets_actual") or 0),
                "jira_por_recuperar": int(ultimo.get("jira_por_recuperar_actual") or 0),
                "jira_equipos_con_issues": int(ultimo.get("equipos_con_issues_jira") or 0),
                "jira_issues_abiertos": int(ultimo.get("issues_jira_abiertos") or 0),
                "jira_board": board_actual,
                "jira_board_index": board_index,
                "delta_disponibles_mtr_vs_jira": int(ultimo.get("disponibles_mtr_actual") or 0) - int(board_index.get("DISPONIBLE", 0) or 0),
                "reconciliacion": reconciliation,
            },
            "jira_mensual": jira_mensual,
        }
    except SQLAlchemyError as e:
        raise _internal_api_error("resumen_operacion_mensual", e)


@router.get("/movimientos-mes-2026")
def movimientos_mes_2026(limit: int = 12):
    visible_month_end = _next_month_start(_operational_month_start())
    sql = """
    select
      mes,
      estado_mes,
      fecha_ultima_actualizacion,
      fuente,
      movimientos_total,
      asignaciones,
      movimientos_internos,
      total_ingresos,
      total_salidas,
      ingresos_personas,
      salidas_personas,
      movimientos_internos_sin_impacto,
      ingresos_hardware,
      reasignaciones_hardware,
      equipos_reutilizados,
      cambios_equipo_real,
      devoluciones_hardware,
      equipos_retornados,
      equipos_baja,
      nuevos_con_equipo,
      nuevos_sin_equipo,
      presion_compra,
      stock_disponible,
      gap,
      mtr_ingresos_total,
      ingresos_mtr_original,
      mtr_salidas_total,
      salidas_mtr_original,
      movimientos_ytd,
      override_manual_aplicado,
      override_scope,
      override_note,
      delta_ingresos_vs_mtr_original,
      delta_salidas_vs_mtr_original,
      conteo_validado_mtr_original,
      estado_validacion_mtr_original,
      pct_movimientos_100,
      pct_movimientos_ytd_100,
      mix_asignaciones_100,
      stock_activo,
      insight_mtr,
      insight_movimientos,
      insight_mix,
      insight_delta
    from analytics.mart_estadistica_movimientos_mes
    where mes >= date_trunc('year', current_date)::date
      and mes < :visible_month_end
    order by mes asc
    limit :limit
    """
    try:
        with engine.connect() as c:
            rows = [
                _decorate_month_row(dict(r._mapping))
                for r in c.execute(
                    sql_text(sql),
                    {"limit": int(limit), "visible_month_end": visible_month_end},
                ).fetchall()
            ]
        return {"rows": rows}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/asignaciones-mes")
def asignaciones_mtr_mes(
    mes: date,
    limit: int = 500,
):
    """
    Asignaciones por mes (fuente MTR0602).
    - Base: analytics."mtr_equipos_asignados.csv.from_MTR0602"
    - Enrich: analytics.stg_mtr_equipos_asignados_detalle (marca/modelo/nro_serie/tipo_colaborador)
    """
    engine = get_engine()

    sql_rows = r"""
    with raw as (
      select
        nullif(trim("Empleado Asignado"), '') as persona,
        nullif(trim("Cliente"), '') as cliente,
        concat('SKU-', nullif(trim(("SKU")::text), '')) as id_equipo,
        nullif(trim("Sistema Operativo"), '') as os,
        nullif(trim("Condición"), '') as condicion,
        nullif(trim("Localización"), '') as ubicacion,
        nullif(trim("Ciudad/Comuna"), '') as ciudad_comuna,
        nullif(trim("Tipo de colaborador"), '') as tipo_colaborador_mtr,
        nullif(regexp_replace(trim("Fecha de Asignación"), '\s+', ' ', 'g'), '') as fecha_txt,
        "Fecha de Asignación #1" as fecha_ts
      from analytics."mtr_equipos_asignados.csv.from_MTR0602"
    ),
    tokenized as (
      select
        *,
        substring(
          fecha_txt
          from '([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}|[0-9]{1,2}-[0-9]{1,2}-[0-9]{4})'
        ) as fecha_token
      from raw
    ),
    norm as (
      select *,
        case
          when fecha_ts is not null then fecha_ts::date
          when fecha_token ~ '^\d{4}-\d{2}-\d{2}$'
               and to_char(to_date(fecha_token, 'YYYY-MM-DD'), 'YYYY-MM-DD') = fecha_token
            then to_date(fecha_token, 'YYYY-MM-DD')
          when fecha_token ~ '^\d{1,2}/\d{1,2}/\d{4}$'
               and split_part(fecha_token, '/', 2)::int > 12
               and to_char(
                 to_date(
                   lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3),
                   'MM/DD/YYYY'
                 ),
                 'MM/DD/YYYY'
               ) = lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3)
            then to_date(
              lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
              lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
              split_part(fecha_token, '/', 3),
              'MM/DD/YYYY'
            )
          when fecha_token ~ '^\d{1,2}/\d{1,2}/\d{4}$'
               and to_char(
                 to_date(
                   lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3),
                   'DD/MM/YYYY'
                 ),
                 'DD/MM/YYYY'
               ) = lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3)
            then to_date(
              lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
              lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
              split_part(fecha_token, '/', 3),
              'DD/MM/YYYY'
            )
          when fecha_token ~ '^\d{1,2}-\d{1,2}-\d{4}$'
               and to_char(
                 to_date(
                   lpad(split_part(fecha_token, '-', 1), 2, '0') || '-' ||
                   lpad(split_part(fecha_token, '-', 2), 2, '0') || '-' ||
                   split_part(fecha_token, '-', 3),
                   'DD-MM-YYYY'
                 ),
                 'DD-MM-YYYY'
               ) = lpad(split_part(fecha_token, '-', 1), 2, '0') || '-' ||
                   lpad(split_part(fecha_token, '-', 2), 2, '0') || '-' ||
                   split_part(fecha_token, '-', 3)
            then to_date(
              lpad(split_part(fecha_token, '-', 1), 2, '0') || '-' ||
              lpad(split_part(fecha_token, '-', 2), 2, '0') || '-' ||
              split_part(fecha_token, '-', 3),
              'DD-MM-YYYY'
            )
          else null
        end as fecha_asignacion
      from tokenized
      where id_equipo is not null and id_equipo <> 'SKU-'
    ),
    enriched as (
      select
        n.fecha_asignacion,
        n.persona,
        n.cliente,
        n.id_equipo,
        coalesce(nullif(n.os,''), nullif(d.sistema_operativo,'')) as sistema_operativo,
        coalesce(nullif(n.condicion,''), nullif(d.condicion,'')) as condicion,
        coalesce(nullif(d.tipo_colaborador,''), n.tipo_colaborador_mtr) as tipo_colaborador,
        n.ubicacion,
        n.ciudad_comuna,
        nullif(d.marca,'') as marca,
        nullif(d.modelo,'') as modelo,
        nullif(d.nro_serie,'') as nro_serie
      from norm n
      left join analytics.stg_mtr_equipos_asignados_detalle d
        on d.id_equipo = n.id_equipo
        or ('SKU-' || d.sku::text) = n.id_equipo
        or d.sku::text = regexp_replace(n.id_equipo, '^SKU-', '')
    )
    select *
    from enriched
    where fecha_asignacion >= :mes
      and fecha_asignacion <  (:mes + interval '1 month')
    order by fecha_asignacion, persona
    limit :limit
    """

    sql_count = r"""
    with raw as (
      select
        concat('SKU-', nullif(trim(("SKU")::text), '')) as id_equipo,
        nullif(regexp_replace(trim("Fecha de Asignación"), '\s+', ' ', 'g'), '') as fecha_txt,
        "Fecha de Asignación #1" as fecha_ts
      from analytics."mtr_equipos_asignados.csv.from_MTR0602"
    ),
    tokenized as (
      select
        *,
        substring(
          fecha_txt
          from '([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}|[0-9]{1,2}-[0-9]{1,2}-[0-9]{4})'
        ) as fecha_token
      from raw
    ),
    norm as (
      select
        case
          when fecha_ts is not null then fecha_ts::date
          when fecha_token ~ '^\d{4}-\d{2}-\d{2}$'
               and to_char(to_date(fecha_token, 'YYYY-MM-DD'), 'YYYY-MM-DD') = fecha_token
            then to_date(fecha_token, 'YYYY-MM-DD')
          when fecha_token ~ '^\d{1,2}/\d{1,2}/\d{4}$'
               and split_part(fecha_token, '/', 2)::int > 12
               and to_char(
                 to_date(
                   lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3),
                   'MM/DD/YYYY'
                 ),
                 'MM/DD/YYYY'
               ) = lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3)
            then to_date(
              lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
              lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
              split_part(fecha_token, '/', 3),
              'MM/DD/YYYY'
            )
          when fecha_token ~ '^\d{1,2}/\d{1,2}/\d{4}$'
               and to_char(
                 to_date(
                   lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3),
                   'DD/MM/YYYY'
                 ),
                 'DD/MM/YYYY'
               ) = lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
                   lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
                   split_part(fecha_token, '/', 3)
            then to_date(
              lpad(split_part(fecha_token, '/', 1), 2, '0') || '/' ||
              lpad(split_part(fecha_token, '/', 2), 2, '0') || '/' ||
              split_part(fecha_token, '/', 3),
              'DD/MM/YYYY'
            )
          when fecha_token ~ '^\d{1,2}-\d{1,2}-\d{4}$'
               and to_char(
                 to_date(
                   lpad(split_part(fecha_token, '-', 1), 2, '0') || '-' ||
                   lpad(split_part(fecha_token, '-', 2), 2, '0') || '-' ||
                   split_part(fecha_token, '-', 3),
                   'DD-MM-YYYY'
                 ),
                 'DD-MM-YYYY'
               ) = lpad(split_part(fecha_token, '-', 1), 2, '0') || '-' ||
                   lpad(split_part(fecha_token, '-', 2), 2, '0') || '-' ||
                   split_part(fecha_token, '-', 3)
            then to_date(
              lpad(split_part(fecha_token, '-', 1), 2, '0') || '-' ||
              lpad(split_part(fecha_token, '-', 2), 2, '0') || '-' ||
              split_part(fecha_token, '-', 3),
              'DD-MM-YYYY'
            )
          else null
        end as fecha_asignacion
      from tokenized
      where id_equipo is not null and id_equipo <> 'SKU-'
    )
    select count(*)::int as n
    from norm
    where fecha_asignacion >= :mes
      and fecha_asignacion <  (:mes + interval '1 month')
    """

    try:
        with engine.connect() as c:
            rows = [
                dict(r._mapping)
                for r in c.execute(sql_text(sql_rows), {"mes": mes, "limit": int(limit)}).fetchall()
            ]
            n = c.execute(sql_text(sql_count), {"mes": mes}).scalar() or 0
        return {"mes": mes, "count": int(n), "rows": rows}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/cambios-equipo-mes")
def cambios_equipo_mes(
    mes: date = Query(..., description="Mes en formato YYYY-MM-01"),
    limit: int = Query(500, ge=1, le=5000),
):
    """
    Cambios de equipo reales inferidos desde la secuencia de ingresos MTR por persona.
    Se considera cambio cuando una persona recibe un SKU distinto al último SKU visible antes del mes consultado.
    """
    sql = """
    with historia_persona as (
      select
        fecha_evento_dia as fecha_evento,
        fecha_evento_dia::date as fecha,
        upper(trim(persona)) as persona_key,
        nullif(trim(persona), '') as persona,
        coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE') as cliente,
        upper(nullif(trim(id_equipo), '')) as id_equipo,
        nullif(trim(marca), '') as marca,
        nullif(trim(modelo), '') as modelo,
        row_number() over (
          partition by upper(trim(persona)), fecha_evento_dia::date, upper(coalesce(id_equipo, ''))
          order by fecha_evento_dia asc
        ) as rn
      from analytics.int_mtr_eventos_dedup_stats
      where tipo_evento = 'INGRESO'
        and nullif(trim(persona), '') is not null
        and nullif(trim(id_equipo), '') is not null
        and fecha_evento_dia < (:mes + interval '1 month')
    ),
    ordenada as (
      select *
      , lag(id_equipo) over (
          partition by persona_key
          order by fecha_evento, id_equipo
        ) as equipo_anterior
      , lag(marca) over (
          partition by persona_key
          order by fecha_evento, id_equipo
        ) as marca_anterior
      , lag(modelo) over (
          partition by persona_key
          order by fecha_evento, id_equipo
        ) as modelo_anterior
      from historia_persona
      where rn = 1
    ),
    cambios_mes as (
      select
        fecha,
        persona,
        cliente,
        equipo_anterior,
        marca_anterior,
        modelo_anterior,
        id_equipo as equipo_nuevo,
        marca as marca_nueva,
        modelo as modelo_nuevo
      from ordenada
      where date_trunc('month', fecha_evento)::date = :mes
    )
    select
      fecha,
      persona,
      cliente,
      equipo_anterior,
      coalesce(nullif(concat_ws(' ', marca_anterior, modelo_anterior), ''), equipo_anterior) as detalle_anterior,
      equipo_nuevo,
      coalesce(nullif(concat_ws(' ', marca_nueva, modelo_nuevo), ''), equipo_nuevo) as detalle_nuevo,
      'analytics.int_mtr_eventos_dedup_stats'::text as fuente
    from cambios_mes
    where equipo_anterior is not null
      and equipo_nuevo is not null
      and equipo_anterior <> equipo_nuevo
    order by fecha desc, persona asc
    limit :limit
    """

    try:
        with engine.connect() as c:
            rows = [dict(r._mapping) for r in c.execute(sql_text(sql), {"mes": mes, "limit": int(limit)}).fetchall()]
        return {
            "mes": mes,
            "estado_mes": _month_state(mes),
            "fecha_ultima_actualizacion": max((row.get("fecha") for row in rows), default=None),
            "count": len(rows),
            "rows": rows,
            "source": "analytics.int_mtr_eventos_dedup_stats",
        }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/core-extranjeros-mes")
def core_extranjeros_mes(
    mes: date,
    limit: int = 500,
):
    """
    Movimientos internos (Core Extranjeros).
    Fuente preferida: analytics.fct_movimientos_detalle
    Nota: esta fuente NO tiene ubicaciones; se devuelven como null.
    """
    engine = get_engine()

    sql_rows = r"""
    with base as (
      select
        fecha::date as fecha,
        nullif(trim(id_equipo::text), '') as id_equipo_raw,

        case
          when nullif(trim(id_equipo), '') is null then null
          when lower(trim(id_equipo)) like 'sku-%' then
            'SKU-' || regexp_replace(regexp_replace(trim(id_equipo), '^SKU-|^sku-', ''), '\.0$', '')
          else
            'SKU-' || regexp_replace(trim(id_equipo), '\.0$', '')
        end as id_equipo,

        nullif(trim(tipo_movimiento), '') as tipo_movimiento,
        nullif(trim(cliente_origen), '') as cliente_origen,
        nullif(trim(cliente_destino), '') as cliente_destino,
        nullif(trim(persona_destino), '') as persona,
        nullif(trim(plataforma), '') as plataforma,
        coalesce(es_extranjero, false) as es_extranjero
      from analytics.fct_movimientos_detalle
      where fecha >= :mes
        and fecha <  (:mes + interval '1 month')
    ),
    core_extr as (
      select *
      from base
      where es_extranjero = true
        and lower(coalesce(plataforma,'')) = 'core'
    ),
    final as (
      select
        fecha,
        id_equipo,
        persona,
        cliente_origen,
        cliente_destino,
        cast(null as text) as ubicacion_origen,
        cast(null as text) as ubicacion_destino,
        case
          when cliente_origen is distinct from cliente_destino then 'cambio_cliente'
          else 'otro'
        end as tipo
      from core_extr
    )
    select *
    from final
    order by fecha, persona, id_equipo
    limit :limit
    """

    sql_kpis = r"""
    with base as (
      select
        fecha::date as fecha,
        nullif(trim(cliente_origen), '') as cliente_origen,
        nullif(trim(cliente_destino), '') as cliente_destino,
        nullif(trim(plataforma), '') as plataforma,
        coalesce(es_extranjero, false) as es_extranjero
      from analytics.fct_movimientos_detalle
      where fecha >= :mes
        and fecha <  (:mes + interval '1 month')
    ),
    core_extr as (
      select *
      from base
      where es_extranjero = true
        and lower(coalesce(plataforma,'')) = 'core'
    )
    select
      count(*)::int as movimientos,
      sum(case when cliente_origen is distinct from cliente_destino then 1 else 0 end)::int as cambios_cliente,
      0::int as cambios_ubicacion
    from core_extr
    """

    try:
        with engine.connect() as c:
            rows = [
                dict(r._mapping)
                for r in c.execute(sql_text(sql_rows), {"mes": mes, "limit": int(limit)}).fetchall()
            ]
            k = c.execute(sql_text(sql_kpis), {"mes": mes}).mappings().first() or {}
        return {
            "mes": mes,
            "count": int(k.get("movimientos", 0) or 0),
            "kpis": {
                "movimientos": int(k.get("movimientos", 0) or 0),
                "cambios_cliente": int(k.get("cambios_cliente", 0) or 0),
                "cambios_ubicacion": int(k.get("cambios_ubicacion", 0) or 0)
},
            "rows": rows,
            "fuente": "analytics.fct_movimientos_detalle"
}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/movimientos-internos-core-extranjeros-mes")
def movimientos_internos_core_extranjeros_mes(
    mes: date,
    limit: int = 500,
):
    """
    Movimientos internos del universo "Core Extranjeros" en el mes.
    Fuente: views analytics.mart_movimientos_internos_core_extranjeros_* (estables).
    """
    engine = get_engine()

    sql_rows = """
      select
        mes,
        fecha,
        id_equipo,
        persona,
        cliente_origen,
        cliente_destino,
        ubicacion_origen,
        ubicacion_destino,
        tipo
      from analytics.mart_movimientos_internos_core_extranjeros_detalle_mes
      where mes = :mes
      order by fecha, persona, id_equipo
      limit :limit
    """

    sql_kpi = """
      select
        mes,
        movimientos_total,
        movimientos_internos,
        cambios_cliente
      from analytics.mart_movimientos_internos_core_extranjeros_mes
      where mes = :mes
    """

    try:
        with engine.connect() as c:
            rows = [dict(r._mapping) for r in c.execute(sql_text(sql_rows), {"mes": mes, "limit": int(limit)}).fetchall()]
            k = c.execute(sql_text(sql_kpi), {"mes": mes}).mappings().first() or {}
        return {
            "mes": mes,
            "count": int(k.get("movimientos_total", 0) or 0),
            "kpis": {
                "movimientos": int(k.get("movimientos_total", 0) or 0),
                "movimientos_internos": int(k.get("movimientos_internos", 0) or 0),
                "cambios_cliente": int(k.get("cambios_cliente", 0) or 0)
},
            "rows": rows,
            "fuente": "analytics.mart_movimientos_internos_core_extranjeros_*"
}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")



@router.get("/asignaciones-count")
def asignaciones_count(mes: date):
    engine = get_engine()
    sql = """
      with params as (
        select
          date_trunc('month', :mes)::date as mes_ini,
          (date_trunc('month', :mes) + interval '1 month')::date as mes_fin
      )
      select count(*)::int as n
      from analytics.stg_mtr_equipos_asignados_detalle, params
      where fecha_asignacion >= params.mes_ini
        and fecha_asignacion <  params.mes_fin
    """
    try:
        with engine.connect() as c:
            n = c.execute(sql_text(sql), {"mes": mes}).scalar() or 0
        return {"mes": mes, "count": int(n)}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/cambios-equipo-count")
def cambios_equipo_count(mes: date):
    rows = []
    try:
        data = cambios_equipo_mes(mes=mes, limit=5000)
        rows = data.get("rows", []) if isinstance(data, dict) else []
    except Exception:
        rows = []
    return {"mes": mes, "count": int(len(rows))}


# ---------------------------
# MTR detalle (ingresos/salidas)
# ---------------------------



# =========================
# MTR latest / detalle mes
# =========================

def _mtr_latest_table(tipo: str) -> str:
    t = (tipo or "").strip().lower()
    if t == "ingresos":
        return "analytics.stg_mtr_ingresos"
    if t == "salidas":
        return "analytics.stg_mtr_salidas"
    raise HTTPException(status_code=400, detail="tipo debe ser ingresos o salidas")


def _mtr_enrichment_source() -> dict[str, str] | None:
    try:
        insp = inspect(engine)
        relation_names = _analytics_relation_names(insp)
    except Exception:
        return None

    for relation in ("stg_equipos_enriched", "stg_equipos", "mart_equipos_estado_actual"):
        if relation not in relation_names:
            continue
        try:
            cols = {c["name"] for c in insp.get_columns(relation, schema="analytics")}
        except Exception:
            cols = set()

        if "id_equipo" not in cols:
            continue

        cliente_col = next(
            (name for name in ("cliente_actual", "cliente") if name in cols),
            None,
        )
        persona_col = next(
            (name for name in ("persona_actual", "persona_asignada", "last_event_persona") if name in cols),
            None,
        )
        sistema_operativo_col = next(
            (name for name in ("sistema_operativo", "plataforma") if name in cols),
            None,
        )
        condicion_col = "condicion" if "condicion" in cols else None

        return {
            "relation": f"analytics.{relation}",
            "cliente_col": cliente_col or "null",
            "persona_col": persona_col or "null",
            "marca_col": "marca" if "marca" in cols else "null",
            "modelo_col": "modelo" if "modelo" in cols else "null",
            "sistema_operativo_col": sistema_operativo_col or "null",
            "condicion_col": condicion_col or "null",
        }

    return None


def _mtr_sql():
    enrichment = _mtr_enrichment_source()
    if enrichment:
        relation = enrichment["relation"]
        cliente_expr = f"nullif(trim(e.{enrichment['cliente_col']}::text), '')" if enrichment["cliente_col"] != "null" else "null::text"
        persona_expr = f"nullif(trim(e.{enrichment['persona_col']}::text), '')" if enrichment["persona_col"] != "null" else "null::text"
        marca_expr = f"nullif(trim(e.{enrichment['marca_col']}::text), '')" if enrichment["marca_col"] != "null" else "null::text"
        modelo_expr = f"nullif(trim(e.{enrichment['modelo_col']}::text), '')" if enrichment["modelo_col"] != "null" else "null::text"
        so_expr = f"nullif(trim(e.{enrichment['sistema_operativo_col']}::text), '')" if enrichment["sistema_operativo_col"] != "null" else "null::text"
        condicion_expr = f"nullif(trim(e.{enrichment['condicion_col']}::text), '')" if enrichment["condicion_col"] != "null" else "null::text"
        join_sql = f"""
  left join lateral (
    select
      e.id_equipo,
      {cliente_expr} as cliente_lookup,
      {persona_expr} as persona_lookup,
      {marca_expr} as marca_lookup,
      {modelo_expr} as modelo_lookup,
      {so_expr} as sistema_operativo_lookup,
      {condicion_expr} as condicion_lookup
    from {relation} e
    where (
      f.id_equipo is not null
      and upper(trim(e.id_equipo)) = upper(trim(f.id_equipo))
    )
    or (
      f.id_equipo is null
      and f.persona is not null
      and upper(trim(coalesce({persona_expr},''))) = upper(trim(f.persona))
    )
    order by
      case
        when f.id_equipo is not null
         and upper(trim(e.id_equipo)) = upper(trim(f.id_equipo))
        then 0 else 1
      end,
      e.id_equipo
    limit 1
  ) eq on true
"""
    else:
        join_sql = """
  left join lateral (
    select
      null::text as id_equipo,
      null::text as cliente_lookup,
      null::text as persona_lookup,
      null::text as marca_lookup,
      null::text as modelo_lookup,
      null::text as sistema_operativo_lookup,
      null::text as condicion_lookup
  ) eq on true
"""

    return """
with src as (
  select
    fecha_evento::date as fecha_evento,
    nullif(trim(persona::text), '') as persona,
    nullif(trim(detalle::text), '') as detalle,
    case
      when id_equipo is null then null
      when upper(trim(id_equipo::text)) ~ '^SKU-[0-9]+$' then upper(trim(id_equipo::text))
      when upper(trim(id_equipo::text)) ~ '^SKU[ -]*[0-9]+$'
        then regexp_replace(upper(trim(id_equipo::text)), '^SKU[ -]*', 'SKU-')
      when trim(id_equipo::text) ~ '^[0-9]+(\.0+)?$'
        then 'SKU-' || split_part(trim(id_equipo::text), '.', 1)
      else null
    end as id_equipo
  from __TABLE__
),
filtrado as (
  select *
  from src
  where fecha_evento is not null
    and date_trunc('month', fecha_evento)::date = cast(:mes as date)
),
enriched as (
  select
    f.fecha_evento,
    f.persona,
    coalesce(
      nullif(trim(split_part(coalesce(f.detalle,''), '|', 1)), ''),
      eq.cliente_lookup
    ) as cliente,
    coalesce(eq.id_equipo, f.id_equipo) as id_equipo,
    eq.marca_lookup as marca,
    eq.modelo_lookup as modelo,
    eq.sistema_operativo_lookup as sistema_operativo,
    eq.condicion_lookup as condicion,
    case
      when lower(coalesce(eq.sistema_operativo_lookup, '')) like '%mac%'
        or lower(coalesce(eq.sistema_operativo_lookup, '')) like '%sonoma%'
        or lower(coalesce(eq.sistema_operativo_lookup, '')) like '%sequoia%'
        or lower(coalesce(eq.marca_lookup, '')) = 'apple'
      then 'MAC'
      when coalesce(eq.sistema_operativo_lookup, '') <> '' then 'WIN'
      else null
    end as mac_win,
    (lower(coalesce(eq.condicion_lookup, '')) like '%nuevo%') as es_nuevo,
    f.detalle
  from filtrado f
__ENRICHMENT_JOIN__
)
select
  fecha_evento,
  persona,
  cliente as cliente_asignado,
  id_equipo as equipo_asignado_actual,
  id_equipo,
  marca,
  modelo,
  condicion,
  mac_win,
  es_nuevo,
  coalesce(
    nullif(trim(concat_ws(' ', marca, modelo)), ''),
    nullif(trim(cliente), ''),
    nullif(trim(detalle), ''),
    '—'
  ) as detalle
from enriched
order by fecha_evento asc, persona asc nulls last, id_equipo asc nulls last
limit :limit
""".replace("__ENRICHMENT_JOIN__", join_sql)

def _mtr_fetch_rows(mes: str, tipo: str, limit: int):
    table_name = _mtr_latest_table(tipo)
    sql = _mtr_sql().replace("__TABLE__", table_name)
    with engine.begin() as conn:
        res = conn.execute(
            sql_text(sql),
            {"mes": mes, "limit": limit}
        )
        rows = [dict(r._mapping) for r in res]
    return rows


@router.get("/mtr-count")
def mtr_count(
    mes: str = Query(..., description="YYYY-MM-01"),
    tipo: str = Query(..., description="ingresos|salidas"),
):
    rows = _mtr_fetch_rows(mes=mes, tipo=tipo, limit=5000)
    mes_date = date.fromisoformat(str(mes)[:10])
    return {
        "mes": mes,
        "tipo": tipo,
        "estado_mes": _month_state(mes_date),
        "fecha_ultima_actualizacion": max((row.get("fecha_evento") for row in rows), default=None),
        "fuente": MTR_EXECUTIVE_SOURCE,
        "count": len(rows),
    }


@router.get("/mtr")
def mtr(
    mes: str = Query(..., description="YYYY-MM-01"),
    tipo: str = Query(..., description="ingresos|salidas"),
    limit: int = Query(500, ge=1, le=5000),
):
    rows = _mtr_fetch_rows(mes=mes, tipo=tipo, limit=limit)
    mes_date = date.fromisoformat(str(mes)[:10])
    return {
        "mes": mes,
        "tipo": tipo,
        "estado_mes": _month_state(mes_date),
        "fecha_ultima_actualizacion": max((row.get("fecha_evento") for row in rows), default=None),
        "fuente": MTR_EXECUTIVE_SOURCE,
        "rows": rows,
        "count": len(rows),
    }




# ---------------------------
# ML score / resumen
# ---------------------------

@router.get("/ml-score-resumen")
def ml_score_resumen(
    mes: date = Query(..., description="YYYY-MM-01"),
):
    sql = """
    select
      mes,
      equipos_scoreados,
      score_promedio,
      bajo,
      medio,
      alto,
      score_max
    from analytics.v_mtr1203_ml_score_resumen_mes
    where mes = :mes
    """
    try:
        with engine.connect() as c:
            row = c.execute(sql_text(sql), {"mes": mes}).mappings().first()
        if not row:
            return {
                "mes": mes,
                "equipos_scoreados": 0,
                "score_promedio": 0,
                "bajo": 0,
                "medio": 0,
                "alto": 0,
                "score_max": 0
}
        return dict(row)
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/ml-score-clientes")
def ml_score_clientes(
    mes: date = Query(..., description="YYYY-MM-01"),
    limit: int = Query(10, ge=1, le=100),
):
    sql = """
    select
      mes,
      cliente_ref,
      equipos,
      score_promedio,
      score_max,
      equipos_medio,
      equipos_alto
    from analytics.v_mtr1203_ml_score_cliente_mes
    where mes = :mes
    order by score_promedio desc, equipos desc, cliente_ref asc nulls last
    limit :limit
    """
    try:
        with engine.connect() as c:
            rows = [dict(r._mapping) for r in c.execute(sql_text(sql), {"mes": mes, "limit": int(limit)}).fetchall()]
        return {
            "mes": mes,
            "count": len(rows),
            "data": rows
}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/ml-score-detalle")
def ml_score_detalle(
    mes: date = Query(..., description="YYYY-MM-01"),
    limit: int = Query(20, ge=1, le=500),
):
    sql = """
    select
      mes,
      id_equipo,
      cliente_ref,
      persona_ref,
      location_ref,
      pais_regla,
      requiere_equipo_flag,
      no_requiere_equipo_flag,
      marca,
      modelo,
      mac_win,
      condicion,
      movimientos_mes,
      ingresos_mes,
      salidas_mes,
      movimientos_3m,
      ingresos_3m,
      salidas_3m,
      ok_enrich_flag,
      sin_match_flag,
      sin_regla_flag,
      no_requiere_equipo_evento_flag,
      gap_operativo_flag,
      cambio_cliente_vs_mes_prev,
      cambio_persona_vs_mes_prev,
      cambio_plataforma_vs_mes_prev,
      antiguedad_meses_observados,
      es_mac,
      es_win,
      es_nuevo,
      es_usado,
      es_chile,
      es_extranjero,
      cliente_walmart,
      cliente_imed,
      score_riesgo_rotacion_raw,
      score_riesgo_rotacion,
      bucket_riesgo,
      factores_riesgo,
      factores_proteccion,
      explicacion_corta
    from analytics.v_mtr1203_ml_scores_latest
    where mes = :mes
    order by score_riesgo_rotacion desc, id_equipo asc nulls last
    limit :limit
    """
    try:
        with engine.connect() as c:
            rows = [dict(r._mapping) for r in c.execute(sql_text(sql), {"mes": mes, "limit": int(limit)}).fetchall()]
        return {
            "mes": mes,
            "count": len(rows),
            "data": rows
}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")




@router.get("/movimientos-mensuales")
def movimientos_mensuales():
    visible_month_end = _next_month_start(_operational_month_start())
    sql = """
        select
          mes,
          estado_mes,
          fecha_ultima_actualizacion,
          fuente,
          movimientos_total,
          total_ingresos as ingresos,
          total_salidas as salidas,
          total_ingresos,
          total_salidas,
          ingresos_personas,
          salidas_personas,
          movimientos_internos,
          movimientos_internos_sin_impacto,
          cambios_equipo_real,
          cambios_equipo_real_base,
          cambios_reemplazos_mtr,
          asignaciones,
          ingresos_hardware,
          reasignaciones_hardware,
          equipos_reutilizados,
          devoluciones_hardware,
          equipos_retornados,
          equipos_baja,
          salidas_hardware,
          nuevos_con_equipo,
          nuevos_sin_equipo,
          presion_compra,
          stock_activo,
          stock_disponible,
          gap,
          override_manual_aplicado,
          override_scope,
          override_note,
          pct_movimientos_100,
          insight_movimientos,
          insight_mtr
        from analytics.mart_estadistica_movimientos_mes_v2
        where mes >= date '2026-01-01'
          and mes < :visible_month_end
        order by mes
    """
    try:
        with engine.begin() as conn:
            rows = [
                _decorate_month_row(dict(r._mapping))
                for r in conn.execute(text(sql), {"visible_month_end": visible_month_end})
            ]
        return {"rows": rows, "count": len(rows)}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/mtr-resumen-mes")
def mtr_resumen_mes():
    visible_year_start = date(_operational_month_start().year, 1, 1)
    visible_month_end = _next_month_start(_operational_month_start())
    sql = """
    with mov as (
      select
        m.mes,
        m.ingresos,
        m.salidas,
        m.ingresos_con_equipo,
        m.salidas_con_equipo,
        m.ingresos_mac,
        m.ingresos_win,
        m.salidas_mac,
        m.salidas_win,
        m.delta_movimientos
      from analytics.v_mtr1203_kpi_movimientos_mes m
    ),
    mov_ext as (
      select
        e.mes,
        e.ingresos_total,
        e.ingresos_sin_equipo_pero_esperado,
        e.ingresos_no_requiere_equipo,
        e.salidas_total,
        e.salidas_sin_equipo_pero_esperado,
        e.salidas_no_requiere_equipo
      from analytics.v_mtr1203_kpi_movimientos_mes_extendido e
    ),
    stock as (
      select
        s.mes,
        s.stock_activo,
        s.stock_mac,
        s.stock_win,
        s.stock_nuevo,
        s.stock_usado
      from analytics.v_mtr1203_stock_operativo_mes s
    )
    select
      mov.mes,
      mov.ingresos as ingresos_total,
      mov.salidas as salidas_total,
      mov.delta_movimientos,
      mov.ingresos_con_equipo,
      mov.salidas_con_equipo,
      mov.ingresos_mac,
      mov.ingresos_win,
      mov.salidas_mac,
      mov.salidas_win,
      mov_ext.ingresos_sin_equipo_pero_esperado,
      mov_ext.ingresos_no_requiere_equipo,
      mov_ext.salidas_sin_equipo_pero_esperado,
      mov_ext.salidas_no_requiere_equipo,
      stock.stock_activo,
      stock.stock_mac,
      stock.stock_win,
      stock.stock_nuevo,
      stock.stock_usado,
      (
        'Ingresos ' || coalesce(mov.ingresos,0) ||
        ' · Salidas ' || coalesce(mov.salidas,0) ||
        ' · Delta ' || coalesce(mov.delta_movimientos,0) ||
        ' · Stock activo ' || coalesce(stock.stock_activo,0)
      ) as insight_mtr
    from mov
    left join mov_ext on mov_ext.mes = mov.mes
    left join stock on stock.mes = mov.mes
    where mov.mes >= :visible_year_start
      and mov.mes < :visible_month_end
    order by mov.mes
    """
    try:
        with engine.connect() as c:
            rows = [
                dict(r._mapping)
                for r in c.execute(
                    sql_text(sql),
                    {
                        "visible_year_start": visible_year_start,
                        "visible_month_end": visible_month_end,
                    },
                ).fetchall()
            ]
        return {"count": len(rows), "data": rows}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")




@router.get("/ml-risk-summary")
def ml_risk_summary(
    mes: date = Query(..., description="YYYY-MM-01"),
):
    sql = """
    select
      mes,
      count(*) as equipos_total,
      count(*) filter (where bucket_riesgo = 'ALTO') as alto,
      count(*) filter (where bucket_riesgo = 'MEDIO') as medio,
      count(*) filter (where bucket_riesgo = 'BAJO') as bajo,
      round(avg(score_riesgo_rotacion), 1) as score_promedio,
      max(score_riesgo_rotacion) as score_max
    from analytics.v_mtr1203_ml_scores_latest
    where mes = :mes
    group by 1
    """
    try:
        with engine.connect() as c:
            row = c.execute(sql_text(sql), {"mes": mes}).mappings().first()
        if not row:
            return {
                "mes": mes,
                "equipos_total": 0,
                "alto": 0,
                "medio": 0,
                "bajo": 0,
                "score_promedio": 0,
                "score_max": 0
}
        return dict(row)
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/ml-version-comparison")
def ml_version_comparison(
    limit: int = Query(20, ge=1, le=100, description="Cantidad máxima de SKUs afectados a devolver"),
):
    """
    Comparación operativa entre ML v2 y ML v3 usando exclusivamente el mart canónico actual.
    """
    try:
        insp = inspect(engine)
        cols = {c["name"] for c in insp.get_columns("mart_equipos_estado_actual", schema="analytics")}

        required_cols = {
            "id_equipo",
            "ml_score_v2",
            "ml_score_v3",
            "ml_risk_level_v2",
            "ml_risk_level_v3",
            "ml_score_delta_v3_vs_v2",
            "ml_main_driver_v3",
        }

        if not required_cols.issubset(cols):
            return {
                "summary": {
                    "total_equipos": 0,
                    "equipos_con_v2": 0,
                    "equipos_con_v3": 0,
                    "clasificacion_cambiada": 0,
                },
                "score_distribution_v3": [],
                "risk_distribution": {"v2": [], "v3": []},
                "top_main_drivers_v3": [],
                "biggest_score_deltas": [],
                "affected_skus": [],
            }

        active_predicate = _active_operational_predicate(lambda name: name in cols, "m")

        sql_summary = """
        with base as (
          select *
          from analytics.mart_equipos_estado_actual m
          where """ + active_predicate + """
        )
        select
          count(*) as total_equipos,
          count(*) filter (where ml_score_v2 is not null) as equipos_con_v2,
          count(*) filter (where ml_score_v3 is not null) as equipos_con_v3,
          count(*) filter (
            where ml_risk_level_v2 is not null
              and ml_risk_level_v3 is not null
              and upper(ml_risk_level_v2) <> upper(ml_risk_level_v3)
          ) as clasificacion_cambiada
        from base
        """

        sql_score_distribution = """
        with base as (
          select
            case
              when ml_score_v3 is null then 'Sin score'
              when ml_score_v3 < 4 then '0-3'
              when ml_score_v3 < 7 then '4-6'
              else '7-10'
            end as bucket
          from analytics.mart_equipos_estado_actual m
          where """ + active_predicate + """
        )
        select bucket, count(*) as equipos
        from base
        group by 1
        order by
          case bucket
            when '0-3' then 1
            when '4-6' then 2
            when '7-10' then 3
            else 4
          end
        """

        sql_risk_distribution = """
        with base as (
          select *
          from analytics.mart_equipos_estado_actual m
          where """ + active_predicate + """
        )
        select 'v2' as version, coalesce(upper(ml_risk_level_v2), 'SIN SCORE') as risk_level, count(*) as equipos
        from base
        group by 1, 2
        union all
        select 'v3' as version, coalesce(upper(ml_risk_level_v3), 'SIN SCORE') as risk_level, count(*) as equipos
        from base
        group by 1, 2
        """

        sql_drivers = """
        with base as (
          select *
          from analytics.mart_equipos_estado_actual m
          where """ + active_predicate + """
        )
        select
          coalesce(nullif(trim(ml_main_driver_v3), ''), 'Sin driver visible') as driver,
          count(*) as equipos
        from base
        where ml_score_v3 is not null
        group by 1
        order by count(*) desc, driver asc
        limit 8
        """

        sql_deltas = """
        with base as (
          select *
          from analytics.mart_equipos_estado_actual m
          where """ + active_predicate + """
        )
        select
          id_equipo,
          ml_score_v2,
          ml_score_v3,
          ml_risk_level_v2,
          ml_risk_level_v3,
          ml_score_delta_v3_vs_v2,
          coalesce(nullif(trim(ml_main_driver_v3), ''), 'Sin driver visible') as ml_main_driver_v3
        from base
        where ml_score_v3 is not null
          and ml_score_delta_v3_vs_v2 is not null
        order by abs(ml_score_delta_v3_vs_v2) desc, id_equipo asc
        limit :limit
        """

        sql_affected = """
        with base as (
          select *
          from analytics.mart_equipos_estado_actual m
          where """ + active_predicate + """
        )
        select
          id_equipo,
          ml_score_v2,
          ml_score_v3,
          ml_risk_level_v2,
          ml_risk_level_v3,
          ml_score_delta_v3_vs_v2,
          coalesce(nullif(trim(ml_main_driver_v3), ''), 'Sin driver visible') as ml_main_driver_v3
        from base
        where ml_risk_level_v2 is not null
          and ml_risk_level_v3 is not null
          and upper(ml_risk_level_v2) <> upper(ml_risk_level_v3)
        order by abs(coalesce(ml_score_delta_v3_vs_v2, 0)) desc, id_equipo asc
        limit :limit
        """

        with engine.connect() as c:
            summary = dict(c.execute(sql_text(sql_summary)).mappings().first() or {})
            score_distribution_v3 = [dict(r) for r in c.execute(sql_text(sql_score_distribution)).mappings().all()]
            risk_rows = [dict(r) for r in c.execute(sql_text(sql_risk_distribution)).mappings().all()]
            top_main_drivers_v3 = [dict(r) for r in c.execute(sql_text(sql_drivers)).mappings().all()]
            biggest_score_deltas = [dict(r) for r in c.execute(sql_text(sql_deltas), {"limit": limit}).mappings().all()]
            affected_skus = [dict(r) for r in c.execute(sql_text(sql_affected), {"limit": limit}).mappings().all()]

        risk_distribution = {
            "v2": [r for r in risk_rows if r.get("version") == "v2"],
            "v3": [r for r in risk_rows if r.get("version") == "v3"],
        }

        return {
            "summary": summary,
            "score_distribution_v3": score_distribution_v3,
            "risk_distribution": risk_distribution,
            "top_main_drivers_v3": top_main_drivers_v3,
            "biggest_score_deltas": biggest_score_deltas,
            "affected_skus": affected_skus,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise _internal_api_error("ml_version_comparison", exc)








@router.get("/equipos/{id_equipo}")
def get_equipo_detalle(id_equipo: str):
    """
    Detalle operativo de un equipo para /equipos/[id] y ML explain.
    """
    try:
        insp = inspect(engine)
        cols = {c["name"] for c in insp.get_columns("mart_equipos_estado_actual", schema="analytics")}

        def has(name: str) -> bool:
            return name in cols

        def txt(name: str) -> str:
            return f"nullif(trim({name}), '')"

        id_expr = "coalesce(id_equipo, 'SIN-SKU')" if has("id_equipo") else "'SIN-SKU'"

        estado_parts = []
        if has("estado_equipo"):
            estado_parts.append(txt("estado_equipo"))
        if has("estado_operativo"):
            estado_parts.append(txt("estado_operativo"))
        estado_expr = f"coalesce({', '.join(estado_parts)}, '—')" if estado_parts else "'—'"

        cliente_expr = txt("cliente") if has("cliente") else "'—'"

        marca_modelo_parts = []
        if has("marca") and has("modelo"):
            marca_modelo_parts.append("nullif(trim(concat_ws(' ', marca, modelo)), '')")
        elif has("modelo"):
            marca_modelo_parts.append(txt("modelo"))
        elif has("marca"):
            marca_modelo_parts.append(txt("marca"))
        marca_modelo_expr = f"coalesce({', '.join(marca_modelo_parts)}, '—')" if marca_modelo_parts else "'—'"

        tipo_colab_expr = txt("tipo_colaborador") if has("tipo_colaborador") else "'—'"
        estado_operativo_expr = txt("estado_operativo") if has("estado_operativo") else "null"
        estado_equipo_expr = txt("estado_equipo") if has("estado_equipo") else "null"
        estado_equipo_mtr_expr = txt("estado_equipo_mtr") if has("estado_equipo_mtr") else "null"
        alertas_severidad_expr = txt("alertas_severidad") if has("alertas_severidad") else "'NORMAL'"
        alertas_resumen_expr = f"coalesce({txt('alertas_resumen')}, 'Sin alertas')" if has("alertas_resumen") else "'Sin alertas'"
        jira_open_count_expr = "coalesce(jira_open_count, 0)" if has("jira_open_count") else "0"
        jira_bucket_expr = txt("jira_board_bucket") if has("jira_board_bucket") else "null"
        ml_alert_code_expr = txt("ml_alert_code") if has("ml_alert_code") else "null"

        ml_motivo_parts = []
        if has("ml_alert_code"):
            ml_motivo_parts.append(txt("ml_alert_code"))
        if has("ml_motivo_principal"):
            ml_motivo_parts.append(txt("ml_motivo_principal"))
        ml_motivo_expr = f"coalesce({', '.join(ml_motivo_parts)}, '—')" if ml_motivo_parts else "'—'"

        ml_risk_expr = f"upper({txt('ml_risk_level')})" if has("ml_risk_level") else "null"
        ml_score_expr = "coalesce(ml_score, 0)" if has("ml_score") else "0"
        ml_link_expr = txt("ml_link_path") if has("ml_link_path") else "null"
        ml_scored_at_expr = "cast(ml_scored_at as text)" if has("ml_scored_at") else "null"
        ml_score_v2_expr = "ml_score_v2" if has("ml_score_v2") else ml_score_expr
        ml_risk_v2_expr = txt("ml_risk_level_v2") if has("ml_risk_level_v2") else ml_risk_expr
        ml_alert_v2_expr = txt("ml_alert_code_v2") if has("ml_alert_code_v2") else ml_alert_code_expr
        ml_score_v3_expr = "ml_score_v3" if has("ml_score_v3") else "null"
        ml_risk_v3_expr = txt("ml_risk_level_v3") if has("ml_risk_level_v3") else "null"
        ml_alert_v3_expr = txt("ml_alert_code_v3") if has("ml_alert_code_v3") else "null"
        ml_main_driver_v3_expr = txt("ml_main_driver_v3") if has("ml_main_driver_v3") else "null"
        ml_reason_v3_expr = txt("ml_risk_reason_v3") if has("ml_risk_reason_v3") else "null"
        ml_scored_at_v3_expr = "cast(ml_scored_at_v3 as text)" if has("ml_scored_at_v3") else "null"
        ml_source_available_v3_expr = "coalesce(ml_source_available_v3, false)" if has("ml_source_available_v3") else "false"
        ml_version_expr = txt("ml_version") if has("ml_version") else "'v2'"
        ml_delta_expr = "ml_score_delta_v3_vs_v2" if has("ml_score_delta_v3_vs_v2") else "null"
        ml_score_v2_expr = "ml_score_v2" if has("ml_score_v2") else ml_score_expr
        ml_risk_v2_expr = txt("ml_risk_level_v2") if has("ml_risk_level_v2") else ml_risk_expr
        ml_alert_v2_expr = txt("ml_alert_code_v2") if has("ml_alert_code_v2") else ml_alert_code_expr
        ml_score_v3_expr = "ml_score_v3" if has("ml_score_v3") else "null"
        ml_risk_v3_expr = txt("ml_risk_level_v3") if has("ml_risk_level_v3") else "null"
        ml_alert_v3_expr = txt("ml_alert_code_v3") if has("ml_alert_code_v3") else "null"
        ml_main_driver_v3_expr = txt("ml_main_driver_v3") if has("ml_main_driver_v3") else "null"
        ml_reason_v3_expr = txt("ml_risk_reason_v3") if has("ml_risk_reason_v3") else "null"
        ml_scored_at_v3_expr = "cast(ml_scored_at_v3 as text)" if has("ml_scored_at_v3") else "null"
        ml_source_available_v3_expr = "coalesce(ml_source_available_v3, false)" if has("ml_source_available_v3") else "false"
        ml_version_expr = txt("ml_version") if has("ml_version") else "'v2'"
        ml_delta_expr = "ml_score_delta_v3_vs_v2" if has("ml_score_delta_v3_vs_v2") else "null"
        marca_expr = txt("marca") if has("marca") else "null"
        modelo_expr = txt("modelo") if has("modelo") else "null"
        prioridad_rank_expr = "priority_final_rank" if has("priority_final_rank") else "null"
        prioridad_motivo_expr = txt("priority_final_motivo") if has("priority_final_motivo") else "null"
        condicion_expr = txt("condicion") if has("condicion") else "null"
        plataforma_expr = txt("plataforma") if has("plataforma") else "null"
        sku_expr = "cast(sku as text)" if has("sku") else "null"
        tipo_equipo_expr = txt("tipo_equipo") if has("tipo_equipo") else "null"
        sistema_operativo_expr = txt("sistema_operativo") if has("sistema_operativo") else "null"
        procesador_expr = txt("procesador") if has("procesador") else "null"
        ram_gb_expr = "ram_gb" if has("ram_gb") else "null"
        almacenamiento_gb_expr = "almacenamiento_gb" if has("almacenamiento_gb") else "null"
        almacenamiento_tipo_expr = txt("almacenamiento_tipo") if has("almacenamiento_tipo") else "null"
        pantalla_expr = txt("pantalla") if has("pantalla") else "null"
        anio_modelo_expr = txt("anio_modelo") if has("anio_modelo") else "null"
        serial_expr = txt("serial") if has("serial") else "null"
        specs_source_expr = txt("specs_fuente_origen") if has("specs_fuente_origen") else "null"
        specs_confidence_expr = "specs_confidence_score" if has("specs_confidence_score") else "null"
        specs_status_expr = txt("specs_status") if has("specs_status") else "null"
        carbon_country_expr = txt("carbon_electricity_country") if has("carbon_electricity_country") else "null"
        carbon_grid_factor_expr = "carbon_grid_factor_kgco2e_kwh" if has("carbon_grid_factor_kgco2e_kwh") else "null"
        carbon_grid_year_expr = "carbon_grid_reference_year" if has("carbon_grid_reference_year") else "null"
        carbon_grid_source_expr = txt("carbon_grid_source") if has("carbon_grid_source") else "null"
        carbon_source_vendor_expr = txt("carbon_source_vendor") if has("carbon_source_vendor") else "null"
        carbon_source_url_expr = txt("carbon_source_url") if has("carbon_source_url") else "null"
        carbon_lifetime_expr = "carbon_assumed_lifetime_years" if has("carbon_assumed_lifetime_years") else "null"
        carbon_use_kwh_expr = "carbon_use_annual_kwh" if has("carbon_use_annual_kwh") else "null"
        carbon_report_total_expr = "carbon_report_total_kgco2e" if has("carbon_report_total_kgco2e") else "null"
        carbon_embodied_expr = "carbon_embodied_kgco2e" if has("carbon_embodied_kgco2e") else "null"
        carbon_use_annual_expr = "carbon_use_annual_kgco2e" if has("carbon_use_annual_kgco2e") else "null"
        carbon_use_lifetime_expr = "carbon_use_lifetime_kgco2e" if has("carbon_use_lifetime_kgco2e") else "null"
        carbon_total_expr = "carbon_total_estimated_kgco2e" if has("carbon_total_estimated_kgco2e") else "null"
        carbon_method_expr = txt("carbon_method") if has("carbon_method") else "null"
        carbon_confidence_expr = "carbon_confidence_score" if has("carbon_confidence_score") else "null"
        carbon_status_expr = txt("carbon_status") if has("carbon_status") else "null"

        persona_asignada_expr = (
            "coalesce(nullif(trim(persona_visible), ''), nullif(trim(persona_asignada), ''), nullif(trim(persona_actual), ''), '—')"
            if has("persona_visible") or has("persona_asignada") or has("persona_actual")
            else "'—'"
        )
        last_event_persona_expr = "coalesce(nullif(trim(last_event_persona), ''), '—')" if has("last_event_persona") else "'—'"
        last_event_type_expr = "coalesce(nullif(trim(last_event_type), ''), '—')" if has("last_event_type") else "'—'"
        last_event_date_expr = "cast(last_event_date as text)" if has("last_event_date") else "null"
        localizacion_expr = txt("localizacion") if has("localizacion") else "'—'"
        ciudad_expr = txt("ciudad_comuna") if has("ciudad_comuna") else "'—'"
        mtr_detail_cte = _build_mtr_detail_cte(insp)

        sql = f"""
        with ml_hist as (
            select
                entity_id as id_equipo,
                alert_code::text as ml_alert_code_hist,
                drivers_json as ml_drivers_json,
                created_at as ml_scored_at_hist,
                row_number() over (
                    partition by entity_id
                    order by created_at desc
                ) as rn
            from analytics.ml_scores_v2_history
        ),
        {mtr_detail_cte},
        base as (
            select
                {id_expr} as id_equipo,
                {estado_expr} as estado,
                {persona_asignada_expr} as asignado_a,
                {last_event_persona_expr} as last_event_persona,
                {last_event_type_expr} as last_event_type,
                {last_event_date_expr} as last_event_date,

                case
                    when upper(coalesce({alertas_severidad_expr}, 'NORMAL')) in ('CRITICAL', 'ALTA') then 'CRITICAL'
                    when upper(coalesce({alertas_severidad_expr}, 'NORMAL')) in ('WARN', 'MEDIA') then 'WARN'
                    when upper(coalesce({alertas_severidad_expr}, 'NORMAL')) in ('INFO', 'BAJA') then 'INFO'
                    else 'NORMAL'
                end as severidad_base,

                {cliente_expr} as cliente,
                {marca_modelo_expr} as marca_modelo,
                {marca_expr} as marca,
                {modelo_expr} as modelo,
                {tipo_colab_expr} as tipo_colaborador,
                {estado_operativo_expr} as estado_operativo,
                {estado_equipo_expr} as estado_equipo,
                {estado_equipo_mtr_expr} as estado_equipo_mtr,
                {localizacion_expr} as localizacion,
                {ciudad_expr} as ciudad_comuna,
                {condicion_expr} as condicion,
                {plataforma_expr} as plataforma,

                {alertas_resumen_expr} as alertas_resumen,
                {jira_open_count_expr} as jira_open_count,
                {jira_bucket_expr} as jira_board_bucket,
                {ml_alert_code_expr} as ml_alert_code,
                {ml_motivo_expr} as ml_motivo_principal,
                {ml_risk_expr} as ml_risk_level,
                {ml_score_expr} as ml_score,
                {ml_link_expr} as ml_link_path,
                {ml_scored_at_expr} as ml_scored_at,
                {ml_score_v2_expr} as ml_score_v2,
                {ml_risk_v2_expr} as ml_risk_level_v2,
                {ml_alert_v2_expr} as ml_alert_code_v2,
                {ml_score_v3_expr} as ml_score_v3,
                {ml_risk_v3_expr} as ml_risk_level_v3,
                {ml_alert_v3_expr} as ml_alert_code_v3,
                {ml_main_driver_v3_expr} as ml_main_driver_v3,
                {ml_reason_v3_expr} as ml_risk_reason_v3,
                {ml_scored_at_v3_expr} as ml_scored_at_v3,
                {ml_source_available_v3_expr} as ml_source_available_v3,
                {ml_version_expr} as ml_version,
                {ml_delta_expr} as ml_score_delta_v3_vs_v2,
                {sku_expr} as sku,
                {tipo_equipo_expr} as tipo_equipo,
                {sistema_operativo_expr} as sistema_operativo,
                {procesador_expr} as procesador,
                {ram_gb_expr} as ram_gb,
                {almacenamiento_gb_expr} as almacenamiento_gb,
                {almacenamiento_tipo_expr} as almacenamiento_tipo,
                {pantalla_expr} as pantalla,
                {anio_modelo_expr} as anio_modelo,
                {serial_expr} as serial,
                {specs_source_expr} as fuente_origen,
                {specs_confidence_expr} as specs_confidence_score,
                {specs_status_expr} as specs_status,
                {carbon_country_expr} as carbon_electricity_country,
                {carbon_grid_factor_expr} as carbon_grid_factor_kgco2e_kwh,
                {carbon_grid_year_expr} as carbon_grid_reference_year,
                {carbon_grid_source_expr} as carbon_grid_source,
                {carbon_source_vendor_expr} as carbon_source_vendor,
                {carbon_source_url_expr} as carbon_source_url,
                {carbon_lifetime_expr} as carbon_assumed_lifetime_years,
                {carbon_use_kwh_expr} as carbon_use_annual_kwh,
                {carbon_report_total_expr} as carbon_report_total_kgco2e,
                {carbon_embodied_expr} as carbon_embodied_kgco2e,
                {carbon_use_annual_expr} as carbon_use_annual_kgco2e,
                {carbon_use_lifetime_expr} as carbon_use_lifetime_kgco2e,
                {carbon_total_expr} as carbon_total_estimated_kgco2e,
                {carbon_method_expr} as carbon_method,
                {carbon_confidence_expr} as carbon_confidence_score,
                {carbon_status_expr} as carbon_status,
                {prioridad_rank_expr} as priority_final_rank,
                {prioridad_motivo_expr} as priority_final_motivo
            from analytics.mart_equipos_estado_actual
            where upper({id_expr}) = upper(:id_equipo)
        )
        select
            base.id_equipo as id_equipo,
            estado,
            estado_operativo,
            estado_equipo,
            estado_equipo_mtr,
            coalesce(mtr_detail.persona_asignada, nullif(trim(base.asignado_a), ''), '—') as asignado_a,
            coalesce(nullif(trim(base.last_event_persona), ''), '—') as last_event_persona,
            last_event_type,
            last_event_date,
            case
                when coalesce(ml_score, 0) >= 8 then 'CRITICAL'
                when coalesce(ml_score, 0) >= 4 then 'WARN'
                when severidad_base in ('CRITICAL', 'WARN', 'INFO', 'NORMAL') then severidad_base
                else 'NORMAL'
            end as severidad,
            coalesce(base.cliente, mtr_detail.cliente, '—') as cliente,
            coalesce(
                base.marca_modelo,
                nullif(trim(concat_ws(' ', mtr_detail.marca, mtr_detail.modelo)), ''),
                '—'
            ) as marca_modelo,
            coalesce(base.marca, mtr_detail.marca) as marca,
            coalesce(base.modelo, mtr_detail.modelo) as modelo,
            coalesce(base.tipo_colaborador, mtr_detail.tipo_colaborador, '—') as tipo_colaborador,
            coalesce(base.localizacion, mtr_detail.localizacion, '—') as localizacion,
            coalesce(base.ciudad_comuna, mtr_detail.ciudad_comuna, '—') as ciudad_comuna,
            coalesce(base.condicion, mtr_detail.condicion) as condicion,
            coalesce(base.plataforma, mtr_detail.plataforma) as plataforma,
            sku,
            tipo_equipo,
            sistema_operativo,
            procesador,
            ram_gb,
            almacenamiento_gb,
            almacenamiento_tipo,
            pantalla,
            anio_modelo,
            serial,
            fuente_origen,
            specs_confidence_score,
            specs_status,
            carbon_electricity_country,
            carbon_grid_factor_kgco2e_kwh,
            carbon_grid_reference_year,
            carbon_grid_source,
            carbon_source_vendor,
            carbon_source_url,
            carbon_assumed_lifetime_years,
            carbon_use_annual_kwh,
            carbon_report_total_kgco2e,
            carbon_embodied_kgco2e,
            carbon_use_annual_kgco2e,
            carbon_use_lifetime_kgco2e,
            carbon_total_estimated_kgco2e,
            carbon_method,
            carbon_confidence_score,
            carbon_status,
            alertas_resumen,
            jira_open_count,
            jira_board_bucket,
            coalesce(base.ml_alert_code_v3, base.ml_alert_code_v2, base.ml_alert_code, ml_hist.ml_alert_code_hist) as ml_alert_code,
            coalesce(base.ml_risk_reason_v3, base.ml_main_driver_v3, ml_motivo_principal) as ml_motivo_principal,
            coalesce(base.ml_risk_level_v3, base.ml_risk_level_v2, ml_risk_level, 'BAJO') as ml_risk_level,
            coalesce(base.ml_score_v3, base.ml_score_v2, ml_score, 0) as ml_score,
            ml_link_path,
            coalesce(base.ml_scored_at_v3, base.ml_scored_at, cast(ml_hist.ml_scored_at_hist as text)) as ml_scored_at,
            ml_hist.ml_drivers_json,
            base.ml_score_v2,
            base.ml_risk_level_v2,
            base.ml_alert_code_v2,
            base.ml_score_v3,
            base.ml_risk_level_v3,
            base.ml_alert_code_v3,
            base.ml_main_driver_v3,
            base.ml_risk_reason_v3,
            base.ml_scored_at_v3,
            base.ml_source_available_v3,
            base.ml_version,
            base.ml_score_delta_v3_vs_v2,
            priority_final_rank,
            priority_final_motivo
        from base
        left join ml_hist
          on upper(ml_hist.id_equipo) = upper(base.id_equipo)
         and ml_hist.rn = 1
        left join mtr_detail
          on mtr_detail.id_equipo = upper(base.id_equipo)
        limit 1
        """

        with engine.connect() as c:
            row = c.execute(text(sql), {"id_equipo": id_equipo}).mappings().first()

        out = dict(row) if row else {}
        if not out and _has_table(engine, "analytics", "mart_mtr_jira_reconciliacion"):
            fallback_sql = """
            with mtr_detail as (
              select
                upper(id_equipo) as id_equipo,
                nullif(trim(cliente), '') as cliente,
                nullif(trim(persona_asignada), '') as persona_asignada,
                nullif(trim(tipo_colaborador), '') as tipo_colaborador,
                nullif(trim(marca), '') as marca,
                nullif(trim(modelo), '') as modelo,
                nullif(trim(localizacion), '') as localizacion,
                nullif(trim(ciudad_comuna), '') as ciudad_comuna,
                nullif(trim(condicion), '') as condicion,
                nullif(trim(plataforma), '') as plataforma
              from analytics.stg_mtr_equipos_asignados_detalle
            )
            select
              r.id_equipo,
              coalesce(nullif(r.mtr_estado_operativo, ''), nullif(r.jira_estado_equipo_top, ''), '—') as estado,
              nullif(r.mtr_estado_operativo, '') as estado_operativo,
              nullif(r.mtr_estado_equipo, '') as estado_equipo,
              nullif(r.mtr_estado_equipo, '') as estado_equipo_mtr,
              coalesce(m.persona_asignada, nullif(r.persona_actual, ''), '—') as asignado_a,
              '—' as last_event_persona,
              nullif(r.mtr_last_event_type, '') as last_event_type,
              cast(r.mtr_last_event_at as text) as last_event_date,
              case
                when coalesce(r.flag_inconsistencia_mtr_jira, false) then 'WARN'
                when coalesce(r.in_jira, false) then 'INFO'
                else 'NORMAL'
              end as severidad,
              coalesce(nullif(r.mtr_cliente, ''), nullif(r.cliente_actual, ''), nullif(m.cliente, ''), '—') as cliente,
              coalesce(nullif(trim(concat_ws(' ', r.marca, r.modelo)), ''), nullif(trim(concat_ws(' ', m.marca, m.modelo)), ''), coalesce(r.jira_summary_top, '—')) as marca_modelo,
              coalesce(nullif(r.marca, ''), m.marca) as marca,
              coalesce(nullif(r.modelo, ''), m.modelo, r.jira_summary_top) as modelo,
              coalesce(m.tipo_colaborador, '—') as tipo_colaborador,
              coalesce(nullif(r.localizacion, ''), m.localizacion, '—') as localizacion,
              coalesce(nullif(r.ciudad_comuna, ''), m.ciudad_comuna, '—') as ciudad_comuna,
              coalesce(nullif(r.condicion, ''), m.condicion) as condicion,
              coalesce(nullif(r.sistema_operativo, ''), m.plataforma) as plataforma,
              null::text as sku,
              null::text as tipo_equipo,
              null::text as sistema_operativo,
              null::text as procesador,
              null::numeric as ram_gb,
              null::numeric as almacenamiento_gb,
              null::text as almacenamiento_tipo,
              null::text as pantalla,
              null::text as anio_modelo,
              null::text as serial,
              null::text as fuente_origen,
              null::numeric as specs_confidence_score,
              null::text as specs_status,
              null::text as carbon_electricity_country,
              null::numeric as carbon_grid_factor_kgco2e_kwh,
              null::integer as carbon_grid_reference_year,
              null::text as carbon_grid_source,
              null::text as carbon_source_vendor,
              null::text as carbon_source_url,
              null::numeric as carbon_assumed_lifetime_years,
              null::numeric as carbon_use_annual_kwh,
              null::numeric as carbon_report_total_kgco2e,
              null::numeric as carbon_embodied_kgco2e,
              null::numeric as carbon_use_annual_kgco2e,
              null::numeric as carbon_use_lifetime_kgco2e,
              null::numeric as carbon_total_estimated_kgco2e,
              null::text as carbon_method,
              null::numeric as carbon_confidence_score,
              null::text as carbon_status,
              coalesce(r.conciliacion_resumen, 'Sin alertas') as alertas_resumen,
              coalesce(r.jira_open_count, 0) as jira_open_count,
              nullif(r.jira_board_bucket_top, '') as jira_board_bucket,
              null::text as ml_alert_code,
              coalesce(r.conciliacion_resumen, '—') as ml_motivo_principal,
              null::text as ml_risk_level,
              0::numeric as ml_score,
              null::text as ml_link_path,
              null::text as ml_scored_at,
              null::jsonb as ml_drivers_json,
              null::numeric as priority_final_rank,
              r.conciliacion_estado as priority_final_motivo,
              null::numeric as ml_score_v2,
              null::text as ml_risk_level_v2,
              null::text as ml_alert_code_v2,
              null::numeric as ml_score_v3,
              null::text as ml_risk_level_v3,
              null::text as ml_alert_code_v3,
              null::text as ml_main_driver_v3,
              null::text as ml_risk_reason_v3,
              null::text as ml_scored_at_v3,
              false as ml_source_available_v3,
              'v2'::text as ml_version,
              null::numeric as ml_score_delta_v3_vs_v2
            from analytics.mart_mtr_jira_reconciliacion r
            left join mtr_detail m
              on m.id_equipo = upper(r.id_equipo)
            where upper(r.id_equipo) = upper(:id_equipo)
            limit 1
            """
            with engine.connect() as c:
                fallback_row = c.execute(text(fallback_sql), {"id_equipo": id_equipo}).mappings().first()
            out = dict(fallback_row) if fallback_row else {}

        if not out:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")

        out["ml_explain_summary"] = _ml_explain_summary(
            out.get("ml_alert_code"),
            out.get("ml_motivo_principal"),
            out.get("ml_drivers_json"),
        )
        out["ml_explain_summary_v3"] = build_ml_v3_summary(out)
        out["ml_versions"] = build_ml_versions_payload(out)
        return out

    except SQLAlchemyError as e:
        raise _internal_api_error("equipo_detalle", e)

@router.get("/equipos")
def get_equipos(limit: int = 400):
    """
    Lista operativa de equipos para la vista /activos.
    Robusto a columnas opcionales del mart y enriquecido para UI/planeación.
    """
    try:
        insp = inspect(engine)
        cols = {c["name"] for c in insp.get_columns("mart_equipos_estado_actual", schema="analytics")}

        def has(name: str) -> bool:
            return name in cols

        def txt(name: str) -> str:
            return f"nullif(trim({name}), '')"

        id_expr = "coalesce(id_equipo, 'SIN-SKU')" if has("id_equipo") else "'SIN-SKU'"

        estado_parts = []
        if has("estado_equipo"):
            estado_parts.append(txt("estado_equipo"))
        if has("estado_operativo"):
            estado_parts.append(txt("estado_operativo"))
        estado_expr = f"coalesce({', '.join(estado_parts)}, '—')" if estado_parts else "'—'"

        cliente_expr = txt("cliente") if has("cliente") else "'—'"
        localizacion_expr = txt("localizacion") if has("localizacion") else "null"
        ciudad_expr = txt("ciudad_comuna") if has("ciudad_comuna") else "null"

        marca_modelo_parts = []
        if has("marca") and has("modelo"):
            marca_modelo_parts.append("nullif(trim(concat_ws(' ', marca, modelo)), '')")
        elif has("modelo"):
            marca_modelo_parts.append(txt("modelo"))
        elif has("marca"):
            marca_modelo_parts.append(txt("marca"))
        marca_modelo_expr = f"coalesce({', '.join(marca_modelo_parts)}, '—')" if marca_modelo_parts else "'—'"

        tipo_colab_expr = txt("tipo_colaborador") if has("tipo_colaborador") else "'—'"

        alertas_severidad_expr = txt("alertas_severidad") if has("alertas_severidad") else "'NORMAL'"
        alertas_resumen_expr = f"coalesce({txt('alertas_resumen')}, 'Sin alertas')" if has("alertas_resumen") else "'Sin alertas'"
        jira_open_count_expr = "coalesce(jira_open_count, 0)" if has("jira_open_count") else "0"
        jira_bucket_expr = txt("jira_board_bucket") if has("jira_board_bucket") else "null"
        marca_expr = txt("marca") if has("marca") else "null"
        modelo_expr = txt("modelo") if has("modelo") else "null"
        ml_alert_code_expr = txt("ml_alert_code") if has("ml_alert_code") else "null"

        ml_motivo_parts = []
        if has("ml_alert_code"):
            ml_motivo_parts.append(txt("ml_alert_code"))
        if has("ml_motivo_principal"):
            ml_motivo_parts.append(txt("ml_motivo_principal"))
        ml_motivo_expr = f"coalesce({', '.join(ml_motivo_parts)}, '—')" if ml_motivo_parts else "'—'"

        ml_risk_expr = f"upper({txt('ml_risk_level')})" if has("ml_risk_level") else "null"
        ml_score_expr = "coalesce(ml_score, 0)" if has("ml_score") else "0"
        ml_link_expr = txt("ml_link_path") if has("ml_link_path") else "null"
        ml_scored_at_expr = "cast(ml_scored_at as text)" if has("ml_scored_at") else "null"
        ml_score_v2_expr = "ml_score_v2" if has("ml_score_v2") else ml_score_expr
        ml_risk_v2_expr = txt("ml_risk_level_v2") if has("ml_risk_level_v2") else ml_risk_expr
        ml_alert_v2_expr = txt("ml_alert_code_v2") if has("ml_alert_code_v2") else ml_alert_code_expr
        ml_score_v3_expr = "ml_score_v3" if has("ml_score_v3") else "null"
        ml_risk_v3_expr = txt("ml_risk_level_v3") if has("ml_risk_level_v3") else "null"
        ml_alert_v3_expr = txt("ml_alert_code_v3") if has("ml_alert_code_v3") else "null"
        ml_main_driver_v3_expr = txt("ml_main_driver_v3") if has("ml_main_driver_v3") else "null"
        ml_reason_v3_expr = txt("ml_risk_reason_v3") if has("ml_risk_reason_v3") else "null"
        ml_scored_at_v3_expr = "cast(ml_scored_at_v3 as text)" if has("ml_scored_at_v3") else "null"
        ml_source_available_v3_expr = "coalesce(ml_source_available_v3, false)" if has("ml_source_available_v3") else "false"
        ml_version_expr = txt("ml_version") if has("ml_version") else "'v2'"
        ml_delta_expr = "ml_score_delta_v3_vs_v2" if has("ml_score_delta_v3_vs_v2") else "null"

        priority_rank_expr = "coalesce(priority_final_rank, 999999)" if has("priority_final_rank") else "999999"
        priority_sort_expr = "coalesce(priority_final_sort_key, 0)" if has("priority_final_sort_key") else "0"

        persona_asignada_expr = (
            "coalesce(nullif(trim(persona_visible), ''), nullif(trim(persona_asignada), ''), nullif(trim(persona_actual), ''), '—')"
            if has("persona_visible") or has("persona_asignada") or has("persona_actual")
            else "'—'"
        )
        last_event_persona_expr = "coalesce(nullif(trim(last_event_persona), ''), '—')" if has("last_event_persona") else "'—'"
        mtr_detail_cte = _build_mtr_detail_cte(insp)

        where_clause = ""
        if has("estado_operativo") or has("es_activo_operativo"):
            where_clause = f"where {_active_operational_predicate(has)}"

        sql = f"""
        with ml_hist as (
            select
                entity_id as id_equipo,
                alert_code::text as ml_alert_code_hist,
                drivers_json as ml_drivers_json,
                created_at as ml_scored_at_hist,
                row_number() over (
                    partition by entity_id
                    order by created_at desc
                ) as rn
            from analytics.ml_scores_v2_history
        ),
        {mtr_detail_cte},
        base as (
            select
                {id_expr} as id_equipo,
                {estado_expr} as estado,
                {persona_asignada_expr} as asignado_a,
                {last_event_persona_expr} as last_event_persona,

                case
                    when upper(coalesce({alertas_severidad_expr}, 'NORMAL')) in ('CRITICAL', 'ALTA') then 'CRITICAL'
                    when upper(coalesce({alertas_severidad_expr}, 'NORMAL')) in ('WARN', 'MEDIA') then 'WARN'
                    when upper(coalesce({alertas_severidad_expr}, 'NORMAL')) in ('INFO', 'BAJA') then 'INFO'
                    else 'NORMAL'
                end as severidad_base,

                {cliente_expr} as cliente,
                {localizacion_expr} as localizacion,
                {ciudad_expr} as ciudad_comuna,
                {marca_modelo_expr} as marca_modelo,
                {tipo_colab_expr} as tipo_colaborador,

                {alertas_resumen_expr} as alertas_resumen,
                {jira_open_count_expr} as jira_open_count,
                {jira_bucket_expr} as jira_board_bucket,
                {marca_expr} as marca,
                {modelo_expr} as modelo,
                {ml_alert_code_expr} as ml_alert_code,
                {ml_motivo_expr} as ml_motivo_principal,
                {ml_risk_expr} as ml_risk_level,
                {ml_score_expr} as ml_score,
                {ml_link_expr} as ml_link_path,
                {ml_scored_at_expr} as ml_scored_at,
                {ml_score_v2_expr} as ml_score_v2,
                {ml_risk_v2_expr} as ml_risk_level_v2,
                {ml_alert_v2_expr} as ml_alert_code_v2,
                {ml_score_v3_expr} as ml_score_v3,
                {ml_risk_v3_expr} as ml_risk_level_v3,
                {ml_alert_v3_expr} as ml_alert_code_v3,
                {ml_main_driver_v3_expr} as ml_main_driver_v3,
                {ml_reason_v3_expr} as ml_risk_reason_v3,
                {ml_scored_at_v3_expr} as ml_scored_at_v3,
                {ml_source_available_v3_expr} as ml_source_available_v3,
                {ml_version_expr} as ml_version,
                {ml_delta_expr} as ml_score_delta_v3_vs_v2,
                {priority_rank_expr} as priority_final_rank,
                {priority_sort_expr} as priority_final_sort_key
            from analytics.mart_equipos_estado_actual
            {where_clause}
        )
        select
            base.id_equipo as id_equipo,
            base.estado,
            coalesce(mtr_detail.persona_asignada, nullif(trim(base.asignado_a), ''), '—') as asignado_a,
            coalesce(nullif(trim(base.last_event_persona), ''), '—') as last_event_persona,

            case
                when coalesce(ml_score, 0) >= 8 then 'CRITICAL'
                when coalesce(ml_score, 0) >= 4 then 'WARN'
                when severidad_base in ('CRITICAL', 'WARN', 'INFO', 'NORMAL') then severidad_base
                else 'NORMAL'
            end as severidad,

            coalesce(base.cliente, mtr_detail.cliente, '—') as cliente,
            coalesce(base.localizacion, mtr_detail.localizacion) as localizacion,
            coalesce(base.ciudad_comuna, mtr_detail.ciudad_comuna) as ciudad_comuna,
            coalesce(
                base.marca_modelo,
                nullif(trim(concat_ws(' ', mtr_detail.marca, mtr_detail.modelo)), ''),
                '—'
            ) as marca_modelo,
            coalesce(base.tipo_colaborador, mtr_detail.tipo_colaborador, '—') as tipo_colaborador,
            base.alertas_resumen,
            base.jira_open_count,
            base.jira_board_bucket,
            coalesce(base.marca, mtr_detail.marca) as marca,
            coalesce(base.modelo, mtr_detail.modelo) as modelo,
            coalesce(base.ml_alert_code, ml_hist.ml_alert_code_hist) as ml_alert_code,
            base.ml_motivo_principal,
            base.ml_risk_level,
            base.ml_score,
            base.ml_link_path,
            coalesce(base.ml_scored_at, cast(ml_hist.ml_scored_at_hist as text)) as ml_scored_at,
            ml_hist.ml_drivers_json,
            base.priority_final_rank,
            base.priority_final_sort_key
        from base
        left join ml_hist
          on upper(ml_hist.id_equipo) = upper(base.id_equipo)
         and ml_hist.rn = 1
        left join mtr_detail
          on mtr_detail.id_equipo = upper(base.id_equipo)
        order by base.priority_final_rank asc, base.priority_final_sort_key desc, base.id_equipo asc
        limit :limit
        """

        with engine.connect() as c:
            rows = c.execute(text(sql), {"limit": limit}).mappings().all()

        items = []
        for row in rows:
            item = dict(row)
            item["ml_explain_summary"] = _ml_explain_summary(
                item.get("ml_alert_code"),
                item.get("ml_motivo_principal"),
                item.get("ml_drivers_json"),
            )
            item["ml_explain_summary_v3"] = build_ml_v3_summary(item)
            item["ml_versions"] = build_ml_versions_payload(item)
            items.append(item)

        if _has_table(engine, "analytics", "mart_mtr_jira_reconciliacion"):
            existing_ids = {str(item.get("id_equipo") or "").upper() for item in items}
            extra_sql = """
            select
              r.id_equipo,
              coalesce(nullif(r.mtr_estado_operativo, ''), nullif(r.jira_estado_equipo_top, ''), '—') as estado,
              coalesce(nullif(r.persona_asignada, ''), nullif(r.persona_actual, ''), '—') as asignado_a,
              '—' as last_event_persona,
              case
                when coalesce(r.flag_inconsistencia_mtr_jira, false) then 'WARN'
                when coalesce(r.in_jira, false) then 'INFO'
                else 'NORMAL'
              end as severidad,
              coalesce(nullif(r.mtr_cliente, ''), nullif(r.cliente_actual, ''), 'SIN_CLIENTE') as cliente,
              coalesce(nullif(trim(concat_ws(' ', r.marca, r.modelo)), ''), r.jira_summary_top, '—') as marca_modelo,
              coalesce(m.tipo_colaborador, '—') as tipo_colaborador,
              coalesce(nullif(r.localizacion, ''), m.localizacion) as localizacion,
              coalesce(nullif(r.ciudad_comuna, ''), m.ciudad_comuna) as ciudad_comuna,
              coalesce(r.conciliacion_resumen, 'Sin alertas') as alertas_resumen,
              coalesce(r.jira_open_count, 0) as jira_open_count,
              nullif(r.jira_board_bucket_top, '') as jira_board_bucket,
              coalesce(nullif(r.marca, ''), m.marca) as marca,
              coalesce(nullif(r.modelo, ''), m.modelo, r.jira_summary_top) as modelo,
              null::text as ml_alert_code,
              r.conciliacion_resumen as ml_motivo_principal,
              null::text as ml_risk_level,
              0::numeric as ml_score,
              null::text as ml_link_path,
              null::text as ml_scored_at,
              null::jsonb as ml_drivers_json,
              999999::numeric as priority_final_rank,
              0::numeric as priority_final_sort_key,
              r.conciliacion_estado,
              r.origen_principal
            from analytics.mart_mtr_jira_reconciliacion r
            left join analytics.stg_mtr_equipos_asignados_detalle m
              on upper(m.id_equipo) = upper(r.id_equipo)
            where (
              coalesce(r.flag_jira_sin_match_mtr, false)
              or coalesce(r.flag_mtr_sin_match_jira, false)
              or coalesce(r.flag_inconsistencia_mtr_jira, false)
            )
            order by
              case
                when r.conciliacion_estado = 'JIRA_SIN_MATCH_MTR' then 1
                when r.conciliacion_estado = 'ESTADO_DISTINTO' then 2
                when r.conciliacion_estado = 'ASIGNADO_JIRA_DISPONIBLE_MTR' then 3
                when r.conciliacion_estado = 'RESERVADO_JIRA_ASIGNADO_MTR' then 4
                else 5
              end,
              r.id_equipo asc
            limit :limit
            """
            with engine.connect() as c:
                extra_rows = c.execute(text(extra_sql), {"limit": limit}).mappings().all()

            for row in extra_rows:
                item = dict(row)
                if str(item.get("id_equipo") or "").upper() in existing_ids:
                    continue
                item["ml_explain_summary"] = _ml_explain_summary(
                    item.get("ml_alert_code"),
                    item.get("ml_motivo_principal"),
                    item.get("ml_drivers_json"),
                )
                item["ml_explain_summary_v3"] = None
                item["ml_versions"] = None
                items.append(item)
                existing_ids.add(str(item.get("id_equipo") or "").upper())

        return {"count": len(items), "items": items}

    except SQLAlchemyError as e:
        raise _internal_api_error("equipos", e)

@router.get("/planeacion-acciones")
def get_planeacion_acciones(limit: int = 400):
    """
    Planeación basada en decisiones operativas derivadas del parque actual.
    Categorías:
      - retiro_renovacion
      - compra_staffing
      - movimientos_core
      - asignacion_reasignacion
      - mantener
    """
    try:
        insp = inspect(engine)
        cols = {c["name"] for c in insp.get_columns("mart_equipos_estado_actual", schema="analytics")}

        def has(name: str) -> bool:
            return name in cols

        def txt(name: str) -> str:
            return f"nullif(trim({name}), '')"

        id_expr = "coalesce(id_equipo, 'SIN-SKU')" if has("id_equipo") else "'SIN-SKU'"

        estado_parts = []
        if has("estado_equipo"):
            estado_parts.append(txt("estado_equipo"))
        if has("estado_operativo"):
            estado_parts.append(txt("estado_operativo"))
        estado_expr = f"coalesce({', '.join(estado_parts)}, '—')" if estado_parts else "'—'"

        cliente_expr = txt("cliente") if has("cliente") else "null"

        marca_modelo_parts = []
        if has("marca") and has("modelo"):
            marca_modelo_parts.append("nullif(trim(concat_ws(' ', marca, modelo)), '')")
        elif has("modelo"):
            marca_modelo_parts.append(txt("modelo"))
        elif has("marca"):
            marca_modelo_parts.append(txt("marca"))
        marca_modelo_expr = f"coalesce({', '.join(marca_modelo_parts)}, '—')" if marca_modelo_parts else "'—'"

        tipo_colab_expr = txt("tipo_colaborador") if has("tipo_colaborador") else "'unknown'"
        alertas_resumen_expr = f"coalesce({txt('alertas_resumen')}, 'Sin alertas')" if has("alertas_resumen") else "'Sin alertas'"
        ml_score_expr = "coalesce(ml_score, 0)" if has("ml_score") else "0"
        persona_expr = txt("last_event_persona") if has("last_event_persona") else "null"
        clasificacion_expr = txt("clasificacion_operacional") if has("clasificacion_operacional") else "null"
        decision_operativa_expr = txt("decision_sugerida_operativa") if has("decision_sugerida_operativa") else "null"
        evidencia_operativa_expr = txt("evidencia_fuente_operativa") if has("evidencia_fuente_operativa") else "null"
        fuente_operativa_expr = txt("fuente_clasificacion_operativa") if has("fuente_clasificacion_operativa") else "null"

        where_clause = ""
        if has("estado_operativo") or has("es_activo_operativo"):
            where_clause = f"where {_active_operational_predicate(has)}"

        sql = f"""
        select
            {id_expr} as id_equipo,
            {estado_expr} as estado,
            {cliente_expr} as cliente,
            {marca_modelo_expr} as marca_modelo,
            {persona_expr} as persona,
            lower(coalesce({tipo_colab_expr}, 'unknown')) as tipo_colaborador,
            {alertas_resumen_expr} as alertas_resumen,
            {ml_score_expr} as ml_score,
            {clasificacion_expr} as clasificacion_operacional,
            {decision_operativa_expr} as decision_sugerida_operativa,
            {evidencia_operativa_expr} as evidencia_fuente_operativa,
            {fuente_operativa_expr} as fuente_clasificacion_operativa
        from analytics.mart_equipos_estado_actual
        {where_clause}
        order by id_equipo asc
        limit :limit
        """

        with engine.connect() as c:
            rows = c.execute(text(sql), {"limit": limit}).mappings().all()

        def normalize_family(modelo: str) -> str:
            m = (modelo or "").lower()
            if "macbook" in m or "apple" in m or "a2141" in m or "a2442" in m:
                return "MAC"
            if "elitebook" in m or "hp " in m or m.startswith("hp"):
                return "HP"
            if "dell" in m or "latitude" in m:
                return "DELL"
            if "lenovo" in m or "thinkpad" in m or "yoga" in m:
                return "LENOVO"
            return "OTRO"

        def decision_for(item: dict) -> dict:
            modelo = (item.get("marca_modelo") or "").lower()
            alerta = (item.get("alertas_resumen") or "").lower()
            score = float(item.get("ml_score") or 0)
            tipo = (item.get("tipo_colaborador") or "unknown").lower()
            clasificacion = (item.get("clasificacion_operacional") or "").upper()

            if clasificacion in {"VENDIDO", "DADO_DE_BAJA", "BAJA_REQUERIDA"}:
                return {
                    "decision": item.get("decision_sugerida_operativa") or "Dar de baja / retirar",
                    "categoria": "retiro_renovacion",
                    "motivo": item.get("evidencia_fuente_operativa") or clasificacion,
                }

            if clasificacion == "RENOVAR":
                return {
                    "decision": item.get("decision_sugerida_operativa") or "Renovar",
                    "categoria": "compra_staffing" if tipo == "staffing" else "retiro_renovacion",
                    "motivo": item.get("evidencia_fuente_operativa") or clasificacion,
                }

            if clasificacion == "OBSERVACION":
                return {
                    "decision": item.get("decision_sugerida_operativa") or "Observación",
                    "categoria": "observacion",
                    "motivo": item.get("evidencia_fuente_operativa") or clasificacion,
                }

            if clasificacion == "MANTENER":
                return {
                    "decision": item.get("decision_sugerida_operativa") or "Mantener",
                    "categoria": "mantener",
                    "motivo": item.get("evidencia_fuente_operativa") or clasificacion,
                }

            # 1) Política de modelo manda primero
            if "dell" in modelo or "latitude" in modelo:
                return {
                    "decision": "Dar de baja / renovar",
                    "categoria": "retiro_renovacion",
                    "motivo": "Política Dell",
                }

            if "asus" in modelo:
                return {
                    "decision": "Dar de baja / renovar",
                    "categoria": "retiro_renovacion",
                    "motivo": "Política Asus",
                }

            if tipo == "staffing" and "a2141" in modelo:
                return {
                    "decision": "Renovar",
                    "categoria": "compra_staffing",
                    "motivo": "Staffing con Apple A2141",
                }

            if any(code in modelo for code in ["a2442", "a2485", "a2338", "a2337"]):
                return {
                    "decision": "Observación",
                    "categoria": "observacion",
                    "motivo": "Mac con vida útil vigente",
                }

            # 2) Reglas operativas
            if "sin asignación" in alerta or "sin asignacion" in alerta:
                return {
                    "decision": "Asignar o reasignar",
                    "categoria": "asignacion_reasignacion",
                    "motivo": "Sin asignación",
                }

            if score >= 8 and tipo == "staffing":
                return {
                    "decision": "Revisión inmediata",
                    "categoria": "compra_staffing",
                    "motivo": "Score alto en staffing",
                }

            if "rotación" in alerta or "rotacion" in alerta:
                if tipo == "staffing":
                    return {
                        "decision": "Revisión inmediata",
                        "categoria": "compra_staffing",
                        "motivo": "Rotación alta en staffing",
                    }
                return {
                    "decision": "Revisar estabilidad",
                    "categoria": "movimientos_core" if tipo == "core" else "mantener",
                    "motivo": "Rotación alta",
                }

            if tipo == "core":
                return {
                    "decision": "Evaluar reutilización",
                    "categoria": "movimientos_core",
                    "motivo": "Parque Core",
                }

            return {
                "decision": "Mantener",
                "categoria": "mantener",
                "motivo": "Operación normal",
            }

        items = []
        bloques = {
            "retiro_renovacion": [],
            "compra_staffing": [],
            "movimientos_core": [],
            "asignacion_reasignacion": [],
            "observacion": [],
            "mantener": [],
        }
        compras_por_familia = {
            "MAC": 0,
            "HP": 0,
            "OTRO": 0,
        }

        for r in rows:
            base = {
                "id_equipo": r["id_equipo"],
                "estado": r["estado"],
                "cliente": r["cliente"],
                "marca_modelo": r["marca_modelo"],
                "persona": r.get("persona"),
                "tipo_colaborador": r["tipo_colaborador"],
                "alertas_resumen": r["alertas_resumen"],
                "ml_score": float(r["ml_score"] or 0),
                "familia_modelo": normalize_family(r["marca_modelo"] or ""),
                "clasificacion_operacional": r.get("clasificacion_operacional"),
                "decision_sugerida_operativa": r.get("decision_sugerida_operativa"),
                "evidencia_fuente_operativa": r.get("evidencia_fuente_operativa"),
                "fuente_clasificacion_operativa": r.get("fuente_clasificacion_operativa"),
            }

            dec = decision_for(base)
            item = {**base, **dec}
            items.append(item)
            bloques[dec["categoria"]].append(item)

            if dec["categoria"] == "compra_staffing":
                fam = item["familia_modelo"]
                if fam == "MAC":
                    compras_por_familia["MAC"] += 1
                elif fam == "HP":
                    compras_por_familia["HP"] += 1
                else:
                    compras_por_familia["OTRO"] += 1

        resumen = {
            "retiro_renovacion": len(bloques["retiro_renovacion"]),
            "compra_staffing": len(bloques["compra_staffing"]),
            "movimientos_core": len(bloques["movimientos_core"]),
            "asignacion_reasignacion": len(bloques["asignacion_reasignacion"]),
            "observacion": len(bloques["observacion"]),
            "mantener": len(bloques["mantener"]),
            "total": len(items),
        }

        staffing_obsoletos: dict[tuple[str, str, str], dict[str, Any]] = {}
        for item in items:
            if (item.get("tipo_colaborador") or "").lower() != "staffing":
                continue
            if (item.get("estado") or "").upper() != "ASIGNADO":
                continue
            if (item.get("clasificacion_operacional") or "").upper() not in {"RENOVAR", "BAJA_REQUERIDA", "OBSERVACION"}:
                continue
            key = (
                item.get("marca_modelo") or "Sin modelo",
                item.get("clasificacion_operacional") or "SIN_CLASIFICACION",
                item.get("fuente_clasificacion_operativa") or "SIN_FUENTE",
            )
            bucket = staffing_obsoletos.setdefault(
                key,
                {
                    "modelo": key[0],
                    "cantidad": 0,
                    "skus": [],
                    "personas": [],
                    "clientes": [],
                    "decision_sugerida": item.get("decision_sugerida_operativa"),
                    "evidencia_fuente": item.get("evidencia_fuente_operativa"),
                    "clasificacion_operacional": item.get("clasificacion_operacional"),
                    "fuente_clasificacion_operativa": item.get("fuente_clasificacion_operativa"),
                },
            )
            bucket["cantidad"] += 1
            bucket["skus"].append(item.get("id_equipo"))
            if item.get("persona"):
                bucket["personas"].append(item["persona"])
            if item.get("cliente"):
                bucket["clientes"].append(item["cliente"])

        obsoletos_staffing_asignados = []
        for bucket in staffing_obsoletos.values():
            bucket["skus"] = sorted({sku for sku in bucket["skus"] if sku})
            bucket["personas"] = sorted({persona for persona in bucket["personas"] if persona})
            bucket["clientes"] = sorted({cliente for cliente in bucket["clientes"] if cliente})
            obsoletos_staffing_asignados.append(bucket)
        obsoletos_staffing_asignados.sort(
            key=lambda item: (
                0 if item.get("clasificacion_operacional") == "BAJA_REQUERIDA" else 1,
                item.get("modelo") or "",
            )
        )

        excluded_sql = """
        select
          coalesce(nullif(trim(concat_ws(' ', marca, modelo)), ''), 'Sin modelo') as modelo,
          count(*)::int as cantidad,
          array_agg(id_equipo order by id_equipo) as skus,
          array_agg(coalesce(nullif(trim(last_event_persona), ''), 'SIN_PERSONA') order by coalesce(nullif(trim(last_event_persona), ''), 'SIN_PERSONA')) as personas,
          array_agg(coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE') order by coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE')) as clientes,
          max(decision_sugerida_operativa) as decision_sugerida,
          max(evidencia_fuente_operativa) as evidencia_fuente,
          max(clasificacion_operacional) as clasificacion_operacional
        from analytics.mart_equipos_estado_actual
        where lower(coalesce(tipo_colaborador, '')) like '%staff%'
          and not coalesce(es_activo_operativo, true)
          and (
            upper(coalesce(modelo, '')) like '%A2141%'
            or (
              upper(coalesce(marca, '')) = 'DELL'
              and regexp_replace(upper(coalesce(modelo, '')), '[^A-Z0-9]+', '', 'g') like '%LATITUDE7400%'
            )
          )
        group by 1
        order by modelo
        """
        with engine.connect() as c:
            excluded_rows = [dict(row) for row in c.execute(text(excluded_sql)).mappings().all()]

        obsoletos_staffing_activos_resumen = {
            "A2141": 0,
            "DELL_LATITUDE_7400": 0,
        }
        for item in obsoletos_staffing_asignados:
            model_key = re.sub(r"[^A-Z0-9]+", "", (item.get("modelo") or "").upper())
            if "A2141" in model_key:
                obsoletos_staffing_activos_resumen["A2141"] += int(item.get("cantidad") or 0)
            elif "LATITUDE7400" in model_key:
                obsoletos_staffing_activos_resumen["DELL_LATITUDE_7400"] += int(item.get("cantidad") or 0)

        return {
            "count": len(items),
            "resumen": resumen,
            "compras_por_familia": compras_por_familia,
            "bloques": bloques,
            "obsoletos_staffing_asignados": obsoletos_staffing_asignados,
            "obsoletos_staffing_activos_resumen": obsoletos_staffing_activos_resumen,
            "excluidos_parque_operativo": excluded_rows,
        }

    except SQLAlchemyError as e:
        raise _internal_api_error("planeacion_acciones", e)


@router.get("/planeacion-gap-compra")
def get_planeacion_gap_compra():
    """
    Gap simple de compra para Acid Labs basado en:
      - demanda operativa reciente del MTR
      - oferta inmediata real del parque
      - recuperables como oferta cercana
    """
    try:
        insp = inspect(engine)
        cols = {c["name"] for c in insp.get_columns("mart_equipos_estado_actual", schema="analytics")}

        def has(name: str) -> bool:
            return name in cols

        def txt(name: str) -> str:
            return f"nullif(trim({name}), '')" if has(name) else "null::text"

        cliente_parts = []
        for candidate in ("cliente", "cliente_actual"):
            if has(candidate):
                cliente_parts.append(txt(candidate))
        cliente_expr = f"coalesce({', '.join(cliente_parts)})" if cliente_parts else "null::text"

        estado_operativo_expr = f"upper(coalesce({txt('estado_operativo')}, 'SIN_ESTADO'))"
        activo_operativo_expr = "coalesce(es_activo_operativo, true)" if has("es_activo_operativo") else "null::boolean"

        estado_detail_parts = []
        for candidate in (
            "estado_equipo",
            "estado_equipo_mtr",
            "jira_board_bucket",
            "jira_status_name",
            "last_event_detalle",
            "alertas_resumen",
        ):
            if has(candidate):
                estado_detail_parts.append(txt(candidate))
        estado_detail_expr = (
            "upper(concat_ws(' | ', " + ", ".join(estado_detail_parts) + "))"
            if estado_detail_parts
            else "''"
        )

        persona_expr = txt("persona_asignada")

        sql_stock = f"""
        with base as (
          select
            case
              when upper(coalesce({cliente_expr}, '')) like '%2BRAIN%' then '2Brains'
              when upper(coalesce({cliente_expr}, '')) like '%ACID%' then 'Acid Labs'
              else null
            end as empresa,
            {estado_operativo_expr} as estado_operativo_raw,
            {activo_operativo_expr} as es_activo_operativo_raw,
            {estado_detail_expr} as estado_detalle_raw,
            {persona_expr} as persona_asignada_raw
          from analytics.mart_equipos_estado_actual
        ),
        classified as (
          select
            empresa,
            estado_operativo_raw,
            es_activo_operativo_raw,
            coalesce(estado_detalle_raw, '') as estado_detalle_raw,
            persona_asignada_raw,
            case
              when estado_operativo_raw = 'DISPONIBLE'
                and persona_asignada_raw is null
                and coalesce(estado_detalle_raw, '') not like '%RESERV%'
                and coalesce(estado_detalle_raw, '') not like '%RESGUARDO%'
                and coalesce(estado_detalle_raw, '') not like '%REPAR%'
                and coalesce(estado_detalle_raw, '') not like '%REVISION%'
                and coalesce(estado_detalle_raw, '') not like '%RECUP%'
                and coalesce(estado_detalle_raw, '') not like '%DEFECT%'
                and coalesce(estado_detalle_raw, '') not like '%POOL%'
                and coalesce(estado_detalle_raw, '') not like '%STAND%'
                and coalesce(estado_detalle_raw, '') not like '%ASIGNAD%'
              then 1 else 0
            end as is_oferta_inmediata,
            case
              when coalesce(estado_detalle_raw, '') like '%RECUP%'
                or coalesce(estado_detalle_raw, '') like '%REPAR%'
                or coalesce(estado_detalle_raw, '') like '%REVISION%'
              then 1 else 0
            end as is_oferta_cercana
          from base
        )
        select
          count(*) filter (where is_oferta_inmediata = 1) as oferta_inmediata,
          count(*) filter (where is_oferta_cercana = 1) as oferta_cercana
        from classified
        where empresa = 'Acid Labs'
          and coalesce(es_activo_operativo_raw, estado_operativo_raw <> 'BAJA')
        """

        relation_names = _analytics_relation_names(insp)
        has_mtr_stats = "int_mtr_eventos_dedup_stats" in relation_names

        sql_demand = """
        with mensual as (
          select
            date_trunc('month', fecha_evento_dia)::date as mes,
            count(*) filter (
              where tipo_evento = 'INGRESO'
                and coalesce(ingreso_presiona_compra, true)
            ) as ingresos_presion_compra
          from analytics.int_mtr_eventos_dedup_stats
          where upper(coalesce(cliente, '')) like '%ACID%'
            and fecha_evento_dia >= (date_trunc('month', current_date) - interval '12 months')
          group by 1
        ),
        anchor as (
          select max(mes) as max_mes
          from mensual
        ),
        recent as (
          select
            gs::date as mes,
            coalesce(m.ingresos_presion_compra, 0) as ingresos_presion_compra
          from anchor a
          cross join lateral generate_series(
            a.max_mes - interval '2 months',
            a.max_mes,
            interval '1 month'
          ) as gs
          left join mensual m
            on m.mes = gs::date
          where a.max_mes is not null
        )
        select
          count(*) as meses_considerados,
          coalesce(avg(ingresos_presion_compra)::numeric, 0) as promedio_ingresos,
          coalesce(sum(ingresos_presion_compra), 0) as ingresos_total_ventana,
          coalesce(
            string_agg(
              to_char(mes, 'YYYY-MM') || ': ' || ingresos_presion_compra::text,
              ' | '
              order by mes desc
            ),
            ''
          ) as ventana_resumen
        from recent
        """

        with engine.connect() as conn:
            stock_row = conn.execute(text(sql_stock)).mappings().first() or {}
            demand_row = (
                conn.execute(text(sql_demand)).mappings().first()
                if has_mtr_stats
                else {
                    "meses_considerados": 0,
                    "promedio_ingresos": 0,
                    "ingresos_total_ventana": 0,
                    "ventana_resumen": "",
                }
            )

        oferta_inmediata = int(stock_row.get("oferta_inmediata") or 0)
        oferta_cercana = int(stock_row.get("oferta_cercana") or 0)
        recuperables_ponderados = int(round(oferta_cercana * 0.5))
        meses_considerados = int(demand_row.get("meses_considerados") or 0)
        promedio_ingresos = float(demand_row.get("promedio_ingresos") or 0)
        demanda_operativa_estimada = int(ceil(promedio_ingresos)) if promedio_ingresos > 0 else 0
        colchon_operativo = 2
        gap_bruto = (demanda_operativa_estimada + colchon_operativo) - (
            oferta_inmediata + recuperables_ponderados
        )
        gap_resultante = max(gap_bruto, 0)
        exceso_stock = max(gap_bruto * -1, 0)
        if demanda_operativa_estimada <= 0:
            pressure_score = 0.0
            recomendacion, lectura = _gap_no_pressure_recommendation()
        else:
            pressure_score = round(
                (demanda_operativa_estimada + colchon_operativo) / max(1, oferta_inmediata),
                2,
            )
            recomendacion, lectura = _gap_recommendation("Acid Labs", pressure_score)

        if exceso_stock > 0 and pressure_score < 1:
            lectura = "La oferta inmediata actual supera la demanda operativa reciente más el colchón mínimo."

        return {
            "scope_label": "Acid Labs",
            "scope_note": "Primera versión basada en ingresos MTR recientes y oferta real del parque. La oferta inmediata ahora excluye STAND_BY, POOL, reservados y equipos con señales de reparación o revisión.",
            "formula": "gap = demanda_operativa_estimada + colchón mínimo - (oferta inmediata real + recuperables ponderados)",
            "pressure_formula": "presión = (demanda operativa estimada + colchón mínimo) / max(1, oferta inmediata real)",
            "items": [
                {
                    "empresa": "Acid Labs",
                    "demanda_operativa_estimada": demanda_operativa_estimada,
                    "demanda_fuente": (
                        f"Promedio de ingresos MTR con presión de compra en ventana consecutiva de {meses_considerados or 0} meses recientes"
                    ),
                    "ventana_mtr_resumen": demand_row.get("ventana_resumen") or "Sin ventana MTR disponible",
                    "meses_considerados": meses_considerados,
                    "colchon_operativo": colchon_operativo,
                    "oferta_inmediata": oferta_inmediata,
                    "oferta_cercana": oferta_cercana,
                    "recuperables_ponderados": recuperables_ponderados,
                    "gap_bruto": gap_bruto,
                    "gap_resultante": gap_resultante,
                    "exceso_stock": exceso_stock,
                    "pressure_score": pressure_score,
                    "estrategia_recomendada": "Compra bimensual",
                    "recomendacion": recomendacion,
                    "lectura": lectura,
                }
            ],
            "supuestos": [
                "Oferta inmediata real considera solo equipos en estado operativo DISPONIBLE, sin usuario asignado y sin señales de reserva, reparación, revisión, recuperación o resguardo.",
                "STAND_BY y POOL quedan fuera de la oferta inmediata porque no representan disponibilidad operativa asegurada.",
                "Oferta cercana agrupa estados con RECUP, REPAR o REVISION.",
                "Los recuperables se ponderan al 50% para no tratarlos como stock inmediato.",
                "La demanda se estima con el promedio de ingresos MTR recientes que presionan compra en una ventana consecutiva de hasta 3 meses dentro de los últimos 12 meses.",
                "Se agrega un colchón mínimo de 2 equipos para no operar al límite.",
                "La presión se calcula sobre oferta inmediata real, no sobre recuperables, para reflejar urgencia operativa de corto plazo.",
                "Si el gap bruto es negativo, se muestra cobertura suficiente y exceso de stock en lugar de un gap negativo ambiguo.",
            ],
        }

    except SQLAlchemyError as e:
        raise _internal_api_error("planeacion_gap_compra", e)


def _month_label_es(value: date | None) -> str:
    months = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
    ]
    if value is None:
        return "sin mes"
    return f"{months[value.month - 1]} {value.year}"


def _day_month_label(value: date | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%d-%m")


def _to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _to_float(value: Any) -> float | None:
    try:
        return round(float(value), 2)
    except Exception:
        return None


def _clean_tracking_model_label(value: Any) -> str:
    text_value = str(value or "equipos").strip()
    return (
        text_value.replace("HP pendiente por definir", "HP")
        .replace("pendiente por definir", "por definir")
        .replace("  ", " ")
        .strip()
    )


@router.get("/planeacion-compras-resumen")
def get_planeacion_compras_resumen(
    mes: date | None = Query(default=None),
    empresa: str | None = Query(default="Acid Labs"),
):
    scope_company = (empresa or "Acid Labs").strip() or "Acid Labs"
    scope_note = (
        "Vista enfocada en Acid Labs. Las compras de 2Brains se gestionan en un flujo separado."
        if scope_company == "Acid Labs"
        else f"Vista enfocada en {scope_company}."
    )
    try:
        insp = inspect(engine)
        relation_names = _analytics_relation_names(insp)
        required_relations = {
            "mart_planeacion_compras_tendencia_mes",
            "mart_planeacion_forecast_demanda_mes",
            "mart_planeacion_compras_resumen_mes",
            "mart_planeacion_compras_tracking",
            "fact_planeacion_compras",
            "mart_equipos_estado_actual",
        }

        if not required_relations.issubset(relation_names):
            missing = sorted(required_relations - relation_names)
            return {
                "mes": (mes or date.today().replace(day=1)).isoformat(),
                "scope": scope_company,
                "scope_note": scope_note,
                "summary": {},
                "executive_reading": {},
                "decision_recommended": {},
                "formula_breakdown": {},
                "projection_risk": {},
                "scenarios": [],
                "forecast": {},
                "trend": [],
                "month_options": [],
                "by_company": [],
                "by_provider": [],
                "by_model": [],
                "detail": [],
                "alertas": [],
                "compras_tracking": [],
                "compras_tracking_note": None,
                "compras_mes": {},
                "capex": {},
                "may_preview": {},
                "ml_risk": {"groups": {}, "summary": {}, "policy_notes": []},
                "pending_notes": [
                    "Faltan relaciones analíticas para planeación de compras. Ejecuta dbt seed/run antes de consultar este bloque.",
                    f"Relaciones faltantes: {', '.join(missing)}",
                ],
            }

        sql_default_month = """
        select max(mes) as mes
        from analytics.mart_planeacion_compras_tendencia_mes
        where not es_proyeccion
        """

        sql_summary = """
        select
          mes,
          es_proyeccion,
          mes_base_proyeccion,
          fuente_presion,
          mtr_ingresos_total,
          demanda_presion_compra_mes,
          salidas_mes,
          movimientos_total_mes,
          stock_heredado_confirmado,
          stock_heredado_proyectado,
          compras_nuevas_confirmadas_mes,
          compras_nuevas_pendientes_mes,
          total_confirmadas,
          total_pendientes,
          stock_confirmado,
          stock_proyectado,
          stock_disponible_confirmado,
          stock_disponible_total,
          empresas_con_compra,
          proveedores_activos,
          modelos_distintos,
          mes_siguiente,
          balance_confirmado_vs_presion_mes,
          balance_total_vs_presion_mes,
          cobertura_confirmada_ratio,
          cobertura_total_ratio,
          lectura_preparacion,
          nota_mes
        from analytics.mart_planeacion_compras_tendencia_mes
        where mes = :mes
        """

        sql_trend = """
        select
          mes,
          es_proyeccion,
          mes_base_proyeccion,
          fuente_presion,
          mtr_ingresos_total,
          demanda_presion_compra_mes,
          stock_heredado_confirmado,
          stock_heredado_proyectado,
          compras_nuevas_confirmadas_mes,
          compras_nuevas_pendientes_mes,
          total_confirmadas,
          total_pendientes,
          stock_confirmado,
          stock_proyectado,
          stock_disponible_confirmado,
          stock_disponible_total,
          balance_confirmado_vs_presion_mes,
          balance_total_vs_presion_mes,
          cobertura_confirmada_ratio,
          cobertura_total_ratio,
          lectura_preparacion,
          nota_mes
        from analytics.mart_planeacion_compras_tendencia_mes
        order by mes
        """

        sql_forecast = """
        select
          mes,
          es_proyeccion,
          presion_mes,
          presion_mes_anterior,
          presion_hace_2_meses,
          forecast_presion_base,
          forecast_presion_bajo,
          forecast_presion_alto,
          stock_confirmado,
          stock_total,
          gap_base_confirmado,
          gap_alto_confirmado,
          gap_base_total,
          gap_alto_total,
          fuente_forecast,
          insight_forecast
        from analytics.mart_planeacion_forecast_demanda_mes
        where mes = :mes
        """

        sql_forecast_segment = """
        with segments as (
          select 'extranjero'::text as segmento
          union all select 'nacional'::text
          union all select 'no_clasificado'::text
        ),
        base as (
          select
            case
              when upper(coalesce(dimension_value, 'UNKNOWN')) = 'EXTRANJERO' then 'extranjero'
              when upper(coalesce(dimension_value, 'UNKNOWN')) = 'NACIONAL' then 'nacional'
              else 'no_clasificado'
            end as segmento,
            mes,
            coalesce(presion_compra, 0)::int as presion_compra
          from analytics.mart_catastro_historia_mensual_dimension
          where dimension_name = 'ambito'
            and mes in (
              (cast(:mes as date) - interval '1 month')::date,
              (cast(:mes as date) - interval '2 month')::date,
              (cast(:mes as date) - interval '3 month')::date
            )
        )
        select
          s.segmento,
          coalesce(sum(case when b.mes = (cast(:mes as date) - interval '1 month')::date then b.presion_compra else 0 end), 0)::int as presion_mes,
          coalesce(sum(case when b.mes = (cast(:mes as date) - interval '2 month')::date then b.presion_compra else 0 end), 0)::int as presion_mes_anterior,
          coalesce(sum(case when b.mes = (cast(:mes as date) - interval '3 month')::date then b.presion_compra else 0 end), 0)::int as presion_hace_2_meses,
          round(
            (
              coalesce(sum(case when b.mes = (cast(:mes as date) - interval '1 month')::date then b.presion_compra else 0 end), 0)::numeric * 0.5
              + coalesce(sum(case when b.mes = (cast(:mes as date) - interval '2 month')::date then b.presion_compra else 0 end), 0)::numeric * 0.3
              + coalesce(sum(case when b.mes = (cast(:mes as date) - interval '3 month')::date then b.presion_compra else 0 end), 0)::numeric * 0.2
            ),
            0
          )::int as forecast_segmento
        from segments s
        left join base b
          on b.segmento = s.segmento
        group by s.segmento
        order by case s.segmento
          when 'extranjero' then 1
          when 'nacional' then 2
          else 3
        end
        """

        sql_company = """
        select
          empresa,
          sum(equipos_confirmados)::int as confirmadas,
          sum(equipos_pendientes)::int as pendientes,
          sum(stock_disponible_delta)::int as stock_confirmado,
          sum(stock_planificado_delta)::int as stock_proyectado,
          count(distinct proveedor)::int as proveedores,
          string_agg(distinct modelo, ' | ' order by modelo) as modelos
        from analytics.mart_planeacion_compras_resumen_mes
        where mes = :mes
        group by 1
        order by confirmadas desc, pendientes desc, empresa
        """

        sql_provider = """
        select
          proveedor,
          sum(equipos_confirmados)::int as confirmadas,
          sum(equipos_pendientes)::int as pendientes,
          sum(stock_disponible_delta)::int as stock_confirmado,
          sum(stock_planificado_delta)::int as stock_proyectado,
          string_agg(distinct empresa, ' | ' order by empresa) as empresas
        from analytics.mart_planeacion_compras_resumen_mes
        where mes = :mes
        group by 1
        order by confirmadas desc, pendientes desc, proveedor
        """

        sql_model = """
        select
          empresa,
          proveedor,
          marca,
          modelo,
          os_familia,
          sum(equipos_confirmados)::int as confirmadas,
          sum(equipos_pendientes)::int as pendientes,
          sum(equipos_total)::int as total
        from analytics.mart_planeacion_compras_resumen_mes
        where mes = :mes
        group by 1,2,3,4,5
        order by empresa, proveedor, marca, modelo
        """

        sql_detail = """
        select
          mes_operacion,
          id_compra_manual,
          mes_referencia,
          fecha_compra,
          empresa,
          proveedor,
          marca,
          modelo,
          os_familia,
          tipo_equipo,
          cantidad,
          estado_compra,
          tipo_stock,
          cuenta_stock_disponible,
          cuenta_stock_planificado,
          fecha_estimada_entrega,
          fecha_ingreso_real,
          observacion as observaciones
        from analytics.fact_planeacion_compras
        where mes_operacion = :mes
        order by empresa, proveedor, marca, modelo, id_compra_manual
        """

        sql_detail_all = """
        select
          mes_operacion,
          id_compra_manual,
          mes_referencia,
          fecha_compra,
          empresa,
          proveedor,
          marca,
          modelo,
          os_familia,
          tipo_equipo,
          cantidad,
          estado_compra,
          tipo_stock,
          cuenta_stock_disponible,
          cuenta_stock_planificado,
          fecha_estimada_entrega,
          fecha_ingreso_real,
          observacion as observaciones
        from analytics.fact_planeacion_compras
        where date_trunc('year', mes_operacion) = date_trunc('year', current_date)
        order by mes_operacion, empresa, proveedor, marca, modelo, id_compra_manual
        """

        sql_tracking = """
        select
          mes,
          mes_compra,
          id_compra,
          empresa,
          proveedor,
          modelo,
          cantidad,
          estado,
          tipo_stock,
          fecha_estimada_entrega,
          fecha_ingreso_real,
          accion_recomendada,
          cuenta_stock_real,
          cuenta_stock_proyectado,
          observacion
        from analytics.mart_planeacion_compras_tracking
        where mes = :mes
        order by
          case estado
            when 'PENDIENTE' then 1
            when 'CONFIRMADA' then 2
            when 'RECIBIDA' then 3
            else 4
          end,
          proveedor,
          empresa,
          modelo
        """

        sql_capex_refs = """
        select
          modelo,
          proveedor,
          empresa,
          precio_unitario,
          moneda,
          vigencia_desde,
          vigencia_hasta,
          observacion
        from analytics.stg_capex_hardware_referencias
        order by empresa, proveedor, modelo
        """

        sql_risk = """
        with base as (
          select
            coalesce(nullif(trim(marca), ''), 'SIN_MARCA') as marca,
            coalesce(nullif(trim(modelo), ''), 'SIN_MODELO') as modelo,
            coalesce(nullif(trim(tipo_colaborador), ''), 'unknown') as tipo_colaborador,
            coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE') as cliente,
            coalesce(nullif(trim(accion_regla_modelo), ''), 'SIN_ACCION') as accion_regla_modelo,
            coalesce(nullif(trim(motivo_regla_modelo), ''), 'sin_motivo') as motivo_regla_modelo,
            coalesce(ml_score_v3, ml_score, 0)::numeric as ml_score,
            coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'Sin score') as ml_risk_level,
            coalesce(movimientos_12m, 0)::int as movimientos_12m,
            coalesce(flag_rotacion_alta, false) as flag_rotacion_alta,
            coalesce(flag_renovar, false) as flag_renovar,
            coalesce(flag_renovar_regla, false) as flag_renovar_regla,
            coalesce(flag_dar_baja_regla, false) as flag_dar_baja_regla,
            coalesce(jira_open_count, 0)::int as jira_open_count,
            coalesce(presion_stock, 0)::int as presion_stock,
            coalesce(dias_a_vencer, 99999)::int as dias_a_vencer
          from analytics.mart_equipos_estado_actual
          where coalesce(es_activo_operativo, upper(coalesce(estado_operativo, 'ACTIVO')) <> 'BAJA')
        ),
        scoped as (
          select
            *,
            case
              when upper(ml_risk_level) = 'ALTA' then true
              else false
            end as flag_riesgo_alto_ml,
            case
              when upper(ml_risk_level) = 'ALTA'
                and (
                  dias_a_vencer <= 90
                  or flag_renovar
                  or flag_renovar_regla
                )
              then true
              else false
            end as flag_riesgo_alto_operativo,
            case
              when upper(ml_risk_level) = 'ALTA'
                and (
                  dias_a_vencer <= 30
                  or jira_open_count > 0
                  or movimientos_12m >= 1
                )
              then true
              else false
            end as flag_riesgo_alto_urgente,
            case
              when upper(ml_risk_level) = 'ALTA'
                and dias_a_vencer <= 30
                and (
                  jira_open_count > 0
                  or movimientos_12m >= 1
                )
              then true
              else false
            end as flag_prioridad_accion_inmediata,
            case
              when upper(marca) = 'APPLE' and upper(modelo) like '%A2141%' and lower(tipo_colaborador) like '%staff%' then 'RENOVAR'
              when upper(marca) = 'DELL' and upper(modelo) like '%LATITUDE 7400%' then 'DAR_BAJA'
              when upper(marca) = 'DELL' and upper(modelo) like '%VOSTRO 5402%' then 'DAR_BAJA'
              when upper(marca) = 'ASUS' and upper(modelo) like '%UX435E%' then 'OBSERVAR'
              when upper(marca) = 'APPLE' and upper(modelo) like '%M1 PRO%' then 'OBSERVAR'
              when upper(marca) = 'APPLE' and upper(modelo) like '%M1%' then 'OBSERVAR'
              when upper(marca) = 'HP' and upper(modelo) like '%ELITEBOOK 8 G1I 14 AI%' then 'MANTENER'
              when upper(marca) = 'HP' and upper(modelo) not like '%ELITEBOOK 8 G1I 14 AI%' then 'OBSERVAR'
              else null
            end as decision_categoria,
            case
              when upper(marca) = 'APPLE' and upper(modelo) like '%A2141%' and lower(tipo_colaborador) like '%staff%' then 'Apple A2141 en staffing se renueva como línea prioritaria de recambio.'
              when upper(marca) = 'DELL' and upper(modelo) like '%LATITUDE 7400%' then 'Dell Latitude 7400 se da de baja y no entra a recompra.'
              when upper(marca) = 'DELL' and upper(modelo) like '%VOSTRO 5402%' then 'Dell Vostro 5402 sigue política de baja, sin recompra.'
              when upper(marca) = 'ASUS' and upper(modelo) like '%UX435E%' then 'Asus antiguos quedan en revisión para baja o renovación.'
              when upper(marca) = 'APPLE' and upper(modelo) like '%M1 PRO%' then 'Mac M1 Pro queda en observación, sin renovación inmediata.'
              when upper(marca) = 'APPLE' and upper(modelo) like '%M1%' then 'Mac M1 queda en observación, sin renovación inmediata.'
              when upper(marca) = 'HP' and upper(modelo) like '%ELITEBOOK 8 G1I 14 AI%' then 'HP EliteBook 8 G1i 14 AI es el modelo objetivo Windows.'
              when upper(marca) = 'HP' and upper(modelo) not like '%ELITEBOOK 8 G1I 14 AI%' then 'HP antiguos requieren revisión antes de comprar adicional.'
              else null
            end as regla_negocio
          from base
        ),
        agregado as (
          select
            decision_categoria,
            marca,
            modelo,
            regla_negocio,
            count(*)::int as equipos,
            count(*) filter (where flag_riesgo_alto_ml)::int as riesgo_alto_ml,
            count(*) filter (where flag_riesgo_alto_operativo)::int as riesgo_alto_operativo,
            count(*) filter (where flag_riesgo_alto_urgente)::int as riesgo_alto_urgente,
            count(*) filter (where flag_prioridad_accion_inmediata)::int as prioridad_accion_inmediata,
            count(*) filter (where flag_riesgo_alto_operativo)::int as riesgo_alto,
            count(*) filter (where upper(ml_risk_level) = 'MEDIA')::int as riesgo_medio,
            count(*) filter (where flag_rotacion_alta)::int as equipos_rotacion_alta,
            count(*) filter (where flag_renovar or flag_renovar_regla or dias_a_vencer <= 90)::int as proximos_90d,
            round(avg(ml_score)::numeric, 2) as ml_score_promedio,
            round(avg(movimientos_12m)::numeric, 1) as rotacion_promedio_12m,
            max(presion_stock)::int as presion_stock_max,
            string_agg(distinct cliente, ' | ' order by cliente) as clientes
          from scoped
          where decision_categoria is not null
          group by 1,2,3,4
        )
        select
          decision_categoria,
          marca,
          modelo,
          regla_negocio,
          equipos,
          riesgo_alto_ml,
          riesgo_alto_operativo,
          riesgo_alto_urgente,
          prioridad_accion_inmediata,
          riesgo_alto,
          riesgo_medio,
          equipos_rotacion_alta,
          proximos_90d,
          ml_score_promedio,
          rotacion_promedio_12m,
          presion_stock_max,
          clientes
        from agregado
        order by
          case decision_categoria
            when 'RENOVAR' then 1
            when 'DAR_BAJA' then 2
            when 'OBSERVAR' then 3
            when 'MANTENER' then 4
            else 5
          end,
          riesgo_alto desc,
          proximos_90d desc,
          ml_score_promedio desc,
          marca,
          modelo
        """

        with engine.connect() as conn:
            if mes is None:
                mes = conn.execute(text(sql_default_month)).scalar()
            mes = (mes or date.today()).replace(day=1)

            summary = conn.execute(text(sql_summary), {"mes": mes}).mappings().first()
            trend_rows = conn.execute(text(sql_trend)).mappings().all()
            company_rows = conn.execute(text(sql_company), {"mes": mes}).mappings().all()
            provider_rows = conn.execute(text(sql_provider), {"mes": mes}).mappings().all()
            model_rows = conn.execute(text(sql_model), {"mes": mes}).mappings().all()
            detail_rows = conn.execute(text(sql_detail), {"mes": mes}).mappings().all()
            detail_all_rows = conn.execute(text(sql_detail_all)).mappings().all()
            tracking_rows = conn.execute(text(sql_tracking), {"mes": mes}).mappings().all()
            capex_ref_rows = (
                conn.execute(text(sql_capex_refs)).mappings().all()
                if "stg_capex_hardware_referencias" in relation_names
                else []
            )
            risk_rows = conn.execute(text(sql_risk)).mappings().all()
            inherited_detail_rows = []
            inherited_tracking_rows = []
            if summary is not None and summary.get("es_proyeccion") and summary.get("mes_base_proyeccion") is not None:
                inherited_detail_rows = conn.execute(
                    text(sql_detail),
                    {"mes": summary.get("mes_base_proyeccion")},
                ).mappings().all()
                inherited_tracking_rows = conn.execute(
                    text(sql_tracking),
                    {"mes": summary.get("mes_base_proyeccion")},
                ).mappings().all()

        if summary is None:
            return {
                "mes": mes.isoformat(),
                "scope": scope_company,
                "scope_note": scope_note,
                "summary": {},
                "executive_reading": {},
                "decision_recommended": {},
                "formula_breakdown": {},
                "projection_risk": {},
                "scenarios": [],
                "forecast": {},
                "trend": [],
                "month_options": [],
                "by_company": [],
                "by_provider": [],
                "by_model": [],
                "detail": [],
                "alertas": [],
                "compras_tracking": [],
                "compras_tracking_note": None,
                "compras_mes": {},
                "capex": {},
                "may_preview": {},
                "ml_risk": {"groups": {}, "summary": {}, "policy_notes": []},
                "pending_notes": [
                    "No hay datos de tendencia o compras para el mes solicitado.",
                ],
            }

        summary_dict = dict(summary)
        summary_dict["mes"] = summary_dict.get("mes") or mes
        summary_dict["mes_siguiente"] = summary_dict.get("mes_siguiente") or mes
        summary_dict["mes_label"] = _month_label_es(summary_dict.get("mes"))

        scoped_detail_all = [
            dict(row)
            for row in detail_all_rows
            if str((row.get("empresa") or "")).strip() == scope_company
        ]

        scoped_monthly_purchase_metrics: dict[date, dict[str, Any]] = {}
        for row in scoped_detail_all:
            month_key = row.get("mes_operacion")
            if month_key is None:
                continue
            bucket = scoped_monthly_purchase_metrics.setdefault(
                month_key,
                {
                    "confirmadas": 0,
                    "pendientes": 0,
                    "stock_confirmado": 0,
                    "stock_proyectado": 0,
                    "proveedores": set(),
                    "modelos": set(),
                },
            )
            cantidad = _to_int(row.get("cantidad"))
            estado_compra = str((row.get("estado_compra") or "")).upper()
            if estado_compra in {"CONFIRMADA", "RECIBIDA"}:
                bucket["confirmadas"] += cantidad
            elif estado_compra == "PENDIENTE":
                bucket["pendientes"] += cantidad
            if bool(row.get("cuenta_stock_disponible")):
                bucket["stock_confirmado"] += cantidad
            if bool(row.get("cuenta_stock_planificado")):
                bucket["stock_proyectado"] += cantidad
            if row.get("proveedor"):
                bucket["proveedores"].add(str(row.get("proveedor")))
            if row.get("modelo"):
                bucket["modelos"].add(str(row.get("modelo")))

        trend_dicts = []
        scoped_trend_by_month: dict[date, dict[str, Any]] = {}
        base_trend_dicts = [dict(r) for r in trend_rows]
        for base_row in base_trend_dicts:
            row = dict(base_row)
            row_mes = row.get("mes")
            purchase_metrics = scoped_monthly_purchase_metrics.get(
                row_mes,
                {
                    "confirmadas": 0,
                    "pendientes": 0,
                    "stock_confirmado": 0,
                    "stock_proyectado": 0,
                    "proveedores": set(),
                    "modelos": set(),
                },
            )
            if row.get("es_proyeccion"):
                inherited_row = scoped_trend_by_month.get(row.get("mes_base_proyeccion")) or {}
                stock_heredado_confirmado = _to_int(inherited_row.get("stock_disponible_confirmado"))
                stock_heredado_proyectado = max(
                    _to_int(inherited_row.get("stock_disponible_total")) - stock_heredado_confirmado,
                    0,
                )
                stock_disponible_confirmado = stock_heredado_confirmado + _to_int(purchase_metrics.get("stock_confirmado"))
                stock_disponible_total = (
                    stock_heredado_confirmado
                    + stock_heredado_proyectado
                    + _to_int(purchase_metrics.get("stock_confirmado"))
                    + _to_int(purchase_metrics.get("stock_proyectado"))
                )
                row.update(
                    {
                        "stock_heredado_confirmado": stock_heredado_confirmado,
                        "stock_heredado_proyectado": stock_heredado_proyectado,
                        "compras_nuevas_confirmadas_mes": _to_int(purchase_metrics.get("confirmadas")),
                        "compras_nuevas_pendientes_mes": _to_int(purchase_metrics.get("pendientes")),
                        "total_confirmadas": _to_int(purchase_metrics.get("confirmadas")),
                        "total_pendientes": _to_int(purchase_metrics.get("pendientes")),
                        "stock_confirmado": _to_int(purchase_metrics.get("stock_confirmado")),
                        "stock_proyectado": _to_int(purchase_metrics.get("stock_proyectado")),
                        "stock_disponible_confirmado": stock_disponible_confirmado,
                        "stock_disponible_total": stock_disponible_total,
                    }
                )
            else:
                previous_row = trend_dicts[-1] if trend_dicts else {}
                stock_heredado_confirmado = _to_int(previous_row.get("stock_disponible_confirmado"))
                stock_heredado_proyectado = max(
                    _to_int(previous_row.get("stock_disponible_total")) - stock_heredado_confirmado,
                    0,
                )
                stock_confirmado = _to_int(purchase_metrics.get("stock_confirmado"))
                stock_proyectado = _to_int(purchase_metrics.get("stock_proyectado"))
                row.update(
                    {
                        "stock_heredado_confirmado": stock_heredado_confirmado,
                        "stock_heredado_proyectado": stock_heredado_proyectado,
                        "compras_nuevas_confirmadas_mes": _to_int(purchase_metrics.get("confirmadas")),
                        "compras_nuevas_pendientes_mes": _to_int(purchase_metrics.get("pendientes")),
                        "total_confirmadas": _to_int(purchase_metrics.get("confirmadas")),
                        "total_pendientes": _to_int(purchase_metrics.get("pendientes")),
                        "stock_confirmado": stock_confirmado,
                        "stock_proyectado": stock_proyectado,
                        "stock_disponible_confirmado": stock_heredado_confirmado + stock_confirmado,
                        "stock_disponible_total": stock_heredado_confirmado + stock_heredado_proyectado + stock_confirmado + stock_proyectado,
                    }
                )

            row["empresas_con_compra"] = 1 if (_to_int(row.get("total_confirmadas")) + _to_int(row.get("total_pendientes"))) > 0 else 0
            row["proveedores_activos"] = len(purchase_metrics.get("proveedores") or [])
            row["modelos_distintos"] = len(purchase_metrics.get("modelos") or [])
            row["balance_confirmado_vs_presion_mes"] = _to_int(row.get("stock_disponible_confirmado")) - _to_int(row.get("demanda_presion_compra_mes"))
            row["balance_total_vs_presion_mes"] = _to_int(row.get("stock_disponible_total")) - _to_int(row.get("demanda_presion_compra_mes"))
            demanda = _to_int(row.get("demanda_presion_compra_mes"))
            row["cobertura_confirmada_ratio"] = (
                round(_to_int(row.get("stock_disponible_confirmado")) / demanda, 2)
                if demanda > 0
                else None
            )
            row["cobertura_total_ratio"] = (
                round(_to_int(row.get("stock_disponible_total")) / demanda, 2)
                if demanda > 0
                else None
            )
            if row.get("es_proyeccion") and demanda == 0:
                row["lectura_preparacion"] = "No hay presión estimada para el mes proyectado; la continuidad queda anclada solo al stock heredado."
            elif row.get("es_proyeccion") and _to_int(row.get("stock_disponible_confirmado")) >= demanda:
                row["lectura_preparacion"] = "El mes proyectado inicia cubierto con stock heredado y no necesita compra adicional inmediata."
            elif row.get("es_proyeccion") and _to_int(row.get("stock_disponible_total")) >= demanda:
                row["lectura_preparacion"] = "El mes proyectado queda cubierto si se concreta el stock proyectado heredado del mes anterior."
            elif row.get("es_proyeccion"):
                row["lectura_preparacion"] = "Incluso con arrastre y pendientes heredados, el mes proyectado sigue con brecha y exige compra adicional."
            elif demanda == 0:
                row["lectura_preparacion"] = "No hay presión MTR en el mes; la lectura queda anclada a stock confirmado y stock proyectado."
            elif _to_int(row.get("stock_disponible_confirmado")) >= demanda:
                row["lectura_preparacion"] = "La cobertura confirmada alcanza para el mes sin depender de compras pendientes."
            elif _to_int(row.get("stock_disponible_total")) >= demanda:
                row["lectura_preparacion"] = "La cobertura confirmada queda corta, pero el mes se cubre si se concretan las compras pendientes."
            else:
                row["lectura_preparacion"] = "Incluso considerando pendientes, la presión mensual sigue abierta y exige compra adicional."

            trend_dicts.append(row)
            if row_mes is not None:
                scoped_trend_by_month[row_mes] = row

        summary_source = dict(summary_dict)
        summary_dict = {
            **summary_source,
            **dict(scoped_trend_by_month.get(summary_dict.get("mes")) or {}),
        }
        summary_dict["mes"] = summary_dict.get("mes") or mes
        summary_dict["mes_siguiente"] = summary_source.get("mes_siguiente") or summary_dict.get("mes_siguiente") or mes
        summary_dict["mes_label"] = _month_label_es(summary_dict.get("mes"))

        next_row = scoped_trend_by_month.get(summary_dict.get("mes_siguiente"))
        trend_month_order = [row.get("mes") for row in trend_dicts if row.get("mes") is not None]
        trend_month_index = {month_value: index for index, month_value in enumerate(trend_month_order)}
        forecast_target_month = summary_dict.get("mes") if bool(summary_dict.get("es_proyeccion")) else summary_dict.get("mes_siguiente")
        with engine.connect() as conn:
            forecast_segment_rows = (
                conn.execute(text(sql_forecast_segment), {"mes": forecast_target_month}).mappings().all()
                if forecast_target_month is not None
                else []
            )

        total_confirmadas = _to_int(summary_dict.get("total_confirmadas"))
        total_pendientes = _to_int(summary_dict.get("total_pendientes"))
        stock_confirmado = _to_int(summary_dict.get("stock_confirmado"))
        stock_proyectado = _to_int(summary_dict.get("stock_proyectado"))
        stock_heredado_confirmado = _to_int(summary_dict.get("stock_heredado_confirmado"))
        stock_heredado_proyectado = _to_int(summary_dict.get("stock_heredado_proyectado"))
        compras_nuevas_confirmadas_mes = _to_int(summary_dict.get("compras_nuevas_confirmadas_mes"))
        compras_nuevas_pendientes_mes = _to_int(summary_dict.get("compras_nuevas_pendientes_mes"))
        stock_disponible_confirmado = _to_int(summary_dict.get("stock_disponible_confirmado"))
        stock_disponible_total = _to_int(summary_dict.get("stock_disponible_total"))
        mtr_ingresos_total = _to_int(summary_dict.get("mtr_ingresos_total"))
        presion = _to_int(summary_dict.get("demanda_presion_compra_mes"))
        gap_confirmado = _to_int(summary_dict.get("balance_confirmado_vs_presion_mes"))
        gap_total = _to_int(summary_dict.get("balance_total_vs_presion_mes"))
        cobertura_confirmada = _to_float(summary_dict.get("cobertura_confirmada_ratio"))
        cobertura_total = _to_float(summary_dict.get("cobertura_total_ratio"))
        mes_label = _month_label_es(summary_dict.get("mes"))
        es_proyeccion = bool(summary_dict.get("es_proyeccion"))
        is_current_month = summary_dict.get("mes") == date.today().replace(day=1)
        visible_day_label = _day_month_label(date.today()) if is_current_month and not es_proyeccion else None
        mes_siguiente_label = _month_label_es(
            (next_row or {}).get("mes") or summary_dict.get("mes_siguiente")
        )
        mes_base_label = _month_label_es(summary_dict.get("mes_base_proyeccion")).split()[0] if summary_dict.get("mes_base_proyeccion") else "mes previo"

        detail_rows = [
            dict(row)
            for row in detail_rows
            if str((row.get("empresa") or "")).strip() == scope_company
        ]
        inherited_detail_rows = [
            dict(row)
            for row in inherited_detail_rows
            if str((row.get("empresa") or "")).strip() == scope_company
        ]
        tracking_rows = [
            dict(row)
            for row in tracking_rows
            if str((row.get("empresa") or "")).strip() == scope_company
        ]
        inherited_tracking_rows = [
            dict(row)
            for row in inherited_tracking_rows
            if str((row.get("empresa") or "")).strip() == scope_company
        ]

        current_month_details = detail_rows
        company_rows = []
        if current_month_details:
            company_rows.append(
                {
                    "empresa": scope_company,
                    "confirmadas": sum(
                        _to_int(row.get("cantidad"))
                        for row in current_month_details
                        if str((row.get("estado_compra") or "")).upper() in {"CONFIRMADA", "RECIBIDA"}
                    ),
                    "pendientes": sum(
                        _to_int(row.get("cantidad"))
                        for row in current_month_details
                        if str((row.get("estado_compra") or "")).upper() == "PENDIENTE"
                    ),
                    "stock_confirmado": sum(
                        _to_int(row.get("cantidad"))
                        for row in current_month_details
                        if bool(row.get("cuenta_stock_disponible"))
                    ),
                    "stock_proyectado": sum(
                        _to_int(row.get("cantidad"))
                        for row in current_month_details
                        if bool(row.get("cuenta_stock_planificado"))
                    ),
                    "proveedores": len({str(row.get("proveedor")) for row in current_month_details if row.get("proveedor")}),
                    "modelos": " | ".join(
                        sorted({str(row.get("modelo")) for row in current_month_details if row.get("modelo")})
                    ),
                }
            )

        provider_index: dict[str, dict[str, Any]] = {}
        model_index: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}
        for row in current_month_details:
            proveedor = str(row.get("proveedor") or "")
            provider_bucket = provider_index.setdefault(
                proveedor,
                {
                    "proveedor": proveedor,
                    "confirmadas": 0,
                    "pendientes": 0,
                    "stock_confirmado": 0,
                    "stock_proyectado": 0,
                    "empresas": scope_company,
                },
            )
            model_key = (
                scope_company,
                proveedor,
                str(row.get("marca") or ""),
                str(row.get("modelo") or ""),
                str(row.get("os_familia") or ""),
            )
            model_bucket = model_index.setdefault(
                model_key,
                {
                    "empresa": scope_company,
                    "proveedor": proveedor,
                    "marca": row.get("marca"),
                    "modelo": row.get("modelo"),
                    "os_familia": row.get("os_familia"),
                    "confirmadas": 0,
                    "pendientes": 0,
                    "total": 0,
                },
            )
            cantidad = _to_int(row.get("cantidad"))
            estado_compra = str((row.get("estado_compra") or "")).upper()
            if estado_compra in {"CONFIRMADA", "RECIBIDA"}:
                provider_bucket["confirmadas"] += cantidad
                model_bucket["confirmadas"] += cantidad
            elif estado_compra == "PENDIENTE":
                provider_bucket["pendientes"] += cantidad
                model_bucket["pendientes"] += cantidad
            if bool(row.get("cuenta_stock_disponible")):
                provider_bucket["stock_confirmado"] += cantidad
            if bool(row.get("cuenta_stock_planificado")):
                provider_bucket["stock_proyectado"] += cantidad
            model_bucket["total"] += cantidad

        provider_rows = sorted(
            provider_index.values(),
            key=lambda row: (-_to_int(row.get("confirmadas")), -_to_int(row.get("pendientes")), str(row.get("proveedor") or "")),
        )
        model_rows = sorted(
            model_index.values(),
            key=lambda row: (
                str(row.get("empresa") or ""),
                str(row.get("proveedor") or ""),
                str(row.get("marca") or ""),
                str(row.get("modelo") or ""),
            ),
        )

        compras_tracking = [dict(r) for r in tracking_rows]
        inherited_tracking = [dict(r) for r in inherited_tracking_rows]
        if es_proyeccion:
            carryover_tracking = [
                row
                for row in inherited_tracking
                if (
                    (
                        str((row.get("estado") or "")).upper() in {"PENDIENTE", "CONFIRMADA"}
                        and row.get("fecha_ingreso_real") is None
                    )
                    or (
                        str((row.get("estado") or "")).upper() == "RECIBIDA"
                        and row.get("fecha_ingreso_real") is not None
                    )
                )
            ]
            if carryover_tracking:
                combined_tracking = compras_tracking + carryover_tracking
                seen_tracking_ids: set[str] = set()
                deduped_tracking: list[dict[str, Any]] = []
                for row in combined_tracking:
                    row_id = str(
                        row.get("id_compra")
                        or f"{row.get('proveedor')}|{row.get('empresa')}|{row.get('modelo')}|{row.get('estado')}"
                    )
                    if row_id in seen_tracking_ids:
                        continue
                    seen_tracking_ids.add(row_id)
                    deduped_tracking.append(row)
                compras_tracking = deduped_tracking

        compras_tracking.sort(
            key=lambda row: (
                0
                if str((row.get("estado") or "")).upper() == "PENDIENTE"
                else 1
                if str((row.get("estado") or "")).upper() == "CONFIRMADA"
                else 2
                if str((row.get("estado") or "")).upper() == "RECIBIDA"
                else 3,
                str(row.get("proveedor") or ""),
                str(row.get("empresa") or ""),
                str(row.get("modelo") or ""),
            )
        )
        compras_tracking_note = (
            f"Se incluyen compras heredadas de {mes_base_label} que siguen destrabando la cobertura de {mes_label}."
            if es_proyeccion and inherited_tracking
            else None
        )
        pending_tracking_rows = [
            row for row in compras_tracking if str((row.get("estado") or "")).upper() == "PENDIENTE"
        ]
        pending_tracking_total = sum(_to_int(row.get("cantidad")) for row in pending_tracking_rows)
        top_pending_tracking = max(
            pending_tracking_rows,
            key=lambda row: _to_int(row.get("cantidad")),
            default=None,
        )

        pending_rows = [
            dict(r)
            for r in detail_rows
            if str((r.get("estado_compra") or "")).upper() == "PENDIENTE"
        ]
        if not pending_rows and es_proyeccion:
            pending_rows = [
                dict(r)
                for r in inherited_detail_rows
                if str((r.get("estado_compra") or "")).upper() == "PENDIENTE"
            ]
        pending_refs = [
            f"{_to_int(r.get('cantidad'))} {r.get('modelo') or r.get('marca') or 'equipos'} con {r.get('proveedor') or 'proveedor por confirmar'}"
            for r in pending_rows
        ]
        pending_short = pending_refs[0] if pending_refs else None
        if pending_short:
            pending_short_clean = (
                _clean_tracking_model_label(pending_short)
            )
        else:
            pending_short_clean = None

        if es_proyeccion and presion == 0:
            conclusion = (
                f"{mes_label.capitalize()} no tiene presión estimada disponible. La continuidad queda anclada solo al stock heredado del cierre previo."
            )
            riesgo_conclusion = "Sin demanda proyectada disponible."
        elif es_proyeccion:
            if gap_confirmado >= 0:
                conclusion = (
                    f"{mes_label.capitalize()} inicia con {stock_heredado_confirmado} equipos confirmados desde {mes_base_label}. "
                    f"Con una demanda proyectada de {presion}, la cobertura confirmada llega a {cobertura_confirmada or 0:.2f}x y no exige compra adicional inmediata."
                )
                if stock_heredado_proyectado > 0:
                    conclusion += (
                        f" Si se concretan {stock_heredado_proyectado} pendientes heredados, la cobertura total sube a {cobertura_total or 0:.2f}x."
                    )
                riesgo_conclusion = "Continuidad cubierta con arrastre confirmado."
            elif gap_total >= 0:
                conclusion = (
                    f"{mes_label.capitalize()} inicia con {stock_heredado_confirmado} equipos confirmados desde {mes_base_label}. "
                    f"Si se concretan {stock_heredado_proyectado} pendientes, la cobertura inicial permite absorber la demanda proyectada sin necesidad de compra adicional inmediata."
                )
                riesgo_conclusion = "Cobertura proyectada suficiente por continuidad del parque."
            else:
                conclusion = (
                    f"{mes_label.capitalize()} arranca con {stock_heredado_confirmado} equipos heredados y {stock_heredado_proyectado} proyectados, pero la demanda estimada de {presion} deja una brecha total de {gap_total}. "
                    f"Se requiere compra adicional para sostener continuidad del parque."
                )
                riesgo_conclusion = "Continuidad insuficiente: compra adicional requerida."
        elif presion == 0:
            conclusion = (
                f"{mes_label.capitalize()} no muestra presión MTR que active compra. La lectura queda anclada al stock confirmado y al stock proyectado."
            )
            riesgo_conclusion = "Sin presión de compra en el mes seleccionado."
        elif is_current_month and visible_day_label:
            coverage_sentence = (
                f" La cobertura confirmada llega a {cobertura_confirmada or 0:.2f}x."
                if cobertura_confirmada is not None
                else ""
            )
            gap_sentence = (
                f" El balance confirmado actual es de {gap_confirmado:+d} equipos."
                if gap_confirmado != 0
                else " El balance confirmado actual está equilibrado."
            )
            pending_sentence = (
                f" Si se concretan {pending_short_clean}, la cobertura total sube a {cobertura_total or 0:.2f}x."
                if pending_short_clean and cobertura_total is not None and cobertura_total >= 1
                else ""
            )
            conclusion = (
                f"{mes_label.capitalize()} presenta {mtr_ingresos_total} ingresos acumulados al {visible_day_label}, "
                f"de los cuales {presion} presionan compra.{coverage_sentence}{gap_sentence}{pending_sentence}"
            )
            riesgo_conclusion = "Acumulado visible del mes en curso."
        elif gap_confirmado >= 0:
            conclusion = (
                f"{mes_label.capitalize()} cierra con cobertura confirmada positiva de {gap_confirmado} equipos. "
                f"Las compras confirmadas cubren {cobertura_confirmada or 0:.2f}x de la presión mensual."
            )
            riesgo_conclusion = "Cobertura confirmada suficiente."
        elif gap_total >= 0:
            pending_phrase = (
                f" Si se concretan {pending_short_clean}, {mes_siguiente_label.split()[0]} inicia con cobertura suficiente."
                if pending_short_clean
                else f" Si se concretan las compras pendientes, {mes_siguiente_label.split()[0]} inicia con cobertura suficiente."
            )
            conclusion = (
                f"{mes_label.capitalize()} cierra con déficit operativo leve de {gap_confirmado} equipos. "
                f"Las compras confirmadas cubren {cobertura_confirmada or 0:.2f}x de la presión mensual."
                f"{pending_phrase}"
            )
            riesgo_conclusion = "Déficit confirmado, pero cobertura total suficiente si se ejecutan pendientes."
        else:
            conclusion = (
                f"{mes_label.capitalize()} cierra con déficit confirmado de {gap_confirmado} equipos y la cobertura total proyectada llega solo a {cobertura_total or 0:.2f}x. "
                f"Se requiere activar compra adicional para que {mes_siguiente_label.split()[0]} no parta con brecha operativa."
            )
            riesgo_conclusion = "Déficit confirmado y proyectado: compra urgente."

        if presion == 0:
            decision_title = "Mantener monitoreo, sin compra activa por presión MTR."
            decision_tone = "green"
            decision_body = (
                "El mes no presenta presión MTR que obligue a comprar. Conviene monitorear demanda extraordinaria, "
                "ejecución de pendientes y renovación de modelos críticos sin abrir compra adicional por defecto."
            )
        elif cobertura_confirmada is not None and cobertura_confirmada < 1 and (cobertura_total or 0) >= 1:
            decision_title = "Ejecutar pendientes, no sobredimensionar nueva compra."
            decision_tone = "amber"
            decision_body = (
                f"El gap confirmado se mantiene en {gap_confirmado} y la cobertura confirmada queda en {cobertura_confirmada:.2f}x. "
                f"La cobertura total sube a {cobertura_total or 0:.2f}x si se concretan los pendientes heredados o del mes."
            )
        elif cobertura_confirmada is not None and cobertura_confirmada < 1 and ((cobertura_total or 0) < 1):
            decision_title = "Activar nueva compra urgente."
            decision_tone = "red"
            decision_body = (
                f"Ni el stock disponible confirmado ni el stock proyectado alcanzan a cubrir la presión mensual. "
                f"El balance total sigue en {gap_total} y conviene abrir compra adicional antes de {mes_siguiente_label}."
            )
        else:
            decision_title = "Mantener monitoreo, no comprar adicional salvo demanda extraordinaria."
            decision_tone = "green"
            decision_body = (
                f"La cobertura confirmada del mes llega a {cobertura_confirmada or 0:.2f}x y no obliga a sobredimensionar nuevas compras. "
                f"Conviene seguir monitoreando presión MTR, entregas y renovación de modelos críticos."
            )

        decision_actions = []
        if pending_short_clean:
            decision_actions.append(f"Ejecutar compra pendiente de {pending_short_clean}.")
            decision_actions.append("Dar seguimiento a proveedor y fecha de entrega antes de contar esos equipos como stock real.")
        if gap_total < 0:
            decision_actions.append("Abrir compra adicional para cerrar la brecha remanente del mes siguiente.")
        elif gap_confirmado < 0:
            decision_actions.append("No contar compras pendientes como stock real hasta ingreso físico al parque.")
        if not decision_actions:
            decision_actions.append("Mantener monitoreo semanal de presión, cobertura y mix de modelos objetivo.")

        projected_gap_note = None
        if es_proyeccion:
            projected_gap_note = (
                f"Gap proyectado: {gap_total:+d}, considerando {stock_heredado_proyectado} equipos pendientes heredados. "
                "Estos equipos no deben contarse como stock real hasta su ingreso físico."
            )

        projection_risk = {
            "title": "Riesgo operativo de la proyección",
            "summary": (
                f"La proyección de {mes_label} es suficiente con stock confirmado, pero depende del seguimiento de los "
                f"{stock_heredado_proyectado} HP pendientes con Ricoh para mantener cobertura holgada. "
                "Si esos equipos no ingresan o la demanda supera el promedio estimado, la presión de compra puede reaparecer."
                if es_proyeccion
                else "El riesgo operativo del mes está dominado por la ejecución de compras pendientes y por la variación de la demanda real."
            ),
            "items": (
                [
                    f"Dependencia de entrega de {stock_heredado_proyectado} HP con Ricoh." if stock_heredado_proyectado > 0 else "Sin pendientes heredados relevantes en la proyección.",
                    f"Si los pendientes no llegan, la cobertura queda solo con stock confirmado ({stock_disponible_confirmado}).",
                    f"Si la demanda sube sobre la estimación ({presion}), podría reaparecer déficit operativo.",
                    "Mantener monitoreo de ingresos MTR durante el mes proyectado.",
                ]
                if es_proyeccion
                else [
                    "Seguir ejecución de compras pendientes para no trasladar brecha al mes siguiente.",
                    "Monitorear ingresos MTR y cambios de demanda del mes en curso.",
                ]
            ),
            "gap_note": projected_gap_note,
            "renewal_note": "La renovación de modelos críticos, especialmente Apple A2141 y Dell en salida, puede aumentar la presión futura si no se planifica junto con las compras nuevas.",
        }

        stress_demand = int(ceil(presion * 1.2)) if presion > 0 else 0
        scenarios = [
            {
                "name": "Escenario base",
                "stock": stock_disponible_confirmado,
                "demanda": presion,
                "gap": stock_disponible_confirmado - presion,
                "decision": "Monitorear, no comprar adicional",
                "note": "Usa solo stock confirmado disponible.",
            },
            {
                "name": "Escenario con pendientes",
                "stock": stock_disponible_total,
                "demanda": presion,
                "gap": stock_disponible_total - presion,
                "decision": "Cobertura holgada si llegan los HP",
                "note": "Incluye pendientes heredados que aún no ingresan físicamente.",
            },
            {
                "name": "Escenario estrés",
                "stock": stock_disponible_confirmado,
                "demanda": stress_demand,
                "gap": stock_disponible_confirmado - stress_demand,
                "decision": "Revisar compra adicional o acelerar pendientes",
                "note": "Asume demanda +20% sobre la estimación actual.",
            },
        ]

        formula_breakdown = {
            "mtr_ingresos_total": mtr_ingresos_total,
            "presion_mensual": presion,
            "stock_heredado_confirmado": stock_heredado_confirmado,
            "stock_heredado_proyectado": stock_heredado_proyectado,
            "compras_nuevas_confirmadas_mes": compras_nuevas_confirmadas_mes,
            "compras_nuevas_pendientes_mes": compras_nuevas_pendientes_mes,
            "stock_confirmado": stock_confirmado,
            "stock_proyectado": stock_proyectado,
            "stock_disponible_confirmado": stock_disponible_confirmado,
            "stock_disponible_total": stock_disponible_total,
            "gap_confirmado": gap_confirmado,
            "gap_proyectado": gap_total,
            "cobertura_confirmada": cobertura_confirmada,
            "cobertura_proyectada": cobertura_total,
            "fuente_presion": summary_dict.get("fuente_presion"),
            "presion_formula": (
                f"presión mensual = ingresos MTR acumulados que presionan compra (acumulado visible al {visible_day_label})"
                if is_current_month and not es_proyeccion and visible_day_label
                else "presión mensual = demanda real MTR que presiona compra"
                if not es_proyeccion
                else "presión mensual = datos reales acumulados MTR + proyección simple para días restantes"
                if summary_dict.get("fuente_presion") == "mtr_real_acumulado_proyectado"
                else "presión mensual = promedio de los últimos 3 meses con presión"
            ),
            "stock_heredado_formula": "stock heredado = stock confirmado del mes anterior",
            "stock_proyectado_heredado_formula": "stock proyectado heredado = pendientes del mes anterior que aún no ingresan",
            "stock_confirmado_formula": "compras nuevas confirmadas del mes",
            "stock_proyectado_formula": "compras nuevas pendientes del mes",
            "stock_disponible_formula": f"stock disponible confirmado = {stock_heredado_confirmado} + {compras_nuevas_confirmadas_mes} = {stock_disponible_confirmado}",
            "stock_disponible_total_formula": f"stock disponible total = {stock_heredado_confirmado} + {stock_heredado_proyectado} + {compras_nuevas_confirmadas_mes} + {compras_nuevas_pendientes_mes} = {stock_disponible_total}",
            "gap_confirmado_formula": f"gap confirmado = {stock_disponible_confirmado} - {presion} = {gap_confirmado}",
            "gap_proyectado_formula": f"gap proyectado = {stock_disponible_total} - {presion} = {gap_total}",
            "status_confirmado": (
                "Déficit confirmado" if gap_confirmado < 0 else "Cobertura confirmada suficiente"
            ),
            "status_proyectado": (
                "Cobertura suficiente si se concretan pendientes"
                if gap_confirmado < 0 and gap_total >= 0
                else "Activar compra urgente"
                if gap_total < 0
                else "Cobertura total suficiente"
            ),
            "gap_proyectado_note": projected_gap_note,
        }

        executive_reading = {
            "mes": summary_dict.get("mes").isoformat(),
            "mes_label": mes_label,
            "es_proyeccion": es_proyeccion,
            "scope": scope_company,
            "scope_note": scope_note,
            "mtr_ingresos_total": mtr_ingresos_total,
            "visible_al_dia": visible_day_label,
            "presion_mes": presion,
            "stock_heredado_confirmado": stock_heredado_confirmado,
            "stock_heredado_proyectado": stock_heredado_proyectado,
            "compras_confirmadas": compras_nuevas_confirmadas_mes,
            "compras_pendientes": compras_nuevas_pendientes_mes,
            "stock_disponible_confirmado": stock_disponible_confirmado,
            "stock_disponible_total": stock_disponible_total,
            "gap_confirmado": gap_confirmado,
            "gap_total": gap_total,
            "cobertura_confirmada": cobertura_confirmada,
            "cobertura_total": cobertura_total,
            "conclusion": conclusion,
            "estado": riesgo_conclusion,
        }

        month_options = [
            {
                "mes": row["mes"].isoformat(),
                "label": _month_label_es(row["mes"]),
                "es_proyeccion": bool(row.get("es_proyeccion")),
            }
            for row in trend_dicts
        ]

        trend = []
        for row in trend_dicts:
            trend.append(
                {
                    **row,
                    "mes": row["mes"].isoformat(),
                    "mes_label": _month_label_es(row["mes"]),
                    "mes_corto": _month_label_es(row["mes"]).split()[0],
                }
            )

        forecast = {}
        forecast_source_row = scoped_trend_by_month.get(forecast_target_month) if forecast_target_month is not None else None
        forecast_target_index = trend_month_index.get(forecast_target_month) if forecast_target_month is not None else None
        history_month_1 = (
            scoped_trend_by_month.get(trend_month_order[forecast_target_index - 1])
            if forecast_target_index is not None and forecast_target_index - 1 >= 0
            else None
        )
        history_month_2 = (
            scoped_trend_by_month.get(trend_month_order[forecast_target_index - 2])
            if forecast_target_index is not None and forecast_target_index - 2 >= 0
            else None
        )
        history_month_3 = (
            scoped_trend_by_month.get(trend_month_order[forecast_target_index - 3])
            if forecast_target_index is not None and forecast_target_index - 3 >= 0
            else None
        )
        if forecast_source_row is not None and forecast_target_month is not None and history_month_1 is not None:
            forecast_month_label = _month_label_es(forecast_target_month)
            presion_mes = _to_int(history_month_1.get("demanda_presion_compra_mes"))
            presion_mes_anterior = _to_int((history_month_2 or {}).get("demanda_presion_compra_mes"))
            presion_hace_2_meses = _to_int((history_month_3 or {}).get("demanda_presion_compra_mes"))
            forecast_base = int(
                round(
                    presion_mes * 0.5
                    + presion_mes_anterior * 0.3
                    + presion_hace_2_meses * 0.2,
                    0,
                )
            )
            forecast_low = int(round(forecast_base * 0.9, 0))
            forecast_high = int(round(forecast_base * 1.1, 0))
            forecast_stock_confirmed = _to_int(forecast_source_row.get("stock_disponible_confirmado"))
            forecast_stock_total = _to_int(forecast_source_row.get("stock_disponible_total"))
            low_gap_confirmed = forecast_stock_confirmed - forecast_low
            low_gap_total = forecast_stock_total - forecast_low
            gap_base_confirmado = forecast_stock_confirmed - forecast_base
            gap_alto_confirmado = forecast_stock_confirmed - forecast_high
            gap_base_total = forecast_stock_total - forecast_base
            gap_alto_total = forecast_stock_total - forecast_high

            def _forecast_decision(gap_confirmed_value: int, gap_total_value: int) -> str:
                if gap_confirmed_value >= 0:
                    return "Cobertura suficiente con stock confirmado"
                if gap_total_value >= 0:
                    return "Acelerar pendientes, no comprar adicional todavía"
                return "Evaluar compra adicional"

            segment_rows = [dict(r) for r in forecast_segment_rows]
            segment_total = sum(_to_int(r.get("forecast_segmento")) for r in segment_rows)
            top_segment = max(segment_rows, key=lambda item: _to_int(item.get("forecast_segmento")), default=None)
            has_segment_history = segment_total > 0
            if has_segment_history and top_segment and top_segment.get("segmento") == "extranjero":
                segment_insight = (
                    "La presión proyectada se explica principalmente por ingresos sin equipo, especialmente extranjeros."
                )
            elif has_segment_history:
                segment_insight = (
                    "La presión proyectada se explica principalmente por ingresos sin equipo asignado en la historia reciente."
                )
            else:
                segment_insight = "No hay suficiente historia segmentada para proyectar por segmento."

            high_scenario_risk = (
                "Con escenario alto puede aparecer déficit leve si no llegan pendientes."
                if gap_alto_confirmado < 0 and gap_alto_total >= 0
                else "Con escenario alto la cobertura confirmada sigue siendo suficiente."
                if gap_alto_confirmado >= 0
                else "Con escenario alto conviene evaluar compra adicional."
            )
            pending_cover_units = pending_tracking_total or max(forecast_stock_total - forecast_stock_confirmed, 0)
            pending_cover_note = (
                f"El escenario alto queda cubierto si ingresan los {pending_cover_units} equipos pendientes."
                if gap_alto_confirmado < 0
                and gap_alto_total >= 0
                and pending_cover_units > 0
                else None
            )
            insight_forecast = (
                "No hay suficiente presión histórica reciente para construir un forecast útil."
                if forecast_base == 0
                else "Incluso con el escenario alto, la cobertura confirmada se mantiene suficiente."
                if gap_alto_confirmado >= 0
                else "El escenario alto exige acelerar pendientes, pero no abre compra adicional inmediata."
                if gap_alto_total >= 0
                else "Si el escenario alto se materializa, conviene evaluar compra adicional."
            )

            forecast = {
                "mes": forecast_target_month.isoformat(),
                "mes_label": forecast_month_label,
                "subtitle": "Proyección de presión de compra para el siguiente ciclo.",
                "metodo": "Ponderación 50/30/20 sobre los últimos 3 meses con presión",
                "presion_mes": presion_mes,
                "presion_mes_anterior": presion_mes_anterior,
                "presion_hace_2_meses": presion_hace_2_meses,
                "forecast_presion_base": forecast_base,
                "forecast_presion_bajo": forecast_low,
                "forecast_presion_alto": forecast_high,
                "stock_confirmado": forecast_stock_confirmed,
                "stock_total": forecast_stock_total,
                "gap_base_confirmado": gap_base_confirmado,
                "gap_alto_confirmado": gap_alto_confirmado,
                "gap_base_total": gap_base_total,
                "gap_alto_total": gap_alto_total,
                "fuente_forecast": "ponderacion_50_30_20_ultimos_3_meses",
                "insight_forecast": insight_forecast,
                "risk_high_scenario": high_scenario_risk,
                "pending_cover_note": pending_cover_note,
                "segment_insight": segment_insight,
                "segments": segment_rows,
                "scenarios": [
                    {
                        "name": "Bajo",
                        "demanda": forecast_low,
                        "gap_confirmado": low_gap_confirmed,
                        "gap_total": low_gap_total,
                        "decision": _forecast_decision(low_gap_confirmed, low_gap_total),
                    },
                    {
                        "name": "Base",
                        "demanda": forecast_base,
                        "gap_confirmado": gap_base_confirmado,
                        "gap_total": gap_base_total,
                        "decision": _forecast_decision(
                            gap_base_confirmado,
                            gap_base_total,
                        ),
                    },
                    {
                        "name": "Alto",
                        "demanda": forecast_high,
                        "gap_confirmado": gap_alto_confirmado,
                        "gap_total": gap_alto_total,
                        "decision": _forecast_decision(
                            gap_alto_confirmado,
                            gap_alto_total,
                        ),
                    },
                ],
            }

        summary_response = {
            **summary_dict,
            "mes": summary_dict.get("mes").isoformat(),
            "mes_siguiente": summary_dict.get("mes_siguiente").isoformat(),
            "cobertura_confirmada_ratio": cobertura_confirmada,
            "cobertura_total_ratio": cobertura_total,
        }

        next_preview_source = next_row or summary_dict
        may_preview = {
            "mes": (next_preview_source.get("mes") or summary_dict.get("mes_siguiente")).isoformat(),
            "stock_confirmado_arrastre": _to_int(next_preview_source.get("stock_heredado_confirmado") or next_preview_source.get("stock_disponible_confirmado")),
            "stock_proyectado_arrastre": _to_int(next_preview_source.get("stock_heredado_proyectado")),
            "demanda_referencia": _to_int(next_preview_source.get("demanda_presion_compra_mes")),
            "balance_confirmado": _to_int(next_preview_source.get("balance_confirmado_vs_presion_mes")),
            "balance_total": _to_int(next_preview_source.get("balance_total_vs_presion_mes")),
            "cobertura_confirmada_ratio": _to_float(next_preview_source.get("cobertura_confirmada_ratio")),
            "cobertura_total_ratio": _to_float(next_preview_source.get("cobertura_total_ratio")),
            "lectura": next_preview_source.get("lectura_preparacion"),
        }

        risk_groups = {"renovar": [], "dar_baja": [], "observar": [], "mantener": []}
        for row in risk_rows:
            item = dict(row)
            key = str(item.get("decision_categoria") or "").lower()
            if key in risk_groups:
                risk_groups[key].append(item)

        risk_summary = {
            key: sum(_to_int(item.get("equipos")) for item in items)
            for key, items in risk_groups.items()
        }

        pending_notes = [
            "Las compras pendientes se muestran como stock proyectado y no se incorporan al stock confirmado.",
            "STAND_BY y POOL no cuentan como oferta inmediata en el gap operativo.",
            "Los recuperables se ponderan al 50% para no tratarlos como stock inmediato.",
        ]
        if compras_tracking:
            confirmed_not_received = sum(
                _to_int(row.get("cantidad"))
                for row in compras_tracking
                if str((row.get("estado") or "")).upper() == "CONFIRMADA"
                and row.get("fecha_ingreso_real") is None
            )
            if confirmed_not_received > 0:
                pending_notes.append(
                    f"Hay {confirmed_not_received} equipos en estado CONFIRMADA que aún no registran ingreso físico al parque."
                )
        if stock_confirmado == 0:
            pending_notes.append(
                "No hay compras confirmadas para el mes solicitado; la preparación del mes siguiente depende de stock ya existente o compras futuras."
            )
        if summary_dict.get("es_proyeccion"):
            if summary_dict.get("fuente_presion") == "mtr_real_acumulado_proyectado":
                pending_notes.append(
                    "El mes seleccionado es una proyección del siguiente ciclo: combina stock heredado del mes base con datos MTR reales acumulados del propio mes y una proyección simple para los días restantes."
                )
            else:
                pending_notes.append(
                    "El mes seleccionado es una proyección del siguiente ciclo: usa stock heredado confirmado/proyectado del mes base y estima la presión con el promedio de los últimos 3 meses con presión."
                )

        alertas = []
        if forecast:
            gap_base_confirmado = _to_int(forecast.get("gap_base_confirmado"))
            gap_alto_confirmado = _to_int(forecast.get("gap_alto_confirmado"))
            gap_alto_total = _to_int(forecast.get("gap_alto_total"))
            if gap_alto_confirmado < 0:
                alertas.append(
                    {
                        "severity": "high",
                        "title": f"Riesgo de déficit leve en escenario alto ({gap_alto_confirmado})",
                        "description": "El escenario alto abre brecha con stock confirmado y exige seguimiento más estricto de cobertura.",
                        "recommended_action": "Revisar cobertura del escenario alto antes de abrir compra adicional.",
                        "related_metric": f"gap_alto_confirmado={gap_alto_confirmado}",
                    }
                )
                alertas.append(
                    {
                        "severity": "high",
                        "title": "Acelerar pendientes",
                        "description": "Riesgo de déficit en escenario alto si no ingresan las compras pendientes.",
                        "recommended_action": "Priorizar seguimiento con proveedor, ETA e ingreso físico al parque.",
                        "related_metric": f"gap_alto_total={gap_alto_total}",
                    }
                )
            if gap_base_confirmado == 0:
                alertas.append(
                    {
                        "severity": "medium",
                        "title": "Cobertura justa",
                        "description": "La cobertura confirmada queda exactamente al límite para el escenario base.",
                        "recommended_action": "Monitorear demanda MTR durante el mes y evitar contar pendientes como stock real.",
                        "related_metric": "gap_base_confirmado=0",
                    }
                )
            elif gap_base_confirmado > 0:
                alertas.append(
                    {
                        "severity": "low",
                        "title": "Cobertura suficiente con stock confirmado",
                        "description": "El escenario base se sostiene con stock confirmado sin depender de compras pendientes.",
                        "recommended_action": "Mantener monitoreo ejecutivo y revisar solo cambios extraordinarios de demanda.",
                        "related_metric": f"gap_base_confirmado={gap_base_confirmado}",
                    }
                )

        if top_pending_tracking is not None:
            pending_model_label = _clean_tracking_model_label(top_pending_tracking.get("modelo"))
            pending_supplier = top_pending_tracking.get("proveedor") or "proveedor por confirmar"
            pending_qty = _to_int(top_pending_tracking.get("cantidad"))
            alertas.append(
                {
                    "severity": "info",
                    "title": f"Dar seguimiento a {pending_qty} {pending_model_label} pendientes con {pending_supplier}",
                    "description": "Estas compras destraban la cobertura proyectada, pero todavía no cuentan como stock real operativo.",
                    "recommended_action": top_pending_tracking.get("accion_recomendada") or "Confirmar fecha de entrega",
                    "related_metric": f"compras_pendientes={pending_qty}",
                }
            )

        capex = {}
        if capex_ref_rows:
            capex_source_rows = (
                [dict(r) for r in inherited_detail_rows]
                if es_proyeccion and inherited_detail_rows
                else [dict(r) for r in detail_rows]
            )
            capex_reference_rows = [dict(r) for r in capex_ref_rows]

            def _reference_for_compra(row: dict[str, Any]) -> dict[str, Any] | None:
                modelo = str(row.get("modelo") or "").strip()
                proveedor = str(row.get("proveedor") or "").strip()
                empresa = str(row.get("empresa") or "").strip()
                mes_ref = row.get("mes_referencia") or summary_dict.get("mes_base_proyeccion") or summary_dict.get("mes")
                for ref in capex_reference_rows:
                    if (
                        str(ref.get("modelo") or "").strip() == modelo
                        and str(ref.get("proveedor") or "").strip() == proveedor
                        and str(ref.get("empresa") or "").strip() == empresa
                    ):
                        vigente_desde = ref.get("vigencia_desde")
                        vigente_hasta = ref.get("vigencia_hasta")
                        if mes_ref is not None and vigente_desde is not None and mes_ref < vigente_desde:
                            continue
                        if mes_ref is not None and vigente_hasta is not None and mes_ref > vigente_hasta:
                            continue
                        return ref
                return None

            known_confirmed_amount_raw = 0.0
            known_confirmed_units = 0
            known_pending_amount_raw = 0.0
            known_pending_units = 0
            unknown_pending_refs = []
            capex_reference_matches = []
            for row in capex_source_rows:
                estado = str((row.get("estado_compra") or "")).upper()
                if estado == "CANCELADA":
                    continue
                ref = _reference_for_compra(row)
                cantidad = _to_int(row.get("cantidad"))
                if ref is None:
                    if estado == "PENDIENTE":
                        unknown_pending_refs.append(row)
                    continue
                precio_unitario = float(ref.get("precio_unitario") or 0)
                monto_raw = cantidad * precio_unitario
                monto = int(round(monto_raw))
                capex_reference_matches.append(
                    {
                        "empresa": row.get("empresa"),
                        "proveedor": row.get("proveedor"),
                        "modelo": row.get("modelo"),
                        "cantidad": cantidad,
                        "precio_unitario": precio_unitario,
                        "monto_estimado": monto,
                        "moneda": ref.get("moneda") or "CLP",
                        "estado_compra": estado,
                        "observacion": ref.get("observacion"),
                    }
                )
                if estado in {"CONFIRMADA", "RECIBIDA"}:
                    known_confirmed_amount_raw += monto_raw
                    known_confirmed_units += cantidad
                elif estado == "PENDIENTE":
                    known_pending_amount_raw += monto_raw
                    known_pending_units += cantidad

            known_confirmed_amount = int(round(known_confirmed_amount_raw))
            known_pending_amount = int(round(known_pending_amount_raw))
            mix_unit_price = (
                round(known_confirmed_amount_raw / known_confirmed_units, 2)
                if known_confirmed_units > 0
                else 0
            )
            forecast_units = _to_int((forecast or {}).get("forecast_presion_base"))
            forecast_amount = int(round(forecast_units * mix_unit_price)) if forecast_units > 0 and mix_unit_price > 0 else None
            capex_confirmed_label = (
                f"CAPEX confirmado {mes_base_label} (Acid Labs)"
                if es_proyeccion and summary_dict.get("mes_base_proyeccion")
                else f"CAPEX confirmado {mes_label.split()[0]} (Acid Labs)"
            )
            urgent_renewal_units = sum(
                _to_int(item.get("riesgo_alto_operativo"))
                for item in risk_groups.get("renovar", [])
            )
            total_known_capex = known_confirmed_amount + (forecast_amount or 0)

            capex = {
                "currency": "CLP",
                "scope": f"{scope_company} / vista principal",
                "reference_month": (summary_dict.get("mes_base_proyeccion") or summary_dict.get("mes")).isoformat(),
                "reference_note": "Valor aproximado basado en última factura real. Puede variar según proveedor, modelo y condiciones comerciales. No incluye 2Brains. Catastro principal considera solo compras asociadas a Acid Labs.",
                "summary": {
                    "capex_confirmado_label": capex_confirmed_label,
                    "capex_confirmado": known_confirmed_amount or None,
                    "capex_pendiente": known_pending_amount or None,
                    "capex_pendiente_status": (
                        "CAPEX pendiente por estimar / sin monto definitivo."
                        if unknown_pending_refs
                        else "Sin compras pendientes con referencia financiera cargada."
                    ),
                    "capex_proyectado_label": f"CAPEX proyectado {mes_label.split()[0]}",
                    "capex_proyectado": forecast_amount,
                    "forecast_unidades": forecast_units,
                    "mix_unitario_referencial": mix_unit_price or None,
                    "capex_renovacion_urgente": None,
                    "capex_renovacion_urgente_status": (
                        f"Sin referencia financiera vigente para {urgent_renewal_units} equipos en renovación urgente."
                        if urgent_renewal_units > 0
                        else "Sin renovación urgente valorizable con referencia vigente."
                    ),
                    "capex_total_estimado": total_known_capex or None,
                    "capex_total_status": "Total conocido: confirmado + forecast referencial. No incluye Ricoh ni 2Brains.",
                    "proveedor_mas_relevante": "MacOnline",
                    "empresa_mayor_presion": scope_company,
                },
                "by_company": [
                    {
                        "empresa": scope_company,
                        "capex_confirmado": known_confirmed_amount or None,
                        "capex_pendiente": known_pending_amount or None,
                        "capex_proyectado": forecast_amount,
                        "status": "Empresa incluida en el alcance financiero vigente.",
                    },
                ],
                "by_provider": [
                    {
                        "proveedor": "MacOnline",
                        "capex_confirmado": known_confirmed_amount or None,
                        "capex_pendiente": None,
                        "capex_proyectado": forecast_amount,
                        "status": "Proveedor con última factura real disponible.",
                    },
                    {
                        "proveedor": "Ricoh",
                        "capex_confirmado": None,
                        "capex_pendiente": None,
                        "capex_proyectado": None,
                        "status": "CAPEX pendiente por estimar / sin monto definitivo.",
                    },
                ],
                "categories": [
                    {
                        "categoria": "Compra confirmada",
                        "monto": known_confirmed_amount or None,
                        "status": "Compras confirmadas con referencia real del corte operativo actual.",
                    },
                    {
                        "categoria": "Compra pendiente",
                        "monto": known_pending_amount or None,
                        "status": "Ricoh queda pendiente por estimar hasta contar con cotización o factura.",
                    },
                    {
                        "categoria": "Renovación urgente",
                        "monto": None,
                        "status": "Sin referencia financiera vigente para modelos críticos.",
                    },
                    {
                        "categoria": "Renovación planificada",
                        "monto": None,
                        "status": "Sin referencia financiera vigente para valorización planificada.",
                    },
                    {
                        "categoria": "Forecast próximo ciclo",
                        "monto": forecast_amount,
                        "status": f"{forecast_units} equipos proyectados usando mix referencial de la última factura real.",
                    },
                ],
                "references": capex_reference_matches,
                "reading": (
                    f"Finanzas debe considerar un CAPEX proyectado de {forecast_amount or 0} CLP para cubrir presión operativa del siguiente ciclo usando la última factura real de MacOnline como referencia. "
                    "La compra pendiente con Ricoh no debe considerarse ejecutada hasta ingreso físico. No incluye 2Brains."
                ),
            }

        return {
            "mes": summary_response["mes"],
            "scope": scope_company,
            "scope_note": scope_note,
            "summary": summary_response,
            "compras_mes": summary_response,
            "executive_reading": executive_reading,
            "decision_recommended": {
                "title": decision_title,
                "body": decision_body,
                "tone": decision_tone,
                "actions": decision_actions,
            },
            "formula_breakdown": formula_breakdown,
            "projection_risk": projection_risk,
            "scenarios": scenarios,
            "forecast": forecast,
            "trend": trend,
            "month_options": month_options,
            "by_company": [dict(r) for r in company_rows],
            "by_provider": [dict(r) for r in provider_rows],
            "by_model": [dict(r) for r in model_rows],
            "detail": [dict(r) for r in detail_rows],
            "alertas": alertas,
            "compras_tracking": compras_tracking,
            "compras_tracking_note": compras_tracking_note,
            "capex": capex,
            "may_preview": may_preview,
            "ml_risk": {
                "summary": risk_summary,
                "groups": risk_groups,
                "policy_notes": [
                "Dell se da de baja y no se recompra.",
                "Apple A2141 en staffing se renueva; Mac M1 y M1 Pro quedan en observación.",
                "HP EliteBook 8 G1i 14 AI es el modelo objetivo Windows.",
                "MacBook Pro M5 Pro es el modelo objetivo para developers/staffing; MacBook Air M5 funciona como alternativa más liviana según perfil.",
                "Riesgo alto operativo = ML alta + ventana de renovación activa (dias_a_vencer <= 90 o flags de renovar).",
                "Riesgo urgente = ML alta + (dias_a_vencer <= 30 o tickets Jira abiertos o rotación 12m >= 1).",
                "Acción inmediata prioriza los casos donde el riesgo alto coincide con vencimiento crítico y señales operativas como tickets abiertos o rotación reciente.",
            ],
        },
            "pending_notes": pending_notes,
        }

    except SQLAlchemyError as e:
        raise _internal_api_error("planeacion_compras_resumen", e)


@router.get("/planeacion-parque")
def get_planeacion_parque(limit: int = 50):
    """
    Planeación basada en política real:
    - Dell: NO comprar → salida / renovación
    - Staffing: compra Mac M4/M5 Pro y HP Elitebook
    - Core: reutiliza desde staffing
    """
    try:
        sql = """
        with base as (
            select
                id_equipo,
                coalesce(
                    nullif(trim(marca_modelo), ''),
                    concat_ws(' ', nullif(trim(marca), ''), nullif(trim(modelo), '')),
                    'Sin modelo'
                ) as modelo,
                lower(coalesce(nullif(trim(marca), ''), '')) as marca,
                upper(coalesce(nullif(trim(ml_risk_level), ''), 'BAJO')) as risk_level,
                upper(coalesce(nullif(trim(estado_operativo), ''), 'ACTIVO')) as estado_operativo,
                coalesce(es_activo_operativo, upper(coalesce(nullif(trim(estado_operativo), ''), 'ACTIVO')) <> 'BAJA') as es_activo_operativo,
                upper(coalesce(nullif(trim(condicion), ''), 'UNKNOWN')) as condicion,
                coalesce(lower(plataforma), 'unknown') as plataforma
            from analytics.mart_equipos_estado_actual
            where coalesce(es_activo_operativo, upper(coalesce(nullif(trim(estado_operativo), ''), 'ACTIVO')) <> 'BAJA')
        ),

        clasificado as (
            select *,
                case
                    when marca like '%dell%' then 'RETIRO'
                    when modelo ilike '%mac%' then 'COMPRA_MAC'
                    when modelo ilike '%elitebook%' then 'COMPRA_HP'
                    else 'OTRO'
                end as politica_modelo,

                case
                    when plataforma like '%core%' then 'CORE'
                    else 'STAFFING'
                end as parque
            from base
        ),

        agg as (
            select
                politica_modelo,
                parque,
                sum(case when risk_level = 'ALTO' then 1 else 0 end) as alto,
                sum(case when risk_level = 'MEDIO' then 1 else 0 end) as medio,
                sum(case when risk_level = 'BAJO' then 1 else 0 end) as bajo,
                sum(case when condicion in ('BUENA','OK','GOOD') then 1 else 0 end) as reutilizable
            from clasificado
            group by politica_modelo, parque
        )

        select * from agg
        """

        rows = db.execute(text(sql)).mappings().all()

        salida = 0
        compra_mac = 0
        compra_hp = 0
        reutilizable_core = 0

        for r in rows:
            if r["politica_modelo"] == "RETIRO":
                salida += (r["alto"] or 0) + (r["medio"] or 0)

            if r["politica_modelo"] == "COMPRA_MAC" and r["parque"] == "STAFFING":
                compra_mac += (r["alto"] or 0) + (r["medio"] or 0)

            if r["politica_modelo"] == "COMPRA_HP" and r["parque"] == "STAFFING":
                compra_hp += (r["alto"] or 0) + (r["medio"] or 0)

            if r["parque"] == "STAFFING":
                reutilizable_core += (r["reutilizable"] or 0)

        return {
            "resumen": {
                "salida_renovacion": salida,
                "compra_mac": compra_mac,
                "compra_hp": compra_hp,
                "reutilizables_core": reutilizable_core
            },
            "debug_rows": rows
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ml-risk-equipos")
def ml_risk_equipos(
    mes: date = Query(..., description="YYYY-MM-01"),
    limit: int = Query(50, ge=1, le=500),
):
    sql = """
    select
      mes,
      id_equipo,
      cliente_ref,
      persona_ref,
      marca,
      modelo,
      mac_win,
      condicion,
      pais_regla,
      score_riesgo_rotacion,
      bucket_riesgo,
      factores_riesgo,
      factores_proteccion,
      explicacion_corta
    from analytics.v_mtr1203_ml_scores_latest
    where mes = :mes
    order by
      case bucket_riesgo
        when 'ALTO' then 1
        when 'MEDIO' then 2
        else 3
      end,
      score_riesgo_rotacion desc,
      id_equipo asc nulls last
    limit :limit
    """
    try:
        with engine.connect() as c:
            rows = [dict(r._mapping) for r in c.execute(sql_text(sql), {"mes": mes, "limit": int(limit)}).fetchall()]
        return {"mes": mes, "count": len(rows), "data": rows}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")










@router.get("/home-activos")
def home_activos():
    try:
        use_tmp = _has_table(engine, "analytics", "tmp_mtr1903_equipos_asignados")
        use_override = _has_table(engine, "analytics", "mtr_estado_override")
        has_raw_jira = _has_table(engine, "raw", "jira_issues")

        join_tmp_top = """
                    left join analytics.tmp_mtr1903_equipos_asignados tmp
                      on upper(tmp.id_equipo) = upper(e.id_equipo)
        """ if use_tmp else ""

        join_tmp_tabla = """
                      left join analytics.tmp_mtr1903_equipos_asignados tmp
                        on upper(tmp.id_equipo) = upper(e.id_equipo)
        """ if use_tmp else ""

        join_override_resumen = """
                  left join analytics.mtr_estado_override o
                    on upper(o.id_equipo) = upper(e.id_equipo)
        """ if use_override else ""

        join_override_tabla = """
                      left join analytics.mtr_estado_override o
                        on upper(o.id_equipo) = upper(e.id_equipo)
        """ if use_override else ""

        tmp_cliente_top = "nullif(tmp.cliente,'')," if use_tmp else ""
        tmp_cliente_tabla = "nullif(tmp.cliente,'')," if use_tmp else ""
        tmp_persona_tabla = "nullif(tmp.persona_asignada,'')," if use_tmp else ""
        tmp_fecha_tabla = "tmp.fecha_asignacion," if use_tmp else ""
        tmp_tipo_tabla = "case when tmp.persona_asignada is not null then 'ASIGNACION' else null end," if use_tmp else ""

        ov_estado_operativo_resumen = "o.estado_operativo_override," if use_override else ""
        ov_estado_operativo_tabla = "o.estado_operativo_override," if use_override else ""
        ov_estado_equipo_tabla = "o.estado_equipo_override," if use_override else ""
        ov_motivo_tabla = "o.motivo," if use_override else "null,"

        with engine.connect() as c:
            resumen = dict(c.execute(sql_text(f"""
                with base as (
                  select
                    e.id_equipo,
                    coalesce({ov_estado_operativo_resumen}
                      case
                        when upper(coalesce(e.last_event_type,'')) in ('ASIGNACION','INGRESO') then 'ASIGNADO'
                        when upper(coalesce(e.last_event_type,'')) in ('SAL','SALIDA','BAJA','RECUPERADO','RECUPERAR','POR RECUPERAR','DEFECTUOSO','OBSOLETO') then 'BAJA'
                        else upper(coalesce(e.estado_operativo,''))
                      end
                    ) as estado_operativo
                  from analytics.mart_equipos_estado_actual e
                  {join_override_resumen}
                )
                select
                  count(*) as activos_totales,
                  count(*) filter (where estado_operativo = 'ASIGNADO') as asignados,
                  count(*) filter (where estado_operativo in ('DISPONIBLE','STAND_BY')) as disponibles,
                  count(*) filter (where estado_operativo = 'BAJA') as bajas,
                  0 as sin_score,
                  0 as renovar,
                  0 as sin_asignacion,
                  0 as rotacion_alta
                from base
            """)).mappings().one())

            if _has_table(engine, "analytics", "mart_confianza_dato"):
                reconciliacion = dict(c.execute(sql_text("""
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
                """)).mappings().one())

                extra = (
                    dict(c.execute(sql_text("""
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
                    """)).mappings().one())
                    if _has_table(engine, "analytics", "mart_operacion_alertas")
                    else {
                        "reservas_jira_pendientes": 0,
                        "asignados_sin_respaldo_cruzado": 0,
                    }
                )

                reconciliacion.update(extra)
            elif _has_table(engine, "analytics", "mart_mtr_jira_reconciliacion"):
                reconciliacion = dict(c.execute(sql_text("""
                    select
                      count(*) filter (where conciliacion_estado = 'CONCILIADO') as equipos_conciliados,
                      count(*) filter (where coalesce(flag_inconsistencia_mtr_jira, false)) as inconsistencias_mtr_jira,
                      count(*) filter (where coalesce(flag_jira_sin_match_mtr, false)) as jira_sin_match_mtr,
                      count(*) filter (where coalesce(flag_mtr_sin_match_jira, false)) as mtr_sin_match_jira,
                      count(*) filter (where coalesce(flag_creado_jira_sin_ingreso_mtr, false)) as creados_jira_sin_ingreso_mtr,
                      count(*) filter (where coalesce(flag_reserva_jira_pendiente, false)) as reservas_jira_pendientes,
                      count(*) filter (where coalesce(flag_asignado_sin_respaldo_cruzado, false)) as asignados_sin_respaldo_cruzado
                    from analytics.mart_mtr_jira_reconciliacion
                """)).mappings().one())
            else:
                reconciliacion = {
                    "equipos_conciliados": 0,
                    "inconsistencias_mtr_jira": 0,
                    "jira_sin_match_mtr": 0,
                    "mtr_sin_match_jira": 0,
                    "creados_jira_sin_ingreso_mtr": 0,
                    "reservas_jira_pendientes": 0,
                    "asignados_sin_respaldo_cruzado": 0,
                }

            top_clientes = [
                dict(r)
                for r in c.execute(sql_text(f"""
                    select
                      coalesce({tmp_cliente_top} nullif(e.cliente,''), 'SIN_CLIENTE') as cliente,
                      count(*) as equipos,
                      null::numeric as score_promedio
                    from analytics.mart_equipos_estado_actual e
                    {join_tmp_top}
                    group by 1
                    order by equipos desc, cliente asc
                    limit 10
                """)).mappings().all()
            ]

            jira_board_counts = {}
            if has_raw_jira:
                jira_board_counts = {
                    str(row["bucket"]): int(row["total"] or 0)
                    for row in c.execute(sql_text("""
                        select
                          coalesce(nullif(board_bucket, ''), 'SIN_BUCKET') as bucket,
                          count(*) as total
                        from raw.jira_issues
                        group by 1
                    """)).mappings().all()
                }

            tabla = [
                dict(r)
                for r in c.execute(sql_text(f"""
                    with base as (
                      select
                        e.id_equipo,
                        coalesce({tmp_cliente_tabla} nullif(e.cliente,'')) as cliente,
                        e.estado_equipo_mtr,

                        coalesce({ov_estado_operativo_tabla}
                          case
                            when upper(coalesce(e.last_event_type,'')) in ('ASIGNACION','INGRESO') then 'ASIGNADO'
                            when upper(coalesce(e.last_event_type,'')) in ('SAL','SALIDA','BAJA','RECUPERADO','RECUPERAR','POR RECUPERAR','DEFECTUOSO','OBSOLETO') then 'BAJA'
                            else upper(coalesce(e.estado_operativo,''))
                          end
                        ) as estado_operativo,

                        coalesce({ov_estado_equipo_tabla}
                          case
                            when upper(coalesce(e.last_event_type,'')) in ('ASIGNACION','INGRESO') then 'Asignado'
                            when upper(coalesce(e.last_event_type,'')) in ('SAL','SALIDA','BAJA','RECUPERADO','RECUPERAR','POR RECUPERAR','DEFECTUOSO','OBSOLETO') then 'Baja'
                            else e.estado_equipo
                          end
                        ) as estado_equipo,

                        case
                          when coalesce({ov_estado_operativo_tabla}
                            case
                              when upper(coalesce(e.last_event_type,'')) in ('ASIGNACION','INGRESO') then 'ASIGNADO'
                              when upper(coalesce(e.last_event_type,'')) in ('SAL','SALIDA','BAJA','RECUPERADO','RECUPERAR','POR RECUPERAR','DEFECTUOSO','OBSOLETO') then 'BAJA'
                              else upper(coalesce(e.estado_operativo,''))
                            end
                          ) = 'ASIGNADO'
                          then coalesce(
                            nullif(e.last_event_persona,''),
                            {tmp_persona_tabla}
                            nullif(e.last_event_persona,'')
                          )
                          else null
                        end as persona,

                        e.ml_score,
                        e.ml_risk_level,
                        e.ml_alert_code,
                        coalesce({tmp_fecha_tabla} e.last_event_date) as last_event_date,
                        coalesce(
                          e.last_event_type,
                          {tmp_tipo_tabla}
                          e.last_event_type
                        ) as last_event_type,
                        e.alertas_severidad,
                        e.alertas_resumen,
                        e.priority_final_rank,
                        coalesce({ov_motivo_tabla} e.priority_final_motivo) as priority_final_motivo
                      from analytics.mart_equipos_estado_actual e
                      {join_tmp_tabla}
                      {join_override_tabla}
                    )
                    select
                      id_equipo,
                      cliente,
                      persona,
                      estado_equipo_mtr,
                      estado_operativo,
                      estado_equipo,
                      ml_score,
                      ml_risk_level,
                      ml_alert_code,
                      last_event_date,
                      last_event_type,
                      alertas_severidad,
                      alertas_resumen,
                      priority_final_rank,
                      priority_final_motivo
                    from base
                    order by
                      priority_final_rank asc nulls last,
                      last_event_date desc nulls last,
                      id_equipo asc
                    limit 500
                """)).mappings().all()
            ]

        return {
            "resumen": resumen,
            "reconciliacion": reconciliacion,
            "top_clientes": top_clientes,
            "jira_board_counts": jira_board_counts,
            "tabla": tabla,
            "count_tabla": len(tabla)
}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/planeacion-series")
def planeacion_series():
    sql = """
    select
      mes,
      bloque,
      serie,
      valor
    from analytics.mart_ui_planeacion_series
    order by mes asc, bloque asc, serie asc
    """
    try:
        with engine.connect() as conn:
            rows = [dict(r._mapping) for r in conn.execute(sql_text(sql))]

        out = {
            "global": [],
            "os": [],
            "clientes": [],
            "forecast": [],
            "kpi": {
                "stock_recomendado_3m": 0,
                "promedio_mensual_3m": 0
}
        }

        for r in rows:
            item = {
                "mes": r["mes"].isoformat() if r["mes"] else None,
                "serie": r["serie"],
                "valor": float(r["valor"]) if r["valor"] is not None else 0
            }
            bloque = (r["bloque"] or "").upper()
            if bloque == "GLOBAL":
                out["global"].append(item)
            elif bloque == "OS":
                out["os"].append(item)
            elif bloque == "CLIENTE":
                out["clientes"].append(item)
            elif bloque == "FORECAST":
                out["forecast"].append(item)


        forecast_vals = [
            float(x["valor"] or 0)
            for x in out["forecast"]
            if x.get("serie") == "compra_base_forecast"
        ]
        if forecast_vals:
            out["kpi"] = {
                "stock_recomendado_3m": int(round(sum(forecast_vals))),
                "promedio_mensual_3m": int(round(sum(forecast_vals) / len(forecast_vals)))
}

        return out
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

@router.get("/riesgo-90d")
def riesgo_90d(limit: int = 50):
    sql = text("""
    with bajas as (
      select distinct upper(trim(id_equipo)) as id_equipo
      from analytics.bajas2703
      where nullif(trim(id_equipo), '') is not null
    ),
    activos as (
      select
        upper(trim(id_equipo)) as id_equipo,
        coalesce(es_activo_operativo, upper(coalesce(nullif(trim(estado_operativo), ''), 'ACTIVO')) <> 'BAJA') as es_activo_operativo
      from analytics.mart_equipos_estado_actual
    )
    select
      p.id_equipo,
      p.marca,
      p.modelo,
      p.tipo_colaborador,
      p.segmento_destino,
      p.cliente,
      p.accion_regla_modelo,
      p.motivo_regla_modelo,
      p.flag_renovar_regla,
      p.flag_dar_baja_regla,
      p.ml_score as score,
      p.ml_risk_level as nivel_riesgo,
      p.ml_alert_code as factores_riesgo,
      p.last_event_date,
      p.last_event_type,
      coalesce(p.alertas_resumen, 'Sin alertas') as explicacion_corta,
      case
        when coalesce(p.flag_dar_baja_regla, false) then 'ALTO'
        when coalesce(p.flag_renovar_regla, false) then 'MEDIO'
        else 'BAJO'
      end as riesgo_90d
    from analytics.mart_equipos_estado_actual_politica p
    left join bajas b
      on b.id_equipo = upper(p.id_equipo)
    left join activos a
      on a.id_equipo = upper(p.id_equipo)
    where b.id_equipo is null
      and coalesce(a.es_activo_operativo, true)
    order by
      case
        when coalesce(p.flag_dar_baja_regla, false) then 1
        when coalesce(p.flag_renovar_regla, false) then 2
        else 3
      end,
      p.priority_final_rank nulls last,
      p.id_equipo
    limit :limit
    """)

    try:
        with engine.connect() as conn:
            rows = [dict(r) for r in conn.execute(sql, {"limit": int(limit)}).mappings().all()]

        alto = [r for r in rows if (r.get("riesgo_90d") or "").upper() == "ALTO"]
        medio = [r for r in rows if (r.get("riesgo_90d") or "").upper() == "MEDIO"]
        bajo = [r for r in rows if (r.get("riesgo_90d") or "").upper() == "BAJO"]

        return {
            "rows": rows,
            "count": len(rows),
            "grupos": {"alto": alto, "medio": medio, "bajo": bajo},
            "alto": alto,
            "medio": medio,
            "bajo": bajo
        }

    except Exception as e:
        return {
            "error": str(e),
            "rows": [],
            "count": 0,
            "grupos": {"alto": [], "medio": [], "bajo": []},
            "alto": [],
            "medio": [],
            "bajo": []
        }


@router.get("/modelos-criticos")
def modelos_criticos():
    sql = """
    with base as (
        select
            id_equipo,
            upper(coalesce(modelo, '')) as modelo,
            coalesce(estado_operativo, estado_equipo_mtr, '') as estado_raw,
            cliente,
            coalesce(movimientos_12m, 0) as movimientos_12m,
            last_event_date
        from analytics.mart_equipos_estado_actual
    ),
    filtrado as (
        select *,
            case
                when modelo like '%A2141%' then 'MAC A2141'
                when modelo like '%A1990%' then 'MAC A1990'
                when modelo like '%7400%' then 'DELL 7400'
                else null
            end as modelo_familia
        from base
        where modelo like '%A2141%'
           or modelo like '%A1990%'
           or modelo like '%7400%'
    ),
    clasificado as (
        select *,
            case
                when upper(estado_raw) like '%BAJA%' then 'BAJA'
                when upper(estado_raw) like '%ASIGN%' then 'ASIGNADO'
                else 'OTRO'
            end as estado_simple
        from filtrado
    )
    select
        modelo_familia,
        count(*) as total_equipos,
        count(*) filter (where estado_simple = 'ASIGNADO') as asignados,
        count(*) filter (where estado_simple = 'BAJA') as bajas,
        round(avg(movimientos_12m)::numeric, 1) as rotacion_promedio_12m,
        sum(movimientos_12m) as rotacion_total_12m
    from clasificado
    group by modelo_familia
    order by modelo_familia
    """

    try:
        with engine.connect() as conn:
            rows = [dict(r) for r in conn.execute(text(sql)).mappings().all()]
        return {"rows": rows, "count": len(rows)}
    except SQLAlchemyError:
        return {"rows": [], "count": 0}


@router.get("/ml-timeline/{id_equipo}")
def ml_timeline(id_equipo: str):
    sql = """
    select
      fecha_evento,
      tipo_evento,
      persona,
      cliente,
      location_ingreso,
      pais_regla,
      id_equipo,
      id_equipo_detectado,
      marca,
      modelo,
      mac_win,
      condicion
    from analytics.mart_equipos_estado_actual
    where
      upper(coalesce(id_equipo,'')) = upper(:id_equipo)
      or upper(coalesce(id_equipo_detectado,'')) = upper(:id_equipo)
    order by fecha_evento asc
    """
    try:
        with engine.connect() as c:
            rows = [
                dict(r._mapping)
                for r in c.execute(sql_text(sql), {"id_equipo": id_equipo}).fetchall()
            ]

        return {
            "id_equipo": id_equipo,
            "count": len(rows),
            "data": rows
}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
      
@router.get("/resumen")
def resumen_mes(
    mes: str = Query(..., description="YYYY-MM-01"),
):
    sql = """
    with m as (
      select *
      from analytics.mart_equipos_estado_actual
      where mes::date = :mes::date
    ),
    ing as (
      select
        count(*) as ingresos,
        count(*) filter (where coalesce(requiere_equipo_regla, false) = true) as ingresos_requieren,
        count(*) filter (where coalesce(requiere_equipo_regla, false) = false) as ingresos_no_requieren,
        count(*) filter (where upper(coalesce(mac_win, '')) = 'MAC') as ingresos_mac,
        count(*) filter (where upper(coalesce(mac_win, '')) = 'WIN') as ingresos_win,
        count(*) filter (
          where upper(coalesce(mac_win, '')) = 'MAC'
            and coalesce(condicion, '') ilike 'nuevo%%'
        ) as compras_mac_nuevos
      from m
      where tipo_evento = 'INGRESO'
    ),
    sal as (
      select
        count(*) as salidas,
        count(*) filter (where upper(coalesce(mac_win, '')) = 'MAC') as salidas_mac,
        count(*) filter (where upper(coalesce(mac_win, '')) = 'WIN') as salidas_win
      from m
      where tipo_evento = 'SALIDA'
    ),
    ext as (
      select
        count(*) filter (
          where tipo_evento = 'INGRESO'
            and lower(coalesce(pais_regla, '')) = 'extranjero'
            and coalesce(requiere_equipo_regla, false) = false
        ) as extranjeros_total,
        count(*) filter (
          where tipo_evento = 'INGRESO'
            and lower(coalesce(pais_regla, '')) = 'extranjero'
            and coalesce(requiere_equipo_regla, false) = false
            and lower(coalesce(cliente, '')) like 'core%%'
        ) as extranjeros_core,
        count(*) filter (
          where tipo_evento = 'INGRESO'
            and lower(coalesce(pais_regla, '')) = 'extranjero'
            and coalesce(requiere_equipo_regla, false) = false
            and lower(coalesce(cliente, '')) like 'staff%%'
        ) as extranjeros_staffing,
        count(*) filter (
          where tipo_evento = 'SALIDA'
            and lower(coalesce(pais_regla, '')) = 'extranjero'
        ) as salidas_extranjeros_total,
        count(*) filter (
          where tipo_evento = 'SALIDA'
            and lower(coalesce(pais_regla, '')) = 'extranjero'
            and nullif(coalesce(id_equipo, ''), '') is not null
        ) as salidas_extranjeros_con_equipo,
        count(*) filter (
          where tipo_evento = 'SALIDA'
            and lower(coalesce(pais_regla, '')) = 'extranjero'
            and nullif(coalesce(id_equipo, ''), '') is null
        ) as salidas_extranjeros_sin_equipo
      from m
    ),
    cambios as (
      select count(*) as cambios_equipo
      from (
        select
          fecha_evento,
          persona,
          id_equipo,
          lag(id_equipo) over (
            partition by upper(coalesce(persona, ''))
            order by fecha_evento, tipo_evento, coalesce(id_equipo, '')
          ) as prev_equipo
        from m
        where nullif(coalesce(persona, ''), '') is not null
          and nullif(coalesce(id_equipo, ''), '') is not null
      ) x
      where prev_equipo is not null
        and upper(coalesce(prev_equipo, '')) <> upper(coalesce(id_equipo, ''))
    ),
    stock as (
      select
        stock_activo,
        stock_mac,
        stock_win,
        stock_nuevo,
        stock_usado
      from analytics.v_mtr1203_stock_operativo_mes
      where mes::date = :mes::date
    )
    select
      :mes::date as mes,
      coalesce((select ingresos from ing), 0) as ingresos,
      coalesce((select salidas from sal), 0) as salidas,
      coalesce((select ingresos from ing), 0) - coalesce((select salidas from sal), 0) as delta,
      coalesce((select stock_activo from stock), 0) as stock_activo,

      0 as movimientos_total,
      0 as asignaciones,

      coalesce((select extranjeros_total from ext), 0) as extranjeros_total,
      coalesce((select extranjeros_core from ext), 0) as extranjeros_core,
      coalesce((select extranjeros_staffing from ext), 0) as extranjeros_staffing,

      coalesce((select salidas_extranjeros_total from ext), 0) as salidas_extranjeros_total,
      coalesce((select salidas_extranjeros_con_equipo from ext), 0) as salidas_extranjeros_con_equipo,
      coalesce((select salidas_extranjeros_sin_equipo from ext), 0) as salidas_extranjeros_sin_equipo,

      case
        when coalesce((select salidas from sal), 0) > 0
        then round(100.0 * coalesce((select salidas_extranjeros_total from ext), 0) / (select salidas from sal), 1)
        else 0
      end as pct_salidas_extranjeros_100,

      coalesce((select cambios_equipo from cambios), 0) as cambios_equipo_mes,

      coalesce((select compras_mac_nuevos from ing), 0) as compras_mac_nuevos,

      concat(
        'Ingresos ', coalesce((select ingresos from ing), 0),
        ' · Salidas ', coalesce((select salidas from sal), 0),
        ' · Delta ', coalesce((select ingresos from ing), 0) - coalesce((select salidas from sal), 0),
        ' · Stock activo ', coalesce((select stock_activo from stock), 0),
        ' · Presión compra ', coalesce((select ingresos_requieren from ing), 0),
        ' · Extranjeros sin equipo ', coalesce((select extranjeros_total from ext), 0)
      ) as insight_mtr
    """
    try:
        with engine.connect() as c:
            row = c.execute(sql_text(sql), {"mes": mes}).mappings().first()
        return dict(row) if row else {"mes": mes}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

@router.get("/mtr-detalle-mes")
def mtr_detalle_mes(
    mes: str = Query(..., description="YYYY-MM-01"),
    tipo: str = Query(..., description="ingresos|salidas"),
    limit: int = Query(500, ge=1, le=5000),
):
    tipo_norm = (tipo or "").strip().lower()
    if tipo_norm not in ("ingresos", "salidas"):
        raise HTTPException(status_code=400, detail="tipo debe ser ingresos|salidas")

    tipo_mov = "INGRESO" if tipo_norm == "ingresos" else "SALIDA"

    sql = """
    select
      e.fecha_evento as fecha_evento,
      e.persona,
      e.empresa as cliente,
      e.empresa as cliente_asignado,
      e.id_equipo as equipo_asignado_actual,
      e.id_equipo,
      e.marca,
      e.modelo,
      null::text as condicion,
      case
        when upper(coalesce(e.os_familia, '')) = 'MAC' then 'MAC'
        when upper(coalesce(e.os_familia, '')) = 'WIN' then 'WIN'
        else null
      end as mac_win,
      e.es_ingreso_nuevo as es_nuevo,
      e.tipo_ingreso,
      e.ingreso_con_equipo,
      e.ingreso_presiona_compra,
      e.solicitud_equipo_explicita,
      e.requiere_equipo_regla,
      case
        when upper(coalesce(e.ambito, '')) = 'NACIONAL' then 'chile'
        when upper(coalesce(e.ambito, '')) = 'EXTRANJERO' then 'extranjero'
        else 'unknown'
      end as pais_regla,
      e.pais as location_ingreso,
      e.pais,
      case
        when e.tipo_evento = 'INGRESO'
          and not coalesce(e.ingreso_con_equipo, false)
          and coalesce(e.ingreso_presiona_compra, false)
          then 'Pendiente'
        else null
      end as sku_pendiente,
      null::text as id_equipo_anterior_persona,
      null::text as cliente_anterior_persona,
      false as es_cambio_equipo_real,
      false as es_movimiento_interno_persona_cliente,
      trim(
        concat_ws(
          ' ',
          nullif(e.marca, ''),
          nullif(e.modelo, '')
        )
      ) as detalle
    from analytics.mart_catastro_historia_eventos e
    where e.mes = :mes
      and e.tipo_evento = :tipo_mov
    order by e.fecha_evento asc, cliente asc nulls last, persona asc nulls last
    limit :limit
    """
    try:
        with engine.connect() as c:
            rows = [
                dict(r._mapping)
                for r in c.execute(
                    sql_text(sql),
                    {"mes": mes, "tipo_mov": tipo_mov, "limit": int(limit)}
                ).fetchall()
            ]
        mes_date = date.fromisoformat(str(mes)[:10])
        return {
            "mes": mes,
            "tipo": tipo_norm,
            "estado_mes": _month_state(mes_date),
            "fecha_ultima_actualizacion": max((row.get("fecha_evento") for row in rows), default=None),
            "fuente": MTR_EXECUTIVE_SOURCE,
            "data": rows,
            "count": len(rows),
        }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

@router.get("/modelos-criticos")
def modelos_criticos():
    sql = """
    with base as (
        select
            id_equipo,
            upper(coalesce(modelo, '')) as modelo,
            coalesce(estado_operativo, estado_equipo, '') as estado_raw,
            cliente_final,
            persona_asignada_final,
            coalesce(movimientos_12m, 0) as movimientos_12m,
            last_event_date
        from analytics.mart_equipos_estado_actual_v3
    ),
    filtrado as (
        select *,
            case
                when modelo like '%A2141%' then 'MAC A2141'
                when modelo like '%A1990%' then 'MAC A1990'
                when modelo like '%7400%' then 'DELL 7400'
                else null
            end as modelo_familia
        from base
        where modelo like '%A2141%'
           or modelo like '%A1990%'
           or modelo like '%7400%'
    ),
    clasificado as (
        select *,
            case
                when upper(estado_raw) like '%BAJA%' then 'BAJA'
                when upper(estado_raw) like '%ASIGN%' then 'ASIGNADO'
                else 'OTRO'
            end as estado_simple
        from filtrado
    )
    select
        modelo_familia,
        count(*) as total_equipos,
        count(*) filter (where estado_simple = 'ASIGNADO') as asignados,
        count(*) filter (where estado_simple = 'BAJA') as bajas,
        round(avg(movimientos_12m)::numeric, 1) as rotacion_promedio_12m,
        sum(movimientos_12m) as rotacion_total_12m
    from clasificado
    group by modelo_familia
    order by modelo_familia
    """

    try:
        with engine.connect() as conn:
            rows = [dict(r) for r in conn.execute(text(sql)).mappings().all()]
        return {"rows": rows, "count": len(rows)}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"modelos_criticos error: {e}")

@router.get("/renovaciones-resumen")
def renovaciones_resumen():
    sql = """
    select
      accion_regla_modelo,
      sum(equipos) as equipos
    from analytics.mart_resumen_renovaciones
    group by 1
    order by 2 desc
    """
    with engine.connect() as conn:
        rows = [dict(r._mapping) for r in conn.execute(text(sql))]
    return {"rows": rows, "count": len(rows)}

@router.get("/activos-politica")
def activos_politica(limit: int = 500):
    sql = """
    select
      id_equipo,
      marca,
      modelo,
      tipo_colaborador,
      segmento_destino,
      cliente,
      accion_regla_modelo,
      motivo_regla_modelo,
      flag_renovar_regla,
      flag_dar_baja_regla
    from analytics.mart_equipos_estado_actual_politica
    order by
      case accion_regla_modelo
        when 'RENOVAR_Y_BAJA' then 1
        when 'RENOVAR' then 2
        when 'CONSERVAR' then 3
        else 4
      end,
      marca,
      modelo,
      id_equipo
    limit :limit
    """
    with engine.connect() as conn:
        rows = [dict(r._mapping) for r in conn.execute(text(sql), {"limit": limit})]
    return {"rows": rows, "count": len(rows)}



@router.get("/movimientos-mes-historico")
def get_movimientos_mes_historico(limit: int = 12):
    try:
        sql = """
        select
            mes,
            movimientos_total,
            mtr_ingresos_total as ingresos,
            mtr_salidas_total as salidas,
            stock_activo,
            pct_movimientos_100,
            insight_movimientos
        from analytics.mart_estadistica_movimientos_mes
        order by mes desc
        limit :limit
        """
        with engine.connect() as c:
            rows = c.execute(text(sql), {"limit": limit}).mappings().all()

        items = [dict(r) for r in rows]
        items.reverse()

        return {
            "count": len(items),
            "items": items
        }

    except Exception as e:
        return {"error": str(e)}



@router.get("/movimientos-mes-historico-v2")
def get_movimientos_mes_historico_v2(limit: int = 12):
    try:
        sql = """
        select
            m.mes,
            m.movimientos_total,
            m.total_ingresos as ingresos,
            m.total_salidas as salidas,
            m.estado_mes,
            m.fecha_ultima_actualizacion,
            m.fecha_ultimo_evento_mtr,
            m.fuente,
            m.movimientos_internos,
            m.movimientos_internos_sin_impacto,
            m.cambios_equipo_real,
            m.cambios_equipo_real_base,
            m.cambios_reemplazos_mtr,
            m.asignaciones,
            m.ingresos_hardware,
            m.reasignaciones_hardware,
            m.equipos_reutilizados,
            m.devoluciones_hardware,
            m.equipos_retornados,
            m.equipos_baja,
            m.salidas_hardware,
            m.ingresos_personas,
            m.ingresos_mtr_original,
            m.salidas_personas,
            m.salidas_mtr_original,
            m.nuevos_con_equipo,
            m.nuevos_sin_equipo,
            m.nacionales_con_equipo_asignado,
            m.nacionales_pendientes_equipo,
            m.internacionales_con_equipo_asignado,
            m.internacionales_sin_equipo_no_requerido,
            m.presion_compra,
            m.stock_activo,
            m.stock_disponible,
            m.gap,
            m.override_manual_aplicado,
            m.override_scope,
            m.override_note,
            m.delta_ingresos_vs_mtr_original,
            m.delta_salidas_vs_mtr_original,
            m.conteo_validado_mtr_original,
            m.estado_validacion_mtr_original,
            m.pct_movimientos_100,
            m.insight_movimientos,
            m.insight_mtr,
            (m.estado_mes = 'en_curso') as is_current_month,
            case
                when m.estado_mes = 'en_curso' then m.fecha_ultima_actualizacion
                else null::date
            end as acumulado_hasta
        from analytics.mart_estadistica_movimientos_mes_v2 m
        order by m.mes desc
        limit :limit
        """
        with engine.connect() as c:
            rows = c.execute(text(sql), {"limit": limit}).mappings().all()

        items = [_decorate_month_row(dict(r)) for r in rows]
        items.reverse()

        return {"count": len(items), "items": items}

    except Exception as e:
        return {"error": str(e)}



@router.get("/estadisticas-porcentajes")
def get_estadisticas_porcentajes(
    date_from: date = Query(default=date(2025, 1, 1)),
    date_to: date = Query(default=date(2026, 4, 30)),
):
    try:
        sql_geo = """
        select
          count(*) filter (
            where tipo_evento = 'INGRESO'
              and upper(coalesce(ambito, '')) = 'NACIONAL'
          ) as chile,
          count(*) filter (
            where tipo_evento = 'INGRESO'
              and upper(coalesce(ambito, '')) = 'EXTRANJERO'
          ) as extranjero,
          count(*) filter (
            where tipo_evento = 'INGRESO'
              and upper(coalesce(ambito, '')) not in ('NACIONAL', 'EXTRANJERO')
          ) as sin_dato,
          count(*) filter (where tipo_evento = 'INGRESO') as total
        from analytics.mart_catastro_historia_eventos
        where fecha_evento >= cast(:date_from as date)
          and fecha_evento <= cast(:date_to as date)
        """

        sql_os = """
        select
          count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_con_equipo, false)
              and upper(coalesce(os_familia, '')) = 'MAC'
          ) as mac,
          count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_con_equipo, false)
              and upper(coalesce(os_familia, '')) = 'WIN'
          ) as windows,
          count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_con_equipo, false)
              and upper(coalesce(os_familia, '')) not in ('MAC', 'WIN')
          ) as sin_dato,
          count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_con_equipo, false)
          ) as total
        from analytics.mart_catastro_historia_eventos
        where fecha_evento >= cast(:date_from as date)
          and fecha_evento <= cast(:date_to as date)
        """

        sql_clientes_ing = """
        with base as (
          select
            coalesce(nullif(trim(cliente), ''), 'Sin cliente') as cliente,
            count(*) as total
          from analytics.int_mtr_eventos_dedup_stats
          where tipo_evento = 'INGRESO'
            and fecha_evento_dia >= cast(:date_from as date)
            and fecha_evento_dia <= cast(:date_to as date)
          group by 1
        )
        select
          cliente,
          total,
          round(total::numeric * 100 / sum(total) over (), 2) as pct
        from base
        order by total desc, cliente
        limit 10
        """

        sql_clientes_sal = """
        with base as (
          select
            coalesce(nullif(trim(cliente), ''), 'Sin cliente') as cliente,
            count(*) as total
          from analytics.int_mtr_eventos_dedup_stats
          where tipo_evento = 'SALIDA'
            and fecha_evento_dia >= cast(:date_from as date)
            and fecha_evento_dia <= cast(:date_to as date)
          group by 1
        )
        select
          cliente,
          total,
          round(total::numeric * 100 / sum(total) over (), 2) as pct
        from base
        order by total desc, cliente
        limit 10
        """

        with engine.connect() as c:
            geo = c.execute(text(sql_geo), {"date_from": date_from, "date_to": date_to}).mappings().first()
            osr = c.execute(text(sql_os), {"date_from": date_from, "date_to": date_to}).mappings().first()
            cli_ing = c.execute(text(sql_clientes_ing), {"date_from": date_from, "date_to": date_to}).mappings().all()
            cli_sal = c.execute(text(sql_clientes_sal), {"date_from": date_from, "date_to": date_to}).mappings().all()

        return {
            "geo": dict(geo) if geo else {},
            "os": dict(osr) if osr else {},
            "clientes_ingresos": [dict(x) for x in cli_ing],
            "clientes_salidas": [dict(x) for x in cli_sal],
            "periodo_clientes": {
                "date_from": date_from.isoformat(),
                "date_to": date_to.isoformat(),
            },
        }

    except Exception as e:
        return {"error": str(e)}

@router.get("/rotacion-sku")
def get_rotacion_sku(limit: int = 20):
    try:
        sql_resumen = """
        select
          bucket_rotacion,
          count(*) as total
        from analytics.mart_mtr_rotacion_sku
        group by 1
        order by
          case bucket_rotacion
            when 'ALTA' then 1
            when 'MEDIA' then 2
            else 3
          end
        """

        sql_top = """
        select
          id_equipo,
          eventos_totales,
          ingresos_totales,
          salidas_totales,
          eventos_12m,
          salidas_12m,
          personas_distintas_total,
          personas_distintas_12m,
          indice_rotacion,
          bucket_rotacion,
          primera_fecha_evento,
          ultima_fecha_evento,
          dias_desde_ultimo_evento
        from analytics.mart_mtr_rotacion_sku
        order by indice_rotacion desc, salidas_12m desc, eventos_12m desc, id_equipo
        limit :limit
        """

        with engine.connect() as c:
            resumen = c.execute(text(sql_resumen)).mappings().all()
            top = c.execute(text(sql_top), {"limit": limit}).mappings().all()

        return {
            "resumen": [dict(x) for x in resumen],
            "top": [dict(x) for x in top]
        }

    except Exception as e:
        return {"error": str(e)}

@router.get("/rotacion-sku/{id_equipo}")
def get_rotacion_sku_detalle(id_equipo: str):
    try:
        sql = """
        select
          id_equipo,
          eventos_totales,
          ingresos_totales,
          salidas_totales,
          eventos_12m,
          salidas_12m,
          personas_distintas_total,
          personas_distintas_12m,
          indice_rotacion,
          bucket_rotacion,
          primera_fecha_evento,
          ultima_fecha_evento,
          dias_desde_ultimo_evento
        from analytics.mart_mtr_rotacion_sku
        where upper(id_equipo) = upper(:id_equipo)
        """

        sql_timeline = """
        select
          fecha_evento::date as fecha,
          tipo_evento,
          coalesce(nullif(trim(persona), ''), 'Sin persona') as persona,
          coalesce(nullif(trim(cliente), ''), 'Sin cliente') as cliente
        from analytics.int_mtr_eventos_dedup_stats
        where upper(id_equipo) = upper(:id_equipo)
        order by fecha_evento desc
        limit 50
        """

        with engine.connect() as c:
            row = c.execute(text(sql), {"id_equipo": id_equipo}).mappings().first()
            timeline = c.execute(text(sql_timeline), {"id_equipo": id_equipo}).mappings().all()

        return {
            "item": dict(row) if row else None,
            "timeline": [dict(x) for x in timeline]
        }

    except Exception as e:
        return {"error": str(e)}

@router.get("/home-resumen-v2")
def get_home_resumen_v2():
    try:
        cols_sql = """
        select column_name
        from information_schema.columns
        where table_schema = 'analytics'
          and table_name = 'mart_equipos_estado_actual'
        """
        with engine.connect() as c:
            cols = {r[0] for r in c.execute(text(cols_sql)).fetchall()}

        persona_col = "persona_visible" if "persona_visible" in cols else (
            "persona_asignada" if "persona_asignada" in cols else "null"
        )
        active_expr = _active_operational_predicate(lambda name: name in cols)
        ml_risk_expr = "upper(coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'SIN SCORE'))"

        sql = f"""
        with base as (
          select *
          from analytics.mart_equipos_estado_actual
        )
        select
          count(*) filter (where {active_expr}) as activos_totales,
          count(*) filter (
            where {active_expr}
              and (
                upper(coalesce(estado_operativo, '')) like '%ASIGN%'
                or upper(coalesce(estado_equipo, '')) like '%ASIGN%'
              )
          ) as asignados,
          count(*) filter (
            where {active_expr}
              and (
                upper(coalesce(estado_operativo, '')) like '%DISPON%'
                or upper(coalesce(estado_equipo, '')) like '%DISPON%'
                or upper(coalesce(estado_operativo, '')) like '%STAND%'
              )
          ) as disponibles,
          count(*) filter (where not {active_expr}) as bajas,
          count(*) filter (
            where {active_expr}
              and coalesce(nullif(trim(cast({persona_col} as text)), ''), '') = ''
          ) as sin_asignacion,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'ALTO') as riesgo_alto,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'MEDIO') as riesgo_medio,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'BAJO') as riesgo_bajo
        from base
        """
        with engine.connect() as c:
            row = c.execute(text(sql)).mappings().first()
        return dict(row) if row else {}
    except Exception as e:
        return {"error": str(e)}

@router.get("/activos-lista-v2")
def get_activos_lista_v2(limit: int = 200):
    try:
        sql = """
        select
          id_equipo,
          cliente,
          persona_visible,
          localizacion,
          ciudad_comuna,
          marca,
          modelo,
          tipo_colaborador,
          estado_operativo,
          estado_equipo,
          ml_risk_level,
          ml_score,
          alertas_severidad,
          decision_sugerida,
          decision_motivo
        from analytics.mart_equipos_estado_actual
        where coalesce(es_activo_operativo, upper(coalesce(estado_operativo, 'ACTIVO')) <> 'BAJA')
        order by
          coalesce(priority_final_rank, 999999),
          id_equipo
        limit :limit
        """
        with engine.connect() as c:
            rows = c.execute(text(sql), {"limit": limit}).mappings().all()
        return {"count": len(rows), "items": [dict(x) for x in rows]}
    except Exception as e:
        return {"error": str(e)}

@router.get("/home-resumen-v3")
def get_home_resumen_v3():
    try:
        cols_sql = """
        select column_name
        from information_schema.columns
        where table_schema = 'analytics'
          and table_name = 'mart_equipos_estado_actual'
        """
        with engine.connect() as c:
            cols = {r[0] for r in c.execute(text(cols_sql)).fetchall()}

        sin_asig_expr = "flag_sin_asignacion" if "flag_sin_asignacion" in cols else "false"
        active_expr = _active_operational_predicate(lambda name: name in cols)
        ml_risk_expr = "upper(coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'SIN SCORE'))"

        sql = f"""
        with base as (
          select *
          from analytics.mart_equipos_estado_actual
        )
        select
          count(*) filter (where {active_expr}) as activos_totales,

          count(*) filter (
            where {active_expr}
              and (
                upper(coalesce(estado_operativo, '')) like '%ASIGN%'
                or upper(coalesce(estado_equipo, '')) like '%ASIGN%'
              )
          ) as asignados,

          count(*) filter (
            where {active_expr}
              and (
                upper(coalesce(estado_operativo, '')) like '%DISPON%'
                or upper(coalesce(estado_equipo, '')) like '%DISPON%'
                or upper(coalesce(estado_operativo, '')) like '%STAND%'
              )
          ) as disponibles,

          count(*) filter (where not {active_expr}) as bajas,

          count(*) filter (
            where {active_expr}
              and coalesce({sin_asig_expr}, false) = true
          ) as sin_asignacion,

          count(*) filter (where {active_expr} and {ml_risk_expr} = 'ALTO') as riesgo_alto,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'MEDIO') as riesgo_medio,
          count(*) filter (where {active_expr} and {ml_risk_expr} = 'BAJO') as riesgo_bajo,

          count(*) filter (
            where {active_expr}
              and upper(coalesce(localizacion, '')) = 'CHILE'
          ) as geo_chile,

          count(*) filter (
            where {active_expr}
              and upper(coalesce(localizacion, '')) <> 'CHILE'
              and coalesce(nullif(trim(localizacion), ''), '') <> ''
          ) as geo_extranjero
        from base
        """

        with engine.connect() as c:
            row = c.execute(text(sql)).mappings().first()

        return dict(row) if row else {}

    except Exception as e:
        return {"error": str(e)}

# DEBUG TEMP
print("🔥 entrando a home-activos")
