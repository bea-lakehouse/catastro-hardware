-- stg_mtr_1202_equipos_asignados_norm
-- Fuente: analytics.mtr_1202_equipos_asignados_raw (JSONB)
-- Normaliza columnas clave para dashboard

with src as (
  select row_raw
  from {{ source('analytics','mtr_1202_equipos_asignados_raw') }}
),
base as (
  select
    -- SKU viene como "10.0" en asignados, lo normalizamos
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
    nullif(trim(row_raw->>'Ámbito laboral'), '') as ambito_laboral,
    nullif(trim(row_raw->>'Localización'), '') as ubicacion,
    nullif(trim(row_raw->>'Ciudad/Comuna'), '') as ciudad_comuna,

    nullif(trim(row_raw->>'Estatus del Equipo'), '') as estado_equipo,

    {{ mtr_parse_timestamp("row_raw->>'Fecha de Asignación'") }} as fecha_asignacion,
    {{ mtr_parse_date("row_raw->>'Fecha de Compra'") }} as fecha_compra,
    {{ mtr_parse_timestamp("row_raw->>'Fecha de Mantenimiento'") }} as fecha_mantenimiento,

    row_raw
  from src
),
final as (
  select
    *,
    -- plataforma derivada
    case
      when sistema_operativo is null then 'unknown'
      when lower(sistema_operativo) like '%mac%' or lower(sistema_operativo) like '%ventura%' or lower(sistema_operativo) like '%sonoma%' or lower(sistema_operativo) like '%sequoia%'
        then 'mac'
      when lower(sistema_operativo) like '%win%' then 'windows'
      else 'unknown'
    end as plataforma,

    -- por defecto: asignados son "Chile" (se corrige con tabla extranjero)
    'Chile'::text as pais

  from base
)
select * from final
