{{ config(materialized='view', tags=['mart','kpi','acciones','movimientos','comite']) }}

with mov as (
  select
    mes::date as mes,
    stock_activo::int as stock_activo,
    movimientos_total::int as movimientos_total
  from analytics.mart_estadistica_movimientos_mes
  where mes >= date_trunc('year', current_date)::date
),

acciones_agg as (
  -- total acciones por prioridad
  select
    prioridad::text as prioridad,
    count(*)::int as acciones_registros,
    sum(total)::int as acciones_total
  from analytics.mart_alertas_acciones
  group by 1
),

acciones_alta as (
  select
    coalesce(max(acciones_total), 0)::int as acciones_criticas
  from acciones_agg
  where prioridad = 'Alta'
),

ml as (
  select
    count(*) filter (where ml_risk_level = 'Alta')::int as ml_alta_total,
    count(*) filter (where ml_risk_level = 'Media')::int as ml_media_total,
    count(*) filter (where ml_risk_level = 'Baja')::int as ml_baja_total,
    max(ml_model_version)::text as ml_model_version,
    max(ml_model_run_at)::timestamp as ml_model_run_at
  from {{ ref('int_ml_scores_best_latest') }}
),

base as (
  select
    m.mes,
    m.stock_activo,
    m.movimientos_total,
    a.acciones_criticas,
    ml.ml_alta_total,
    ml.ml_media_total,
    ml.ml_baja_total,
    ml.ml_model_version,
    ml.ml_model_run_at,
    round(
      case when a.acciones_criticas > 0
        then (m.movimientos_total::numeric / a.acciones_criticas) * 100
      end
    ,2) as pct_cobertura_riesgo
  from mov m
  cross join acciones_alta a
  cross join ml
),

final as (
  select
    *,
    case
      when acciones_criticas > 0 and movimientos_total = 0
        then '🚨 Riesgo crítico sin gestión este mes.'
      when pct_cobertura_riesgo is null
        then 'ℹ️ Sin acciones críticas definidas (o sin data).'
      when pct_cobertura_riesgo < 10
        then '🔴 Se gestionó menos del 10% del riesgo crítico.'
      when pct_cobertura_riesgo between 10 and 30
        then '🟠 Gestión parcial del riesgo crítico.'
      else
        '🟢 Buen nivel de gestión del riesgo.'
    end as insight_riesgo,

    -- COPY "listo para comité" (título + resumen + recomendación)
    format(
      'Mes %s | Stock %s | Mov %s | Acciones críticas %s | Cobertura %s%%',
      to_char(mes,'YYYY-MM'),
      stock_activo,
      movimientos_total,
      acciones_criticas,
      coalesce(pct_cobertura_riesgo::text,'n/a')
    ) as comite_titulo,

    format(
      'Se registran %s acciones críticas (Alta). Este mes se ejecutaron %s movimientos. Cobertura del riesgo: %s%%. ML driver: Altos=%s (modelo %s).',
      acciones_criticas,
      movimientos_total,
      coalesce(pct_cobertura_riesgo::text,'n/a'),
      ml_alta_total,
      coalesce(ml_model_version,'n/a')
    ) as comite_resumen,

    case
      when acciones_criticas > 0 and movimientos_total = 0
        then 'Recomendación: activar plan de mitigación inmediato (priorizar renovaciones y casos sin asignación).'
      when pct_cobertura_riesgo < 10
        then 'Recomendación: aumentar capacidad de ejecución (objetivo mínimo 10–30% cobertura mensual).'
      when pct_cobertura_riesgo between 10 and 30
        then 'Recomendación: sostener ritmo y focalizar en top drivers ML (rotación/antigüedad/stock).'
      else
        'Recomendación: mantener operación y monitorear variaciones del mix.'
    end as comite_recomendacion

  from base
)

select * from final
order by mes asc
