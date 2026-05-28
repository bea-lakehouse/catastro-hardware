{{ config(materialized='table', tags=['audit', 'marts']) }}

with sync_runs as (
  select
    run_id,
    source_type,
    source_name,
    status,
    started_at,
    finished_at,
    coalesce(finished_at, started_at) as run_ts
  from {{ source('raw', 'sync_runs') }}
  where status = 'SUCCESS'
),

google_sheet_runs as (
  select
    run_id,
    run_ts
  from sync_runs
  where source_type = 'google_sheets'
    and source_name = 'mtr'
),

google_sheet_run_pairs as (
  select
    curr.run_id as curr_run_id,
    curr.run_ts as curr_run_ts,
    prev.run_id as prev_run_id,
    prev.run_ts as prev_run_ts
  from (
    select
      run_id,
      run_ts,
      row_number() over (order by run_ts, run_id) as rn
    from google_sheet_runs
  ) curr
  join (
    select
      run_id,
      run_ts,
      row_number() over (order by run_ts, run_id) as rn
    from google_sheet_runs
  ) prev
    on prev.rn = curr.rn - 1
),

assigned_snapshot as (
  select
    id_equipo,
    cliente,
    persona_asignada,
    estado_equipo,
    localizacion,
    ciudad_comuna,
    fecha_asignacion,
    marca,
    modelo,
    run_id,
    row_number
  from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
),

assigned_snapshot_dedup as (
  select *
  from (
    select
      a.*,
      row_number() over (
        partition by a.run_id, a.id_equipo
        order by a.row_number
      ) as rn
    from assigned_snapshot a
    where a.id_equipo is not null
  ) x
  where rn = 1
),

assigned_pairwise as (
  select
    rp.curr_run_id,
    rp.curr_run_ts,
    rp.prev_run_id,
    rp.prev_run_ts,
    d.*
  from google_sheet_run_pairs rp
  join lateral (
    select
      coalesce(curr.id_equipo, prev.id_equipo) as id_equipo,
      prev.cliente as prev_cliente,
      curr.cliente as curr_cliente,
      prev.persona_asignada as prev_persona_asignada,
      curr.persona_asignada as curr_persona_asignada,
      prev.estado_equipo as prev_estado_equipo,
      curr.estado_equipo as curr_estado_equipo,
      prev.localizacion as prev_localizacion,
      curr.localizacion as curr_localizacion,
      prev.ciudad_comuna as prev_ciudad_comuna,
      curr.ciudad_comuna as curr_ciudad_comuna,
      prev.marca as prev_marca,
      curr.marca as curr_marca,
      prev.modelo as prev_modelo,
      curr.modelo as curr_modelo,
      prev.fecha_asignacion as prev_fecha_asignacion,
      curr.fecha_asignacion as curr_fecha_asignacion
    from (
      select *
      from assigned_snapshot_dedup
      where run_id = rp.prev_run_id
    ) prev
    full outer join (
      select *
      from assigned_snapshot_dedup
      where run_id = rp.curr_run_id
    ) curr
      on curr.id_equipo = prev.id_equipo
  ) d on true
  where d.id_equipo is not null
),

assigned_field_changes as (
  select
    id_equipo,
    c.campo_modificado,
    c.valor_anterior,
    c.valor_nuevo,
    curr_run_ts as fecha_cambio,
    'Google Sheets'::text as origen,
    'analytics.stg_mtr_google_sheet_equipos_asignados'::text as source_table,
    curr_run_id::text as source_run_id,
    'Google Sheets Sync'::text as actor,
    c.tipo_cambio,
    c.criticidad,
    c.confianza
  from assigned_pairwise p
  cross join lateral (
    values
      (
        'cliente'::text,
        prev_cliente::text,
        curr_cliente::text,
        'cambio_cliente'::text,
        'ALTA'::text,
        'ALTA'::text
      ),
      (
        'persona_asignada'::text,
        prev_persona_asignada::text,
        curr_persona_asignada::text,
        'cambio_persona'::text,
        'ALTA'::text,
        'ALTA'::text
      ),
      (
        'estado'::text,
        prev_estado_equipo::text,
        curr_estado_equipo::text,
        case
          when upper(coalesce(curr_estado_equipo, '')) like '%BAJA%' then 'salida_equipo'
          else 'cambio_estado'
        end::text,
        case
          when upper(coalesce(curr_estado_equipo, '')) like '%BAJA%' then 'CRITICA'
          else 'MEDIA'
        end::text,
        'ALTA'::text
      ),
      (
        'marca'::text,
        prev_marca::text,
        curr_marca::text,
        'inconsistencia_detectada'::text,
        'MEDIA'::text,
        'MEDIA'::text
      ),
      (
        'modelo'::text,
        prev_modelo::text,
        curr_modelo::text,
        'inconsistencia_detectada'::text,
        'MEDIA'::text,
        'MEDIA'::text
      ),
      (
        'ubicacion'::text,
        prev_localizacion::text,
        curr_localizacion::text,
        'inconsistencia_detectada'::text,
        'MEDIA'::text,
        'MEDIA'::text
      ),
      (
        'asignacion'::text,
        prev_fecha_asignacion::text,
        curr_fecha_asignacion::text,
        'cambio_persona'::text,
        'MEDIA'::text,
        'MEDIA'::text
      )
  ) as c(campo_modificado, valor_anterior, valor_nuevo, tipo_cambio, criticidad, confianza)
  where c.valor_anterior is distinct from c.valor_nuevo
),

available_snapshot as (
  select
    id_equipo,
    run_id,
    row_number
  from {{ ref('stg_mtr_google_sheet_equipos_disponibles') }}
  where id_equipo is not null
),

available_snapshot_dedup as (
  select *
  from (
    select
      a.*,
      row_number() over (
        partition by a.run_id, a.id_equipo
        order by a.row_number
      ) as rn
    from available_snapshot a
  ) x
  where rn = 1
),

available_pairwise as (
  select
    rp.curr_run_id,
    rp.curr_run_ts,
    d.*
  from google_sheet_run_pairs rp
  join lateral (
    select
      coalesce(curr.id_equipo, prev.id_equipo) as id_equipo,
      case when prev.id_equipo is not null then 'DISPONIBLE' else 'NO_DISPONIBLE' end as disponibilidad_anterior,
      case when curr.id_equipo is not null then 'DISPONIBLE' else 'NO_DISPONIBLE' end as disponibilidad_nueva
    from (
      select *
      from available_snapshot_dedup
      where run_id = rp.prev_run_id
    ) prev
    full outer join (
      select *
      from available_snapshot_dedup
      where run_id = rp.curr_run_id
    ) curr
      on curr.id_equipo = prev.id_equipo
  ) d on true
  where d.id_equipo is not null
),

available_changes as (
  select
    id_equipo,
    'disponibilidad'::text as campo_modificado,
    disponibilidad_anterior as valor_anterior,
    disponibilidad_nueva as valor_nuevo,
    curr_run_ts as fecha_cambio,
    'Google Sheets'::text as origen,
    'analytics.stg_mtr_google_sheet_equipos_disponibles'::text as source_table,
    curr_run_id::text as source_run_id,
    'Google Sheets Sync'::text as actor,
    'cambio_estado'::text as tipo_cambio,
    'MEDIA'::text as criticidad,
    'ALTA'::text as confianza
  from available_pairwise
  where disponibilidad_anterior is distinct from disponibilidad_nueva
),

mtr_events as (
  select
    id_equipo,
    fecha_evento::timestamptz as fecha_cambio,
    tipo_evento,
    persona,
    cliente,
    detalle,
    coalesce(ingreso_con_equipo, false) as ingreso_con_equipo,
    coalesce(es_movimiento_interno_persona_cliente, false) as es_movimiento_interno_persona_cliente
  from {{ ref('int_mtr_eventos_dedup_stats') }}
  where id_equipo is not null
    and tipo_evento in ('INGRESO', 'SALIDA')
),

mtr_event_audit as (
  select
    id_equipo,
    'estado'::text as campo_modificado,
    case
      when tipo_evento = 'INGRESO' and ingreso_con_equipo then 'SIN_ASIGNACION_VISIBLE'
      when tipo_evento = 'INGRESO' then 'SIN_EQUIPO'
      when tipo_evento = 'SALIDA' then 'ACTIVO'
      else null
    end::text as valor_anterior,
    case
      when tipo_evento = 'INGRESO' and ingreso_con_equipo then 'ASIGNADO'
      when tipo_evento = 'INGRESO' then 'INGRESADO'
      when tipo_evento = 'SALIDA' then 'BAJA'
      else upper(tipo_evento)
    end::text as valor_nuevo,
    fecha_cambio,
    'MTR'::text as origen,
    'analytics.int_mtr_eventos_dedup_stats'::text as source_table,
    null::text as source_run_id,
    'MTR'::text as actor,
    case
      when tipo_evento = 'INGRESO' then 'ingreso_equipo'
      when tipo_evento = 'SALIDA' then 'salida_equipo'
      else 'cambio_estado'
    end::text as tipo_cambio,
    case
      when tipo_evento = 'SALIDA' then 'CRITICA'
      else 'ALTA'
    end::text as criticidad,
    'ALTA'::text as confianza
  from mtr_events
  where not es_movimiento_interno_persona_cliente
),

jira_webhook_base as (
  select
    coalesce(nullif(trim(issue_id), ''), nullif(trim(issue_key), '')) as issue_key_fallback,
    id::text as event_row_id,
    equipo_id as id_equipo,
    coalesce(event_ts, inserted_at) as fecha_cambio,
    nullif(trim(status_name), '') as status_name,
    nullif(trim(summary), '') as summary,
    nullif(trim(priority_name), '') as priority_name,
    nullif(trim(raw_payload #>> '{issue,fields,assignee,displayName}'), '') as assignee_display_name,
    nullif(trim(raw_payload #>> '{issue,fields,reporter,displayName}'), '') as reporter_display_name
  from {{ ref('stg_jira_webhook_events') }}
  where coalesce(nullif(trim(issue_id), ''), nullif(trim(issue_key), '')) is not null
    and equipo_id is not null
),

jira_webhook_classified as (
  select
    *,
    case
      when lower(coalesce(status_name, '')) like '%cread%' or lower(coalesce(status_name, '')) like '%created%' then 'CREADO'
      when lower(coalesce(status_name, '')) like '%reserv%' then 'RESERVADO'
      when lower(coalesce(status_name, '')) like '%asign%' or lower(coalesce(status_name, '')) like '%assigned%' then 'ASIGNADO'
      when lower(coalesce(status_name, '')) like '%dispon%' or lower(coalesce(status_name, '')) like '%available%' then 'DISPONIBLE'
      when lower(coalesce(status_name, '')) like '%baja%' then 'BAJA'
      when lower(coalesce(status_name, '')) like '%resguard%' then 'RESGUARDO'
      when lower(coalesce(status_name, '')) like '%defect%' or lower(coalesce(status_name, '')) like '%repar%' then 'DEFECTUOSO'
      when lower(coalesce(status_name, '')) like '%obsole%' then 'OBSOLETO'
      when lower(coalesce(status_name, '')) like '%progres%' then 'EN_PROGRESO'
      else null
    end as estado_equipo_jira
  from jira_webhook_base
),

jira_webhook_ranked as (
  select
    *,
    lag(coalesce(estado_equipo_jira, status_name)) over (
      partition by issue_key_fallback
      order by fecha_cambio, event_row_id
    ) as prev_estado_jira,
    lag(assignee_display_name) over (
      partition by issue_key_fallback
      order by fecha_cambio, event_row_id
    ) as prev_assignee_display_name
  from jira_webhook_classified
),

jira_status_changes as (
  select
    id_equipo,
    'estado_jira'::text as campo_modificado,
    prev_estado_jira::text as valor_anterior,
    coalesce(estado_equipo_jira, status_name)::text as valor_nuevo,
    fecha_cambio,
    'Jira'::text as origen,
    'analytics.stg_jira_webhook_events'::text as source_table,
    null::text as source_run_id,
    coalesce(reporter_display_name, assignee_display_name, 'Jira')::text as actor,
    case
      when coalesce(estado_equipo_jira, status_name) = 'RESERVADO' then 'reserva_jira'
      when coalesce(estado_equipo_jira, status_name) = 'ASIGNADO' then 'asignacion_jira'
      else 'cambio_estado_jira'
    end::text as tipo_cambio,
    case
      when coalesce(estado_equipo_jira, status_name) in ('ASIGNADO', 'RESERVADO') then 'ALTA'
      else 'MEDIA'
    end::text as criticidad,
    'ALTA'::text as confianza
  from jira_webhook_ranked
  where prev_estado_jira is distinct from coalesce(estado_equipo_jira, status_name)
    and prev_estado_jira is not null
),

jira_assignee_changes as (
  select
    id_equipo,
    'asignacion'::text as campo_modificado,
    prev_assignee_display_name::text as valor_anterior,
    assignee_display_name::text as valor_nuevo,
    fecha_cambio,
    'Jira'::text as origen,
    'analytics.stg_jira_webhook_events'::text as source_table,
    null::text as source_run_id,
    coalesce(reporter_display_name, assignee_display_name, 'Jira')::text as actor,
    'asignacion_jira'::text as tipo_cambio,
    'MEDIA'::text as criticidad,
    'ALTA'::text as confianza
  from jira_webhook_ranked
  where prev_assignee_display_name is distinct from assignee_display_name
    and prev_assignee_display_name is not null
),

jira_snapshot_fallback as (
  select
    s.id_equipo,
    'estado_jira'::text as campo_modificado,
    null::text as valor_anterior,
    coalesce(s.estado_equipo_jira, s.board_bucket, s.status_name, 'CREADO')::text as valor_nuevo,
    s.created_at::timestamptz as fecha_cambio,
    'Jira'::text as origen,
    'analytics.stg_jira_issues'::text as source_table,
    null::text as source_run_id,
    coalesce(s.reporter_display_name, s.assignee_display_name, 'Jira')::text as actor,
    case
      when coalesce(s.estado_equipo_jira, s.board_bucket, s.status_name) = 'RESERVADO' then 'reserva_jira'
      when coalesce(s.estado_equipo_jira, s.board_bucket, s.status_name) = 'ASIGNADO' then 'asignacion_jira'
      else 'cambio_estado_jira'
    end::text as tipo_cambio,
    'MEDIA'::text as criticidad,
    'MEDIA'::text as confianza
  from {{ ref('stg_jira_issues') }} s
  where s.id_equipo is not null
    and s.created_at is not null
    and not exists (
      select 1
      from jira_webhook_base w
      where w.issue_key_fallback = s.issue_id
         or w.issue_key_fallback = s.issue_key
    )
),

repair_events as (
  select
    id_equipo,
    'estado'::text as campo_modificado,
    null::text as valor_anterior,
    'REPARADO'::text as valor_nuevo,
    fecha_evento::timestamptz as fecha_cambio,
    'Excel Reparados'::text as origen,
    'analytics.stg_reparaciones_excel'::text as source_table,
    null::text as source_run_id,
    coalesce(persona, 'Excel Reparados')::text as actor,
    'cambio_estado'::text as tipo_cambio,
    'MEDIA'::text as criticidad,
    'MEDIA'::text as confianza
  from {{ ref('stg_reparaciones_excel') }}
  where id_equipo is not null
),

timeline_conciliation as (
  select
    id_equipo,
    'origen'::text as campo_modificado,
    'MTR/Jira'::text as valor_anterior,
    'CONCILIADO'::text as valor_nuevo,
    fecha_evento::timestamptz as fecha_cambio,
    'Catastro'::text as origen,
    'analytics.mart_equipo_timeline'::text as source_table,
    null::text as source_run_id,
    'dbt'::text as actor,
    'conciliacion_mtr_jira'::text as tipo_cambio,
    'BAJA'::text as criticidad,
    'ALTA'::text as confianza
  from {{ ref('mart_equipo_timeline') }}
  where lower(coalesce(origen_evento, '')) = 'conciliado'
    and id_equipo is not null
),

reconciliation_findings as (
  select
    id_equipo,
    'origen'::text as campo_modificado,
    case
      when conciliacion_estado = 'CONCILIADO' then 'CONCILIADO'
      else null
    end::text as valor_anterior,
    conciliacion_estado::text as valor_nuevo,
    coalesce(
      greatest(jira_last_event_ts, mtr_last_event_at::timestamptz),
      jira_last_event_ts,
      mtr_last_event_at::timestamptz
    ) as fecha_cambio,
    'Catastro'::text as origen,
    'analytics.mart_mtr_jira_reconciliacion'::text as source_table,
    null::text as source_run_id,
    'dbt'::text as actor,
    'inconsistencia_detectada'::text as tipo_cambio,
    case
      when conciliacion_estado in ('JIRA_SIN_MATCH_MTR', 'MTR_SIN_MATCH_JIRA') then 'CRITICA'
      else 'ALTA'
    end::text as criticidad,
    'ALTA'::text as confianza
  from {{ ref('mart_mtr_jira_reconciliacion') }}
  where id_equipo is not null
    and (
      coalesce(flag_inconsistencia_mtr_jira, false)
      or coalesce(flag_jira_sin_match_mtr, false)
      or coalesce(flag_mtr_sin_match_jira, false)
      or coalesce(flag_reserva_jira_pendiente, false)
      or coalesce(flag_asignado_sin_respaldo_cruzado, false)
    )
),

unioned as (
  select * from assigned_field_changes
  union all
  select * from available_changes
  union all
  select * from mtr_event_audit
  union all
  select * from jira_status_changes
  union all
  select * from jira_assignee_changes
  union all
  select * from jira_snapshot_fallback
  union all
  select * from repair_events
  union all
  select * from timeline_conciliation
  union all
  select * from reconciliation_findings
),

final as (
  select
    (
      'AUD:' || md5(
        concat_ws(
          '|',
          coalesce(u.id_equipo, ''),
          coalesce(u.campo_modificado, ''),
          coalesce(u.valor_anterior, ''),
          coalesce(u.valor_nuevo, ''),
          coalesce(u.fecha_cambio::text, ''),
          coalesce(u.origen, ''),
          coalesce(u.source_table, ''),
          coalesce(u.source_run_id, ''),
          coalesce(u.tipo_cambio, '')
        )
      )
    )::text as audit_id,
    u.id_equipo,
    u.campo_modificado,
    u.valor_anterior,
    u.valor_nuevo,
    u.fecha_cambio,
    u.origen,
    u.source_table,
    u.source_run_id,
    u.actor,
    u.tipo_cambio,
    u.criticidad,
    u.confianza,
    current_timestamp as created_at
  from unioned u
  where u.id_equipo is not null
    and u.fecha_cambio is not null
),

deduped as (
  select *
  from (
    select
      f.*,
      row_number() over (
        partition by f.audit_id
        order by f.fecha_cambio desc, f.id_equipo asc
      ) as rn
    from final f
  ) x
  where rn = 1
)

select *
from deduped
