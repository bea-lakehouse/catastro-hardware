{{ config(materialized='view') }}

{% set jira_customfield = env_var('JIRA_EQUIPO_CUSTOMFIELD', '') %}

with source as (
  select
    issue_id,
    issue_key,
    equipo_id,
    summary,
    status_name,
    assignee_display_name,
    reporter_display_name,
    project_id,
    project_key,
    project_name,
    status_category_changed_at,
    created_at,
    updated_at,
    raw,
    inserted_at
  from {{ source('raw', 'jira_issues') }}

)

, extracted as (
  select
    s.issue_id,
    s.issue_key,
    s.equipo_id as snapshot_equipo_id,
    coalesce(s.summary, s.raw #>> '{fields,summary}') as summary,
    coalesce(s.status_name, s.raw #>> '{fields,status,name}') as status_name,
    coalesce(s.assignee_display_name, s.raw #>> '{fields,assignee,displayName}') as assignee_display_name,
    coalesce(s.reporter_display_name, s.raw #>> '{fields,reporter,displayName}') as reporter_display_name,
    coalesce(s.project_id, s.raw #>> '{fields,project,id}') as project_id,
    coalesce(s.project_key, s.raw #>> '{fields,project,key}') as project_key,
    coalesce(s.project_name, s.raw #>> '{fields,project,name}') as project_name,
    s.status_category_changed_at,
    s.created_at,
    s.updated_at,
    s.raw,
    s.inserted_at,
    coalesce(s.raw #> '{fields,labels}', '[]'::jsonb) as labels,
    s.raw #>> '{fields,priority,name}' as priority_name,
    s.raw #>> '{fields,status,statusCategory,id}' as status_category_id,
    s.raw #>> '{fields,status,statusCategory,key}' as status_category_key,
    s.raw #>> '{fields,status,statusCategory,name}' as status_category_name,
    {% if jira_customfield %}
    case
      when jsonb_typeof(s.raw->'fields'->'{{ jira_customfield }}') = 'string'
        then trim(both '"' from (s.raw->'fields'->'{{ jira_customfield }}')::text)
      else coalesce(
        s.raw->'fields'->'{{ jira_customfield }}'->>'value',
        s.raw->'fields'->'{{ jira_customfield }}'->>'name',
        s.raw->'fields'->'{{ jira_customfield }}'->>'key',
        s.raw->'fields'->'{{ jira_customfield }}'->>'displayName',
        s.raw->'fields'->'{{ jira_customfield }}'->>'title',
        trim(both '"' from (s.raw->'fields'->'{{ jira_customfield }}')::text)
      )
    end as explicit_equipo_id,
    {% else %}
    null::text as explicit_equipo_id,
    {% endif %}
    upper(substring(coalesce(s.summary, s.raw #>> '{fields,summary}', '') from '(?i)(SKU-\d+)')) as summary_equipo_id
  from source s
),

with_labels as (
  select
    e.*,
    lb.label_equipo_id,
    cf.customfield_equipo_id
  from extracted e
  left join lateral (
    select
      upper(substring(label_txt from '(?i)(SKU-\d+)')) as label_equipo_id
    from jsonb_array_elements_text(coalesce(e.labels, '[]'::jsonb)) as labels(label_txt)
    where label_txt ~* 'SKU-\d+'
    order by case when label_txt ~* '^equipo:' then 1 else 2 end, label_txt
    limit 1
  ) lb on true
  left join lateral (
    select
      upper(substring(candidate_txt from '(?i)(SKU-\d+)')) as customfield_equipo_id
    from (
      select
        case
          when jsonb_typeof(v) = 'string' then trim(both '"' from v::text)
          when jsonb_typeof(v) = 'object' then coalesce(v->>'value', v->>'name', v->>'key', v->>'displayName', v->>'title')
          else v::text
        end as candidate_txt
      from jsonb_each(coalesce(e.raw->'fields', '{}'::jsonb)) as fields(k, v)
      where k like 'customfield_%'
    ) scan
    where candidate_txt ~* 'SKU-\d+'
    limit 1
  ) cf on true
),

base as (
  select
    issue_id,
    issue_key,
    case
      when nullif(trim(coalesce(snapshot_equipo_id, '')), '') is not null then upper(trim(snapshot_equipo_id))
      when upper(coalesce(project_key, '')) = 'SKU'
       and upper(coalesce(issue_key, '')) ~ '^SKU-\d+$'
        then upper(issue_key)
      when explicit_equipo_id ~* 'SKU-\d+' then upper(substring(explicit_equipo_id from '(?i)(SKU-\d+)'))
      when nullif(trim(coalesce(explicit_equipo_id, '')), '') is not null then upper(trim(explicit_equipo_id))
      else coalesce(
        label_equipo_id,
        summary_equipo_id,
        customfield_equipo_id
      )
    end as id_equipo,
    case
      when nullif(trim(coalesce(snapshot_equipo_id, '')), '') is not null then 'raw_snapshot'
      when upper(coalesce(project_key, '')) = 'SKU'
       and upper(coalesce(issue_key, '')) ~ '^SKU-\d+$'
        then 'issue_key_sku_project'
      when explicit_equipo_id ~* 'SKU-\d+' then 'explicit_customfield'
      when nullif(trim(coalesce(explicit_equipo_id, '')), '') is not null then 'explicit_customfield'
      when label_equipo_id is not null then 'label'
      when summary_equipo_id is not null then 'summary'
      when customfield_equipo_id is not null then 'customfield_scan'
      else 'unresolved'
    end as id_equipo_resolved_from,
    summary,
    status_name,
    status_category_id,
    status_category_key,
    status_category_name,
    case
      when lower(coalesce(status_name, '')) like '%cread%' or lower(coalesce(status_name, '')) like '%created%' then 'CREADO'
      when lower(coalesce(status_name, '')) like '%por recuperar%' or lower(coalesce(status_name, '')) like '%recuperar%' then 'POR_RECUPERAR'
      when lower(coalesce(status_name, '')) like '%liberar%' then 'POR_RECUPERAR'
      when lower(coalesce(status_name, '')) like '%resguard%' then 'RESGUARDO'
      when lower(coalesce(status_name, '')) like '%desperfect%' or lower(coalesce(status_name, '')) like '%defect%' or lower(coalesce(status_name, '')) like '%repar%' then 'DEFECTUOSO'
      when lower(coalesce(status_name, '')) like '%descontinuad%' or lower(coalesce(status_name, '')) like '%obsole%' or lower(coalesce(status_name, '')) like '%legacy%' then 'OBSOLETO'
      when lower(coalesce(status_name, '')) like '%baja%' or lower(coalesce(status_name, '')) like '%retired%' then 'BAJA'
      when lower(coalesce(status_name, '')) like '%reserv%' then 'RESERVADO'
      when lower(coalesce(status_name, '')) like '%asign%' or lower(coalesce(status_name, '')) like '%assigned%' then 'ASIGNADO'
      when lower(coalesce(status_name, '')) like '%dispon%' or lower(coalesce(status_name, '')) like '%available%' then 'DISPONIBLE'
      when lower(coalesce(status_category_key, '')) = 'done' then 'CERRADO'
      when lower(coalesce(status_category_key, '')) = 'indeterminate' then 'EN_PROGRESO'
      when lower(coalesce(status_category_key, '')) = 'new' then 'PENDIENTE'
      else null
    end as board_bucket,
    case
      when lower(coalesce(status_name, '')) like '%cread%' or lower(coalesce(status_name, '')) like '%created%' then 'CREADO'
      when lower(coalesce(status_name, '')) like '%reserv%' then 'RESERVADO'
      when lower(coalesce(status_name, '')) like '%asign%' or lower(coalesce(status_name, '')) like '%assigned%' then 'ASIGNADO'
      when lower(coalesce(status_category_key, '')) = 'new' then 'CREADO'
      else null
    end as estado_equipo_jira,
    priority_name,
    labels,
    assignee_display_name,
    reporter_display_name,
    project_id,
    project_key,
    project_name,
    status_category_changed_at,
    created_at,
    updated_at,
    raw,
    inserted_at
  from with_labels
)

select * from base
