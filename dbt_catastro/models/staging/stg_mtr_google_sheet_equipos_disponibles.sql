{{ config(materialized='view', tags=['staging','mtr','google_sheets']) }}

with src as (
  select
    run_id,
    row_number,
    row_data
  from {{ source('raw', 'mtr_google_sheet_rows') }}
  where source_name = 'equipos_disponibles'
),

parsed as (
  select
    run_id,
    row_number,

    nullif(trim(coalesce(
      row_data->>'SKU',
      row_data->>'sku'
    )), '') as sku_raw,

    nullif(trim(coalesce(
      row_data->>'Marca',
      row_data->>'marca'
    )), '') as marca,

    nullif(trim(coalesce(
      row_data->>'Modelo',
      row_data->>'modelo'
    )), '') as modelo,

    nullif(trim(coalesce(
      row_data->>'Nro Serie',
      row_data->>'Nro. Serie',
      row_data->>'nro_serie',
      row_data->>'serial'
    )), '') as nro_serie,

    nullif(trim(coalesce(
      row_data->>'Condición',
      row_data->>'Condicion',
      row_data->>'condicion'
    )), '') as condicion,

    nullif(trim(coalesce(
      row_data->>'Localizacion',
      row_data->>'Localización',
      row_data->>'localizacion',
      row_data->>'ubicacion'
    )), '') as ubicacion,

    nullif(trim(coalesce(
      row_data->>'Plataforma',
      row_data->>'plataforma'
    )), '') as plataforma
  from src
),

normalized as (
  select
    run_id,
    row_number,
    case
      when sku_raw is null then null
      when sku_raw ~ '^[0-9]+(\.0+)?$' then split_part(sku_raw, '.', 1)::bigint
      else null
    end as sku,
    marca,
    modelo,
    nro_serie,
    condicion,
    ubicacion,
    plataforma
  from parsed
)

select
  sku,
  case
    when sku is null then null
    else 'SKU-' || sku::text
  end as id_equipo,
  marca,
  modelo,
  nro_serie as serial,
  condicion,
  ubicacion,
  plataforma,
  run_id,
  row_number,
  current_timestamp as _loaded_at
from normalized
where sku is not null
