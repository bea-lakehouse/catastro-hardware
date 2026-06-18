-- ============================================================
-- 002_bronze_tables.sql
-- Bronze layer: ingesta cruda, append-only, inmutable.
-- Todo lo que entra desde Excel queda aquí para siempre.
-- ============================================================

-- ── bronze.ingestion_batches ──────────────────────────────────
-- Un registro por archivo xlsx procesado.
create table if not exists bronze.ingestion_batches (
  batch_id          uuid           primary key default gen_random_uuid(),
  source_file       text           not null,          -- '2brains1706.xlsx'
  source_type       text           not null default 'xlsx',
  loaded_by         text,                             -- usuario o proceso que disparó la carga
  started_at        timestamptz    not null default now(),
  finished_at       timestamptz,
  status            public.tb_pipeline_status not null default 'running',
  sheets_found      text[]         not null default '{}',
  rows_total        integer        not null default 0,
  rows_inserted     integer        not null default 0,
  rows_skipped      integer        not null default 0, -- duplicados detectados por row_hash
  error_message     text,
  metadata          jsonb          not null default '{}'
);

create index if not exists idx_bronze_batches_started
  on bronze.ingestion_batches(started_at desc);
create index if not exists idx_bronze_batches_status
  on bronze.ingestion_batches(status);

comment on table  bronze.ingestion_batches is
  'Un registro por carga de archivo. Ciclo de vida completo de la ingesta.';
comment on column bronze.ingestion_batches.rows_skipped is
  'Filas ignoradas porque row_hash ya existe en bronze.raw_excel_rows (dedup).';

-- ── bronze.raw_excel_rows ─────────────────────────────────────
-- Una fila por fila de Excel en cualquier hoja.
-- NUNCA se modifica tras el INSERT. Append-only.
create table if not exists bronze.raw_excel_rows (
  id                bigserial      primary key,
  batch_id          uuid           not null
                      references bronze.ingestion_batches(batch_id)
                      on delete cascade,
  source_file       text           not null,          -- copia del nombre de archivo
  source_sheet      text           not null,          -- nombre exacto de la hoja
  sheet_row_number  integer        not null,          -- número de fila en la hoja (1-based)
  raw_data          jsonb          not null,          -- toda la fila como clave-valor
  row_hash          text           not null,          -- MD5(raw_data::text) — dedup en Silver
  load_timestamp    timestamptz    not null default now(),
  is_header_row     boolean        not null default false,
  processing_notes  text                              -- anotaciones del pipeline Silver
);

create index if not exists idx_bronze_raw_batch
  on bronze.raw_excel_rows(batch_id);
create index if not exists idx_bronze_raw_sheet
  on bronze.raw_excel_rows(source_file, source_sheet);
create index if not exists idx_bronze_raw_hash
  on bronze.raw_excel_rows(row_hash);
create index if not exists idx_bronze_raw_loaded
  on bronze.raw_excel_rows(load_timestamp desc);

comment on table  bronze.raw_excel_rows is
  'Log inmutable de cada fila de Excel. '
  'Una fila por fila de hoja por batch. Nunca se modifica tras INSERT. '
  'row_hash = MD5(raw_data::text) habilita deduplicación en Silver.';
comment on column bronze.raw_excel_rows.raw_data is
  'Fila completa como JSON. Las claves son los encabezados de la hoja Excel. '
  'Ejemplo: {"Nro Serie":"SK3XKDV7VC9","Modelo":"MacBook Pro - Model A4334",...}';
