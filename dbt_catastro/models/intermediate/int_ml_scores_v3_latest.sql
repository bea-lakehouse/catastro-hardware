{{ config(materialized='view') }}

{#
  ML v3 calculado en forma segura sobre el último snapshot materializado de
  analytics.mart_equipos_estado_actual. Esto evita romper v2 y mantiene a v3
  desacoplado del pipeline legacy.
#}

{% set mart_rel = adapter.get_relation(
    database=target.database,
    schema='analytics',
    identifier='mart_equipos_estado_actual'
) %}

with base as (

  {% if mart_rel is not none %}

    select
      upper(id_equipo)::text as entity_id,
      coalesce(flag_renovar_regla, flag_renovar, false) as flag_renovar_v3,
      coalesce(flag_dar_baja_regla, false) as flag_dar_baja_v3,
      coalesce(flag_sin_asignacion, false) as flag_sin_asignacion_v3,
      coalesce(flag_rotacion_alta, false) as flag_rotacion_alta_v3,
      coalesce(jira_open_count, 0) as jira_open_count,
      upper(coalesce(jira_board_bucket, '')) as jira_board_bucket,
      lower(coalesce(presion_nivel, 'baja')) as presion_nivel,
      upper(coalesce(alertas_severidad, 'INFO')) as alertas_severidad,
      upper(coalesce(estado_operativo, 'DISPONIBLE')) as estado_operativo,
      coalesce(dias_a_vencer, 999999) as dias_a_vencer,
      coalesce(ml_score, 0)::double precision as ml_score_v2,
      coalesce(ml_risk_level, 'Baja')::text as ml_risk_level_v2,
      current_timestamp as created_at
    from {{ mart_rel }}
    where coalesce(es_activo_operativo, upper(coalesce(estado_operativo, 'ACTIVO')) <> 'BAJA')

  {% else %}

    select
      null::text as entity_id,
      null::boolean as flag_renovar_v3,
      null::boolean as flag_dar_baja_v3,
      null::boolean as flag_sin_asignacion_v3,
      null::boolean as flag_rotacion_alta_v3,
      null::int as jira_open_count,
      null::text as jira_board_bucket,
      null::text as presion_nivel,
      null::text as alertas_severidad,
      null::text as estado_operativo,
      null::int as dias_a_vencer,
      null::double precision as ml_score_v2,
      null::text as ml_risk_level_v2,
      null::timestamp as created_at
    where false

  {% endif %}

),

scored as (
  select
    *,
    least(
      10,
      greatest(
        0,
        (case when coalesce(flag_renovar_v3, false) then 4 else 0 end)
        + (case when coalesce(flag_dar_baja_v3, false) then 3 else 0 end)
        + (case when coalesce(flag_sin_asignacion_v3, false) then 3 else 0 end)
        + (case when coalesce(flag_rotacion_alta_v3, false) then 2 else 0 end)
        + (case when jira_open_count > 0 then least(2, jira_open_count) else 0 end)
        + (case
            when jira_board_bucket in ('POR_RECUPERAR', 'DEFECTUOSO', 'OBSOLETO', 'BAJA') then 2
            when jira_board_bucket in ('CREADO', 'RESERVADO', 'EN_PROGRESO', 'ASIGNADO', 'RESGUARDO') then 1
            else 0
          end)
        + (case
            when presion_nivel = 'alta' then 2
            when presion_nivel = 'media' then 1
            else 0
          end)
        + (case
            when alertas_severidad = 'CRITICAL' then 2
            when alertas_severidad = 'WARN' then 1
            else 0
          end)
        + (case when estado_operativo in ('STAND_BY', 'DISPONIBLE') then 1 else 0 end)
      )
    )::double precision as score
  from base
),

final as (
  select
    entity_id,
    score,
    case
      when score >= 8 then 'Alta'
      when score >= 5 then 'Media'
      else 'Baja'
    end as risk_level,
    case
      when coalesce(flag_renovar_v3, false) and dias_a_vencer < 0 then 'RENOVACION_VENCIDA'
      when coalesce(flag_renovar_v3, false) then 'RENOVAR'
      when coalesce(flag_dar_baja_v3, false) then 'DAR_BAJA'
      when coalesce(flag_sin_asignacion_v3, false) then 'SIN_ASIGNACION'
      when jira_board_bucket = 'POR_RECUPERAR' then 'POR_RECUPERAR'
      when jira_board_bucket in ('DEFECTUOSO', 'OBSOLETO', 'BAJA') then jira_board_bucket
      when jira_open_count > 0 then 'JIRA_ABIERTO'
      when coalesce(flag_rotacion_alta_v3, false) then 'ROTACION_ALTA'
      else 'MONITOREO'
    end as alert_code,
    created_at,
    ('/ml-v2/explain/' || entity_id)::text as link_path,
    case
      when coalesce(flag_renovar_v3, false) and dias_a_vencer < 0 then 'Renovación vencida'
      when coalesce(flag_renovar_v3, false) then 'Renovación por política'
      when coalesce(flag_dar_baja_v3, false) then 'Salida de modelo legacy'
      when coalesce(flag_sin_asignacion_v3, false) then 'Equipo sin asignación'
      when jira_board_bucket = 'POR_RECUPERAR' then 'Equipo por recuperar'
      when jira_board_bucket in ('DEFECTUOSO', 'OBSOLETO', 'BAJA') then 'Jira crítico'
      when jira_open_count > 0 then 'Tickets Jira abiertos'
      when coalesce(flag_rotacion_alta_v3, false) then 'Rotación alta'
      else 'Monitoreo base'
    end as main_driver,
    (
      (case when coalesce(flag_renovar_v3, false) then jsonb_build_array(jsonb_build_object('code', 'RENOVAR', 'points', 4, 'label', case when dias_a_vencer < 0 then 'Renovación vencida' else 'Próximo a renovar' end)) else '[]'::jsonb end)
      || (case when coalesce(flag_dar_baja_v3, false) then jsonb_build_array(jsonb_build_object('code', 'DAR_BAJA', 'points', 3, 'label', 'Modelo legacy de salida')) else '[]'::jsonb end)
      || (case when coalesce(flag_sin_asignacion_v3, false) then jsonb_build_array(jsonb_build_object('code', 'SIN_ASIGNACION', 'points', 3, 'label', 'Sin asignación operativa')) else '[]'::jsonb end)
      || (case when coalesce(flag_rotacion_alta_v3, false) then jsonb_build_array(jsonb_build_object('code', 'ROTACION_ALTA', 'points', 2, 'label', 'Rotación alta 12m')) else '[]'::jsonb end)
      || (case when jira_open_count > 0 then jsonb_build_array(jsonb_build_object('code', 'JIRA', 'points', least(2, jira_open_count), 'label', 'Issues Jira abiertos')) else '[]'::jsonb end)
      || (case when jira_board_bucket in ('POR_RECUPERAR', 'DEFECTUOSO', 'OBSOLETO', 'BAJA') then jsonb_build_array(jsonb_build_object('code', jira_board_bucket, 'points', 2, 'label', 'Bucket Jira crítico')) else '[]'::jsonb end)
      || (case when presion_nivel in ('alta', 'media') then jsonb_build_array(jsonb_build_object('code', upper(presion_nivel), 'points', case when presion_nivel = 'alta' then 2 else 1 end, 'label', 'Presión de stock')) else '[]'::jsonb end)
    ) as drivers_json,
    case
      when score >= 8 then 'Riesgo alto por acumulación de señales operativas, Jira y política.'
      when score >= 5 then 'Riesgo medio por combinación de señales vigentes que requieren seguimiento.'
      else 'Riesgo bajo; mantener monitoreo operativo.'
    end as risk_reason,
    'v3'::text as model_version,
    true::boolean as ml_source_available_v3,
    'analytics.mart_equipos_estado_actual'::text as ml_source_name_v3,
    ml_score_v2,
    ml_risk_level_v2
  from scored
)

select * from final
