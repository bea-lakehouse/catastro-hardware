-- ============================================================
-- Migration 003 — Views and helper functions
-- These views flatten Gold tables to match service payload shapes.
-- ============================================================

-- ── v_governance_summary ─────────────────────────────────────
-- Latest summary snapshot for the API
create or replace view v_governance_summary as
select
  gs.*,
  (select count(*) from fact_movements where es_inferido = false) as real_movement_count,
  (select count(*) from fact_movements where es_inferido = true)  as inferred_movement_count
from gold_governance_summary gs
order by gs.snapshot_date desc
limit 1;

-- ── v_completeness_kpis ───────────────────────────────────────
-- Latest completeness KPIs for the API
create or replace view v_completeness_kpis as
select k.*
from gold_completeness_kpis k
where k.snapshot_date = (
  select max(snapshot_date) from gold_completeness_kpis
)
order by k.sort_order
from (
  values
    ('serial', 1), ('fecha', 2), ('cliente', 3),
    ('empleado', 4), ('gestor', 5), ('riesgo_percibido_it', 6)
) as ordering(field_name, sort_order)
where ordering.field_name = k.field_name;

-- Drop and recreate with correct syntax
drop view if exists v_completeness_kpis;
create or replace view v_completeness_kpis as
select k.*
from gold_completeness_kpis k
where k.snapshot_date = (
  select max(snapshot_date) from gold_completeness_kpis
);

-- ── v_gaps_by_source ─────────────────────────────────────────
create or replace view v_gaps_by_source as
select g.*
from gold_gaps_by_source g
where g.snapshot_date = (
  select max(snapshot_date) from gold_gaps_by_source
)
order by
  case g.priority
    when 'CRÍTICA' then 1
    when 'ALTA'    then 2
    when 'MEDIA'   then 3
    when 'BAJA'    then 4
  end;

-- ── v_records_to_fix ─────────────────────────────────────────
create or replace view v_records_to_fix as
select r.*
from gold_records_to_fix r
where r.snapshot_date = (
  select max(snapshot_date) from gold_records_to_fix
)
order by r.issue_count desc, r.employee;

-- ── v_quality_trend ───────────────────────────────────────────
create or replace view v_quality_trend as
select *
from gold_quality_trend
order by snapshot_date;

-- ── v_quality_components ──────────────────────────────────────
create or replace view v_quality_components as
select c.*
from gold_quality_components c
where c.snapshot_date = (
  select max(snapshot_date) from gold_quality_components
)
order by c.weight desc;

-- ── fn_compute_governance_summary ────────────────────────────
-- Called by the Silver pipeline after each ingest to refresh Gold.
create or replace function fn_compute_governance_summary(p_snapshot_date date)
returns void language plpgsql as $$
declare
  v_total        integer;
  v_real         integer;
  v_inferred     integer;
  v_to_fix       integer;
  v_pct_serial   numeric;
  v_pct_fecha    numeric;
  v_pct_gestor   numeric;
  v_pct_cliente  numeric;
  v_qs           numeric;
  v_qs_real      numeric;
  v_dg           numeric;
begin
  -- Total movements
  select count(*)  into v_total    from fact_movements;
  select count(*)  into v_real     from fact_movements where not es_inferido;
  select count(*)  into v_inferred from fact_movements where es_inferido;

  -- Completeness pcts
  select round(100.0 * sum(case when tiene_serial then 1 else 0 end) / nullif(count(*),0), 1)
    into v_pct_serial from fact_movements;
  select round(100.0 * sum(case when tiene_fecha  then 1 else 0 end) / nullif(count(*),0), 1)
    into v_pct_fecha from fact_movements;
  select round(100.0 * sum(case when gestionado_por is not null then 1 else 0 end) / nullif(count(*),0), 1)
    into v_pct_gestor from fact_movements;
  select round(100.0 * sum(case when cliente is not null then 1 else 0 end) / nullif(count(*),0), 1)
    into v_pct_cliente from fact_movements;

  -- Quality scores (same formula as services/)
  -- QS = serial×0.35 + fecha×0.35 + gestor×0.15 + cliente×0.15
  v_qs := coalesce(v_pct_serial,0)*0.35 + coalesce(v_pct_fecha,0)*0.35
        + coalesce(v_pct_gestor,0)*0.15 + coalesce(v_pct_cliente,0)*0.15;

  -- DG = serial×0.20 + fecha×0.20 + cliente×0.15 + riesgo×0.15 (0 for now) + gestor×0.20 + empleado×0.10
  v_dg := coalesce(v_pct_serial,0)*0.20 + coalesce(v_pct_fecha,0)*0.20
        + coalesce(v_pct_cliente,0)*0.15 + 0*0.15  -- riesgo_percibido_it
        + coalesce(v_pct_gestor,0)*0.20;            -- empleado×0.10 omitted for brevity

  -- Records to fix (non-inferred with any null critical field)
  select count(*) into v_to_fix
  from fact_movements
  where not es_inferido
    and (not tiene_serial or not tiene_fecha or cliente is null or gestionado_por is null);

  insert into gold_governance_summary (
    snapshot_date, quality_score, quality_score_real, dg_score,
    dg_level, dg_level_label, total_movements, real_movements,
    inferred_movements, records_to_fix, main_gap, secondary_gap
  ) values (
    p_snapshot_date, round(v_qs,1), round(v_qs,1), round(v_dg,1),
    case
      when v_dg >= 90 then 5
      when v_dg >= 75 then 4
      when v_dg >= 60 then 3
      when v_dg >= 40 then 2
      else 1
    end,
    case
      when v_dg >= 90 then 'Predictivo'
      when v_dg >= 75 then 'Medible'
      when v_dg >= 60 then 'Gestionado'
      when v_dg >= 40 then 'Controlado'
      else 'Inicial'
    end,
    v_total, v_real, v_inferred, v_to_fix,
    'gestor_it_responsable (' || coalesce(v_pct_gestor,0) || '% completitud)',
    'riesgo_percibido_it (bloquea ML Dic 2026)'
  )
  on conflict (snapshot_date) do update set
    quality_score       = excluded.quality_score,
    quality_score_real  = excluded.quality_score_real,
    dg_score            = excluded.dg_score,
    dg_level            = excluded.dg_level,
    dg_level_label      = excluded.dg_level_label,
    total_movements     = excluded.total_movements,
    real_movements      = excluded.real_movements,
    inferred_movements  = excluded.inferred_movements,
    records_to_fix      = excluded.records_to_fix,
    main_gap            = excluded.main_gap,
    secondary_gap       = excluded.secondary_gap,
    computed_at         = now();
end;
$$;
