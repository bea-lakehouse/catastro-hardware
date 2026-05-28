{{ config(materialized='view') }}

{#
  ML v2 opcional en dev/local.
  Fuente esperada: ml.vw_scores_v2_latest (schema ml).
  Si no existe, devolvemos 0 filas con las columnas que consume mart_equipos_estado_actual:
    entity_id, score, risk_level, alert_code, total, created_at, link_path
#}

{% set rel = adapter.get_relation(
    database=target.database,
    schema='ml',
    identifier='vw_scores_v2_latest'
) %}

with base as (

  {% if rel is not none %}

    select *
         , true::boolean as ml_source_available
         , 'ml.vw_scores_v2_latest'::text as ml_source_name
    from {{ rel }}

  {% else %}

    select
      null::text      as entity_id,
      null::float8    as score,
      null::text      as risk_level,
      null::text      as alert_code,
      null::float8    as total,
      null::timestamp as created_at,
      null::text      as link_path,
      false::boolean  as ml_source_available,
      'ml.vw_scores_v2_latest_missing'::text as ml_source_name
    where false

  {% endif %}

)

select * from base
