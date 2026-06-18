-- ============================================================
-- 004_gold_views.sql
-- Gold layer: vistas analíticas calculadas desde Silver.
-- Cada vista refleja el estado actual de los datos Silver.
-- ============================================================

-- ── gold.governance_summary ───────────────────────────────────
create or replace view gold.governance_summary as
with mov as (
  select
    count(*)                                                               as total,
    count(*) filter (where not es_inferido)                               as real_n,
    count(*) filter (where es_inferido)                                   as inferred_n,
    round(100.0 * count(*) filter (where tiene_serial and not es_inferido)
          / nullif(count(*) filter (where not es_inferido), 0), 1)        as pct_serial,
    round(100.0 * count(*) filter (where tiene_fecha and not es_inferido)
          / nullif(count(*) filter (where not es_inferido), 0), 1)        as pct_fecha,
    round(100.0 * count(*) filter (where gestionado_por is not null and not es_inferido)
          / nullif(count(*) filter (where not es_inferido), 0), 1)        as pct_gestor,
    round(100.0 * count(*) filter (where cliente is not null and not es_inferido)
          / nullif(count(*) filter (where not es_inferido), 0), 1)        as pct_cliente,
    round(100.0 * count(*) filter (where riesgo_percibido_it is not null and not es_inferido)
          / nullif(count(*) filter (where not es_inferido), 0), 1)        as pct_riesgo_it,
    count(*) filter (where not es_inferido
      and (not tiene_serial or not tiene_fecha
           or cliente is null or gestionado_por is null))                 as records_to_fix
  from silver.fact_movements
),
scores as (
  select
    coalesce(pct_serial,0)*0.35 + coalesce(pct_fecha,0)*0.35
      + coalesce(pct_gestor,0)*0.15 + coalesce(pct_cliente,0)*0.15      as quality_score,
    coalesce(pct_serial,0)*0.20 + coalesce(pct_fecha,0)*0.20
      + coalesce(pct_cliente,0)*0.15 + coalesce(pct_gestor,0)*0.20
      + coalesce(pct_riesgo_it,0)*0.15                                   as dg_score,
    *
  from mov
)
select
  now()::date                                               as snapshot_date,
  round(quality_score, 1)::numeric(5,1)                    as quality_score,
  round(quality_score, 1)::numeric(5,1)                    as quality_score_real,
  round(dg_score, 1)::numeric(5,1)                         as dg_score,
  case
    when dg_score >= 90 then 5 when dg_score >= 75 then 4
    when dg_score >= 60 then 3 when dg_score >= 40 then 2 else 1
  end::smallint                                             as dg_level,
  case
    when dg_score >= 90 then 'Predictivo'
    when dg_score >= 75 then 'Medible'
    when dg_score >= 60 then 'Gestionado'
    when dg_score >= 40 then 'Controlado'
    else 'Inicial'
  end                                                       as dg_level_label,
  total::integer                                            as total_movements,
  real_n::integer                                           as real_movements,
  inferred_n::integer                                       as inferred_movements,
  records_to_fix::integer                                   as records_to_fix,
  'gestor_it_responsable (' || coalesce(pct_gestor,0) || '% completitud)'
                                                            as main_gap,
  'riesgo_percibido_it (' || coalesce(pct_riesgo_it,0) || '% — bloquea ML Dic 2026)'
                                                            as secondary_gap
from scores;

comment on view gold.governance_summary is
  'Métricas de gobierno calculadas en vivo desde silver.fact_movements. '
  'Fórmula quality_score: serial×0.35 + fecha×0.35 + gestor×0.15 + cliente×0.15. '
  'Fórmula dg_score: serial×0.20 + fecha×0.20 + cliente×0.15 + gestor×0.20 + riesgo_it×0.15.';

-- ── gold.quality_kpis ─────────────────────────────────────────
create or replace view gold.quality_kpis as
select
  field_name,
  field_label,
  pct_complete,
  count_ok,
  count_total,
  case
    when pct_complete >= 90 then 'green'
    when pct_complete >= 70 then 'yellow'
    when pct_complete >= 40 then 'orange'
    else 'red'
  end as semaphore,
  is_strategic
from (
  select
    'serial'                                            as field_name,
    'Serial equipo'                                     as field_label,
    round(100.0 * sum(tiene_serial::int) / nullif(count(*),0),1) as pct_complete,
    sum(tiene_serial::int)::integer                     as count_ok,
    count(*)::integer                                   as count_total,
    false                                               as is_strategic
  from silver.fact_movements
  union all
  select 'fecha','Fecha movimiento',
    round(100.0 * sum(tiene_fecha::int) / nullif(count(*),0),1),
    sum(tiene_fecha::int)::integer, count(*)::integer, false
  from silver.fact_movements
  union all
  select 'cliente','Cliente / Proyecto',
    round(100.0 * count(cliente) / nullif(count(*),0),1),
    count(cliente)::integer, count(*)::integer, false
  from silver.fact_movements
  union all
  select 'empleado','Empleado',
    round(100.0 * count(empleado) / nullif(count(*),0),1),
    count(empleado)::integer, count(*)::integer, false
  from silver.fact_movements
  union all
  select 'gestor','Gestor IT',
    round(100.0 * count(gestionado_por) / nullif(count(*),0),1),
    count(gestionado_por)::integer, count(*)::integer, false
  from silver.fact_movements
  union all
  select 'riesgo_percibido_it','Riesgo percibido IT',
    round(100.0 * count(riesgo_percibido_it) / nullif(count(*),0),1),
    count(riesgo_percibido_it)::integer, count(*)::integer, true
  from silver.fact_movements
) kpis;

comment on view gold.quality_kpis is
  'Completitud por campo en silver.fact_movements. '
  'is_strategic=true marca el target ML (riesgo_percibido_it).';

-- ── gold.movements_quality ────────────────────────────────────
create or replace view gold.movements_quality as
select
  fuente_hoja                                         as source_name,
  count(*)                                            as total_records,
  count(*) filter (where not tiene_serial)            as missing_serial,
  count(*) filter (where not tiene_fecha)             as missing_date,
  count(*) filter (where cliente is null)             as missing_client,
  count(*) filter (where gestionado_por is null)      as missing_manager,
  es_inferido,
  round(100.0 * count(*) filter (where tiene_serial)  / nullif(count(*),0), 1) as pct_serial,
  round(100.0 * count(*) filter (where tiene_fecha)   / nullif(count(*),0), 1) as pct_date,
  case
    when bool_or(es_inferido) then 'BAJA'::public.tb_priority
    when round(100.0 * avg(tiene_serial::int),0) < 60 then 'CRÍTICA'::public.tb_priority
    when round(100.0 * avg(tiene_serial::int),0) < 80 then 'ALTA'::public.tb_priority
    else 'BAJA'::public.tb_priority
  end as priority
from silver.fact_movements
group by fuente_hoja, es_inferido
order by
  case when not es_inferido then 0 else 1 end,
  pct_serial;

-- ── gold.asset_risk ──────────────────────────────────────────
create or replace view gold.asset_risk as
select
  a.serial,
  a.marca,
  a.modelo,
  a.anio_fabricacion,
  a.cpu,
  a.estado,
  a.cliente,
  a.empleado,
  a.risk_score,
  a.risk_nivel,
  a.calidad_dato,
  a.valor_dep_usd,
  a.costo_renovacion_usd,
  a.candidato_renovacion,
  -- Enriquecimiento desde fact_movements
  count(m.movement_id)::integer                           as n_movimientos,
  bool_or(m.tipo_movimiento = 'baja')                     as tiene_baja,
  bool_or(m.tipo_movimiento = 'recuperacion')             as tiene_recuperacion,
  max(m.riesgo_percibido_it)                              as riesgo_it_max,
  -- Bonus movimientos (misma lógica que pipeline Python)
  least(100, a.risk_score + (
    case when bool_or(m.tipo_movimiento = 'baja') then 15 else 0 end +
    case when bool_or(m.tipo_movimiento = 'recuperacion') then 10 else 0 end +
    case when count(m.movement_id) >= 4 then 8
         when count(m.movement_id) >= 3 then 4 else 0 end
  ))::smallint                                            as risk_score_v2,
  silver.risk_nivel(
    least(100, a.risk_score + (
      case when bool_or(m.tipo_movimiento = 'baja') then 15 else 0 end +
      case when bool_or(m.tipo_movimiento = 'recuperacion') then 10 else 0 end +
      case when count(m.movement_id) >= 4 then 8
           when count(m.movement_id) >= 3 then 4 else 0 end
    ))::smallint
  )                                                       as risk_nivel_v2
from silver.dim_asset a
left join silver.fact_movements m on m.serial = a.serial
group by
  a.serial, a.marca, a.modelo, a.anio_fabricacion, a.cpu,
  a.estado, a.cliente, a.empleado, a.risk_score, a.risk_nivel,
  a.calidad_dato, a.valor_dep_usd, a.costo_renovacion_usd, a.candidato_renovacion
order by risk_score_v2 desc nulls last;

comment on view gold.asset_risk is
  'risk_score base desde dim_asset + bonus de historial de movimientos. '
  'risk_score_v2 = risk_score + bonus(baja=+15, recuperacion=+10, 4+movs=+8).';

-- ── gold.financial_summary ────────────────────────────────────
create or replace view gold.financial_summary as
-- Total global
select 'total' as dimension, 'all' as breakdown_value,
  count(*)::integer                         as asset_count,
  coalesce(sum(precio_nuevo_usd), 0)        as valor_nuevo_usd,
  coalesce(sum(valor_dep_usd), 0)           as valor_dep_usd,
  coalesce(sum(dep_acumulada_usd), 0)       as dep_acumulada_usd,
  round(avg(pct_depreciado), 1)             as pct_depreciado_avg,
  coalesce(sum(costo_renovacion_usd) filter (where candidato_renovacion), 0) as costo_renovacion_usd
from silver.dim_asset

union all

-- Por CPU
select 'cpu', coalesce(cpu,'Sin CPU'),
  count(*)::integer,
  coalesce(sum(precio_nuevo_usd), 0), coalesce(sum(valor_dep_usd), 0),
  coalesce(sum(dep_acumulada_usd), 0), round(avg(pct_depreciado), 1),
  coalesce(sum(costo_renovacion_usd) filter (where candidato_renovacion), 0)
from silver.dim_asset group by cpu

union all

-- Por cliente
select 'cliente', coalesce(cliente,'Sin Cliente'),
  count(*)::integer,
  coalesce(sum(precio_nuevo_usd), 0), coalesce(sum(valor_dep_usd), 0),
  coalesce(sum(dep_acumulada_usd), 0), round(avg(pct_depreciado), 1),
  coalesce(sum(costo_renovacion_usd) filter (where candidato_renovacion), 0)
from silver.dim_asset group by cliente

union all

-- Por año de fabricación
select 'anio', coalesce(anio_fabricacion::text,'Sin año'),
  count(*)::integer,
  coalesce(sum(precio_nuevo_usd), 0), coalesce(sum(valor_dep_usd), 0),
  coalesce(sum(dep_acumulada_usd), 0), round(avg(pct_depreciado), 1),
  coalesce(sum(costo_renovacion_usd) filter (where candidato_renovacion), 0)
from silver.dim_asset group by anio_fabricacion;

comment on view gold.financial_summary is
  'Valor del parque agrupado por total, CPU, cliente y año. '
  'Depreciación lineal 5 años, residual 10% (calculado en Silver).';

-- ── gold.forecast ─────────────────────────────────────────────
create or replace view gold.forecast as
select
  serial, marca, modelo, anio_fabricacion, cpu,
  estado, cliente, empleado, risk_score, score_renovacion,
  costo_renovacion_usd,
  case
    when estado in ('Defectuoso','De Baja')  then 'inmediato'
    when risk_score >= 70                    then '6_meses'
    when score_renovacion >= 50              then '12_meses'
    when score_renovacion >= 30              then '18_meses'
    else 'ok'
  end                                        as renovation_period,
  case
    when estado in ('Defectuoso','De Baja')  then 0
    when risk_score >= 70                    then 6
    when score_renovacion >= 50              then 12
    when score_renovacion >= 30              then 18
    else 999
  end                                        as months_to_renovation
from silver.dim_asset
order by months_to_renovation, risk_score desc;

comment on view gold.forecast is
  'Clasificación de renovación por reglas de negocio explicables. '
  'Sprint 4: reemplazar por output del modelo ML en silver.dim_asset.';

-- ── gold.park_quality ─────────────────────────────────────────
create or replace view gold.park_quality as
select
  component, weight, score,
  round(score * weight, 1) as contribution
from (
  select 'Calidad de datos' as component, 0.30 as weight,
    coalesce(round(avg(calidad_dato),1),0) as score
  from silver.dim_asset
  union all
  select 'Integridad serial', 0.25,
    round(100.0 * count(*) filter (where serial is not null) / nullif(count(*),0),1)
  from silver.dim_asset
  union all
  select 'Salud del parque', 0.20,
    round(100.0 * count(*) filter (where estado not in ('Defectuoso','De Baja')) / nullif(count(*),0),1)
  from silver.dim_asset
  union all
  select 'Riesgo renovación', 0.15,
    round(100.0 * count(*) filter (where coalesce(risk_score,0) < 70) / nullif(count(*),0),1)
  from silver.dim_asset
  union all
  select 'Cobertura cliente', 0.10,
    round(100.0 * count(*) filter (where cliente is not null) / nullif(count(*),0),1)
  from silver.dim_asset
) components;

-- ── Función: refrescar todos los Gold computed marts ──────────
-- Llamada al final del pipeline Silver tras cada ingesta.
create or replace function gold.refresh_all(p_snapshot_date date default now()::date)
returns text language plpgsql as $$
declare
  v_assets    integer;
  v_movements integer;
  v_qs        numeric;
  v_dg        numeric;
begin
  select count(*) into v_assets    from silver.dim_asset;
  select count(*) into v_movements from silver.fact_movements;
  select quality_score, dg_score
    into v_qs, v_dg
  from gold.governance_summary;

  -- Log the refresh in ops
  insert into ops.pipeline_runs (
    pipeline_name, status, snapshot_date,
    assets_processed, movements_processed,
    quality_score, dg_score, finished_at
  ) values (
    'gold_refresh', 'success', p_snapshot_date,
    v_assets, v_movements, v_qs, v_dg, now()
  );

  return format(
    'Gold refresh OK — %s activos, %s movimientos, QS=%.1f, DG=%.1f',
    v_assets, v_movements, v_qs, v_dg
  );
exception when others then
  insert into ops.pipeline_runs (pipeline_name, status, error_message, finished_at)
  values ('gold_refresh', 'failed', sqlerrm, now());
  raise;
end; $$;

comment on function gold.refresh_all is
  'Llama al final del pipeline Silver. '
  'Registra la ejecución en ops.pipeline_runs y retorna un resumen.';
