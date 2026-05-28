with sheet as (
  select
    id_equipo,
    estado_equipo,
    cliente,
    persona_asignada,
    ambito_laboral,
    localizacion,
    ciudad_comuna,
    fecha_compra,
    fecha_asignacion,
    'google_sheet'::text as mtr_assignment_source
  from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
),

legacy as (
  select
    case
      when "sku" is null then null
      else 'SKU-' || (
        case
          when ("sku"::text) ~ '^[0-9]+(\.0+)?$' then split_part("sku"::text, '.', 1)::bigint
          else null
        end
      )::text
    end as id_equipo,
    nullif(trim("estatus_del_equipo"::text), '') as estado_equipo,
    nullif(trim("cliente"::text), '') as cliente,
    nullif(trim("empleado_asignado"::text), '') as persona_asignada,
    nullif(trim("ambito_laboral"::text), '') as ambito_laboral,
    nullif(trim("localizacion"::text), '') as localizacion,
    nullif(trim("ciudad_comuna"::text), '') as ciudad_comuna,
    case
      when nullif(trim("fecha_de_compra"::text), '') is null then null
      else left(nullif(trim("fecha_de_compra"::text), ''), 10)::date
    end as fecha_compra,
    null::date as fecha_asignacion,
    'legacy_compat_view'::text as mtr_assignment_source
  from analytics.v_mtr0903_equipos_asignados_norm_compat
),

base as (
  select * from sheet
  union all
  select * from legacy
  where not exists (select 1 from sheet)
),

final as (
  select
    id_equipo,
    estado_equipo,
    persona_asignada,
    cliente,
    localizacion,
    ciudad_comuna,
    fecha_compra,
    fecha_asignacion,
    ambito_laboral,
    mtr_assignment_source
  from base
)
select * from final
