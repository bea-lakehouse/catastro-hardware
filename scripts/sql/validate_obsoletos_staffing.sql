\echo '=== 1. Resumen validación obsoletos Staffing reconciliados ==='
with tagged as (
  select
    case
      when upper(coalesce(modelo, '')) like '%A2141%' then 'A2141'
      when upper(coalesce(marca, '')) = 'DELL'
        and regexp_replace(upper(coalesce(modelo, '')), '[^A-Z0-9]+', '', 'g') like '%LATITUDE7400%'
        then 'Dell Latitude 7400'
    end as modelo,
    upper(coalesce(estado_operativo, '')) as estado_operativo,
    coalesce(es_activo_operativo, true) as es_activo_operativo,
    upper(coalesce(lifecycle_estado, clasificacion_operacional, '')) as lifecycle_estado
  from analytics.mart_equipos_estado_actual
  where lower(coalesce(tipo_colaborador, '')) like '%staff%'
    and (
      upper(coalesce(modelo, '')) like '%A2141%'
      or (
        upper(coalesce(marca, '')) = 'DELL'
        and regexp_replace(upper(coalesce(modelo, '')), '[^A-Z0-9]+', '', 'g') like '%LATITUDE7400%'
      )
    )
),
actual as (
  select
    modelo,
    count(*)::int as cantidad_staffing_total,
    count(*) filter (
      where estado_operativo = 'ASIGNADO'
        and es_activo_operativo
        and lifecycle_estado in ('RENOVAR', 'BAJA_REQUERIDA', 'OBSERVACION')
    )::int as cantidad_activa_operativa,
    count(*) filter (
      where not es_activo_operativo
        and lifecycle_estado in ('VENDIDO', 'DADO_DE_BAJA')
    )::int as cantidad_excluida_venta_baja
  from tagged
  group by 1
),
expected as (
  select 'A2141'::text as modelo, 14::int as cantidad_staffing_total_esperada, 12::int as cantidad_activa_operativa_esperada, 2::int as cantidad_excluida_esperada
  union all
  select 'Dell Latitude 7400'::text as modelo, 9::int as cantidad_staffing_total_esperada, 7::int as cantidad_activa_operativa_esperada, 2::int as cantidad_excluida_esperada
)
select
  e.modelo,
  coalesce(a.cantidad_staffing_total, 0) as cantidad_staffing_total,
  e.cantidad_staffing_total_esperada,
  coalesce(a.cantidad_staffing_total, 0) - e.cantidad_staffing_total_esperada as delta_staffing_total,
  coalesce(a.cantidad_activa_operativa, 0) as cantidad_activa_operativa,
  e.cantidad_activa_operativa_esperada,
  coalesce(a.cantidad_activa_operativa, 0) - e.cantidad_activa_operativa_esperada as delta_activa_operativa,
  coalesce(a.cantidad_excluida_venta_baja, 0) as cantidad_excluida_venta_baja,
  e.cantidad_excluida_esperada,
  coalesce(a.cantidad_excluida_venta_baja, 0) - e.cantidad_excluida_esperada as delta_excluida
from expected e
left join actual a
  on a.modelo = e.modelo
order by e.modelo;

\echo '=== 2. Detalle de SKUs contados en obsoletos Staffing activos ==='
select
  coalesce(nullif(trim(modelo), ''), 'SIN_MODELO') as modelo,
  id_equipo,
  coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE') as cliente,
  coalesce(nullif(trim(last_event_persona), ''), 'SIN_PERSONA') as persona_asignada,
  estado_operativo as estado_actual,
  coalesce(lifecycle_estado, clasificacion_operacional, 'SIN_LIFECYCLE') as lifecycle_estado,
  decision_sugerida_operativa as decision_sugerida,
  evidencia_fuente_operativa as evidencia_fuente
from analytics.mart_equipos_estado_actual
where lower(coalesce(tipo_colaborador, '')) like '%staff%'
  and upper(coalesce(estado_operativo, '')) = 'ASIGNADO'
  and coalesce(es_activo_operativo, true)
  and upper(coalesce(lifecycle_estado, clasificacion_operacional, '')) in ('RENOVAR', 'BAJA_REQUERIDA', 'OBSERVACION')
  and (
    upper(coalesce(modelo, '')) like '%A2141%'
    or (
      upper(coalesce(marca, '')) = 'DELL'
      and regexp_replace(upper(coalesce(modelo, '')), '[^A-Z0-9]+', '', 'g') like '%LATITUDE7400%'
    )
  )
order by modelo, id_equipo;

\echo '=== 3. Excluidos del parque operativo por venta/baja ==='
select
  coalesce(nullif(trim(modelo), ''), 'SIN_MODELO') as modelo,
  id_equipo,
  coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE') as cliente,
  coalesce(nullif(trim(last_event_persona), ''), 'SIN_PERSONA') as persona_asignada,
  estado_operativo as estado_actual,
  coalesce(lifecycle_estado, clasificacion_operacional, 'SIN_LIFECYCLE') as lifecycle_estado,
  decision_sugerida_operativa as decision_sugerida,
  evidencia_fuente_operativa as evidencia_fuente
from analytics.mart_equipos_estado_actual
where lower(coalesce(tipo_colaborador, '')) like '%staff%'
  and not coalesce(es_activo_operativo, true)
  and (
    upper(coalesce(modelo, '')) like '%A2141%'
    or (
      upper(coalesce(marca, '')) = 'DELL'
      and regexp_replace(upper(coalesce(modelo, '')), '[^A-Z0-9]+', '', 'g') like '%LATITUDE7400%'
    )
  )
order by modelo, id_equipo;

\echo '=== 4. Checks rápidos ==='
select
  count(*) filter (
    where lower(coalesce(tipo_colaborador, '')) like '%staff%'
      and not coalesce(es_activo_operativo, true)
      and upper(coalesce(estado_operativo, '')) = 'ASIGNADO'
  )::int as excluidos_que_siguen_asignados,
  count(*) filter (
    where not coalesce(es_activo_operativo, true)
      and upper(coalesce(lifecycle_estado, clasificacion_operacional, '')) in ('RENOVAR', 'BAJA_REQUERIDA')
  )::int as excluidos_que_siguen_generando_renovacion,
  count(*) filter (
    where upper(coalesce(modelo, '')) like '%M1%'
      and upper(coalesce(lifecycle_estado, clasificacion_operacional, '')) <> 'OBSERVACION'
  )::int as mac_m1_fuera_observacion
from analytics.mart_equipos_estado_actual;
