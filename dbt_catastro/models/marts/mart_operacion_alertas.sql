{{ config(materialized='table', tags=['operacion', 'marts']) }}

with audit_rollup as (
  select
    id_equipo,
    count(*) filter (
      where fecha_cambio >= (current_timestamp - interval '30 days')
    )::int as cambios_30d,
    max(fecha_cambio) as ultimo_cambio_auditado
  from {{ ref('mart_equipo_audit_log') }}
  group by 1
),

timeline_last as (
  select
    id_equipo,
    fecha_evento as timeline_last_event_at,
    tipo_evento as timeline_last_event_type,
    detalle as timeline_last_detalle
  from (
    select
      t.*,
      row_number() over (
        partition by t.id_equipo
        order by t.fecha_evento desc, t.tipo_evento desc
      ) as rn
    from {{ ref('mart_timeline_eventos') }} t
  ) x
  where rn = 1
),

jira_issue_latest as (
  select
    issue_id,
    issue_key,
    id_equipo,
    summary,
    status_name,
    status_category_key,
    reporter_display_name,
    created_at,
    updated_at,
    status_category_changed_at
  from (
    select
      j.*,
      row_number() over (
        partition by j.issue_id
        order by coalesce(j.updated_at, j.inserted_at, j.created_at) desc, j.inserted_at desc
      ) as rn
    from {{ ref('stg_jira_issues') }} j
    where j.id_equipo is not null
  ) x
  where rn = 1
),

jira_issue_open as (
  select
    issue_id,
    issue_key,
    id_equipo,
    summary,
    status_name,
    reporter_display_name,
    coalesce(status_category_changed_at, created_at, updated_at) as opened_at,
    greatest(
      0,
      (current_date - coalesce(status_category_changed_at::date, created_at::date, updated_at::date, current_date))
    )::int as dias_abierta_issue
  from jira_issue_latest
  where lower(coalesce(status_category_key, '')) <> 'done'
),

jira_issue_top as (
  select
    id_equipo,
    issue_key as jira_issue_key_top,
    summary as jira_issue_summary_top,
    status_name as jira_issue_status_top,
    reporter_display_name as jira_reporter_top,
    opened_at as jira_issue_opened_at_top,
    dias_abierta_issue as jira_issue_days_open_top
  from (
    select
      j.*,
      row_number() over (
        partition by j.id_equipo
        order by j.dias_abierta_issue desc, j.issue_key asc
      ) as rn
    from jira_issue_open j
  ) x
  where rn = 1
),

estado as (
  select
    id_equipo,
    estado_operativo,
    cliente,
    marca,
    modelo,
    localizacion,
    tipo_colaborador,
    motivo_politica,
    last_event_date,
    last_event_type,
    last_event_persona,
    fecha_vencimiento_renovacion,
    dias_a_vencer,
    flag_renovar,
    jira_open_count,
    jira_issue_key,
    jira_status_name
  from {{ ref('mart_equipos_estado_actual') }}
),

recon as (
  select * from {{ ref('mart_mtr_jira_reconciliacion') }}
),

confianza as (
  select
    id_equipo,
    confianza_dato
  from {{ ref('mart_confianza_dato') }}
),

sla as (
  select
    id_equipo,
    jira_days_open_max,
    fecha_ultimo_movimiento,
    dias_desde_ultimo_movimiento
  from {{ ref('mart_operacion_sla') }}
),

universe as (
  select id_equipo from estado
  union
  select id_equipo from recon
  union
  select id_equipo from audit_rollup
  union
  select id_equipo from timeline_last
  union
  select id_equipo from jira_issue_top
),

base as (
  select
    u.id_equipo,
    e.estado_operativo,
    e.cliente,
    e.marca,
    e.modelo,
    e.localizacion,
    e.tipo_colaborador,
    e.motivo_politica,
    e.last_event_date,
    e.last_event_type,
    e.fecha_vencimiento_renovacion,
    e.dias_a_vencer,
    e.flag_renovar,
    e.jira_open_count,
    e.jira_issue_key,
    e.jira_status_name,
    r.conciliacion_estado,
    r.origen_principal,
    r.persona_asignada,
    r.mtr_estado_operativo,
    r.mtr_last_event_at,
    r.mtr_last_event_type,
    r.mtr_last_ingreso_at,
    r.mtr_last_salida_at,
    r.jira_issue_key_top,
    r.jira_status_name_top,
    r.jira_board_bucket_top,
    r.jira_last_event_ts,
    r.flag_jira_sin_match_mtr,
    r.flag_mtr_sin_match_jira,
    r.flag_reservado_jira_asignado_mtr,
    r.flag_asignado_jira_disponible_mtr,
    r.flag_creado_jira_sin_ingreso_mtr,
    r.flag_inconsistencia_mtr_jira,
    coalesce(a.cambios_30d, 0) as cambios_30d,
    a.ultimo_cambio_auditado,
    e.last_event_persona,
    t.timeline_last_event_at,
    t.timeline_last_event_type,
    t.timeline_last_detalle,
    c.confianza_dato,
    s.jira_days_open_max,
    s.fecha_ultimo_movimiento,
    s.dias_desde_ultimo_movimiento,
    jt.jira_issue_key_top as jira_issue_key_open,
    jt.jira_issue_summary_top,
    jt.jira_issue_status_top,
    jt.jira_reporter_top,
    jt.jira_issue_opened_at_top,
    jt.jira_issue_days_open_top
  from universe u
  left join estado e
    on e.id_equipo = u.id_equipo
  left join recon r
    on r.id_equipo = u.id_equipo
  left join audit_rollup a
    on a.id_equipo = u.id_equipo
  left join timeline_last t
    on t.id_equipo = u.id_equipo
  left join confianza c
    on c.id_equipo = u.id_equipo
  left join sla s
    on s.id_equipo = u.id_equipo
  left join jira_issue_top jt
    on jt.id_equipo = u.id_equipo
),

equipo_asignado_sin_persona as (
  select
    md5(concat_ws('|', 'equipo_asignado_sin_persona', id_equipo)) as alert_id,
    id_equipo,
    'equipo_asignado_sin_persona'::text as tipo_alerta,
    'Equipo asignado sin persona'::text as titulo,
    format('El equipo %s figura asignado, pero no tiene persona responsable visible en la capa operativa.', id_equipo) as descripcion,
    'ALTA'::text as criticidad,
    'MTR'::text as origen,
    'analytics.mart_equipos_estado_actual'::text as fuente_principal,
    concat(
      'estado_operativo=', coalesce(estado_operativo, 'SIN_ESTADO'),
      '; persona_asignada=', coalesce(nullif(trim(coalesce(persona_asignada, '')), ''), '(vacia)')
    ) as evidencia,
    'Validar la asignacion en MTR y completar la persona responsable antes de seguir operando el equipo.'::text as accion_sugerida,
    coalesce(mtr_last_event_at, timeline_last_event_at, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(mtr_last_event_at::date, timeline_last_event_at::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'MEDIA') as confianza_dato
  from base
  where upper(coalesce(estado_operativo, '')) = 'ASIGNADO'
    and nullif(trim(coalesce(persona_asignada, '')), '') is null
),

jira_asignado_mtr_disponible as (
  select
    md5(concat_ws('|', 'jira_asignado_mtr_disponible', id_equipo)) as alert_id,
    id_equipo,
    'jira_asignado_mtr_disponible'::text as tipo_alerta,
    'Jira asignado, MTR disponible'::text as titulo,
    format('Jira mantiene %s como asignado, pero MTR lo muestra disponible o en stand by.', id_equipo) as descripcion,
    'ALTA'::text as criticidad,
    'MTR/Jira'::text as origen,
    'analytics.mart_mtr_jira_reconciliacion'::text as fuente_principal,
    concat(
      'jira_estado=', coalesce(jira_status_name_top, jira_status_name, 'SIN_ESTADO'),
      '; mtr_estado=', coalesce(mtr_estado_operativo, estado_operativo, 'SIN_ESTADO')
    ) as evidencia,
    'Revisar si el workflow Jira quedo atrasado o si falta reflejar un movimiento real en MTR.'::text as accion_sugerida,
    coalesce(jira_last_event_ts, mtr_last_event_at, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(jira_last_event_ts::date, mtr_last_event_at::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'BAJA') as confianza_dato
  from base
  where coalesce(flag_asignado_jira_disponible_mtr, false)
),

jira_reservado_mtr_asignado as (
  select
    md5(concat_ws('|', 'jira_reservado_mtr_asignado', id_equipo)) as alert_id,
    id_equipo,
    'jira_reservado_mtr_asignado'::text as tipo_alerta,
    'Jira reservado, MTR asignado'::text as titulo,
    format('Jira conserva %s en reserva, pero MTR ya lo muestra asignado.', id_equipo) as descripcion,
    'MEDIA'::text as criticidad,
    'MTR/Jira'::text as origen,
    'analytics.mart_mtr_jira_reconciliacion'::text as fuente_principal,
    concat(
      'jira_estado=', coalesce(jira_status_name_top, jira_status_name, 'SIN_ESTADO'),
      '; mtr_estado=', coalesce(mtr_estado_operativo, estado_operativo, 'SIN_ESTADO')
    ) as evidencia,
    'Cerrar o actualizar la reserva en Jira para que el workflow administrativo no quede atrasado.'::text as accion_sugerida,
    coalesce(jira_last_event_ts, mtr_last_event_at, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(jira_last_event_ts::date, mtr_last_event_at::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'BAJA') as confianza_dato
  from base
  where coalesce(flag_reservado_jira_asignado_mtr, false)
),

ticket_jira_sin_ingreso_mtr as (
  select
    md5(concat_ws('|', 'ticket_jira_sin_ingreso_mtr', id_equipo, coalesce(jira_issue_key_open, jira_issue_key_top, jira_issue_key, 'sin_issue'))) as alert_id,
    id_equipo,
    'ticket_jira_sin_ingreso_mtr'::text as tipo_alerta,
    'Ticket Jira sin ingreso MTR'::text as titulo,
    format('Existe workflow Jira para %s, pero MTR no registra ingreso fisico del equipo.', id_equipo) as descripcion,
    'ALTA'::text as criticidad,
    'MTR/Jira'::text as origen,
    'analytics.mart_mtr_jira_reconciliacion'::text as fuente_principal,
    concat(
      'issue=', coalesce(jira_issue_key_open, jira_issue_key_top, jira_issue_key, 'SIN_ISSUE'),
      '; jira_estado=', coalesce(jira_issue_status_top, jira_status_name_top, jira_status_name, 'SIN_ESTADO'),
      '; mtr_last_ingreso=', coalesce(to_char(mtr_last_ingreso_at, 'YYYY-MM-DD'), 'SIN_INGRESO')
    ) as evidencia,
    'Validar si el equipo realmente ingreso a inventario o si Jira fue creado antes del respaldo MTR.'::text as accion_sugerida,
    coalesce(jira_issue_opened_at_top, jira_last_event_ts, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(jira_issue_opened_at_top::date, jira_last_event_ts::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'BAJA') as confianza_dato
  from base
  where coalesce(flag_creado_jira_sin_ingreso_mtr, false)
),

mtr_sin_jira as (
  select
    md5(concat_ws('|', 'mtr_sin_jira', id_equipo)) as alert_id,
    id_equipo,
    'mtr_sin_jira'::text as tipo_alerta,
    'Equipo en MTR sin respaldo Jira'::text as titulo,
    format('El equipo %s existe en MTR, pero no tiene trazabilidad administrativa en Jira.', id_equipo) as descripcion,
    'MEDIA'::text as criticidad,
    'MTR'::text as origen,
    'analytics.mart_mtr_jira_reconciliacion'::text as fuente_principal,
    concat(
      'mtr_estado=', coalesce(mtr_estado_operativo, estado_operativo, 'SIN_ESTADO'),
      '; ultimo_evento_mtr=', coalesce(to_char(mtr_last_event_at, 'YYYY-MM-DD'), 'SIN_EVENTO')
    ) as evidencia,
    'Crear o vincular el workflow Jira para mantener trazabilidad administrativa del equipo.'::text as accion_sugerida,
    coalesce(mtr_last_event_at, timeline_last_event_at, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(mtr_last_event_at::date, timeline_last_event_at::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'MEDIA') as confianza_dato
  from base
  where coalesce(flag_mtr_sin_match_jira, false)
),

jira_sin_mtr as (
  select
    md5(concat_ws('|', 'jira_sin_mtr', id_equipo, coalesce(jira_issue_key_open, jira_issue_key_top, jira_issue_key, 'sin_issue'))) as alert_id,
    id_equipo,
    'jira_sin_mtr'::text as tipo_alerta,
    'Equipo en Jira sin respaldo MTR'::text as titulo,
    format('El equipo %s aparece en Jira, pero no tiene respaldo operativo en MTR.', id_equipo) as descripcion,
    'ALTA'::text as criticidad,
    'Jira'::text as origen,
    'analytics.mart_mtr_jira_reconciliacion'::text as fuente_principal,
    concat(
      'issue=', coalesce(jira_issue_key_open, jira_issue_key_top, jira_issue_key, 'SIN_ISSUE'),
      '; jira_estado=', coalesce(jira_issue_status_top, jira_status_name_top, jira_status_name, 'SIN_ESTADO')
    ) as evidencia,
    'Confirmar si falta cargar el equipo en MTR o si Jira quedo con un SKU incorrecto.'::text as accion_sugerida,
    coalesce(jira_issue_opened_at_top, jira_last_event_ts, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(jira_issue_opened_at_top::date, jira_last_event_ts::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'BAJA') as confianza_dato
  from base
  where coalesce(flag_jira_sin_match_mtr, false)
),

equipo_con_cambios_frecuentes_30d as (
  select
    md5(concat_ws('|', 'equipo_con_cambios_frecuentes_30d', id_equipo)) as alert_id,
    id_equipo,
    'equipo_con_cambios_frecuentes_30d'::text as tipo_alerta,
    'Equipo con cambios frecuentes'::text as titulo,
    format('El equipo %s acumula %s cambios auditados en los ultimos 30 dias.', id_equipo, cambios_30d) as descripcion,
    'MEDIA'::text as criticidad,
    'Catastro'::text as origen,
    'analytics.mart_equipo_audit_log'::text as fuente_principal,
    concat(
      'cambios_30d=', cambios_30d,
      '; ultimo_cambio=', coalesce(to_char(ultimo_cambio_auditado, 'YYYY-MM-DD'), 'SIN_CAMBIO')
    ) as evidencia,
    'Revisar si existe rotacion, reasignacion reiterada o una inconsistencia recurrente entre fuentes.'::text as accion_sugerida,
    coalesce(ultimo_cambio_auditado, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(ultimo_cambio_auditado::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'MEDIA') as confianza_dato
  from base
  where cambios_30d >= 4
),

equipo_sin_movimiento_reciente as (
  select
    md5(concat_ws('|', 'equipo_sin_movimiento_reciente', id_equipo)) as alert_id,
    id_equipo,
    'equipo_sin_movimiento_reciente'::text as tipo_alerta,
    'Equipo sin movimiento reciente'::text as titulo,
    format('El equipo %s no registra movimiento fisico reciente en MTR.', id_equipo) as descripcion,
    'BAJA'::text as criticidad,
    'MTR'::text as origen,
    'analytics.mart_operacion_sla'::text as fuente_principal,
    concat(
      'dias_desde_ultimo_movimiento=', coalesce(dias_desde_ultimo_movimiento::text, 'SIN_DATO'),
      '; ultimo_evento=', coalesce(mtr_last_event_type, timeline_last_event_type, 'SIN_EVENTO'),
      '; detalle=', coalesce(timeline_last_detalle, 'SIN_DETALLE')
    ) as evidencia,
    'Validar si el equipo sigue en el mismo estado esperado o si falta actualizar el movimiento fisico en MTR.'::text as accion_sugerida,
    coalesce(fecha_ultimo_movimiento, mtr_last_event_at, timeline_last_event_at, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(fecha_ultimo_movimiento::date, mtr_last_event_at::date, timeline_last_event_at::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'MEDIA') as confianza_dato
  from base
  where coalesce(dias_desde_ultimo_movimiento, 0) >= 90
    and upper(coalesce(mtr_estado_operativo, estado_operativo, 'SIN_ESTADO')) <> 'BAJA'
),

issue_jira_abierto_mas_7d as (
  select
    md5(concat_ws('|', 'issue_jira_abierto_mas_7d', j.id_equipo, j.issue_key)) as alert_id,
    j.id_equipo,
    'issue_jira_abierto_mas_7d'::text as tipo_alerta,
    'Issue Jira abierto por mas de 7 dias'::text as titulo,
    format('El issue %s del equipo %s sigue abierto hace %s dias.', j.issue_key, j.id_equipo, j.dias_abierta_issue) as descripcion,
    case
      when j.dias_abierta_issue > 14 then 'ALTA'
      else 'MEDIA'
    end::text as criticidad,
    'Jira'::text as origen,
    'analytics.stg_jira_issues'::text as fuente_principal,
    concat(
      'issue=', j.issue_key,
      '; status=', coalesce(j.status_name, 'SIN_ESTADO'),
      '; reporter=', coalesce(j.reporter_display_name, 'SIN_REPORTER')
    ) as evidencia,
    'Revisar backlog Jira y definir resolucion, cierre o siguiente accion operativa.'::text as accion_sugerida,
    j.opened_at as fecha_detectada,
    j.dias_abierta_issue as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(c.confianza_dato, 'MEDIA') as confianza_dato
  from jira_issue_open j
  left join confianza c
    on c.id_equipo = j.id_equipo
  where j.dias_abierta_issue > 7
),

mac_a2141_staffing_sin_renovacion as (
  select
    md5(concat_ws('|', 'mac_a2141_staffing_sin_renovacion', id_equipo)) as alert_id,
    id_equipo,
    'mac_a2141_staffing_sin_renovacion'::text as tipo_alerta,
    'Mac A2141 staffing sin renovacion'::text as titulo,
    format('El equipo %s corresponde a Mac A2141 en staffing y ya entro en ventana de renovacion.', id_equipo) as descripcion,
    'ALTA'::text as criticidad,
    'Politica'::text as origen,
    'analytics.mart_equipos_estado_actual'::text as fuente_principal,
    concat(
      'modelo=', coalesce(modelo, 'SIN_MODELO'),
      '; dias_a_vencer=', coalesce(dias_a_vencer::text, 'SIN_DATO'),
      '; tipo_colaborador=', coalesce(tipo_colaborador, 'SIN_TIPO')
    ) as evidencia,
    'Priorizar plan de renovacion o definicion comercial para evitar continuidad con hardware vencido.'::text as accion_sugerida,
    current_timestamp as fecha_detectada,
    0::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'MEDIA') as confianza_dato
  from base
  where upper(coalesce(modelo, '')) like '%A2141%'
    and lower(coalesce(tipo_colaborador, '')) = 'staffing'
    and coalesce(flag_renovar, false)
),

dell_activo_pendiente_baja as (
  select
    md5(concat_ws('|', 'dell_activo_pendiente_baja', id_equipo)) as alert_id,
    id_equipo,
    'dell_activo_pendiente_baja'::text as tipo_alerta,
    'Dell activo pendiente de baja'::text as titulo,
    format('El equipo %s sigue activo, aunque la politica lo marca para baja.', id_equipo) as descripcion,
    'MEDIA'::text as criticidad,
    'Politica'::text as origen,
    'analytics.mart_equipos_estado_actual'::text as fuente_principal,
    concat(
      'marca=', coalesce(marca, 'SIN_MARCA'),
      '; motivo_politica=', coalesce(motivo_politica, 'SIN_POLITICA'),
      '; estado_operativo=', coalesce(estado_operativo, 'SIN_ESTADO')
    ) as evidencia,
    'Revisar si corresponde baja operativa, reemplazo o excepcion formal de politica.'::text as accion_sugerida,
    current_timestamp as fecha_detectada,
    0::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'MEDIA') as confianza_dato
  from base
  where upper(coalesce(marca, '')) like '%DELL%'
    and upper(coalesce(motivo_politica, '')) = 'DELL_BAJA'
    and upper(coalesce(estado_operativo, 'SIN_ESTADO')) <> 'BAJA'
),

inconsistencia_operativa_mtr_jira as (
  select
    md5(concat_ws('|', 'inconsistencia_operativa_mtr_jira', id_equipo)) as alert_id,
    id_equipo,
    'inconsistencia_operativa_mtr_jira'::text as tipo_alerta,
    'Inconsistencia operativa MTR/Jira'::text as titulo,
    format('El equipo %s presenta conflicto entre la fuente fisica MTR y el workflow administrativo Jira.', id_equipo) as descripcion,
    'CRITICA'::text as criticidad,
    'MTR/Jira'::text as origen,
    'analytics.mart_mtr_jira_reconciliacion'::text as fuente_principal,
    concat(
      'conciliacion_estado=', coalesce(conciliacion_estado, 'SIN_ESTADO'),
      '; jira_estado=', coalesce(jira_status_name_top, jira_status_name, 'SIN_ESTADO'),
      '; mtr_estado=', coalesce(mtr_estado_operativo, estado_operativo, 'SIN_ESTADO')
    ) as evidencia,
    'Conciliar manualmente el caso; MTR conserva la verdad fisica y Jira debe ajustarse al workflow correcto.'::text as accion_sugerida,
    coalesce(jira_last_event_ts, mtr_last_event_at, current_timestamp) as fecha_detectada,
    greatest(0, current_date - coalesce(jira_last_event_ts::date, mtr_last_event_at::date, current_date))::int as dias_abierta,
    'ABIERTA'::text as estado_alerta,
    coalesce(confianza_dato, 'CRITICA') as confianza_dato
  from base
  where coalesce(flag_inconsistencia_mtr_jira, false)
),

all_alerts as (
  select * from equipo_asignado_sin_persona
  union all
  select * from jira_asignado_mtr_disponible
  union all
  select * from jira_reservado_mtr_asignado
  union all
  select * from ticket_jira_sin_ingreso_mtr
  union all
  select * from mtr_sin_jira
  union all
  select * from jira_sin_mtr
  union all
  select * from equipo_con_cambios_frecuentes_30d
  union all
  select * from equipo_sin_movimiento_reciente
  union all
  select * from issue_jira_abierto_mas_7d
  union all
  select * from mac_a2141_staffing_sin_renovacion
  union all
  select * from dell_activo_pendiente_baja
  union all
  select * from inconsistencia_operativa_mtr_jira
)

select
  alert_id,
  id_equipo,
  tipo_alerta,
  titulo,
  descripcion,
  criticidad,
  origen,
  fuente_principal,
  evidencia,
  accion_sugerida,
  fecha_detectada,
  dias_abierta,
  estado_alerta,
  confianza_dato
from all_alerts
