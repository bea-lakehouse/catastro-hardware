\echo '=== 1. Resumen de clasificación operativa ==='
select
  clasificacion_operacional,
  count(*)::int as equipos,
  count(*) filter (where coalesce(es_activo_operativo, false))::int as activos_operativos
from analytics.mart_equipos_estado_actual
group by 1
order by
  case clasificacion_operacional
    when 'DADO_DE_BAJA' then 1
    when 'VENDIDO' then 2
    when 'BAJA_REQUERIDA' then 3
    when 'RENOVAR' then 4
    when 'OBSERVACION' then 5
    when 'MANTENER' then 6
    when 'ASIGNADO' then 7
    when 'DISPONIBLE' then 8
    else 9
  end,
  clasificacion_operacional;

\echo '=== 2. Overrides MTR que no pueden seguir activos ==='
select
  count(*)::int as overrides_en_parque_activo
from analytics.mart_equipos_estado_actual e
join analytics.mtr_estado_override o
  on upper(o.id_equipo) = upper(e.id_equipo)
where coalesce(e.es_activo_operativo, true);

\echo '=== 3. Overrides MTR que no quedaron en BAJA / DADO_DE_BAJA ==='
select
  count(*)::int as overrides_mal_clasificados
from analytics.mart_equipos_estado_actual e
join analytics.mtr_estado_override o
  on upper(o.id_equipo) = upper(e.id_equipo)
where upper(coalesce(e.estado_operativo, '')) <> 'BAJA'
   or upper(coalesce(e.clasificacion_operacional, '')) not in ('DADO_DE_BAJA', 'VENDIDO');

\echo '=== 4. Dell Latitude 7400 staffing debe quedar como BAJA_REQUERIDA ==='
select
  count(*)::int as dell_staffing_fuera_de_politica
from analytics.mart_equipos_estado_actual
where upper(coalesce(marca, '')) = 'DELL'
  and upper(coalesce(modelo, '')) like '%LATITUDE 7400%'
  and lower(coalesce(tipo_colaborador, '')) like '%staff%'
  and upper(coalesce(clasificacion_operacional, '')) <> 'BAJA_REQUERIDA';

\echo '=== 5. Apple A2141 staffing debe quedar como RENOVAR ==='
select
  count(*)::int as a2141_staffing_fuera_de_politica
from analytics.mart_equipos_estado_actual
where upper(coalesce(modelo, '')) like '%A2141%'
  and lower(coalesce(tipo_colaborador, '')) like '%staff%'
  and upper(coalesce(clasificacion_operacional, '')) <> 'RENOVAR';

\echo '=== 6. Mac M1 / M1 Pro debe quedar en OBSERVACION ==='
select
  count(*)::int as mac_m1_fuera_de_politica
from analytics.mart_equipos_estado_actual
where upper(coalesce(marca, '')) = 'APPLE'
  and (
    upper(coalesce(modelo, '')) like '%M1 PRO%'
    or upper(coalesce(modelo, '')) like '%MACBOOK PRO M1%'
    or upper(coalesce(modelo, '')) like '% M1%'
  )
  and upper(coalesce(clasificacion_operacional, '')) <> 'OBSERVACION';

\echo '=== 7. Obsoletos actualmente asignados a Staffing ==='
select
  coalesce(nullif(trim(modelo), ''), 'SIN_MODELO') as modelo,
  count(*)::int as cantidad,
  string_agg(id_equipo, ', ' order by id_equipo) as skus,
  string_agg(coalesce(nullif(trim(last_event_persona), ''), 'SIN_PERSONA'), ' | ' order by coalesce(nullif(trim(last_event_persona), ''), 'SIN_PERSONA')) as personas,
  string_agg(coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE'), ' | ' order by coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE')) as cliente,
  max(decision_sugerida_operativa) as decision_sugerida,
  max(evidencia_fuente_operativa) as evidencia_fuente
from analytics.mart_equipos_estado_actual
where lower(coalesce(tipo_colaborador, '')) like '%staff%'
  and upper(coalesce(estado_operativo, '')) = 'ASIGNADO'
  and upper(coalesce(clasificacion_operacional, '')) in ('RENOVAR', 'BAJA_REQUERIDA', 'OBSERVACION')
group by 1
order by cantidad desc, modelo;
