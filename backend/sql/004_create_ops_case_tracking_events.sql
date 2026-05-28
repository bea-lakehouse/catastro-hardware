create schema if not exists ops;

create table if not exists ops.case_tracking_events (
  event_id bigserial primary key,
  case_id bigint not null references ops.case_tracking(case_id) on delete cascade,
  event_type text not null,
  actor text null,
  before_payload jsonb null,
  after_payload jsonb null,
  comment text null,
  created_at timestamptz not null default now()
);

create index if not exists ix_case_tracking_events_case
  on ops.case_tracking_events(case_id, created_at desc);
