{{ config(materialized='view', tags=['intermediate', 'specs', 'mtr']) }}

with base as (
  select
    case
      when id_equipo is null or trim(id_equipo) = '' then null
      when upper(trim(id_equipo)) like 'SKU-%' then upper(trim(id_equipo))
      when trim(id_equipo) ~ '^[0-9]+(\.0+)?$' then 'SKU-' || split_part(trim(id_equipo), '.', 1)
      else upper(trim(id_equipo))
    end as id_equipo,
    case
      when nullif(trim(coalesce(sku_raw, '')), '') ~ '^[0-9]+(\.0+)?$' then split_part(trim(sku_raw), '.', 1)::bigint
      when upper(coalesce(id_equipo, '')) ~ '^SKU-[0-9]+$' then replace(upper(id_equipo), 'SKU-', '')::bigint
      else null
    end as sku,
    nullif(trim(marca_raw), '') as marca_raw,
    nullif(trim(modelo_raw), '') as modelo_raw,
    nullif(trim(tipo_equipo_raw), '') as tipo_equipo_raw,
    nullif(trim(sistema_operativo_raw), '') as sistema_operativo_raw,
    nullif(trim(procesador_raw), '') as procesador_raw,
    nullif(trim(ram_raw), '') as ram_raw,
    nullif(trim(almacenamiento_raw), '') as almacenamiento_raw,
    nullif(trim(pantalla_raw), '') as pantalla_raw,
    nullif(trim(anio_modelo_raw), '') as anio_modelo_raw,
    nullif(trim(serial_raw), '') as serial_raw,
    nullif(trim(plataforma_raw), '') as plataforma_raw,
    fuente_origen,
    source_priority
  from {{ ref('stg_equipo_specs') }}
),

prepared as (
  select
    *,
    case
      when modelo_raw is not null then modelo_raw
      when lower(coalesce(marca_raw, '')) ~ '(macbook|elitebook|thinkpad|latitude|vivobook|ipad|iphone)' then marca_raw
      else null
    end as modelo_candidate_raw,
    regexp_match(lower(coalesce(ram_raw, '')), '([0-9]+(?:\.[0-9]+)?)\s*(gb|g|mb|m)') as ram_match,
    regexp_match(lower(coalesce(almacenamiento_raw, '')), '([0-9]+(?:\.[0-9]+)?)\s*(tb|gb)') as almacenamiento_match
  from base
),

normalized as (
  select
    id_equipo,
    sku,
    {{ normalize_specs_brand("coalesce(marca_raw, modelo_candidate_raw)") }} as marca,
    {{ normalize_specs_model("modelo_candidate_raw") }} as modelo,
    {{ normalize_specs_type("tipo_equipo_raw") }} as tipo_equipo,
    {{ normalize_specs_os("sistema_operativo_raw", "plataforma_raw") }} as sistema_operativo,
    nullif(trim(procesador_raw), '') as procesador,
    case
      when ram_match is null then null
      when ram_match[2] in ('gb', 'g') then round((ram_match[1])::numeric)::int
      when ram_match[2] in ('mb', 'm') then round(((ram_match[1])::numeric / 1024.0))::int
      else null
    end as ram_gb,
    case
      when almacenamiento_match is null then null
      when almacenamiento_match[2] = 'tb' then round(((almacenamiento_match[1])::numeric * 1024.0))::int
      when almacenamiento_match[2] = 'gb' then round((almacenamiento_match[1])::numeric)::int
      else null
    end as almacenamiento_gb,
    {{ normalize_specs_storage_type("almacenamiento_raw") }} as almacenamiento_tipo,
    nullif(trim(pantalla_raw), '') as pantalla,
    case
      when anio_modelo_raw ~ '^[12][0-9]{3}$' then anio_modelo_raw
      else nullif(trim(anio_modelo_raw), '')
    end as anio_modelo,
    nullif(trim(serial_raw), '') as serial,
    fuente_origen,
    source_priority
  from prepared
)

select
  id_equipo,
  sku,
  marca,
  modelo,
  tipo_equipo,
  sistema_operativo,
  procesador,
  ram_gb,
  almacenamiento_gb,
  almacenamiento_tipo,
  pantalla,
  anio_modelo,
  serial,
  fuente_origen,
  source_priority,
  (
    case when marca is not null then 1 else 0 end +
    case when modelo is not null then 1 else 0 end +
    case when tipo_equipo is not null then 1 else 0 end +
    case when sistema_operativo is not null then 1 else 0 end +
    case when procesador is not null then 1 else 0 end +
    case when ram_gb is not null then 1 else 0 end +
    case when almacenamiento_gb is not null then 1 else 0 end +
    case when almacenamiento_tipo is not null then 1 else 0 end +
    case when pantalla is not null then 1 else 0 end +
    case when anio_modelo is not null then 1 else 0 end +
    case when serial is not null then 1 else 0 end
  )::int as filled_specs_count,
  current_timestamp as _loaded_at
from normalized
where id_equipo is not null
