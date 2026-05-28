{{ config(materialized='view', tags=['compras','capex','marts']) }}

{% set base_rel = ref('mart_ranking_global') %}
{% set equipos_rel = ref('mart_equipos_estado_actual') %}

{# --- backlog_compras: detectar columnas opcionales sin romper SQL --- #}
{% set _bcols = adapter.get_columns_in_relation(base_rel) %}
{% set _bnames = _bcols | map(attribute='name') | list %}
{% set _blower = _bnames | map('lower') | list %}

{% if 'modelo_sugerido' in _blower %}
  {% set modelo_expr_rank = 'r.modelo_sugerido::text' %}
{% else %}
  {% set modelo_expr_rank = 'null::text' %}
{% endif %}

{% set _ecols = adapter.get_columns_in_relation(equipos_rel) %}
{% set _enames = _ecols | map(attribute='name') | list %}
{% set _elower = _enames | map('lower') | list %}

{# prioridad de campos "modelo" dentro de mart_equipos_estado_actual #}
{% if 'modelo' in _elower %}
  {% set modelo_expr_eq = 'e.modelo::text' %}
{% elif 'modelo_equipo' in _elower %}
  {% set modelo_expr_eq = 'e.modelo_equipo::text' %}
{% elif 'detalle' in _elower %}
  {% set modelo_expr_eq = 'e.detalle::text' %}
{% elif 'descripcion' in _elower %}
  {% set modelo_expr_eq = 'e.descripcion::text' %}
{% else %}
  {% set modelo_expr_eq = 'null::text' %}
{% endif %}
{# ------------------------------------------------------------------ #}


{# --- backlog_compras: detectar columna opcional modelo_sugerido sin romper SQL --- #}
{% set _cols = adapter.get_columns_in_relation(base_rel) %}
{% set _names = _cols | map(attribute='name') | list %}
{% set _lower = _names | map('lower') | list %}
{% if 'modelo_sugerido' in _lower %}
  {% set modelo_expr = 'base.modelo_sugerido::text' %}
{% else %}
  {% set modelo_expr = 'null::text' %}
{% endif %}
{# ------------------------------------------------------------------------------ #}


with base as (
  select
    r.*,
    {{ modelo_expr_eq }} as _modelo_raw
  from {{ base_rel }} r
  left join {{ equipos_rel }} e
    on e.id_equipo::text = r.equipo_id::text
),


norm as (
  select
    base.equipo_id::text as equipo_id,

    -- Segmento para agrupar (core/dev/staffing/etc)
    base.segmento_destino::text as segmento_destino,

    -- Mes sugerido para compra (bucket mensual)
    
date_trunc('month', greatest(coalesce(base.fecha_vencimiento_renovacion::date, current_date), current_date))::date as mes_sugerido,

    -- Modelo sugerido:
    -- 1) si viene un campo "modelo_sugerido" en tu mart_ranking_global (futuro), úsalo
    -- 2) si no, usar generacion_categoria como proxy
    coalesce(
      nullif(trim({{ modelo_expr }}), ''),
      nullif(trim(base.generacion_categoria::text), ''),
      'unknown'
    )::text as modelo_sugerido,

    base.tipo_colaborador::text as tipo_colaborador,
    base.alertas_severidad::text as alertas_severidad,
    base.flag_renovar::boolean as flag_renovar,

    base.priority_final_rank::int as priority_final_rank

  from base
),

filtrado as (
  select *
  from norm
  where
    flag_renovar = true
    and alertas_severidad in ('CRITICAL','WARNING')
    and tipo_colaborador = 'core'
),

costo_match as (
  select
    f.*,

    -- Match por patrones del seed (gana el priority más bajo)
    (
      select d.costo_unitario_usd::numeric
      from {{ ref('dim_costos_modelo_estimados') }} d
      where lower(f.modelo_sugerido) like lower(d.pattern_like)
      order by d.priority asc
      limit 1
    ) as costo_unitario_usd

  from filtrado f
)

select
  mes_sugerido,
  segmento_destino,
  modelo_sugerido,

  count(*)::int as cantidad_equipos,
  coalesce(max(costo_unitario_usd), 1500)::numeric as costo_unitario_usd,
  (count(*)::numeric * coalesce(max(costo_unitario_usd), 1500))::numeric as costo_total_usd,

  min(priority_final_rank)::int as prioridad_mejor_rank,

  array_agg(equipo_id order by priority_final_rank asc, equipo_id asc) as equipo_ids

from costo_match
group by 1,2,3
order by mes_sugerido asc, segmento_destino asc, costo_total_usd desc
