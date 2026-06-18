-- ============================================================
-- 001_create_schemas.sql
-- Base de datos: twobrains_assets
-- Proyecto: twobrains-lakehouse  (INDEPENDIENTE de Catastro)
-- Sprint 3 · Jun 2026
-- Idempotente: seguro para re-ejecutar.
-- ============================================================

-- ── Schemas ───────────────────────────────────────────────────
create schema if not exists bronze;
create schema if not exists silver;
create schema if not exists gold;
create schema if not exists ops;

comment on schema bronze is '2Brains · Capa Bronze: ingesta cruda desde Excel. Append-only. Inmutable.';
comment on schema silver is '2Brains · Capa Silver: modelos normalizados. Reglas de negocio centralizadas aquí.';
comment on schema gold   is '2Brains · Capa Gold: vistas analíticas y marts para dashboards y API.';
comment on schema ops    is '2Brains · Capa Ops: logs de pipeline, errores de ingesta, checkpoints.';

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ── Enums (public, referenciables desde cualquier schema) ─────
do $$ begin
  create type public.tb_movement_type as enum (
    'ingreso','salida','compra','asignacion','recuperacion','baja'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tb_asset_status as enum (
    'Asignado','Disponible','Por Recuperar',
    'Defectuoso','De Baja','Reservado','Stock / Nuevo'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tb_asset_condition as enum ('Nuevo','Usado','Defectuoso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tb_risk_level as enum ('BAJO','MEDIO','ALTO','CRÍTICO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tb_snapshot_kind as enum ('monthly','manual','incident','annual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tb_priority as enum ('CRÍTICA','ALTA','MEDIA','BAJA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tb_pipeline_status as enum ('running','success','failed','partial');
exception when duplicate_object then null; end $$;
