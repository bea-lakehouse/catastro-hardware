-- ============================================================
-- 005_ops_tables.sql
-- Ops layer: logs de pipeline, errores, checkpoints de carga.
-- Permite monitorear el estado del flujo Bronze → Silver → Gold.
-- ============================================================

-- ── ops.pipeline_runs ─────────────────────────────────────────
-- Log de cada ejecución completa del pipeline.
create table if not exists ops.pipeline_runs (
  run_id               uuid         primary key default gen_random_uuid(),
  pipeline_name        text         not null,   -- 'ingest_bronze','silver_transform','gold_refresh'
  batch_id             uuid         references bronze.ingestion_batches(batch_id),
  status               public.tb_pipeline_status not null default 'running',
  snapshot_date        date,
  started_at           timestamptz  not null default now(),
  finished_at          timestamptz,
  duration_ms          integer      generated always as (
                          extract(milliseconds from finished_at - started_at)::integer
                        ) stored,
  -- Métricas de la ejecución
  assets_processed     integer,
  movements_processed  integer,
  snapshots_created    integer,
  quality_score        numeric(5,1),
  dg_score             numeric(5,1),
  error_message        text,
  metadata             jsonb        not null default '{}'
);

create index if not exists idx_ops_runs_started      on ops.pipeline_runs(started_at desc);
create index if not exists idx_ops_runs_pipeline     on ops.pipeline_runs(pipeline_name);
create index if not exists idx_ops_runs_status       on ops.pipeline_runs(status);
create index if not exists idx_ops_runs_batch        on ops.pipeline_runs(batch_id);

comment on table ops.pipeline_runs is
  'Log de cada ejecución del pipeline. '
  'Una fila por run de ingest_bronze, silver_transform o gold_refresh.';

-- ── ops.ingestion_errors ──────────────────────────────────────
-- Un registro por fila de Excel que no pudo procesarse.
create table if not exists ops.ingestion_errors (
  id               bigserial    primary key,
  run_id           uuid         references ops.pipeline_runs(run_id) on delete cascade,
  batch_id         uuid         references bronze.ingestion_batches(batch_id),
  source_file      text,
  source_sheet     text,
  row_number       integer,
  raw_data         jsonb,
  error_type       text         not null,   -- 'SERIAL_NULL','DATE_INVALID','SCHEMA_MISMATCH',...
  error_message    text         not null,
  is_critical      boolean      not null default false,
  created_at       timestamptz  not null default now()
);

create index if not exists idx_ops_errors_run     on ops.ingestion_errors(run_id);
create index if not exists idx_ops_errors_batch   on ops.ingestion_errors(batch_id);
create index if not exists idx_ops_errors_type    on ops.ingestion_errors(error_type);
create index if not exists idx_ops_errors_crit    on ops.ingestion_errors(is_critical)
  where is_critical = true;

comment on table ops.ingestion_errors is
  'Error por fila de Excel que falló durante la transformación Silver. '
  'is_critical=true implica que la fila fue descartada completamente.';

-- ── ops.checkpoints ───────────────────────────────────────────
-- Estado del último procesamiento por hoja de Excel.
-- Permite reanudar cargas incrementales sin reprocesar todo.
create table if not exists ops.checkpoints (
  checkpoint_key    text         primary key,  -- 'source_file:source_sheet'
  source_file       text         not null,
  source_sheet      text         not null,
  last_batch_id     uuid         references bronze.ingestion_batches(batch_id),
  last_row_hash     text,                      -- último row_hash procesado
  rows_seen         integer      not null default 0,
  rows_new          integer      not null default 0,
  rows_skipped      integer      not null default 0,
  last_run_at       timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

comment on table ops.checkpoints is
  'Estado de carga incremental por hoja de Excel. '
  'checkpoint_key = source_file || ":" || source_sheet. '
  'El pipeline Silver consulta esto para saltar filas ya procesadas.';

-- ── ops.quality_snapshots ─────────────────────────────────────
-- Historial de métricas de calidad por ejecución.
create table if not exists ops.quality_snapshots (
  id                  bigserial    primary key,
  run_id              uuid         references ops.pipeline_runs(run_id),
  snapshot_date       date         not null,
  quality_score       numeric(5,1),
  dg_score            numeric(5,1),
  dg_level            smallint,
  total_movements     integer,
  real_movements      integer,
  records_to_fix      integer,
  pct_serial          numeric(5,1),
  pct_fecha           numeric(5,1),
  pct_gestor          numeric(5,1),
  pct_cliente         numeric(5,1),
  pct_riesgo_it       numeric(5,1),
  total_assets        integer,
  park_quality_score  numeric(5,1),
  created_at          timestamptz  not null default now()
);

create index if not exists idx_ops_qsnap_date on ops.quality_snapshots(snapshot_date desc);

comment on table ops.quality_snapshots is
  'Historial de métricas de calidad. Permite graficar la evolución del DG Score '
  'sin requerear los datos actuales de Silver.';

-- ── ops.api_request_log ───────────────────────────────────────
-- Log ligero de llamadas a la API (Sprint 4: opcional).
create table if not exists ops.api_request_log (
  id               bigserial    primary key,
  endpoint         text         not null,
  method           text         not null,
  status_code      smallint,
  duration_ms      integer,
  request_body     jsonb,
  error_message    text,
  created_at       timestamptz  not null default now()
) partition by range (created_at);

-- Partición inicial: Jun–Dic 2026
create table if not exists ops.api_request_log_2026
  partition of ops.api_request_log
  for values from ('2026-01-01') to ('2027-01-01');

comment on table ops.api_request_log is
  'Log de llamadas a la API interna. Particionado por mes para gestión de retención.';

-- ── Vista: estado actual del pipeline ─────────────────────────
create or replace view ops.pipeline_status as
select
  p.pipeline_name,
  p.status,
  p.started_at,
  p.finished_at,
  p.duration_ms,
  p.assets_processed,
  p.movements_processed,
  p.quality_score,
  p.dg_score,
  p.error_message,
  b.source_file,
  b.rows_total,
  b.rows_inserted,
  b.rows_skipped
from ops.pipeline_runs p
left join bronze.ingestion_batches b on b.batch_id = p.batch_id
order by p.started_at desc
limit 20;

comment on view ops.pipeline_status is
  'Últimas 20 ejecuciones del pipeline con contexto de batch.';
