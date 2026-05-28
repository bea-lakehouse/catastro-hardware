{{ config(materialized='table', tags=['operacion', 'marts']) }}

with audit_rollup as (
  select
    id_equipo,
    count(*) filter (
      where fecha_cambio >= (current_timestamp - interval '30 days')
    )::int as cambios_auditados_30d,
    max(fecha_cambio) as ultimo_cambio_auditado
  from {{ ref('mart_equipo_audit_log') }}
  group by 1
),

base as (
  select
    r.id_equipo,
    r.conciliacion_estado,
    r.origen_principal,
    coalesce(r.in_mtr, false) as in_mtr,
    coalesce(r.in_jira, false) as in_jira,
    coalesce(r.flag_inconsistencia_mtr_jira, false) as flag_inconsistencia_mtr_jira,
    coalesce(r.flag_jira_sin_match_mtr, false) as flag_jira_sin_match_mtr,
    coalesce(r.flag_mtr_sin_match_jira, false) as flag_mtr_sin_match_jira,
    coalesce(r.flag_estado_distinto, false) as flag_estado_distinto,
    coalesce(r.flag_creado_jira_sin_ingreso_mtr, false) as flag_creado_jira_sin_ingreso_mtr,
    coalesce(r.flag_reservado_jira_asignado_mtr, false) as flag_reservado_jira_asignado_mtr,
    coalesce(r.flag_asignado_jira_disponible_mtr, false) as flag_asignado_jira_disponible_mtr,
    coalesce(a.cambios_auditados_30d, 0) as cambios_auditados_30d,
    a.ultimo_cambio_auditado
  from {{ ref('mart_mtr_jira_reconciliacion') }} r
  left join audit_rollup a
    on a.id_equipo = r.id_equipo
),

final as (
  select
    id_equipo,
    conciliacion_estado,
    origen_principal,
    case
      when in_mtr and in_jira then 2
      when in_mtr or in_jira then 1
      else 0
    end as fuentes_validas,
    case
      when flag_inconsistencia_mtr_jira then 'CRITICA'
      when flag_jira_sin_match_mtr or flag_mtr_sin_match_jira or flag_estado_distinto then 'BAJA'
      when in_mtr and in_jira then 'ALTA'
      when in_mtr or in_jira then 'MEDIA'
      else 'BAJA'
    end as confianza_dato,
    case
      when flag_inconsistencia_mtr_jira then 10
      when flag_jira_sin_match_mtr or flag_mtr_sin_match_jira or flag_estado_distinto then 40
      when in_mtr and in_jira then 100
      when in_mtr or in_jira then 70
      else 25
    end as confianza_score,
    case
      when flag_inconsistencia_mtr_jira then 'Conflicto operativo entre MTR y Jira; requiere conciliacion humana.'
      when flag_jira_sin_match_mtr then 'Jira muestra el equipo sin respaldo operativo en MTR.'
      when flag_mtr_sin_match_jira then 'MTR muestra el equipo sin trazabilidad administrativa en Jira.'
      when flag_estado_distinto then 'Las dos fuentes existen, pero no coinciden en el workflow vigente.'
      when in_mtr and in_jira then 'Equipo conciliado entre fuente fisica y workflow administrativo.'
      when in_mtr then 'Solo MTR entrega una fuente valida en este momento.'
      when in_jira then 'Solo Jira entrega una fuente valida en este momento.'
      else 'No hay fuentes suficientes para confiar en el dato.'
    end as detalle_confianza,
    cambios_auditados_30d,
    ultimo_cambio_auditado,
    current_timestamp as created_at
  from base
)

select * from final
