\echo '=== 1. Volumen general de auditoria ==='
select
  count(*)::int as filas_totales,
  count(distinct id_equipo)::int as equipos_con_auditoria,
  min(fecha_cambio)::date as primera_fecha,
  max(fecha_cambio)::date as ultima_fecha
from analytics.mart_equipo_audit_log;

\echo '=== 2. Distribucion por origen / tipo / criticidad / confianza ==='
select
  origen,
  tipo_cambio,
  criticidad,
  confianza,
  count(*)::int as filas
from analytics.mart_equipo_audit_log
group by 1, 2, 3, 4
order by filas desc, origen, tipo_cambio;

\echo '=== 3. Cambios recientes ==='
select
  id_equipo,
  campo_modificado,
  valor_anterior,
  valor_nuevo,
  fecha_cambio,
  origen,
  tipo_cambio,
  criticidad,
  confianza,
  actor,
  source_table,
  source_run_id
from analytics.mart_equipo_audit_log
order by fecha_cambio desc, id_equipo
limit 40;

\echo '=== 4. SKU-602 ==='
select
  id_equipo,
  campo_modificado,
  valor_anterior,
  valor_nuevo,
  fecha_cambio,
  origen,
  tipo_cambio,
  criticidad,
  confianza,
  actor,
  source_table,
  source_run_id
from analytics.mart_equipo_audit_log
where upper(id_equipo) = 'SKU-602'
order by fecha_cambio desc, campo_modificado;

\echo '=== 5. Jira no debe crear movimientos fisicos ==='
select
  count(*)::int as filas_jira_fisicas
from analytics.mart_equipo_audit_log
where origen = 'Jira'
  and tipo_cambio in ('ingreso_equipo', 'salida_equipo');

\echo '=== 6. No debe existir ingreso_equipo con origen distinto a MTR ==='
select
  count(*)::int as ingresos_no_mtr
from analytics.mart_equipo_audit_log
where tipo_cambio = 'ingreso_equipo'
  and origen <> 'MTR';

\echo '=== 7. No debe existir salida_equipo con origen distinto a MTR ==='
select
  count(*)::int as salidas_no_mtr
from analytics.mart_equipo_audit_log
where tipo_cambio = 'salida_equipo'
  and origen <> 'MTR';

\echo '=== 8. No debe existir audit_id duplicado ==='
select
  count(*)::int as audit_ids_duplicados
from (
  select audit_id
  from analytics.mart_equipo_audit_log
  group by 1
  having count(*) > 1
) x;

\echo '=== 9. No debe existir cambio con valor_anterior = valor_nuevo ==='
select
  count(*)::int as cambios_sin_diff
from analytics.mart_equipo_audit_log
where coalesce(valor_anterior, '') = coalesce(valor_nuevo, '');

\echo '=== 10. fecha_cambio no puede ser futura ==='
select
  count(*)::int as cambios_futuros
from analytics.mart_equipo_audit_log
where fecha_cambio::date > current_date;

\echo '=== 11. Inconsistencias conciliadas vigentes ==='
select
  id_equipo,
  valor_nuevo as conciliacion_estado,
  fecha_cambio,
  criticidad,
  confianza
from analytics.mart_equipo_audit_log
where tipo_cambio = 'inconsistencia_detectada'
  and origen = 'Catastro'
order by fecha_cambio desc, id_equipo
limit 50;
