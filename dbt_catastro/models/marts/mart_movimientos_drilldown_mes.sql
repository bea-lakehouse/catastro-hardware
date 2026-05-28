{{ config(materialized='view', tags=['estadisticas','movimientos','mart']) }}

with mov as (
  select
    date_trunc('month', fecha_movimiento)::date as mes,
    m.id_equipo::text as id_equipo,
      m.plataforma::text as plataforma
      from analytics.fct_movimientos_detalle m
  where fecha_movimiento is not null
      and fecha_movimiento >= date '2024-01-01'
      and fecha_movimiento <  date '2030-01-01'
),

equipos as (
  select
    e.id_equipo::text as id_equipo,
    nullif(btrim(e.cliente::text), '') as cliente,
    nullif(btrim(e.ciudad_comuna::text), '') as ciudad_comuna,
    nullif(btrim(e.localizacion::text), '') as localizacion,
    nullif(btrim(e.last_event_persona::text), '') as persona_asignada,
    nullif(btrim(e.estado_equipo::text), '') as estado_equipo

    -- Heurística Mac/Win (cámbiala por tu columna real si ya existe)


    from analytics.mart_equipos_estado_actual e
),

base as (
  select
    m.mes,
    m.id_equipo,
    coalesce(e.cliente, 'SIN_CLIENTE') as cliente,

    -- Chile vs extranjero: si encuentras una columna país real, reemplaza esto.
    -- (Por ahora: si ciudad/localizacion menciona Chile / Santiago / etc. lo tomo como Chile)
    case
      when lower(coalesce(e.localizacion,'')) like '%chile%' then 'Chile'
      when lower(coalesce(e.ciudad_comuna,'')) like '%chile%' then 'Chile'
      else 'Extranjero'
    end as origen,

    case
        when lower(coalesce(m.plataforma::text,'')) like '%mac%' then 'Mac'
        when lower(coalesce(m.plataforma::text,'')) like '%apple%' then 'Mac'
        else 'Win'
      end as os_familia,

    case
      when e.persona_asignada is not null then 'Asignado'
      else 'No asignado'
    end as asignacion_estado
  from mov m
  left join equipos e using (id_equipo)
),

tot_mes as (
  select
    mes,
    count(*) as movimientos_total,
    count(*) filter (where origen='Chile') as mov_chile,
    count(*) filter (where origen='Extranjero') as mov_extranjero
  from base
  group by 1
),

top_cliente_mes as (
  select *
  from (
    select
      mes, cliente,
      count(*) as mov_cliente,
      row_number() over (partition by mes order by count(*) desc, cliente asc) as rn
    from base
    group by 1,2
  ) t
  where rn = 1
),

cliente_origen as (
  select
    b.mes,
    b.cliente,
    count(*) filter (where b.origen='Chile') as cliente_chile,
    count(*) filter (where b.origen='Extranjero') as cliente_extranjero
  from base b
  group by 1,2
),

extranjero_os_asig as (
  select
    mes,
    cliente,
    os_familia,
    asignacion_estado,
    count(*) as n
  from base
  where origen='Extranjero'
  group by 1,2,3,4
),

-- “Tarjeta” final por mes: métricas + copy listo para UI
final as (
  select
    t.mes,
    t.movimientos_total,

    -- stock_activo lo sacamos del mart mensual que ya tienes (si existe ese mes)
    s.stock_activo,
    case when coalesce(s.stock_activo,0) > 0
      then round(100.0 * t.movimientos_total::numeric / s.stock_activo::numeric, 2)
      else null end as pct_movimientos_100,

    c.cliente as top_cliente,
    c.mov_cliente as top_cliente_mov,

    case when t.movimientos_total > 0
      then round(100.0 * c.mov_cliente::numeric / t.movimientos_total::numeric, 2)
      else null end as top_cliente_pct_100,

    co.cliente_chile,
    co.cliente_extranjero,

    -- JSON drilldown para UI (extranjero split por os/asignación)
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'os', x.os_familia,
        'asignacion', x.asignacion_estado,
        'n', x.n
      ) order by x.os_familia, x.asignacion_estado), '[]'::jsonb)
      from extranjero_os_asig x
      where x.mes = t.mes and x.cliente = c.cliente
    ) as extranjero_detalle_json,

    -- Copy “story” (lo que tú quieres mostrar tal cual)
    (
      'En ' || to_char(t.mes, 'YYYY-MM') ||
      ' hubo ' || t.movimientos_total || ' movimientos' ||
      case when coalesce(s.stock_activo,0) > 0
        then ' (' || round(100.0 * t.movimientos_total::numeric / s.stock_activo::numeric, 2) || '% del stock: ' || s.stock_activo || ').'
        else '.'
      end
      || ' De esos, el cliente principal fue ' || c.cliente || ': ' || c.mov_cliente || ' (' ||
      case when t.movimientos_total > 0 then round(100.0 * c.mov_cliente::numeric / t.movimientos_total::numeric, 2) else 0 end
      || '%).'
      || ' En ' || c.cliente || ': Chile ' || coalesce(co.cliente_chile,0) || ' y extranjero ' || coalesce(co.cliente_extranjero,0) || '.'
    ) as insight_story
  from tot_mes t
    left join lateral (
        select null::bigint as stock_activo
    ) s on true
    left join top_cliente_mes c
    on c.mes = t.mes
  left join cliente_origen co
    on co.mes = t.mes and co.cliente = c.cliente
)

select *
from final
order by mes asc
