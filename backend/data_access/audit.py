from __future__ import annotations

from typing import Any, Dict

from sqlalchemy import text

try:
    from backend.db import engine  # type: ignore
except Exception:
    from db.engine import engine  # type: ignore


SYSTEM_ACTORS = (
    "MTR",
    "Jira",
    "Google Sheets Sync",
    "Excel Reparados",
    "dbt",
    "Catastro System",
)

AUDIT_SELECT = """
select
  audit_id,
  id_equipo,
  campo_modificado,
  valor_anterior,
  valor_nuevo,
  fecha_cambio,
  origen,
  source_table,
  source_run_id,
  actor,
  tipo_cambio,
  criticidad,
  confianza,
  created_at
from analytics.mart_equipo_audit_log
where 1 = 1
"""


def _normalized_criticidad(criticidad: str | None = None, severidad: str | None = None) -> str | None:
    value = (criticidad or severidad or "").strip()
    return value or None


def _build_filters(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    origen: str | None = None,
    tipo_cambio: str | None = None,
    campo_modificado: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    criticidad: str | None = None,
    severidad: str | None = None,
) -> tuple[str, dict[str, Any]]:
    sql = AUDIT_SELECT
    params: dict[str, Any] = {}

    if id_equipo:
        sql += " and upper(id_equipo) = upper(:id_equipo)"
        params["id_equipo"] = id_equipo
    if q:
        sql += " and upper(id_equipo) like upper(:q)"
        params["q"] = f"%{q.strip()}%"
    if origen:
        sql += " and upper(origen) = upper(:origen)"
        params["origen"] = origen
    if tipo_cambio:
        sql += " and upper(tipo_cambio) = upper(:tipo_cambio)"
        params["tipo_cambio"] = tipo_cambio
    if campo_modificado:
        sql += " and upper(campo_modificado) = upper(:campo_modificado)"
        params["campo_modificado"] = campo_modificado
    if desde:
        sql += " and fecha_cambio::date >= cast(:desde as date)"
        params["desde"] = desde
    if hasta:
        sql += " and fecha_cambio::date <= cast(:hasta as date)"
        params["hasta"] = hasta

    criticidad_value = _normalized_criticidad(criticidad, severidad)
    if criticidad_value:
        sql += " and upper(criticidad) = upper(:criticidad)"
        params["criticidad"] = criticidad_value

    return sql, params


def _get_summary_payload(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    origen: str | None = None,
    tipo_cambio: str | None = None,
    campo_modificado: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    criticidad: str | None = None,
    severidad: str | None = None,
) -> Dict[str, Any]:
    filtered_sql, params = _build_filters(
        id_equipo=id_equipo,
        q=q,
        origen=origen,
        tipo_cambio=tipo_cambio,
        campo_modificado=campo_modificado,
        desde=desde,
        hasta=hasta,
        criticidad=criticidad,
        severidad=severidad,
    )

    summary_sql = f"""
    with filtered as (
      {filtered_sql}
    ),
    totals as (
      select
        count(*)::int as total_cambios_auditados,
        count(distinct id_equipo)::int as equipos_con_cambios,
        count(*) filter (where upper(coalesce(criticidad, '')) = 'CRITICA')::int as cambios_criticos,
        count(*) filter (
          where actor is null
             or trim(actor) = ''
             or actor = any(:system_actors)
        )::int as cambios_sin_actor_humano_identificado,
        max(fecha_cambio) as ultimo_cambio_global
      from filtered
    ),
    latest_per_equipo as (
      select distinct on (id_equipo)
        id_equipo,
        fecha_cambio as ultimo_cambio_auditado,
        origen as origen_ultimo_cambio,
        campo_modificado as campo_ultimo_cambio,
        tipo_cambio as tipo_ultimo_cambio
      from filtered
      order by id_equipo, fecha_cambio desc, audit_id desc
    ),
    last_30 as (
      select
        id_equipo,
        count(*)::int as cambios_30d
      from filtered
      where fecha_cambio >= (current_timestamp - interval '30 days')
      group by 1
    ),
    team_field_counts as (
      select
        id_equipo,
        campo_modificado,
        count(*)::int as cambios
      from filtered
      group by 1, 2
    ),
    team_field_ranked as (
      select
        *,
        row_number() over (
          partition by id_equipo
          order by cambios desc, campo_modificado asc
        ) as rn
      from team_field_counts
    ),
    team_field_top as (
      select
        id_equipo,
        json_agg(
          json_build_object(
            'campo_modificado', campo_modificado,
            'cambios', cambios
          )
          order by cambios desc, campo_modificado asc
        ) as campos_mas_modificados
      from team_field_ranked
      where rn <= 3
      group by 1
    ),
    team_rollup as (
      select
        f.id_equipo,
        count(*)::int as cambios_totales,
        count(*) filter (where upper(coalesce(f.criticidad, '')) = 'CRITICA')::int as cambios_criticos,
        count(*) filter (
          where f.actor is null
             or trim(f.actor) = ''
             or f.actor = any(:system_actors)
        )::int as cambios_sin_actor_humano_identificado
      from filtered f
      group by 1
    ),
    equipos as (
      select
        l.id_equipo,
        l.ultimo_cambio_auditado,
        l.origen_ultimo_cambio,
        l.campo_ultimo_cambio,
        l.tipo_ultimo_cambio,
        coalesce(x.cambios_30d, 0) as cambios_30d,
        coalesce(r.cambios_totales, 0) as cambios_totales,
        coalesce(r.cambios_criticos, 0) as cambios_criticos,
        coalesce(r.cambios_sin_actor_humano_identificado, 0) as cambios_sin_actor_humano_identificado,
        coalesce(t.campos_mas_modificados, '[]'::json) as campos_mas_modificados
      from latest_per_equipo l
      left join last_30 x on x.id_equipo = l.id_equipo
      left join team_rollup r on r.id_equipo = l.id_equipo
      left join team_field_top t on t.id_equipo = l.id_equipo
      order by l.ultimo_cambio_auditado desc, l.id_equipo asc
    ),
    origin_counts as (
      select
        origen,
        count(*)::int as cambios
      from filtered
      group by 1
      order by cambios desc, origen asc
    ),
    available_filters as (
      select json_build_object(
        'origenes', coalesce((select json_agg(origen order by origen asc) from (select distinct origen from filtered where origen is not null) x), '[]'::json),
        'tipos_cambio', coalesce((select json_agg(tipo_cambio order by tipo_cambio asc) from (select distinct tipo_cambio from filtered where tipo_cambio is not null) x), '[]'::json),
        'campos_modificados', coalesce((select json_agg(campo_modificado order by campo_modificado asc) from (select distinct campo_modificado from filtered where campo_modificado is not null) x), '[]'::json),
        'criticidades', coalesce((select json_agg(criticidad order by criticidad asc) from (select distinct criticidad from filtered where criticidad is not null) x), '[]'::json)
      ) as payload
    )
    select json_build_object(
      'kpis', json_build_object(
        'total_cambios_auditados', coalesce((select total_cambios_auditados from totals), 0),
        'equipos_con_cambios', coalesce((select equipos_con_cambios from totals), 0),
        'cambios_criticos', coalesce((select cambios_criticos from totals), 0),
        'cambios_sin_actor_humano_identificado', coalesce((select cambios_sin_actor_humano_identificado from totals), 0),
        'ultimo_cambio_global', (select ultimo_cambio_global from totals)
      ),
      'cambios_por_origen', coalesce((select json_agg(json_build_object('origen', origen, 'cambios', cambios) order by cambios desc, origen asc) from origin_counts), '[]'::json),
      'equipos', coalesce((select json_agg(row_to_json(e)) from equipos e), '[]'::json),
      'equipo_summary', (select row_to_json(e) from equipos e where upper(e.id_equipo) = upper(:equipo_summary_id) limit 1),
      'available_filters', (select payload from available_filters)
    ) as payload
    """

    summary_params = dict(params)
    summary_params["system_actors"] = list(SYSTEM_ACTORS)
    summary_params["equipo_summary_id"] = id_equipo or q or ""

    with engine.connect() as conn:
        payload = conn.execute(text(summary_sql), summary_params).scalar_one()

    if isinstance(payload, dict):
        return payload
    return dict(payload or {})


def get_audit_summary(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    origen: str | None = None,
    tipo_cambio: str | None = None,
    campo_modificado: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    criticidad: str | None = None,
    severidad: str | None = None,
) -> Dict[str, Any]:
    try:
        payload = _get_summary_payload(
            id_equipo=id_equipo,
            q=q,
            origen=origen,
            tipo_cambio=tipo_cambio,
            campo_modificado=campo_modificado,
            desde=desde,
            hasta=hasta,
            criticidad=criticidad,
            severidad=severidad,
        )
        return {
            "filters": {
                "id_equipo": id_equipo,
                "q": q,
                "origen": origen,
                "tipo_cambio": tipo_cambio,
                "campo_modificado": campo_modificado,
                "desde": desde,
                "hasta": hasta,
                "criticidad": _normalized_criticidad(criticidad, severidad),
            },
            **payload,
        }
    except Exception as exc:
        return {
            "filters": {
                "id_equipo": id_equipo,
                "q": q,
                "origen": origen,
                "tipo_cambio": tipo_cambio,
                "campo_modificado": campo_modificado,
                "desde": desde,
                "hasta": hasta,
                "criticidad": _normalized_criticidad(criticidad, severidad),
            },
            "kpis": {},
            "cambios_por_origen": [],
            "equipos": [],
            "equipo_summary": None,
            "available_filters": {},
            "error": f"{type(exc).__name__}: {exc}",
        }


def get_audit_log(
    *,
    id_equipo: str | None = None,
    q: str | None = None,
    origen: str | None = None,
    tipo_cambio: str | None = None,
    campo_modificado: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    criticidad: str | None = None,
    severidad: str | None = None,
    limit: int = 200,
) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 1000))
    sql, params = _build_filters(
        id_equipo=id_equipo,
        q=q,
        origen=origen,
        tipo_cambio=tipo_cambio,
        campo_modificado=campo_modificado,
        desde=desde,
        hasta=hasta,
        criticidad=criticidad,
        severidad=severidad,
    )
    sql += """
    order by fecha_cambio desc, id_equipo asc, audit_id asc
    limit :limit
    """
    params["limit"] = limit

    result: Dict[str, Any] = {
        "id_equipo": id_equipo,
        "q": q,
        "filters": {
            "origen": origen,
            "tipo_cambio": tipo_cambio,
            "campo_modificado": campo_modificado,
            "desde": desde,
            "hasta": hasta,
            "criticidad": _normalized_criticidad(criticidad, severidad),
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

        summary = _get_summary_payload(
            id_equipo=id_equipo,
            q=q,
            origen=origen,
            tipo_cambio=tipo_cambio,
            campo_modificado=campo_modificado,
            desde=desde,
            hasta=hasta,
            criticidad=criticidad,
            severidad=severidad,
        )
        result["available_filters"] = summary.get("available_filters", {})
        result["kpis"] = summary.get("kpis", {})
        if id_equipo:
            result["summary"] = summary.get("equipo_summary")
        return result
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result
