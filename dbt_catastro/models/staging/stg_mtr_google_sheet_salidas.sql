{{ config(materialized='view', tags=['staging','mtr','google_sheets','movimientos']) }}

with src as (
  select
    run_id,
    row_number,
    row_data
  from {{ source('raw', 'mtr_google_sheet_rows') }}
  where source_name = 'salidas'
),

parsed as (
  select
    run_id,
    row_number,
    nullif(trim(coalesce(
      row_data->>'Entrega Equipo Computacional',
      row_data->>'SKU',
      row_data->>'sku',
      row_data->>'Id Equipo',
      row_data->>'ID Equipo',
      row_data->>'id_equipo'
    )), '') as sku_raw,
    nullif(trim(coalesce(
      row_data->>'Rut',
      row_data->>'rut'
    )), '') as rut,
    nullif(trim(coalesce(
      row_data->>'Fecha de Salida',
      row_data->>'Fecha Salida',
      row_data->>'Fecha',
      row_data->>'fecha_evento'
    )), '') as fecha_evento_raw,
    coalesce(nullif(trim(coalesce(
      row_data->>'Tipo Evento',
      row_data->>'tipo_evento',
      row_data->>'Tipo de Evento'
    )), ''), 'DEVOLUCION') as tipo_evento,
    nullif(trim(coalesce(
      row_data->>'Nombres',
      row_data->>'column_1',
      row_data->>'Persona',
      row_data->>'persona',
      row_data->>'Empleado Asignado',
      row_data->>'empleado_asignado',
      row_data->>'Nombre'
    )), '') as persona,
    nullif(trim(coalesce(
      row_data->>'Cliente',
      row_data->>'cliente'
    )), '') as cliente,
    nullif(trim(coalesce(
      row_data->>'Perfil',
      row_data->>'perfil'
    )), '') as perfil,
    nullif(trim(coalesce(
      row_data->>'Marca',
      row_data->>'marca'
    )), '') as marca,
    nullif(trim(coalesce(
      row_data->>'Modelo',
      row_data->>'modelo'
    )), '') as modelo,
    nullif(trim(coalesce(
      row_data->>'Plataforma',
      row_data->>'plataforma',
      row_data->>'Sistema Operativo'
    )), '') as plataforma,
    nullif(trim(coalesce(
      row_data->>'Detalle',
      row_data->>'detalle'
    )), '') as detalle
  from src
),

normalized as (
  select
    run_id,
    row_number,
    case
      when sku_raw is null then null
      when sku_raw ~ '^SKU-' then sku_raw
      when sku_raw ~ '^[0-9]+(\.0+)?$' then 'SKU-' || split_part(sku_raw, '.', 1)
      when regexp_replace(sku_raw, '[^0-9]', '', 'g') <> '' then 'SKU-' || regexp_replace(sku_raw, '[^0-9]', '', 'g')
      else null
    end as id_equipo,
    fecha_evento_raw,
    {{ mtr_parse_date("fecha_evento_raw") }} as fecha_evento,
    {{ mtr_date_parse_strategy("fecha_evento_raw") }} as fecha_evento_formato,
    {{ mtr_date_was_normalized("fecha_evento_raw") }} as fecha_evento_normalizada,
    tipo_evento,
    persona,
    rut,
    cliente,
    perfil,
    marca,
    modelo,
    plataforma,
    detalle
  from parsed
)

select
  id_equipo,
  fecha_evento,
  fecha_evento_raw,
  fecha_evento_formato,
  fecha_evento_normalizada,
  tipo_evento,
  persona,
  rut,
  cliente,
  perfil,
  marca,
  modelo,
  plataforma,
  detalle,
  'MTR_GOOGLE_SHEET'::text as fuente_origen,
  run_id,
  row_number,
  current_timestamp as _loaded_at
from normalized
where fecha_evento is not null
  and fecha_evento <= current_date + {{ var('mtr_operational_horizon_days', 7) }}
