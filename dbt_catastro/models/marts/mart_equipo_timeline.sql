with mtr as (
  select
    concat(
      'MTR:',
      md5(
        concat_ws(
          '|',
          coalesce(historia_id::text, ''),
          coalesce(id_equipo, ''),
          coalesce(fecha_evento::text, ''),
          coalesce(tipo_evento, ''),
          coalesce(usuario_evento, ''),
          coalesce(detalle_evento, '')
        )
      )
    )::text as historia_id,
    id_equipo,
    fecha_evento,
    tipo_evento,
    usuario_evento as persona,
    detalle_evento as detalle,
    origen_evento,
    case
      when upper(coalesce(tipo_evento, '')) = 'INGRESO' then 'CREADO'
      when upper(coalesce(tipo_evento, '')) = 'ASIGNACION' then 'ASIGNADO'
      when upper(coalesce(tipo_evento, '')) = 'DEVOLUCION' then 'DISPONIBLE'
      when upper(coalesce(tipo_evento, '')) = 'SALIDA' then 'BAJA'
      else upper(coalesce(tipo_evento, 'EVENTO'))
    end as event_class
  from {{ ref('fct_historia_hw') }}
),

jira_created as (
  select
    ('JIRA-CREATED:' || issue_id) as historia_id,
    id_equipo,
    created_at as fecha_evento,
    'JIRA_CREADO' as tipo_evento,
    coalesce(reporter_display_name, assignee_display_name) as persona,
    concat_ws(' | ', issue_key, summary, 'Creado', project_key) as detalle,
    'jira'::text as origen_evento,
    'CREADO'::text as event_class
  from {{ ref('stg_jira_issues') }}
  where id_equipo is not null
    and created_at is not null
),

jira_workflow as (
  select
    ('JIRA-STATUS:' || issue_id) as historia_id,
    id_equipo,
    coalesce(status_category_changed_at, updated_at) as fecha_evento,
    'JIRA_ESTADO' as tipo_evento,
    coalesce(assignee_display_name, reporter_display_name) as persona,
    concat_ws(' | ', issue_key, summary, coalesce(estado_equipo_jira, board_bucket, status_name, '')) as detalle,
    'jira'::text as origen_evento,
    upper(coalesce(estado_equipo_jira, board_bucket, status_name, 'EVENTO')) as event_class
  from {{ ref('stg_jira_issues') }}
  where id_equipo is not null
    and coalesce(status_category_changed_at, updated_at) is not null
),

jira as (
  select * from jira_created
  union all
  select * from jira_workflow
),

candidate_matches as (
  select
    m.historia_id as mtr_historia_id,
    j.historia_id as jira_historia_id,
    row_number() over (
      partition by j.historia_id
      order by abs((m.fecha_evento::date - j.fecha_evento::date)), m.fecha_evento desc, m.historia_id
    ) as rn_jira,
    row_number() over (
      partition by m.historia_id
      order by abs((m.fecha_evento::date - j.fecha_evento::date)), j.fecha_evento desc, j.historia_id
    ) as rn_mtr
  from mtr m
  join jira j
    on j.id_equipo = m.id_equipo
   and j.event_class = m.event_class
   and abs((m.fecha_evento::date - j.fecha_evento::date)) <= 3
),

matched as (
  select
    cm.mtr_historia_id,
    cm.jira_historia_id,
    ('CONCILIADO:' || cm.mtr_historia_id || ':' || cm.jira_historia_id)::text as historia_id,
    m.id_equipo,
    m.fecha_evento,
    ('CONCILIADO_' || m.event_class)::text as tipo_evento,
    coalesce(m.persona, j.persona) as persona,
    concat_ws(' | ', nullif(trim(coalesce(m.detalle, '')), ''), nullif(trim(coalesce(j.detalle, '')), '')) as detalle,
    'conciliado'::text as origen_evento
  from candidate_matches cm
  join mtr m
    on m.historia_id = cm.mtr_historia_id
  join jira j
    on j.historia_id = cm.jira_historia_id
  where cm.rn_jira = 1
    and cm.rn_mtr = 1
),

matched_mtr as (
  select
    distinct mtr_historia_id as historia_id
  from matched
),

matched_jira as (
  select
    distinct jira_historia_id as historia_id
  from matched
),

unmatched_mtr as (
  select
    historia_id,
    id_equipo,
    fecha_evento,
    tipo_evento,
    persona,
    detalle,
    origen_evento
  from mtr
  where historia_id not in (select historia_id from matched_mtr)
),

unmatched_jira as (
  select
    historia_id,
    id_equipo,
    fecha_evento,
    tipo_evento,
    persona,
    detalle,
    origen_evento
  from jira
  where historia_id not in (select historia_id from matched_jira)
)

select * from unmatched_mtr
union all
select * from unmatched_jira
union all
select
  historia_id,
  id_equipo,
  fecha_evento,
  tipo_evento,
  persona,
  detalle,
  origen_evento
from matched
