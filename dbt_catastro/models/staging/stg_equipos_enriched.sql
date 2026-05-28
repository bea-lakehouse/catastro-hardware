-- stg_equipos_enriched
-- Une:
--  - stg_equipos (inventario limpio por SKU)
--  - stg_mtr_equipos_asignados (estado/persona/cliente/localización/fecha_compra)
-- para alimentar política/presión (int_politica_equipos + int_presion_stock)

with inv as (
  select * from {{ ref('stg_equipos') }}
),
asg as (
  select
    id_equipo,
    estado_equipo,
    cliente,
    persona_asignada,
    fecha_compra,
    mtr_assignment_source
  from {{ ref('stg_mtr_equipos_asignados') }}
),
mtr as (
  with sheet as (
    select
      id_equipo,
      marca,
      modelo,
      case
        when lower(coalesce(sistema_operativo, '')) like '%mac%' then 'Mac'
        when lower(coalesce(sistema_operativo, '')) like '%win%' then 'Win'
        when lower(coalesce(sistema_operativo, '')) like '%android%' then 'Movil'
        when lower(coalesce(sistema_operativo, '')) like '%ios%' then 'Movil'
        else null
      end as os_familia,
      tipo_colaborador_mtr,
      condicion,
      'google_sheet'::text as mtr_specs_source_used
    from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
  ),
  legacy as (
    select
      id_equipo,
      marca,
      modelo,
      os_familia,
      tipo_colaborador_mtr,
      condicion,
      'legacy_tmp_view'::text as mtr_specs_source_used
    from analytics.v_tmp_mtr0903_equipos_asignados_norm
  )
  select *
  from sheet
  union all
  select *
  from legacy
  where not exists (select 1 from sheet)
)

select
  inv.id_equipo,
  inv.sku,
  coalesce(nullif(trim(inv.marca), ''), mtr.marca) as marca,
  {{ normalize_model_name("coalesce(nullif(trim(inv.modelo), ''), mtr.modelo)") }} as modelo,
  inv.cpu,
  inv.ram,
  coalesce(
    nullif(trim(inv.sistema_operativo), ''),
    case
      when mtr.os_familia = 'Mac' then 'macOS'
      when mtr.os_familia = 'Win' then 'Windows'
      when mtr.os_familia = 'Movil' then 'Mobile'
      else null
    end
  ) as sistema_operativo,
  inv.nro_serie,
  asg.fecha_compra,
  null::text as asset_tag,

  asg.estado_equipo as estado,
  asg.cliente as cliente_actual,
  asg.persona_asignada as persona_actual,

  coalesce(
    nullif(trim(inv.tipo_colaborador), ''),
    lower(nullif(trim(mtr.tipo_colaborador_mtr), '')),
    case
      when lower(nullif(trim(mtr.tipo_colaborador_mtr), '')) = 'core' then 'core'
      when lower(nullif(trim(mtr.tipo_colaborador_mtr), '')) = 'staffing' then 'staffing'
      else null
    end
  ) as tipo_colaborador,

  coalesce(nullif(trim(inv.condicion), ''), mtr.condicion) as condicion,
  asg.mtr_assignment_source,
  mtr.mtr_specs_source_used,
  current_timestamp as _loaded_at
from inv
left join asg on asg.id_equipo = inv.id_equipo
left join mtr on mtr.id_equipo = inv.id_equipo
