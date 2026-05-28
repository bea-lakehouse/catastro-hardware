\echo '=== 1. Cobertura base Jira y conciliacion ==='
select 'raw.jira_issues' as tabla, count(*)::int as filas
from raw.jira_issues
union all
select 'analytics.stg_jira_issues', count(*)::int
from analytics.stg_jira_issues
union all
select 'analytics.int_equipo_jira_rollup', count(*)::int
from analytics.int_equipo_jira_rollup
union all
select 'analytics.mart_equipo_timeline', count(*)::int
from analytics.mart_equipo_timeline
union all
select 'analytics.mart_timeline_eventos', count(*)::int
from analytics.mart_timeline_eventos
union all
select 'analytics.mart_equipos_estado_actual', count(*)::int
from analytics.mart_equipos_estado_actual
union all
select 'analytics.mart_mtr_jira_reconciliacion', count(*)::int
from analytics.mart_mtr_jira_reconciliacion
order by 1;

\echo '=== 2. Jira SKU / EQUIPAMIENTO visible tras el refresh ==='
select
  project_key,
  project_name,
  min(created_at)::date as primera_creacion,
  max(created_at)::date as ultima_creacion,
  min(updated_at)::date as primera_actualizacion,
  max(updated_at)::date as ultima_actualizacion,
  count(*)::int as issues
from analytics.stg_jira_issues
where project_key = 'SKU'
group by 1, 2
order by issues desc;

\echo '=== 3. Resolucion de id_equipo en Jira staging ==='
select
  id_equipo_resolved_from,
  count(*)::int as issues
from analytics.stg_jira_issues
group by 1
order by issues desc, id_equipo_resolved_from;

\echo '=== 4. Rollup Jira por estado administrativo ==='
select
  coalesce(jira_estado_equipo_top, 'SIN_ESTADO') as jira_estado_equipo,
  count(*)::int as equipos
from analytics.int_equipo_jira_rollup
group by 1
order by equipos desc, jira_estado_equipo;

\echo '=== 5. Estados de conciliacion MTR vs Jira ==='
select
  conciliacion_estado,
  count(*)::int as equipos
from analytics.mart_mtr_jira_reconciliacion
group by 1
order by equipos desc, conciliacion_estado;

\echo '=== 6. Indicadores clave de conciliacion ==='
select
  count(*) filter (where conciliacion_estado = 'CONCILIADO')::int as equipos_conciliados,
  count(*) filter (where flag_inconsistencia_mtr_jira)::int as inconsistencias_mtr_jira,
  count(*) filter (where flag_jira_sin_match_mtr)::int as jira_sin_match_mtr,
  count(*) filter (where flag_mtr_sin_match_jira)::int as mtr_sin_match_jira,
  count(*) filter (where flag_reserva_jira_pendiente)::int as reservas_jira_pendientes,
  count(*) filter (where flag_asignado_sin_respaldo_cruzado)::int as asignados_sin_respaldo_cruzado
from analytics.mart_mtr_jira_reconciliacion;

\echo '=== 7. Top inconsistencias accionables ==='
select
  id_equipo,
  conciliacion_estado,
  jira_estado_equipo_top,
  mtr_estado_operativo,
  mtr_estado_workflow_proxy,
  persona_asignada,
  mtr_cliente,
  jira_issue_key_top,
  jira_summary_top,
  jira_project_key_top,
  jira_project_name_top
from analytics.mart_mtr_jira_reconciliacion
where flag_inconsistencia_mtr_jira
order by jira_last_event_ts desc nulls last, mtr_last_event_at desc nulls last, id_equipo
limit 50;

\echo '=== 8. SKU-623 a SKU-632: visibilidad Jira/EQUIPAMIENTO y match real MTR ==='
with target as (
  select ('SKU-' || gs)::text as id_equipo
  from generate_series(623, 632) as gs
)
select
  t.id_equipo,
  coalesce(r.in_jira, false) as in_jira,
  coalesce(r.in_mtr, false) as in_mtr,
  r.conciliacion_estado,
  r.jira_project_key_top,
  r.jira_project_name_top,
  r.jira_estado_equipo_top,
  r.mtr_estado_operativo,
  r.jira_issue_key_top,
  r.jira_summary_top
from target t
left join analytics.mart_mtr_jira_reconciliacion r
  on r.id_equipo = t.id_equipo
order by t.id_equipo;

\echo '=== 9. Origen de eventos timeline: MTR / JIRA / CONCILIADO ==='
select
  lower(coalesce(origen_evento, 'sin_origen')) as origen_evento,
  count(*)::int as eventos
from analytics.mart_equipo_timeline_v2
group by 1
order by eventos desc, origen_evento;

\echo '=== 10. Muestras de eventos conciliados para verificar que no se inflen movimientos ==='
select
  id_equipo,
  fecha_evento::date as fecha_evento,
  tipo_evento,
  origen_evento,
  detalle_evento
from analytics.mart_equipo_timeline_v2
where lower(coalesce(origen_evento, '')) = 'conciliado'
order by fecha_evento desc, id_equipo
limit 50;

\echo '=== 11. Corte abril 2026 cerrado vs mayo 2026 acumulado al 2026-05-11 ==='
with periodos as (
  select
    case
      when fecha_evento::date between date '2026-04-01' and date '2026-04-30' then 'abril_2026'
      when fecha_evento::date between date '2026-05-01' and date '2026-05-11' then 'mayo_2026_hasta_11'
    end as periodo,
    tipo_evento,
    es_cambio_equipo_real,
    es_movimiento_interno_persona_cliente,
    ingreso_presiona_compra
  from analytics.int_mtr_eventos_dedup_stats
  where fecha_evento::date between date '2026-04-01' and date '2026-05-11'
)
select
  periodo,
  count(*)::int as eventos_mtr,
  count(*) filter (where tipo_evento = 'INGRESO')::int as ingresos,
  count(*) filter (where tipo_evento = 'SALIDA')::int as salidas,
  count(*) filter (where tipo_evento = 'ASIGNACION')::int as asignaciones,
  count(*) filter (where tipo_evento = 'DEVOLUCION')::int as devoluciones,
  count(*) filter (where es_cambio_equipo_real)::int as cambios_equipo_real,
  count(*) filter (where es_movimiento_interno_persona_cliente)::int as movimientos_internos_persona_cliente,
  count(*) filter (where ingreso_presiona_compra)::int as ingresos_sin_equipo
from periodos
where periodo is not null
group by 1
order by 1;

\echo '=== 12. Validacion de que movimientos internos no se cuenten como cambios fisicos ==='
select
  fecha_evento::date as fecha_evento,
  id_equipo,
  persona,
  cliente,
  id_equipo_anterior_persona,
  cliente_anterior_persona,
  es_cambio_equipo_real,
  es_movimiento_interno_persona_cliente,
  detalle
from analytics.int_mtr_eventos_dedup_stats
where fecha_evento::date between date '2026-04-01' and date '2026-05-11'
  and (
    es_movimiento_interno_persona_cliente
    or es_cambio_equipo_real
  )
order by fecha_evento desc, persona nulls last, id_equipo
limit 100;

\echo '=== 13. Cliente y usuario actual: contraste MTR vs mart estado actual ==='
select
  r.id_equipo,
  r.conciliacion_estado,
  r.mtr_estado_operativo,
  r.persona_asignada,
  r.mtr_cliente,
  e.last_event_persona,
  e.cliente,
  e.jira_issue_key,
  e.jira_summary
from analytics.mart_mtr_jira_reconciliacion r
left join analytics.mart_equipos_estado_actual e
  on e.id_equipo = r.id_equipo
where r.in_mtr
order by r.id_equipo
limit 100;

\echo '=== 14. Equipos Jira sin ingreso MTR asociado ==='
select
  id_equipo,
  conciliacion_estado,
  jira_issue_key_top,
  jira_summary_top,
  jira_estado_equipo_top,
  jira_project_key_top,
  jira_project_name_top,
  jira_last_event_ts::date as jira_ultima_fecha
from analytics.mart_mtr_jira_reconciliacion
where flag_creado_jira_sin_ingreso_mtr
order by jira_last_event_ts desc nulls last, id_equipo;
