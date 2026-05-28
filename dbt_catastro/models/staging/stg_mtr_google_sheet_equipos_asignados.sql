{{ config(materialized='view', tags=['staging','mtr','google_sheets']) }}

with src as (
  select
    run_id,
    row_number,
    row_data
  from {{ source('raw', 'mtr_google_sheet_rows') }}
  where source_name = 'equipos_asignados'
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
      row_data->>'Estatus del Equipo',
      row_data->>'estatus_del_equipo',
      row_data->>'Estado del Equipo'
    )), '') as estado_equipo,

    nullif(trim(coalesce(
      row_data->>'Cliente',
      row_data->>'cliente'
    )), '') as cliente,

    nullif(trim(coalesce(
      row_data->>'Empleado Asignado',
      row_data->>'empleado_asignado'
    )), '') as persona_asignada,

    nullif(trim(coalesce(
      row_data->>'Ambito laboral',
      row_data->>'Ámbito laboral',
      row_data->>'ambito_laboral'
    )), '') as ambito_laboral,

    nullif(trim(coalesce(
      row_data->>'Localizacion',
      row_data->>'Localización',
      row_data->>'localizacion'
    )), '') as localizacion,

    nullif(trim(coalesce(
      row_data->>'Ciudad/Comuna',
      row_data->>'Ciudad Comuna',
      row_data->>'ciudad_comuna'
    )), '') as ciudad_comuna,

    nullif(trim(coalesce(
      row_data->>'Fecha de Compra',
      row_data->>'fecha_de_compra'
    )), '') as fecha_compra_raw,

    nullif(trim(coalesce(
      row_data->>'Fecha de Asignación',
      row_data->>'Fecha de Asignacion',
      row_data->>'fecha_de_asignacion'
    )), '') as fecha_asignacion_raw,

    nullif(trim(coalesce(
      row_data->>'Marca',
      row_data->>'marca'
    )), '') as marca,

    nullif(trim(coalesce(
      row_data->>'Modelo',
      row_data->>'modelo'
    )), '') as modelo,

    nullif(trim(coalesce(
      row_data->>'Sistema Operativo',
      row_data->>'sistema_operativo'
    )), '') as sistema_operativo,

    nullif(trim(coalesce(
      row_data->>'Condición',
      row_data->>'Condicion',
      row_data->>'condicion'
    )), '') as condicion,

    nullif(trim(coalesce(
      row_data->>'Nro Serie',
      row_data->>'Nro. Serie',
      row_data->>'nro_serie'
    )), '') as nro_serie,

    nullif(trim(coalesce(
      row_data->>'CPU',
      row_data->>'cpu'
    )), '') as cpu,

    nullif(trim(coalesce(
      row_data->>'Ram',
      row_data->>'RAM',
      row_data->>'ram'
    )), '') as ram,

    nullif(trim(coalesce(
      row_data->>'Tipo de colaborador',
      row_data->>'tipo_de_colaborador',
      row_data->>'tipo_colaborador'
    )), '') as tipo_colaborador_mtr
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

    estado_equipo,
    cliente,
    persona_asignada,
    ambito_laboral,
    localizacion,
    ciudad_comuna,
    fecha_compra_raw,
    fecha_asignacion_raw,
    marca,
    modelo,
    sistema_operativo,
    condicion,
    nro_serie,
    cpu,
    ram,
    case
      when lower(tipo_colaborador_mtr) in ('core', 'staffing', 'unknown') then lower(tipo_colaborador_mtr)
      when tipo_colaborador_mtr is null then null
      else 'unknown'
    end as tipo_colaborador_mtr,

    {{ mtr_parse_date("fecha_compra_raw") }} as fecha_compra,
    {{ mtr_parse_date("fecha_asignacion_raw") }} as fecha_asignacion
  from parsed
)

select
  case
    when sku is null then null
    else 'SKU-' || sku::text
  end as id_equipo,
  sku,
  estado_equipo,
  cliente,
  persona_asignada,
  ambito_laboral,
  localizacion,
  ciudad_comuna,
  fecha_compra,
  fecha_compra_raw,
  fecha_asignacion,
  fecha_asignacion_raw,
  marca,
  modelo,
  sistema_operativo,
  condicion,
  nro_serie,
  cpu,
  ram,
  tipo_colaborador_mtr,
  run_id,
  row_number,
  current_timestamp as _loaded_at
from normalized
where sku is not null
