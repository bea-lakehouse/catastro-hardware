\echo '=== Validación mensual: MTR original vs UI/mart ==='
with meses as (
  select generate_series(date '2025-03-01', date_trunc('month', current_date)::date, interval '1 month')::date as mes
),
ingresos_mtr_original as (
  select
    date_trunc('month', fecha_evento)::date as mes,
    count(*)::int as ingresos_mtr_original
  from analytics.stg_mtr_google_sheet_ingresos
  where fecha_evento::date between date '2025-03-01' and current_date
  group by 1
),
salidas_mtr_original as (
  select
    date_trunc('month', fecha_evento)::date as mes,
    count(*)::int as salidas_mtr_original
  from analytics.stg_mtr_google_sheet_salidas
  where fecha_evento::date between date '2025-03-01' and current_date
  group by 1
),
ui as (
  select
    mes,
    ingresos_personas::int as ingresos_ui,
    salidas_personas::int as salidas_ui,
    coalesce(personas_resueltas_con_equipo, greatest(ingresos_personas - nuevos_sin_equipo, 0))::int as personas_resueltas_con_equipo,
    coalesce(coherencia_operacional_ingresos, false) as coherencia_operacional_ingresos,
    coalesce(estado_coherencia_operacional, 'REVISAR_SEMANTICA') as estado_coherencia_operacional
  from analytics.mart_estadistica_movimientos_mes_v2
  where mes between date '2025-03-01' and date_trunc('month', current_date)::date
)
select
  m.mes,
  coalesce(i.ingresos_mtr_original, 0) as ingresos_mtr_original,
  coalesce(u.ingresos_ui, 0) as ingresos_ui,
  coalesce(u.ingresos_ui, 0) - coalesce(i.ingresos_mtr_original, 0) as delta_ingresos,
  coalesce(s.salidas_mtr_original, 0) as salidas_mtr_original,
  coalesce(u.salidas_ui, 0) as salidas_ui,
  coalesce(u.salidas_ui, 0) - coalesce(s.salidas_mtr_original, 0) as delta_salidas,
  coalesce(u.personas_resueltas_con_equipo, 0) as personas_resueltas_con_equipo,
  coalesce(u.coherencia_operacional_ingresos, false) as coherencia_operacional_ingresos,
  coalesce(u.estado_coherencia_operacional, 'REVISAR_SEMANTICA') as estado_coherencia_operacional,
  case
    when coalesce(u.ingresos_ui, 0) = coalesce(i.ingresos_mtr_original, 0)
     and coalesce(u.salidas_ui, 0) = coalesce(s.salidas_mtr_original, 0)
     and coalesce(u.coherencia_operacional_ingresos, false)
      then 'VALIDADO'
    else 'PENDIENTE_CONCILIACION'
  end as estado_validacion
from meses m
left join ingresos_mtr_original i
  on i.mes = m.mes
left join salidas_mtr_original s
  on s.mes = m.mes
left join ui u
  on u.mes = m.mes
order by m.mes;
