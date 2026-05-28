{{ config(materialized='view') }}

with base as (
  select
    id::text as id,
    inserted_at,
    event_id,
    webhook_event,
    issue_key,
    payload #>> '{issue,id}' as issue_id,
    equipo_id,
    case
      when coalesce(payload->>'timestamp', '') ~ '^\d+(\.\d+)?$'
        then to_timestamp((payload->>'timestamp')::numeric / 1000.0)
      else null::timestamptz
    end as event_ts,
    payload #>> '{issue,fields,summary}' as summary,
    payload #>> '{issue,fields,status,name}' as status_name,
    payload #>> '{issue,fields,priority,name}' as priority_name,
    payload as raw_payload
  from {{ source('raw', 'raw_jira_webhook_events') }}

)

select * from base
