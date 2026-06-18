-- ============================================================
-- 003_silver_tables.sql
-- Silver layer: modelos normalizados + funciones de negocio.
-- TODA la lógica de normalización vive en este archivo,
-- no en el frontend ni en la API.
-- ============================================================

-- ── Funciones de normalización ────────────────────────────────

-- Serial: strip espacios, uppercase
create or replace function silver.normalize_serial(raw text)
returns text language sql immutable as $$
  select case
    when trim(coalesce(raw,'')) = '' then null
    else upper(regexp_replace(trim(raw), '\s+', '', 'g'))
  end;
$$;

-- CPU: familia canónica de chip
create or replace function silver.normalize_cpu(raw text)
returns text language plpgsql immutable as $$
declare v text := trim(coalesce(raw,''));
begin
  if v ilike '%M5%' then return 'Apple M5'; end if;
  if v ilike '%M4%' then return 'Apple M4'; end if;
  if v ilike '%M3%' then return 'Apple M3'; end if;
  if v ilike '%M2%' then return 'Apple M2'; end if;
  if v ilike '%M1%' then return 'Apple M1'; end if;
  if v ilike '%i9%' then return 'Intel Core i9'; end if;
  if v ilike '%i7%' then return 'Intel Core i7'; end if;
  if v ilike '%i5%' then return 'Intel Core i5'; end if;
  if v ilike '%i3%' then return 'Intel Core i3'; end if;
  if v = ''         then return null; end if;
  return v;
end; $$;

-- CPU generation: 0=Intel, 1=M1 … 5=M5
create or replace function silver.cpu_gen(cpu text)
returns smallint language sql immutable as $$
  select case
    when cpu ilike '%M5%'    then 5
    when cpu ilike '%M4%'    then 4
    when cpu ilike '%M3%'    then 3
    when cpu ilike '%M2%'    then 2
    when cpu ilike '%M1%'    then 1
    when cpu ilike '%intel%' then 0
    else null
  end::smallint;
$$;

-- Estado: enum canónico
create or replace function silver.normalize_estado(raw text)
returns public.tb_asset_status language plpgsql immutable as $$
declare v text := lower(trim(coalesce(raw,'')));
begin
  if v like '%asignad%'    then return 'Asignado'; end if;
  if v like '%disponib%'   then return 'Disponible'; end if;
  if v like '%recuperar%'  then return 'Por Recuperar'; end if;
  if v like '%defectu%'    then return 'Defectuoso'; end if;
  if v like '%baja%'       then return 'De Baja'; end if;
  if v like '%reservad%'   then return 'Reservado'; end if;
  if v like '%stock%' or v like '%nuevo%' then return 'Stock / Nuevo'; end if;
  return null;
end; $$;

-- Cliente: nombre canónico
create or replace function silver.normalize_client(raw text)
returns text language plpgsql immutable as $$
declare v text := lower(trim(coalesce(raw,'')));
begin
  if v = ''                       then return null; end if;
  if v like '%banco de chile%'    then return 'Banco de Chile'; end if;
  if v like '%bancochile%'        then return 'Banco de Chile'; end if;
  if v like '%bci%'               then return 'BCI'; end if;
  if v like '%bupa%'              then return 'Bupa'; end if;
  if v like '%latam%'             then return 'Latam'; end if;
  if v like '%alv%'               then return 'Alv'; end if;
  if v like '%parque arauco%'     then return 'Parque Arauco'; end if;
  if v like '%chilexpress%'       then return 'Chilexpress'; end if;
  if v like '%redsalud%'          then return 'Redsalud'; end if;
  if v like '%afore%'             then return 'Afore Coppel'; end if;
  if v like '%2brains%' or v like '%acidlabs%' then return '2Brains'; end if;
  return initcap(trim(raw));
end; $$;

-- Score de calidad por registro (0-100, 9 campos clave)
create or replace function silver.calc_quality_score(
  p_serial text, p_marca text, p_modelo text,
  p_anio smallint, p_cpu text, p_ram text, p_disco text,
  p_condicion public.tb_asset_condition, p_estado public.tb_asset_status
) returns smallint language sql immutable as $$
  select ((
    case when p_serial    is not null then 1 else 0 end +
    case when p_marca     is not null then 1 else 0 end +
    case when p_modelo    is not null then 1 else 0 end +
    case when p_anio      is not null then 1 else 0 end +
    case when p_cpu       is not null then 1 else 0 end +
    case when p_ram       is not null then 1 else 0 end +
    case when p_disco     is not null then 1 else 0 end +
    case when p_condicion is not null then 1 else 0 end +
    case when p_estado    is not null then 1 else 0 end
  ) * 100 / 9)::smallint;
$$;

-- Score de renovación (0-100, misma lógica que el pipeline Python)
create or replace function silver.calc_renovation_score(
  p_anio smallint, p_ciclos integer, p_condicion_bat text, p_cpu text
) returns smallint language plpgsql immutable as $$
declare
  score int := 0;
  edad  int := extract(year from now())::int - coalesce(p_anio, 2024);
begin
  score := score + case
    when edad >= 5 then 50 when edad >= 4 then 35
    when edad >= 3 then 20 else 0 end;
  if p_ciclos is not null then
    score := score + case
      when p_ciclos > 900 then 25 when p_ciclos > 700 then 15
      when p_ciclos > 500 then 8  else 0 end;
  end if;
  if lower(p_condicion_bat) like '%defect%' or lower(p_condicion_bat) like '%nornal%' then
    score := score + 8;
  end if;
  return least(100, score)::smallint;
end; $$;

-- Asset Risk Score (0-100)
create or replace function silver.calc_risk_score(
  p_anio smallint, p_estado public.tb_asset_status,
  p_ciclos integer, p_cpu text, p_ram text
) returns smallint language plpgsql immutable as $$
declare
  score int := 0;
  edad  int := extract(year from now())::int - coalesce(p_anio, 2024);
begin
  score := score + case
    when edad >= 6 then 30 when edad >= 5 then 22
    when edad >= 4 then 12 when edad >= 3 then 5 else 0 end;
  score := score + case p_estado
    when 'Defectuoso'    then 25 when 'De Baja'      then 20
    when 'Por Recuperar' then 15 else 0 end;
  if p_ciclos is not null then
    score := score + case
      when p_ciclos > 900 then 20 when p_ciclos > 700 then 12
      when p_ciclos > 500 then 6  else 0 end;
  end if;
  score := score + case
    when p_cpu ilike '%intel%' then 15
    when p_cpu ilike '%M1%'    then 5  else 0 end;
  if lower(p_ram) like '%8%gb%' or lower(p_ram) like '%8 gb%'
     or lower(p_ram) like '%8gb%' then
    score := score + 8;
  end if;
  return least(100, score)::smallint;
end; $$;

-- Risk nivel from score
create or replace function silver.risk_nivel(p_score smallint)
returns public.tb_risk_level language sql immutable as $$
  select case
    when p_score >= 70 then 'CRÍTICO'
    when p_score >= 50 then 'ALTO'
    when p_score >= 25 then 'MEDIO'
    else 'BAJO'
  end::public.tb_risk_level;
$$;

-- Valor depreciado (lineal 5 años, residual 10%)
create or replace function silver.calc_valor_dep(
  p_precio_nuevo numeric, p_anio smallint, p_condicion public.tb_asset_condition
) returns numeric language plpgsql immutable as $$
declare
  edad    int     := extract(year from now())::int - coalesce(p_anio, 2020);
  dep_pct numeric := least(1.0, edad::numeric / 5.0);
  val     numeric;
begin
  val := p_precio_nuevo * greatest(0.10, 1.0 - dep_pct);
  if p_condicion = 'Defectuoso' then val := val * 0.5; end if;
  return round(val, 2);
end; $$;

-- Precio de referencia por generación de CPU
create or replace function silver.cpu_precio_nuevo(p_cpu text)
returns numeric language sql immutable as $$
  select case
    when p_cpu ilike '%M5%' then 2200
    when p_cpu ilike '%M4%' then 2000
    when p_cpu ilike '%M3%' then 1900
    when p_cpu ilike '%M2%' then 1800
    when p_cpu ilike '%M1%' then 1700
    when p_cpu ilike '%i7%' then 1600
    when p_cpu ilike '%i5%' then 1400
    else 1500
  end::numeric;
$$;

-- Trigger: updated_at automático
create or replace function silver._set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ── silver.dim_client ─────────────────────────────────────────
create table if not exists silver.dim_client (
  client_id    serial       primary key,
  name         text         not null unique,   -- salida de normalize_client()
  name_aliases text[]       not null default '{}',
  sector       text,
  region       text,
  is_active    boolean      not null default true,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);
create index if not exists idx_silver_client_name on silver.dim_client(name);

drop trigger if exists trg_silver_client_updated_at on silver.dim_client;
create trigger trg_silver_client_updated_at
  before update on silver.dim_client
  for each row execute function silver._set_updated_at();

comment on table silver.dim_client is
  'Maestro de clientes/proyectos. name siempre es output de normalize_client().';

-- ── silver.dim_employee ───────────────────────────────────────
create table if not exists silver.dim_employee (
  employee_id  serial       primary key,
  full_name    text         not null,
  rut          text,
  email        text,
  client_id    integer      references silver.dim_client(client_id),
  is_active    boolean      not null default true,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);
create index if not exists idx_silver_emp_name   on silver.dim_employee(full_name);
create index if not exists idx_silver_emp_rut    on silver.dim_employee(rut);
create index if not exists idx_silver_emp_client on silver.dim_employee(client_id);

drop trigger if exists trg_silver_emp_updated_at on silver.dim_employee;
create trigger trg_silver_emp_updated_at
  before update on silver.dim_employee
  for each row execute function silver._set_updated_at();

comment on table silver.dim_employee is
  'Maestro de colaboradores. Vinculado a cliente actual vía client_id.';

-- ── silver.dim_asset ─────────────────────────────────────────
create table if not exists silver.dim_asset (
  -- PK: serial normalizado
  serial                text         primary key,

  -- Identidad
  sku                   text,
  tipo                  text,
  marca                 text,
  modelo                text,
  color                 text,
  anio_fabricacion      smallint,
  sistema_operativo     text,
  pantalla              text,

  -- Hardware (normalizado)
  cpu                   text,        -- output de normalize_cpu()
  cpu_gen               smallint,    -- output de cpu_gen()
  ram                   text,
  disco                 text,
  ciclos_bateria        integer,
  condicion_bateria     text,

  -- Estado (enum normalizado)
  estado                public.tb_asset_status,
  condicion             public.tb_asset_condition,

  -- Asignación (FK + desnormalizado para lecturas rápidas)
  client_id             integer      references silver.dim_client(client_id),
  cliente               text,        -- desnormalizado
  employee_id           integer      references silver.dim_employee(employee_id),
  empleado              text,        -- desnormalizado
  tipo_colaborador      text,
  perfil                text,
  ambito_laboral        text,
  localizacion          text,
  ciudad                text,
  propiedad             text,

  -- Fechas
  fecha_compra          date,
  fecha_mantenimiento   date,
  fecha_asignacion      date,

  -- Financiero (calculado por Silver)
  precio_nuevo_usd      numeric(10,2),
  valor_dep_usd         numeric(10,2),
  dep_acumulada_usd     numeric(10,2),
  pct_depreciado        numeric(5,1),
  costo_renovacion_usd  numeric(10,2),

  -- Risk & Quality (calculados por Silver)
  risk_score            smallint     check (risk_score between 0 and 100),
  risk_nivel            public.tb_risk_level,
  score_renovacion      smallint     check (score_renovacion between 0 and 100),
  candidato_renovacion  boolean      not null default false,
  calidad_dato          smallint     check (calidad_dato between 0 and 100),

  -- Flags
  es_duplicado          boolean      not null default false,

  -- Trazabilidad desde Bronze
  fuente_hoja           text,
  batch_id              uuid         references bronze.ingestion_batches(batch_id),
  load_timestamp        timestamptz  not null default now(),
  updated_at            timestamptz  not null default now()
);

create index if not exists idx_silver_asset_estado       on silver.dim_asset(estado);
create index if not exists idx_silver_asset_client_id    on silver.dim_asset(client_id);
create index if not exists idx_silver_asset_cliente      on silver.dim_asset(cliente);
create index if not exists idx_silver_asset_risk         on silver.dim_asset(risk_nivel);
create index if not exists idx_silver_asset_candidato    on silver.dim_asset(candidato_renovacion);
create index if not exists idx_silver_asset_updated      on silver.dim_asset(updated_at desc);
create index if not exists idx_silver_asset_anio         on silver.dim_asset(anio_fabricacion);
create index if not exists idx_silver_asset_cpu          on silver.dim_asset(cpu);

drop trigger if exists trg_silver_asset_updated_at on silver.dim_asset;
create trigger trg_silver_asset_updated_at
  before update on silver.dim_asset
  for each row execute function silver._set_updated_at();

comment on table silver.dim_asset is
  'Registro maestro de cada activo físico. '
  'Upsert en serial tras cada ingesta Bronze. '
  'Todos los campos calculados (risk_score, calidad_dato, financiero) se computan aquí.';

-- ── silver.fact_movements ────────────────────────────────────
create table if not exists silver.fact_movements (
  -- PK determinístico: hash MD5(tipo||fecha||empleado||serial||row_idx)
  movement_id              text         primary key,

  tipo_movimiento          public.tb_movement_type not null,
  estado_resultante        public.tb_asset_status,

  -- Temporal
  fecha                    date,
  fecha_retiro_confirmada  date,
  tiene_fecha              boolean      not null default false,

  -- Persona (FK + desnormalizado)
  empleado                 text,
  rut_empleado             text,
  employee_id              integer      references silver.dim_employee(employee_id),
  gestionado_por           text,

  -- Activo (FK + desnormalizado)
  serial                   text         references silver.dim_asset(serial)
                              on delete set null,
  modelo_raw               text,
  cpu                      text,
  ram                      text,
  anio_fabricacion         smallint,
  precio_referencia_usd    numeric(10,2),
  tiene_serial             boolean      not null default false,

  -- Contexto de negocio
  cliente                  text,
  client_id                integer      references silver.dim_client(client_id),
  ubicacion                text,

  -- Snapshot del activo en el momento del movimiento
  asset_cpu                text,
  asset_anio               smallint,
  asset_estado_actual      public.tb_asset_status,
  asset_risk_score         smallint,
  asset_risk_nivel         public.tb_risk_level,
  asset_valor_dep          numeric(10,2),

  -- Flags de calidad y gobierno
  fuente_hoja              text         not null,
  es_inferido              boolean      not null default false,

  -- Target ML: evaluación subjetiva del gestor IT
  riesgo_percibido_it      public.tb_risk_level,

  -- Trazabilidad desde Bronze
  batch_id                 uuid         references bronze.ingestion_batches(batch_id),
  source_file              text,
  load_timestamp           timestamptz  not null default now()
);

create index if not exists idx_silver_mov_serial      on silver.fact_movements(serial);
create index if not exists idx_silver_mov_fecha        on silver.fact_movements(fecha);
create index if not exists idx_silver_mov_tipo         on silver.fact_movements(tipo_movimiento);
create index if not exists idx_silver_mov_cliente      on silver.fact_movements(cliente);
create index if not exists idx_silver_mov_client_id    on silver.fact_movements(client_id);
create index if not exists idx_silver_mov_fuente       on silver.fact_movements(fuente_hoja);
create index if not exists idx_silver_mov_inferido     on silver.fact_movements(es_inferido);
create index if not exists idx_silver_mov_riesgo_it    on silver.fact_movements(riesgo_percibido_it)
  where riesgo_percibido_it is not null;
create index if not exists idx_silver_mov_batch        on silver.fact_movements(batch_id);
-- Índice compuesto: cadena de eventos por activo
create index if not exists idx_silver_mov_serial_fecha on silver.fact_movements(serial, fecha);

comment on table  silver.fact_movements is
  'Cada evento discreto sobre un activo. Append-only. '
  'movement_id es un hash determinístico: re-ejecutar el pipeline no genera duplicados.';
comment on column silver.fact_movements.riesgo_percibido_it is
  'Evaluación subjetiva del gestor IT. '
  'TARGET del modelo ML supervisado de Asset Risk (Dic 2026). '
  'Cada movimiento completado con este campo es un registro de entrenamiento.';

-- ── silver.fact_asset_snapshot ───────────────────────────────
create table if not exists silver.fact_asset_snapshot (
  snapshot_date         date                   not null,
  snapshot_kind         public.tb_snapshot_kind not null default 'monthly',
  serial                text,
  estado                public.tb_asset_status,
  condicion             public.tb_asset_condition,
  cliente               text,
  area                  text,
  proyecto              text,
  plataforma            text,
  marca                 text,
  modelo                text,
  anio_fabricacion      smallint,
  ram                   text,
  disco                 text,
  empleado              text,
  ciudad                text,
  fuente                text,
  valor_depreciado      numeric(10,2),
  precio_nuevo          numeric(10,2),
  costo_renovacion      numeric(10,2),
  score_renovacion      smallint,
  calidad_dato          smallint,
  risk_score            smallint,
  risk_nivel            public.tb_risk_level,
  es_simulado           boolean                not null default false,
  batch_id              uuid                   references bronze.ingestion_batches(batch_id),
  load_timestamp        timestamptz            not null default now(),
  primary key (snapshot_date, coalesce(serial, 'NO_SERIAL_' || extract(epoch from now())::text))
);

create index if not exists idx_silver_snap_date    on silver.fact_asset_snapshot(snapshot_date desc);
create index if not exists idx_silver_snap_serial  on silver.fact_asset_snapshot(serial);
create index if not exists idx_silver_snap_estado  on silver.fact_asset_snapshot(estado);
create index if not exists idx_silver_snap_cliente on silver.fact_asset_snapshot(cliente);

comment on table silver.fact_asset_snapshot is
  'Fotografía mensual/manual del parque. PK: (snapshot_date, serial). '
  'Habilita: ¿Cómo era el parque hace 3 meses?';
