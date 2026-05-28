{{ config(materialized='table', tags=['marts','mtr','rotacion']) }}

with base as (
    select *
    from {{ ref('int_mtr_eventos_dedup') }}
),

agg as (
    select
        id_equipo,

        count(*) as eventos_totales,
        count(*) filter (where tipo_evento = 'INGRESO') as ingresos_totales,
        count(*) filter (where tipo_evento = 'SALIDA') as salidas_totales,

        count(*) filter (
            where fecha_evento >= current_date - interval '12 months'
        ) as eventos_12m,

        count(*) filter (
            where tipo_evento = 'SALIDA'
              and fecha_evento >= current_date - interval '12 months'
        ) as salidas_12m,

        count(distinct persona) filter (
            where coalesce(nullif(trim(persona), ''), '') <> ''
        ) as personas_distintas_total,

        count(distinct persona) filter (
            where coalesce(nullif(trim(persona), ''), '') <> ''
              and fecha_evento >= current_date - interval '12 months'
        ) as personas_distintas_12m,

        min(fecha_evento)::date as primera_fecha_evento,
        max(fecha_evento)::date as ultima_fecha_evento,
        (current_date - max(fecha_evento)::date) as dias_desde_ultimo_evento
    from base
    group by id_equipo
)

select
    id_equipo,
    eventos_totales,
    ingresos_totales,
    salidas_totales,
    eventos_12m,
    salidas_12m,
    personas_distintas_total,
    personas_distintas_12m,
    primera_fecha_evento,
    ultima_fecha_evento,
    dias_desde_ultimo_evento,
    (coalesce(salidas_12m, 0) + coalesce(personas_distintas_12m, 0)) as indice_rotacion,
    case
        when (coalesce(salidas_12m, 0) + coalesce(personas_distintas_12m, 0)) >= 6 then 'ALTA'
        when (coalesce(salidas_12m, 0) + coalesce(personas_distintas_12m, 0)) >= 3 then 'MEDIA'
        else 'BAJA'
    end as bucket_rotacion
from agg
