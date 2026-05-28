with
equipos as (
  select
    ea.id_equipo,
    ea.estado_equipo,
    ea.fecha_compra
  from {{ ref('stg_mtr_equipos_asignados') }} ea
),

last_event as (
  select
    id_equipo,
    fecha_evento as last_event_date
  from (
    select
      e.*,
      row_number() over (partition by id_equipo order by fecha_evento desc, tipo_evento) as rn
    from {{ ref('mart_historia_eventos') }} e
  ) x
  where rn = 1
),

metrics_12m as (
  select
    id_equipo,
    count(*) filter (where fecha_evento >= (current_date - interval '12 months')) as movimientos_12m
  from {{ ref('mart_historia_eventos') }}
  group by 1
),

jira as (
  select
    equipo_id as id_equipo,
    coalesce(jira_open_count,0) as jira_open_count
  from {{ ref('int_equipo_jira_rollup') }}
)

select
  e.id_equipo,

  -- flags (copiadas del mart, pero acá en base intermedia)
  case
    when e.fecha_compra is null then false
    else (
      (e.fecha_compra + ({{ var('vida_util_meses') }} || ' months')::interval)::date
      <= (current_date + ({{ var('ventana_renovar_dias') }} || ' days')::interval)::date
    )
  end as flag_renovar,

  case
    when upper(coalesce(e.estado_equipo,'')) = 'ASIGNADO' then false
    when le.last_event_date is null then false
    else (current_date - le.last_event_date) > {{ var('sin_asignacion_dias') }}
  end as flag_sin_asignacion,

  case
    when coalesce(m.movimientos_12m, 0) >= {{ var('rotacion_alta_12m') }} then true
    else false
  end as flag_rotacion_alta,

  coalesce(j.jira_open_count,0) as jira_open_count

from equipos e
left join last_event  le on le.id_equipo = e.id_equipo
left join metrics_12m m  on m.id_equipo  = e.id_equipo
left join jira        j  on j.id_equipo  = e.id_equipo
