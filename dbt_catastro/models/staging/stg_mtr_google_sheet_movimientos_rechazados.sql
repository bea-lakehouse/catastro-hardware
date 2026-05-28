{{ config(materialized='view', tags=['staging','mtr','google_sheets','dq']) }}

with src as (
  select
    source_name,
    run_id,
    row_number,
    row_data
  from {{ source('raw', 'mtr_google_sheet_rows') }}
  where source_name in ('ingresos', 'salidas')
),

parsed as (
  select
    source_name,
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
      row_data->>'Fecha de Ingreso',
      row_data->>'Fecha de ingreso',
      row_data->>'Fecha Ingreso',
      row_data->>'Fecha ingreso',
      row_data->>'Fecha de Salida',
      row_data->>'Fecha Salida',
      row_data->>'Fecha',
      row_data->>'fecha_evento',
      row_data->>'Fecha de Asignación',
      row_data->>'Fecha de asignación',
      row_data->>'Fecha de Asignacion',
      row_data->>'Fecha de asignacion'
    )), '') as fecha_evento_raw,
    nullif(trim(coalesce(
      row_data->>'column_1',
      row_data->>'Nombres',
      row_data->>'Persona',
      row_data->>'persona',
      row_data->>'Empleado Asignado',
      row_data->>'empleado_asignado',
      row_data->>'Nombre'
    )), '') as persona,
    nullif(trim(coalesce(
      row_data->>'Cliente',
      row_data->>'cliente'
    )), '') as cliente
  from src
),

classified as (
  select
    source_name,
    run_id,
    row_number,
    sku_raw,
    fecha_evento_raw,
    persona,
    cliente,
    {{ mtr_parse_date("fecha_evento_raw") }} as fecha_evento_parseada,
    {{ mtr_date_parse_strategy("fecha_evento_raw") }} as fecha_evento_formato,
    {{ mtr_date_was_normalized("fecha_evento_raw") }} as fecha_evento_normalizada,
    {{ mtr_date_parse_error("fecha_evento_raw") }} as motivo_preliminar
  from parsed
),

rejected as (
  select
    source_name,
    run_id,
    row_number,
    sku_raw,
    fecha_evento_raw,
    fecha_evento_parseada,
    fecha_evento_formato,
    fecha_evento_normalizada,
    persona,
    cliente,
    case
      when motivo_preliminar is not null then motivo_preliminar
      when fecha_evento_parseada > current_date + {{ var('mtr_operational_horizon_days', 7) }}
        then 'fecha_fuera_horizonte_operativo'
      else null
    end as motivo_rechazo
  from classified
)

select
  source_name,
  run_id,
  row_number,
  sku_raw,
  fecha_evento_raw,
  fecha_evento_parseada,
  fecha_evento_formato,
  fecha_evento_normalizada,
  persona,
  cliente,
  motivo_rechazo,
  current_timestamp as _loaded_at
from rejected
where motivo_rechazo is not null
