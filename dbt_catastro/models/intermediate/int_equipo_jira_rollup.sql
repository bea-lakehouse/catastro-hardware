with issues as (
  select
    issue_id,
    issue_key,
    id_equipo,
    summary,
    status_name,
    status_category_id,
    status_category_key,
    status_category_name,
    board_bucket,
    estado_equipo_jira,
    priority_name,
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
  from {{ ref('stg_jira_issues') }}
  where id_equipo is not null
),

classified as (
  select
    *,
    case
      when lower(coalesce(status_category_key, '')) = 'done' then false
      when lower(coalesce(status_name, '')) = any (array['done', 'closed', 'resolved']) then false
      else true
    end as is_open,
    case
      when lower(coalesce(status_category_key, '')) = 'done' then null
      when lower(coalesce(status_name, '')) = any (array['done', 'closed', 'resolved']) then null
      else (current_date - created_at::date)::int
    end as days_open
  from issues
),

agg as (
  select
    id_equipo as equipo_id,
    count(*) as jira_events_total,
    count(*) filter (where is_open) as jira_open_count,
    max(updated_at) as jira_last_event_ts,
    max(updated_at) filter (where is_open) as jira_last_open_event_ts,
    max(days_open) as jira_days_open_max,
    count(*) filter (where is_open and estado_equipo_jira = 'CREADO') as jira_created_count,
    count(*) filter (where is_open and estado_equipo_jira = 'RESERVADO') as jira_reserved_count,
    count(*) filter (where is_open and estado_equipo_jira = 'ASIGNADO') as jira_assigned_count,
    (array_agg(issue_key order by days_open desc nulls last) filter (where is_open))[1] as jira_issue_key_top,
    array_agg(issue_key order by days_open desc nulls last) filter (where is_open) as jira_issue_keys_open,
    (array_agg(summary order by updated_at desc nulls last))[1] as jira_summary_top,
    (array_agg(status_name order by updated_at desc nulls last))[1] as jira_status_name_top,
    (array_agg(status_category_name order by updated_at desc nulls last))[1] as jira_status_category_name_top,
    (array_agg(board_bucket order by updated_at desc nulls last))[1] as jira_board_bucket_top,
    (array_agg(estado_equipo_jira order by updated_at desc nulls last) filter (where estado_equipo_jira is not null))[1] as jira_estado_equipo_top,
    (array_agg(project_key order by updated_at desc nulls last))[1] as jira_project_key_top,
    (array_agg(project_name order by updated_at desc nulls last))[1] as jira_project_name_top,
    (array_agg(reporter_display_name order by updated_at desc nulls last))[1] as jira_reporter_display_name_top,
    array_agg(distinct board_bucket) filter (where is_open and board_bucket is not null) as jira_board_buckets_open
  from classified
  group by 1
)

select * from agg
