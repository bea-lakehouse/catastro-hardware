{{ config(materialized='table', tags=['operacion', 'marts']) }}

with base as (
  select
    r.id_equipo,
    r.jira_issue_key_top as jira_issue_key,
    r.jira_status_name_top as jira_status_name,
    r.jira_board_bucket_top as jira_board_bucket,
    coalesce(r.jira_open_count, 0) as jira_open_count,
    r.jira_days_open_max,
    r.jira_last_open_event_ts,
    r.mtr_last_event_at,
    r.mtr_last_event_type,
    e.estado_operativo,
    e.flag_renovar
  from {{ ref('mart_mtr_jira_reconciliacion') }} r
  left join {{ ref('mart_equipos_estado_actual') }} e
    on e.id_equipo = r.id_equipo
),

final as (
  select
    id_equipo,
    jira_issue_key,
    jira_status_name,
    jira_board_bucket,
    jira_open_count,
    jira_days_open_max,
    case
      when jira_open_count > 0 then 7
      when upper(coalesce(estado_operativo, '')) in ('DISPONIBLE', 'STAND_BY') then 90
      else 30
    end as sla_objetivo_dias,
    case
      when jira_open_count > 0 and coalesce(jira_days_open_max, 0) > 7 then 'VENCIDO'
      when jira_open_count > 0 then 'EN_PLAZO'
      when mtr_last_event_at is not null and (current_date - mtr_last_event_at::date) > 90 then 'OBSERVACION'
      when coalesce(flag_renovar, false) then 'OBSERVACION'
      else 'SIN_ALERTA'
    end as sla_estado,
    (
      jira_open_count > 0
      or (mtr_last_event_at is not null and (current_date - mtr_last_event_at::date) > 90)
      or coalesce(flag_renovar, false)
    ) as backlog_operativo,
    mtr_last_event_at as fecha_ultimo_movimiento,
    case
      when mtr_last_event_at is not null then (current_date - mtr_last_event_at::date)::int
      else null
    end as dias_desde_ultimo_movimiento,
    jira_last_open_event_ts as fecha_ultima_actividad_jira,
    greatest(
      coalesce(jira_days_open_max, 0),
      coalesce((current_date - mtr_last_event_at::date)::int, 0)
    ) as aging_operativo_dias,
    case
      when greatest(coalesce(jira_days_open_max, 0), coalesce((current_date - mtr_last_event_at::date)::int, 0)) >= 91 then '91+d'
      when greatest(coalesce(jira_days_open_max, 0), coalesce((current_date - mtr_last_event_at::date)::int, 0)) >= 31 then '31-90d'
      when greatest(coalesce(jira_days_open_max, 0), coalesce((current_date - mtr_last_event_at::date)::int, 0)) >= 8 then '8-30d'
      when greatest(coalesce(jira_days_open_max, 0), coalesce((current_date - mtr_last_event_at::date)::int, 0)) >= 1 then '1-7d'
      else '0d'
    end as aging_bucket,
    current_timestamp as created_at
  from base
)

select * from final
