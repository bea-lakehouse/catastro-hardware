create schema if not exists raw;

create table if not exists raw.sync_runs (
  run_id bigserial primary key,
  source_type text not null,
  source_name text not null,
  status text not null default 'RUNNING',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  rows_loaded integer not null default 0,
  metadata jsonb null,
  error text null
);

create index if not exists ix_sync_runs_source
  on raw.sync_runs(source_type, source_name, started_at desc);

create table if not exists raw.mtr_google_sheet_rows (
  id bigserial primary key,
  run_id bigint not null references raw.sync_runs(run_id) on delete cascade,
  source_name text not null,
  spreadsheet_id text not null,
  sheet_range text not null,
  row_number integer not null,
  row_data jsonb not null,
  inserted_at timestamptz not null default now()
);

create index if not exists ix_mtr_google_sheet_rows_run
  on raw.mtr_google_sheet_rows(run_id, source_name, row_number);
