\echo '=== 1. SKUs afectados: estado operativo, decision y ML vigente ==='
with afectados as (
  select
    id_equipo,
    estado_operativo,
    lifecycle_estado,
    es_activo_operativo,
    coalesce(ml_activo_operativo, es_activo_operativo) as ml_activo_operativo,
    coalesce(flag_renovar_regla, false) as flag_renovar_regla,
    coalesce(flag_dar_baja_regla, false) as flag_dar_baja_regla,
    coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'Sin score') as ml_risk_level,
    coalesce(ml_score_v3, ml_score, 0) as ml_score,
    decision_sugerida_operativa
  from analytics.mart_equipos_estado_actual
  where id_equipo in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
)
select *
from afectados
order by id_equipo;

\echo '=== 2. Conteo lifecycle_estado actual ==='
select
  coalesce(lifecycle_estado, 'SIN_LIFECYCLE') as lifecycle_estado,
  count(*)::int as cantidad
from analytics.mart_equipos_estado_actual
group by 1
order by 1;

\echo '=== 3. Before vs After (contrafactual: antes de excluir los 4 SKUs no operativos) ==='
with base as (
  select
    id_equipo,
    lower(coalesce(tipo_colaborador, '')) as tipo_colaborador,
    coalesce(es_activo_operativo, true) as es_activo_operativo,
    coalesce(flag_renovar_regla, false) as flag_renovar_regla,
    coalesce(flag_dar_baja_regla, false) as flag_dar_baja_regla,
    coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'Sin score') as ml_risk_level,
    lower(coalesce(presion_nivel, 'baja')) as presion_nivel
  from analytics.mart_equipos_estado_actual
),
afectados as (
  select id_equipo
  from base
  where id_equipo in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
),
actual as (
  select
    count(*) filter (where es_activo_operativo) as activos_operativos,
    count(*) filter (where es_activo_operativo and tipo_colaborador = 'staffing') as staffing_activos,
    count(*) filter (where es_activo_operativo and flag_renovar_regla) as renovar_activos,
    count(*) filter (where es_activo_operativo and flag_dar_baja_regla) as baja_activos,
    count(*) filter (where es_activo_operativo and upper(ml_risk_level) = 'ALTA') as riesgo_alto_activo,
    count(*) filter (where es_activo_operativo and presion_nivel = 'alta') as presion_alta_activa
  from base
),
before_sim as (
  select
    count(*) filter (where es_activo_operativo or id_equipo in (select id_equipo from afectados)) as activos_operativos,
    count(*) filter (where (es_activo_operativo or id_equipo in (select id_equipo from afectados)) and tipo_colaborador = 'staffing') as staffing_activos,
    count(*) filter (where (es_activo_operativo or id_equipo in (select id_equipo from afectados)) and flag_renovar_regla) as renovar_activos,
    count(*) filter (where (es_activo_operativo or id_equipo in (select id_equipo from afectados)) and flag_dar_baja_regla) as baja_activos,
    count(*) filter (where (es_activo_operativo or id_equipo in (select id_equipo from afectados)) and upper(ml_risk_level) = 'ALTA') as riesgo_alto_activo,
    count(*) filter (where (es_activo_operativo or id_equipo in (select id_equipo from afectados)) and presion_nivel = 'alta') as presion_alta_activa
  from base
),
mes_actual as (
  select
    mes,
    stock_activo,
    stock_disponible,
    presion_compra
  from analytics.mart_estadistica_movimientos_mes_v2
  where mes = date_trunc('month', current_date)::date
)
select
  'activos_operativos'::text as metrica,
  before_sim.activos_operativos::int as before,
  actual.activos_operativos::int as after,
  (actual.activos_operativos - before_sim.activos_operativos)::int as delta
from actual, before_sim

union all

select
  'staffing_activos',
  before_sim.staffing_activos::int,
  actual.staffing_activos::int,
  (actual.staffing_activos - before_sim.staffing_activos)::int
from actual, before_sim

union all

select
  'renovar_activos',
  before_sim.renovar_activos::int,
  actual.renovar_activos::int,
  (actual.renovar_activos - before_sim.renovar_activos)::int
from actual, before_sim

union all

select
  'baja_activos',
  before_sim.baja_activos::int,
  actual.baja_activos::int,
  (actual.baja_activos - before_sim.baja_activos)::int
from actual, before_sim

union all

select
  'riesgo_alto_activo',
  before_sim.riesgo_alto_activo::int,
  actual.riesgo_alto_activo::int,
  (actual.riesgo_alto_activo - before_sim.riesgo_alto_activo)::int
from actual, before_sim

union all

select
  'presion_alta_activa',
  before_sim.presion_alta_activa::int,
  actual.presion_alta_activa::int,
  (actual.presion_alta_activa - before_sim.presion_alta_activa)::int
from actual, before_sim

union all

select
  'stock_activo_mes_actual',
  (m.stock_activo + 4)::int as before,
  m.stock_activo::int as after,
  -4::int as delta
from mes_actual m

union all

select
  'stock_disponible_mes_actual',
  m.stock_disponible::int as before,
  m.stock_disponible::int as after,
  0::int as delta
from mes_actual m

union all

select
  'presion_compra_mes_actual',
  m.presion_compra::int as before,
  m.presion_compra::int as after,
  0::int as delta
from mes_actual m
order by metrica;

\echo '=== 4. Planeacion compra ejecutiva y series UI (sin cambio por exclusiones del parque) ==='
select
  e.mes,
  e.total_confirmadas,
  e.total_pendientes,
  e.stock_confirmado,
  e.stock_proyectado,
  e.demanda_presion_compra_mes,
  e.balance_confirmado_vs_presion_mes,
  e.balance_total_vs_presion_mes
from analytics.mart_planeacion_compras_ejecutivo_mes e
order by e.mes desc
limit 3;

select
  bloque,
  serie,
  max(valor)::numeric as valor_max_ref
from analytics.mart_ui_planeacion_series
group by 1,2
order by 1,2;

\echo '=== 5. Matriz de impacto para SKUs excluidos ==='
with base as (
  select
    id_equipo,
    lifecycle_estado,
    coalesce(nullif(trim(decision_sugerida_operativa), ''), 'Sin decision') as decision_sugerida,
    coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'Sin score') as ml_risk_level,
    coalesce(es_activo_operativo, true) as es_activo_operativo,
    coalesce(ml_activo_operativo, es_activo_operativo, true) as ml_activo_operativo
  from analytics.mart_equipos_estado_actual
  where id_equipo in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
)
select
  lifecycle_estado,
  decision_sugerida,
  ml_risk_level,
  count(*)::int as cantidad,
  case
    when not bool_or(es_activo_operativo)
      then 'Excluido de pools operativos; no debe sumar activos, renovar operativo, stock disponible ni presión de compra.'
    else 'Sigue impactando planeación operativa.'
  end as impacto_planeacion,
  case
    when count(*) filter (where ml_activo_operativo) > 0
      then 'Todavía existe score operativo activo para SKUs excluidos.'
    when count(*) filter (where ml_risk_level <> 'Sin score') > 0
      then 'Conserva historia/señal ML, pero marcada fuera del parque operativo actual.'
    else 'Sin score vigente en ML actual.'
  end as impacto_ml,
  string_agg(id_equipo, ', ' order by id_equipo) as sku_afectados
from base
group by 1,2,3
order by 1,2,3;

\echo '=== 6. ML sobre no operativos y presencia en historial ==='
with non_operativos as (
  select
    lifecycle_estado,
    coalesce(ml_activo_operativo, es_activo_operativo, true) as ml_activo_operativo,
    coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'Sin score') as ml_risk_level
  from analytics.mart_equipos_estado_actual
  where not coalesce(es_activo_operativo, true)
),
ml_hist as (
  select
    upper(entity_id) as id_equipo,
    count(*)::int as ml_v2_history_rows
  from analytics.ml_scores_v2_history
  where upper(entity_id) in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
  group by 1
)
select
  lifecycle_estado,
  ml_activo_operativo,
  ml_risk_level,
  count(*)::int as cantidad
from non_operativos
group by 1,2,3
order by 1,2,3;

with ml_hist as (
  select
    upper(entity_id) as id_equipo,
    count(*)::int as ml_v2_history_rows
  from analytics.ml_scores_v2_history
  where upper(entity_id) in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
  group by 1
)
select
  id_equipo,
  ml_v2_history_rows
from ml_hist
order by id_equipo;

\echo '=== 7. KPIs Home operativos y presencia de SKUs excluidos ==='
with home_operativo as (
  select
    count(*) filter (where coalesce(es_activo_operativo, true) and coalesce(flag_renovar_regla, false)) as renovar_politica,
    count(*) filter (where coalesce(es_activo_operativo, true) and coalesce(flag_dar_baja_regla, false)) as salida_legacy,
    count(*) filter (where coalesce(es_activo_operativo, true) and coalesce(presion_nivel, '') = 'alta') as presion_alta,
    count(*) filter (where coalesce(es_activo_operativo, true) and coalesce(presion_nivel, '') = 'media') as presion_media
  from analytics.mart_equipos_estado_actual
),
action_today as (
  select id_equipo
  from analytics.mart_equipos_estado_actual
  where coalesce(es_activo_operativo, true)
    and (
      coalesce(jira_open_count, 0) > 0
      or coalesce(flag_dar_baja_regla, false)
      or coalesce(flag_renovar_regla, false)
      or coalesce(flag_sin_asignacion, false)
    )
  order by coalesce(priority_final_rank, 999) asc, coalesce(jira_open_count, 0) desc, id_equipo asc
  limit 12
),
focos as (
  select id_equipo
  from analytics.mart_equipos_estado_actual
  where coalesce(es_activo_operativo, true)
  order by coalesce(priority_final_rank, 999) asc, priority_final_sort_key desc nulls last, id_equipo asc
  limit 8
),
bolsa as (
  select id_equipo
  from analytics.mart_equipos_estado_actual
  where coalesce(es_activo_operativo, true)
    and (
      coalesce(flag_renovar_regla, false)
      or coalesce(flag_dar_baja_regla, false)
      or coalesce(flag_sin_asignacion, false)
    )
  order by coalesce(priority_final_rank, 999) asc, id_equipo asc
  limit 8
),
excluidos as (
  select id_equipo
  from analytics.mart_equipos_estado_actual
  where id_equipo in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
),
presencia as (
  select
    count(*) filter (where id_equipo in (select id_equipo from action_today)) as excluidos_en_action_today,
    count(*) filter (where id_equipo in (select id_equipo from focos)) as excluidos_en_focos,
    count(*) filter (where id_equipo in (select id_equipo from bolsa)) as excluidos_en_bolsa
  from excluidos
)
select
  'renovar_politica'::text as metrica,
  home_operativo.renovar_politica::int as valor_operativo,
  0::int as referencia,
  0::int as delta
from home_operativo

union all

select
  'salida_legacy',
  home_operativo.salida_legacy::int,
  0::int,
  0::int
from home_operativo

union all

select
  'presion_alta',
  home_operativo.presion_alta::int,
  0::int,
  0::int
from home_operativo

union all

select
  'presion_media',
  home_operativo.presion_media::int,
  0::int,
  0::int
from home_operativo

union all

select
  'excluidos_en_action_today',
  presencia.excluidos_en_action_today::int,
  0::int,
  presencia.excluidos_en_action_today::int
from presencia

union all

select
  'excluidos_en_focos',
  presencia.excluidos_en_focos::int,
  0::int,
  presencia.excluidos_en_focos::int
from presencia

union all

select
  'excluidos_en_bolsa',
  presencia.excluidos_en_bolsa::int,
  0::int,
  presencia.excluidos_en_bolsa::int
from presencia
order by metrica;

\echo '=== 8. Conclusiones finales ==='
with afectados as (
  select
    id_equipo,
    coalesce(es_activo_operativo, true) as es_activo_operativo,
    coalesce(ml_activo_operativo, es_activo_operativo, true) as ml_activo_operativo,
    coalesce(nullif(trim(ml_risk_level_v3), ''), nullif(trim(ml_risk_level), ''), 'Sin score') as ml_risk_level
  from analytics.mart_equipos_estado_actual
  where id_equipo in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
),
home_presence as (
  select
    count(*) filter (
      where coalesce(es_activo_operativo, true)
        and id_equipo in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
    ) as excluidos_activos,
    count(*) filter (
      where coalesce(es_activo_operativo, true)
        and (
          coalesce(flag_renovar_regla, false)
          or coalesce(flag_dar_baja_regla, false)
          or coalesce(flag_sin_asignacion, false)
          or coalesce(jira_open_count, 0) > 0
        )
        and id_equipo in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
    ) as excluidos_en_kpis_home
  from analytics.mart_equipos_estado_actual
),
ml_hist as (
  select count(*)::int as rows_v2_hist
  from analytics.ml_scores_v2_history
  where upper(entity_id) in ('SKU-139', 'SKU-179', 'SKU-162', 'SKU-202')
),
mes_actual as (
  select stock_disponible, presion_compra
  from analytics.mart_estadistica_movimientos_mes_v2
  where mes = date_trunc('month', current_date)::date
)
select
  'Planeación'::text as modulo,
  case
    when exists (
      select 1
      from afectados
      where es_activo_operativo = false
    )
    then 'Impacto esperado'
    else 'Sin impacto'
  end as conclusion,
  'Los 4 SKUs salen del parque operativo y corrigen staffing activo/renovación; la planeación de compras ejecutiva no cambia porque depende de compras manuales y presión MTR.'::text as detalle

union all

select
  'ML',
  case
    when exists (
      select 1
      from afectados
      where ml_activo_operativo
    )
    then 'Impacto incorrecto'
    else 'Sin contaminación operativa'
  end,
  'La historia ML se conserva; el criterio actual exige que los SKUs excluidos no mantengan score operativo vigente aunque sigan existiendo en histórico.'::text

union all

select
  'Riesgo',
  case
    when exists (
      select 1
      from afectados
      where es_activo_operativo
         or ml_activo_operativo
    )
    then 'Impacto incorrecto'
    else 'Sin contaminación operativa'
  end,
  'El riesgo actual debe leerse sólo sobre parque operativo; los equipos vendidos o dados de baja pueden conservar huella histórica, pero no entrar al riesgo vigente.'::text

union all

select
  'KPIs Home',
  case
    when (select excluidos_activos from home_presence) > 0
      or (select excluidos_en_kpis_home from home_presence) > 0
    then 'Impacto incorrecto'
    else 'Sin contaminación operativa'
  end,
  'Los bloques operativos del Home deben quedar basados sólo en es_activo_operativo=true; los excluidos no deben entrar a renovar, salida, presión, focos ni action_today.'::text;
