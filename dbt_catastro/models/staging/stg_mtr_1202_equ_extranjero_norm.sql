-- stg_mtr_1202_equ_extranjero_norm
-- Fuente: analytics.mtr_1202_equ_extranjero_raw (JSONB)

with src as (
  select row_raw
  from {{ source('analytics','mtr_1202_equ_extranjero_raw') }}
),
base as (
  select
    case
      when nullif(trim(row_raw->>'SKU'), '') is null then null
      when (row_raw->>'SKU') ~ '^[0-9]+(\.0+)?$' then split_part(row_raw->>'SKU','.',1)::bigint
      else null
    end as sku,

    case
      when nullif(trim(row_raw->>'SKU'), '') is null then null
      when (row_raw->>'SKU') ~ '^[0-9]+(\.0+)?$' then 'SKU-' || split_part(row_raw->>'SKU','.',1)
      else null
    end as id_equipo,

    nullif(trim(row_raw->>'Marca'), '') as marca,
    nullif(trim(row_raw->>'Modelo'), '') as modelo,
    nullif(trim(row_raw->>'Sistema Operativo'), '') as sistema_operativo,
    nullif(trim(row_raw->>'Condición'), '') as condicion,

    nullif(trim(row_raw->>'Cliente'), '') as cliente_actual,
    nullif(trim(row_raw->>'Empleado Asignado'), '') as persona_actual,
    nullif(trim(row_raw->>'Tipo de colaborador'), '') as tipo_colaborador,

    nullif(trim(row_raw->>'Pais'), '') as pais,
    nullif(trim(row_raw->>'Ciudad'), '') as ciudad,

    {{ mtr_parse_timestamp("row_raw->>'Fecha Asignación'") }} as fecha_asignacion,
    {{ mtr_parse_date("row_raw->>'Fecha Compra'") }} as fecha_compra,
    {{ mtr_parse_timestamp("row_raw->>'Fecha Mantenimiento'") }} as fecha_mantenimiento,

    row_raw
  from src
),
final as (
  select
    *,
    case
      when sistema_operativo is null then 'unknown'
      when lower(sistema_operativo) like '%mac%' or lower(sistema_operativo) like '%ventura%' or lower(sistema_operativo) like '%sonoma%' or lower(sistema_operativo) like '%sequoia%'
        then 'mac'
      when lower(sistema_operativo) like '%win%' then 'windows'
      else 'unknown'
    end as plataforma
  from base
)
select * from final
