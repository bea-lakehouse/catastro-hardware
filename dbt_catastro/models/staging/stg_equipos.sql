-- stg_equipos (inventario base)
-- Universo base: MTR asignados normalizado
-- Specs principales: analytics.mtr_equipos_asignados
-- Refuerzo: analytics.equipos_backfill
-- Complemento de compra/estado: analytics.equipos_raw

with src as (
  with sheet as (
    select
      id_equipo,
      sku
    from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
  ),
  legacy as (
    select
      case
        when sku is null then null
        else 'SKU-' || (
          case
            when sku::text ~ '^[0-9]+(\.0+)?$' then split_part(sku::text, '.', 1)::bigint
            else null
          end
        )::text
      end as id_equipo,

      case
        when sku is null then null
        when sku::text ~ '^[0-9]+(\.0+)?$' then split_part(sku::text, '.', 1)::bigint
        else null
      end as sku
    from {{ ref('mtr_equipos_asignados_norm') }}
  )
  select
    id_equipo,
    sku
  from sheet
  union all
  select
    legacy.id_equipo,
    legacy.sku
  from legacy
  where not exists (select 1 from sheet)
),

raw as (
  select
    id_equipo,
    fecha_compra,
    estado
  from {{ source('analytics','equipos_raw') }}
),

bf as (
  select
    case
      when id_equipo is null or trim(id_equipo) = '' then null
      when upper(trim(id_equipo)) like 'SKU-%' then upper(trim(id_equipo))
      when trim(id_equipo) ~ '^[0-9]+(\.0+)?$' then 'SKU-' || split_part(trim(id_equipo), '.', 1)
      else upper(trim(id_equipo))
    end as id_equipo,
    nullif(trim(marca), '') as marca,
    nullif(trim(modelo), '') as modelo,
    nullif(trim(sistema_operativo), '') as sistema_operativo,
    nullif(trim(condicion), '') as condicion,
    nullif(trim(serial), '') as serial,
    nullif(trim(tipo_colaborador), '') as tipo_colaborador,
    nullif(trim(ubicacion), '') as ubicacion
  from {{ source('analytics','equipos_backfill') }}
),

mtr_specs as (
  with sheet as (
    select
      id_equipo,
      marca,
      modelo,
      sistema_operativo,
      condicion,
      nro_serie,
      cpu,
      ram,
      coalesce(tipo_colaborador_mtr, lower(nullif(trim(ambito_laboral), ''))) as tipo_colaborador,
      fecha_compra,
      estado_equipo as estado
    from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
  ),
  legacy as (
    select
      case
        when "SKU" is null then null
        else 'SKU-' || "SKU"::text
      end as id_equipo,
      nullif(trim("Marca"), '') as marca,
      nullif(trim("Modelo"), '') as modelo,
      nullif(trim("Sistema Operativo"), '') as sistema_operativo,
      nullif(trim("Condición"), '') as condicion,
      nullif(trim("Nro Serie"), '') as nro_serie,
      nullif(trim("CPU"), '') as cpu,
      nullif(trim("Ram"), '') as ram,
      case
        when nullif(trim("Tipo de colaborador"), '') is not null then lower(trim("Tipo de colaborador"))
        when nullif(trim("Ámbito laboral"), '') is not null then lower(trim("Ámbito laboral"))
        else null
      end as tipo_colaborador,
      "Fecha de Compra"::date as fecha_compra,
      nullif(trim("Estatus del Equipo"), '') as estado
    from analytics.mtr_equipos_asignados
  )
  select
    *
  from sheet
  union all
  select *
  from legacy
  where not exists (select 1 from sheet)
)

select
  s.id_equipo,
  s.sku,

  coalesce(r.fecha_compra, ms.fecha_compra) as fecha_compra,
  coalesce(r.estado, ms.estado) as estado,

  coalesce(bf.marca, ms.marca) as marca,
  {{ normalize_model_name("coalesce(bf.modelo, ms.modelo)") }} as modelo,

  ms.cpu,
  ms.ram,

  coalesce(bf.sistema_operativo, ms.sistema_operativo) as sistema_operativo,
  coalesce(bf.serial, ms.nro_serie) as nro_serie,

  case
    when coalesce(bf.tipo_colaborador, ms.tipo_colaborador) is null then null
    when lower(trim(coalesce(bf.tipo_colaborador, ms.tipo_colaborador))) in ('core','staffing','unknown') then lower(trim(coalesce(bf.tipo_colaborador, ms.tipo_colaborador)))
    when lower(trim(coalesce(bf.tipo_colaborador, ms.tipo_colaborador))) in ('nacional','extranjero','na') then 'unknown'
    else 'unknown'
  end as tipo_colaborador,

  coalesce(bf.condicion, ms.condicion) as condicion,

  current_timestamp as _loaded_at
from src s
left join raw r using (id_equipo)
left join bf using (id_equipo)
left join mtr_specs ms using (id_equipo)
where s.id_equipo is not null
