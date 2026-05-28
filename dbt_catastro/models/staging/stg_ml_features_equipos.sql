{{ config(materialized='view') }}

select
  id_equipo,

  count(*) as movimientos_totales,

  count(*) filter (
    where fecha_evento >= current_date - interval '12 months'
  ) as movimientos_12m,

  (max(fecha_evento) - min(fecha_evento))::int
    as dias_rango_hist,

  count(distinct persona) as personas_distintas,

  count(distinct origen) as origenes_distintos

from {{ ref('stg_historia_hw') }}
group by id_equipo
