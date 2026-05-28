with pol as (
  select
    equipo_id,
    coalesce(nullif(segmento_destino,''), 'unknown')     as segmento_destino,
    coalesce(nullif(generacion_categoria,''), 'unknown') as generacion_categoria
  from {{ ref('int_politica_equipos') }}
),
b as (
  select * from {{ ref('int_presion_base') }}
),
agg as (
  select
    p.segmento_destino,
    p.generacion_categoria,

    sum(
      (case when b.flag_renovar then 3 else 0 end)
    + (case when b.flag_sin_asignacion then 2 else 0 end)
    + (case when b.flag_rotacion_alta then 1 else 0 end)
    + (case when b.jira_open_count > 0 then least(5, b.jira_open_count::int) else 0 end)
    )::numeric as presion_stock

  from pol p
  left join b on b.id_equipo = p.equipo_id
  group by 1,2
)
select
  segmento_destino,
  generacion_categoria,
  presion_stock,
  case
    when presion_stock >= 40 then 'alta'
    when presion_stock >= 10 then 'media'
    else 'baja'
  end as presion_nivel
from agg
