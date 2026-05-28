\echo '=== 1. Volumen general de operacion ==='
select
  count(*)::int as alertas_totales,
  count(distinct id_equipo)::int as equipos_afectados,
  min(fecha_detectada)::date as primera_alerta,
  max(fecha_detectada)::date as ultima_alerta
from analytics.mart_operacion_alertas;

\echo '=== 2. Distribucion por criticidad / origen / tipo / estado ==='
select
  criticidad,
  origen,
  tipo_alerta,
  estado_alerta,
  count(*)::int as filas
from analytics.mart_operacion_alertas
group by 1, 2, 3, 4
order by filas desc, criticidad, origen, tipo_alerta;

\echo '=== 3. Alertas recientes ==='
select
  alert_id,
  id_equipo,
  tipo_alerta,
  criticidad,
  origen,
  evidencia,
  accion_sugerida,
  fecha_detectada,
  dias_abierta,
  estado_alerta,
  confianza_dato
from analytics.mart_operacion_alertas
order by fecha_detectada desc, criticidad, id_equipo
limit 40;

\echo '=== 4. Confianza del dato ==='
select
  confianza_dato,
  count(*)::int as equipos
from analytics.mart_confianza_dato
group by 1
order by equipos desc, confianza_dato;

\echo '=== 5. SLA operativo ==='
select
  sla_estado,
  aging_bucket,
  count(*)::int as equipos,
  round(avg(coalesce(jira_days_open_max, 0))::numeric, 2) as jira_days_open_promedio,
  round(avg(coalesce(aging_operativo_dias, 0))::numeric, 2) as aging_operativo_promedio
from analytics.mart_operacion_sla
group by 1, 2
order by equipos desc, sla_estado, aging_bucket;

\echo '=== 6. No debe existir alert_id duplicado ==='
select
  count(*)::int as alert_ids_duplicados
from (
  select alert_id
  from analytics.mart_operacion_alertas
  group by 1
  having count(*) > 1
) x;

\echo '=== 7. Criticidad valida ==='
select
  count(*)::int as criticidades_invalidas
from analytics.mart_operacion_alertas
where criticidad not in ('CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO');

\echo '=== 8. Estado_alerta valido ==='
select
  count(*)::int as estados_invalidos
from analytics.mart_operacion_alertas
where estado_alerta not in ('ABIERTA', 'OBSERVADA', 'RESUELTA');

\echo '=== 9. No alertas sin id_equipo cuando aplica ==='
select
  count(*)::int as alertas_sin_id_equipo
from analytics.mart_operacion_alertas
where nullif(trim(coalesce(id_equipo, '')), '') is null;

\echo '=== 10. No alertas fisicas generadas solo por Jira ==='
select
  count(*)::int as alertas_fisicas_solo_jira
from analytics.mart_operacion_alertas
where origen = 'Jira'
  and tipo_alerta in ('equipo_asignado_sin_persona', 'equipo_sin_movimiento_reciente');

\echo '=== 11. No fechas futuras ==='
select
  count(*)::int as alertas_futuras
from analytics.mart_operacion_alertas
where fecha_detectada::date > current_date;
