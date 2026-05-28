from __future__ import annotations

from typing import Any, Dict

from sqlalchemy import text

try:
    from backend.db import engine  # type: ignore
except Exception:
    from db.engine import engine  # type: ignore


ALERT_SELECT = """
select
  alert_id,
  id_equipo,
  tipo_alerta,
  titulo,
  descripcion,
  criticidad,
  origen,
  fuente_principal,
  evidencia,
  accion_sugerida,
  fecha_detectada,
  dias_abierta,
  estado_alerta,
  confianza_dato
from analytics.mart_operacion_alertas
where 1 = 1
"""


def _severity_order_sql(column: str = "criticidad") -> str:
    return f"""
    case upper(coalesce({column}, ''))
      when 'CRITICA' then 5
      when 'ALTA' then 4
      when 'MEDIA' then 3
      when 'BAJA' then 2
      when 'INFO' then 1
      else 0
    end
    """


def _build_alert_filters(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    criticidad: str | None = None,
    origen: str | None = None,
    tipo_alerta: str | None = None,
    estado_alerta: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
) -> tuple[str, dict[str, Any]]:
    sql = ALERT_SELECT
    params: dict[str, Any] = {}

    if id_equipo:
        sql += " and upper(id_equipo) = upper(:id_equipo)"
        params["id_equipo"] = id_equipo
    if q:
        sql += " and upper(id_equipo) like upper(:q)"
        params["q"] = f"%{q.strip()}%"
    if criticidad:
        sql += " and upper(criticidad) = upper(:criticidad)"
        params["criticidad"] = criticidad
    if origen:
        sql += " and upper(origen) = upper(:origen)"
        params["origen"] = origen
    if tipo_alerta:
        sql += " and upper(tipo_alerta) = upper(:tipo_alerta)"
        params["tipo_alerta"] = tipo_alerta
    if estado_alerta:
        sql += " and upper(estado_alerta) = upper(:estado_alerta)"
        params["estado_alerta"] = estado_alerta
    if desde:
        sql += " and fecha_detectada::date >= cast(:desde as date)"
        params["desde"] = desde
    if hasta:
        sql += " and fecha_detectada::date <= cast(:hasta as date)"
        params["hasta"] = hasta

    return sql, params


def _get_alert_summary_payload(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    criticidad: str | None = None,
    origen: str | None = None,
    tipo_alerta: str | None = None,
    estado_alerta: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
) -> Dict[str, Any]:
    filtered_sql, params = _build_alert_filters(
        id_equipo=id_equipo,
        q=q,
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
    )

    summary_sql = f"""
    with filtered as (
      {filtered_sql}
    ),
    equipos as (
      select distinct id_equipo
      from filtered
      where id_equipo is not null
    ),
    kpis as (
      select
        count(*) filter (where upper(coalesce(criticidad, '')) = 'CRITICA')::int as alertas_criticas,
        count(*) filter (where upper(coalesce(criticidad, '')) = 'ALTA')::int as alertas_altas,
        count(*) filter (where upper(coalesce(estado_alerta, '')) = 'ABIERTA')::int as total_alertas_abiertas,
        count(distinct id_equipo)::int as equipos_afectados,
        round(avg(dias_abierta)::numeric, 2) as aging_promedio_dias,
        max(fecha_detectada) as ultima_alerta_detectada
      from filtered
    ),
    confianza as (
      select
        round(avg(c.confianza_score)::numeric, 2) as confianza_score_promedio,
        case
          when avg(c.confianza_score) >= 85 then 'ALTA'
          when avg(c.confianza_score) >= 60 then 'MEDIA'
          when avg(c.confianza_score) >= 30 then 'BAJA'
          else 'CRITICA'
        end as confianza_dato_general
      from analytics.mart_confianza_dato c
      join equipos e using (id_equipo)
    ),
    sla as (
      select
        round(avg(s.jira_days_open_max)::numeric, 2) filter (where coalesce(s.jira_days_open_max, 0) > 0) as sla_promedio_dias,
        round(avg(s.aging_operativo_dias)::numeric, 2) as aging_operativo_promedio_dias
      from analytics.mart_operacion_sla s
      join equipos e using (id_equipo)
    ),
    origen_counts as (
      select origen, count(*)::int as total
      from filtered
      group by 1
      order by total desc, origen asc
    ),
    tipo_counts as (
      select tipo_alerta, count(*)::int as total
      from filtered
      group by 1
      order by total desc, tipo_alerta asc
    ),
    criticidad_counts as (
      select criticidad, count(*)::int as total
      from filtered
      group by 1
      order by {_severity_order_sql('criticidad')} desc, criticidad asc
    ),
    available_filters as (
      select json_build_object(
        'criticidades', coalesce((select json_agg(criticidad order by {_severity_order_sql('criticidad')} desc, criticidad asc) from (select distinct criticidad from filtered where criticidad is not null) x), '[]'::json),
        'origenes', coalesce((select json_agg(origen order by origen asc) from (select distinct origen from filtered where origen is not null) x), '[]'::json),
        'tipos_alerta', coalesce((select json_agg(tipo_alerta order by tipo_alerta asc) from (select distinct tipo_alerta from filtered where tipo_alerta is not null) x), '[]'::json),
        'estados_alerta', coalesce((select json_agg(estado_alerta order by estado_alerta asc) from (select distinct estado_alerta from filtered where estado_alerta is not null) x), '[]'::json)
      ) as payload
    )
    select json_build_object(
      'kpis', json_build_object(
        'alertas_criticas', coalesce((select alertas_criticas from kpis), 0),
        'alertas_altas', coalesce((select alertas_altas from kpis), 0),
        'total_alertas_abiertas', coalesce((select total_alertas_abiertas from kpis), 0),
        'equipos_afectados', coalesce((select equipos_afectados from kpis), 0),
        'confianza_score_promedio', (select confianza_score_promedio from confianza),
        'confianza_dato_general', (select confianza_dato_general from confianza),
        'sla_promedio_dias', (select sla_promedio_dias from sla),
        'aging_promedio_dias', coalesce((select aging_promedio_dias from kpis), (select aging_operativo_promedio_dias from sla)),
        'aging_operativo_promedio_dias', (select aging_operativo_promedio_dias from sla),
        'ultima_alerta_detectada', (select ultima_alerta_detectada from kpis)
      ),
      'alertas_por_origen', coalesce((select json_agg(json_build_object('origen', origen, 'total', total) order by total desc, origen asc) from origen_counts), '[]'::json),
      'alertas_por_tipo', coalesce((select json_agg(json_build_object('tipo_alerta', tipo_alerta, 'total', total) order by total desc, tipo_alerta asc) from tipo_counts), '[]'::json),
      'alertas_por_criticidad', coalesce((select json_agg(json_build_object('criticidad', criticidad, 'total', total) order by total desc, criticidad asc) from criticidad_counts), '[]'::json),
      'available_filters', (select payload from available_filters),
      'copy_ejecutivo', 'Las alertas no son errores del sistema; son brechas operativas detectadas entre fuentes.'
    ) as payload
    """

    with engine.connect() as conn:
        payload = conn.execute(text(summary_sql), params).scalar_one()

    if isinstance(payload, dict):
        return payload
    return dict(payload or {})


def get_operacion_resumen(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    criticidad: str | None = None,
    origen: str | None = None,
    tipo_alerta: str | None = None,
    estado_alerta: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
) -> Dict[str, Any]:
    filters = {
        "id_equipo": id_equipo,
        "q": q,
        "criticidad": criticidad,
        "origen": origen,
        "tipo_alerta": tipo_alerta,
        "estado_alerta": estado_alerta,
        "desde": desde,
        "hasta": hasta,
    }
    try:
        payload = _get_alert_summary_payload(**filters)
        return {"filters": filters, **payload}
    except Exception as exc:
        return {
            "filters": filters,
            "kpis": {},
            "alertas_por_origen": [],
            "alertas_por_tipo": [],
            "alertas_por_criticidad": [],
            "available_filters": {},
            "copy_ejecutivo": "Las alertas no son errores del sistema; son brechas operativas detectadas entre fuentes.",
            "error": f"{type(exc).__name__}: {exc}",
        }


def get_operacion_alertas(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    criticidad: str | None = None,
    origen: str | None = None,
    tipo_alerta: str | None = None,
    estado_alerta: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    limit: int = 250,
) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 1000))
    sql, params = _build_alert_filters(
        id_equipo=id_equipo,
        q=q,
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
    )
    sql += f"""
    order by {_severity_order_sql()} desc, dias_abierta desc, fecha_detectada desc, id_equipo asc
    limit :limit
    """
    params["limit"] = limit

    result: Dict[str, Any] = {
        "filters": {
            "id_equipo": id_equipo,
            "q": q,
            "criticidad": criticidad,
            "origen": origen,
            "tipo_alerta": tipo_alerta,
            "estado_alerta": estado_alerta,
            "desde": desde,
            "hasta": hasta,
        },
        "limit": limit,
        "count": 0,
        "rows": [],
    }

    try:
        with engine.connect() as conn:
            rows = conn.execute(text(sql), params).mappings().all()
        payload = [dict(row) for row in rows or []]
        result["rows"] = payload
        result["count"] = len(payload)
        result["available_filters"] = _get_alert_summary_payload(
            id_equipo=id_equipo,
            q=q,
            criticidad=criticidad,
            origen=origen,
            tipo_alerta=tipo_alerta,
            estado_alerta=estado_alerta,
            desde=desde,
            hasta=hasta,
        ).get("available_filters", {})
        return result
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result


def get_operacion_sla(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    criticidad: str | None = None,
    origen: str | None = None,
    tipo_alerta: str | None = None,
    estado_alerta: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    limit: int = 250,
) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 1000))
    restrict_to_alert_scope = any([criticidad, origen, tipo_alerta, estado_alerta, desde, hasta])
    filtered_sql, params = _build_alert_filters(
        id_equipo=id_equipo,
        q=q,
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
    )

    sql = f"""
    with filtered_alerts as (
      {filtered_sql}
    ),
    eligible as (
      select distinct id_equipo
      from filtered_alerts
      where id_equipo is not null
    )
    select
      s.id_equipo,
      s.jira_issue_key,
      s.jira_status_name,
      s.jira_board_bucket,
      s.jira_open_count,
      s.jira_days_open_max,
      s.sla_objetivo_dias,
      s.sla_estado,
      s.backlog_operativo,
      s.fecha_ultimo_movimiento,
      s.dias_desde_ultimo_movimiento,
      s.fecha_ultima_actividad_jira,
      s.aging_operativo_dias,
      s.aging_bucket,
      c.confianza_dato,
      c.confianza_score
    from analytics.mart_operacion_sla s
    left join analytics.mart_confianza_dato c
      on c.id_equipo = s.id_equipo
    where (
      :restrict_to_alert_scope = false
      or s.id_equipo in (select id_equipo from eligible)
    )
    """
    params["restrict_to_alert_scope"] = restrict_to_alert_scope

    if id_equipo:
        sql += " and upper(s.id_equipo) = upper(:sla_id_equipo)"
        params["sla_id_equipo"] = id_equipo
    if q:
        sql += " and upper(s.id_equipo) like upper(:sla_q)"
        params["sla_q"] = f"%{q.strip()}%"

    sql += """
    order by
      case upper(coalesce(s.sla_estado, ''))
        when 'VENCIDO' then 4
        when 'OBSERVACION' then 3
        when 'EN_PLAZO' then 2
        else 1
      end desc,
      s.aging_operativo_dias desc,
      s.id_equipo asc
    limit :limit
    """
    params["limit"] = limit

    result: Dict[str, Any] = {
        "filters": {
            "id_equipo": id_equipo,
            "q": q,
            "criticidad": criticidad,
            "origen": origen,
            "tipo_alerta": tipo_alerta,
            "estado_alerta": estado_alerta,
            "desde": desde,
            "hasta": hasta,
        },
        "limit": limit,
        "count": 0,
        "rows": [],
        "aggregates": {},
    }

    try:
        with engine.connect() as conn:
            rows = conn.execute(text(sql), params).mappings().all()
        payload = [dict(row) for row in rows or []]
        result["rows"] = payload
        result["count"] = len(payload)

        if payload:
            jira_days = [float(row["jira_days_open_max"]) for row in payload if row.get("jira_days_open_max") is not None]
            aging_days = [float(row["aging_operativo_dias"]) for row in payload if row.get("aging_operativo_dias") is not None]
            result["aggregates"] = {
                "sla_promedio_dias": round(sum(jira_days) / len(jira_days), 2) if jira_days else None,
                "aging_promedio_dias": round(sum(aging_days) / len(aging_days), 2) if aging_days else None,
                "equipos_en_backlog": sum(1 for row in payload if row.get("backlog_operativo")),
            }
        return result
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result


def get_operacion_confianza(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    criticidad: str | None = None,
    origen: str | None = None,
    tipo_alerta: str | None = None,
    estado_alerta: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    limit: int = 250,
) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 1000))
    restrict_to_alert_scope = any([criticidad, origen, tipo_alerta, estado_alerta, desde, hasta])
    filtered_sql, params = _build_alert_filters(
        id_equipo=id_equipo,
        q=q,
        criticidad=criticidad,
        origen=origen,
        tipo_alerta=tipo_alerta,
        estado_alerta=estado_alerta,
        desde=desde,
        hasta=hasta,
    )

    sql = f"""
    with filtered_alerts as (
      {filtered_sql}
    ),
    eligible as (
      select distinct id_equipo
      from filtered_alerts
      where id_equipo is not null
    ),
    filtered_confianza as (
      select
        c.id_equipo,
        c.conciliacion_estado,
        c.origen_principal,
        c.fuentes_validas,
        c.confianza_dato,
        c.confianza_score,
        c.detalle_confianza,
        c.cambios_auditados_30d,
        c.ultimo_cambio_auditado,
        c.created_at
      from analytics.mart_confianza_dato c
      where (
        :restrict_to_alert_scope = false
        or c.id_equipo in (select id_equipo from eligible)
      )
    """
    params["restrict_to_alert_scope"] = restrict_to_alert_scope

    if id_equipo:
        sql += " and upper(c.id_equipo) = upper(:conf_id_equipo)"
        params["conf_id_equipo"] = id_equipo
    if q:
        sql += " and upper(c.id_equipo) like upper(:conf_q)"
        params["conf_q"] = f"%{q.strip()}%"

    sql += f"""
    ),
    distribution as (
      select
        confianza_dato,
        count(*)::int as equipos
      from filtered_confianza
      group by 1
      order by {_severity_order_sql('confianza_dato')} desc, confianza_dato asc
    )
    select json_build_object(
      'rows', coalesce((select json_agg(row_to_json(fc) order by fc.confianza_score asc, fc.id_equipo asc) from (select * from filtered_confianza order by confianza_score asc, id_equipo asc limit :limit) fc), '[]'::json),
      'distribution', coalesce((select json_agg(json_build_object('confianza_dato', confianza_dato, 'equipos', equipos) order by equipos desc, confianza_dato asc) from distribution), '[]'::json),
      'count', coalesce((select count(*) from filtered_confianza), 0),
      'promedio', (select round(avg(confianza_score)::numeric, 2) from filtered_confianza)
    ) as payload
    """
    params["limit"] = limit

    result: Dict[str, Any] = {
        "filters": {
            "id_equipo": id_equipo,
            "q": q,
            "criticidad": criticidad,
            "origen": origen,
            "tipo_alerta": tipo_alerta,
            "estado_alerta": estado_alerta,
            "desde": desde,
            "hasta": hasta,
        }
    }

    try:
        with engine.connect() as conn:
            payload = conn.execute(text(sql), params).scalar_one()
        if isinstance(payload, dict):
            result.update(payload)
        else:
            result.update(dict(payload or {}))
        return result
    except Exception as exc:
        result.update({"rows": [], "distribution": [], "count": 0, "promedio": None, "error": f"{type(exc).__name__}: {exc}"})
        return result
