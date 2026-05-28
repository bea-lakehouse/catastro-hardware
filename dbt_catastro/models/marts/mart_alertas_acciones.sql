{{ config(materialized='view', tags=['alertas','acciones','mart']) }}

{% set has_estado = relation_exists('analytics', 'mart_equipos_estado_actual') %}

{% if has_estado %}

with base as (
  select
    id_equipo,
    upper(nullif(btrim(alertas_severidad), '')) as sev,
    alertas_codigos
  from analytics.mart_equipos_estado_actual
),
norm as (
  select
    id_equipo,
    case
      when sev = 'CRITICAL' then 'Alta'
      when sev = 'WARNING'  then 'Media'
      when sev = 'INFO'     then 'Baja'
      else 'Media'
    end as prioridad,
    alertas_codigos
  from base
),
exploded as (
  select
    n.prioridad,
    upper(nullif(btrim(codigo), '')) as tipo_accion
  from norm n
  cross join lateral unnest(n.alertas_codigos) as codigo
)
select
  tipo_accion,
  prioridad
from exploded
where nullif(btrim(tipo_accion), '') is not null

{% else %}

select 'SIN_DATA'::text as tipo_accion, 'Media'::text as prioridad
where 1=0

{% endif %}
