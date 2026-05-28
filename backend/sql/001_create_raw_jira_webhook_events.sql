-- RAW store: guarda payload completo + dedupe key
create schema if not exists raw;

create table if not exists raw.raw_jira_webhook_events (
  id bigserial primary key,
  inserted_at timestamptz not null default now(),
  event_id text not null,
  webhook_event text null,
  issue_key text null,
  equipo_id text null,
  payload jsonb not null
);

create unique index if not exists ux_raw_jira_event_id
  on raw.raw_jira_webhook_events(event_id);

create index if not exists ix_raw_jira_issue_key
  on raw.raw_jira_webhook_events(issue_key);

create index if not exists ix_raw_jira_equipo_id
  on raw.raw_jira_webhook_events(equipo_id);
