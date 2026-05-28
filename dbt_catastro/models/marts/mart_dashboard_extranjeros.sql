-- mart_dashboard_extranjeros
-- Dashboard principal para tabla (cliente, sku, condicion, mac/win, extranjero/chile, modelo)

with a as (
  select *
  from {{ ref('stg_mtr_1202_equipos_asignados_norm') }}
),
x as (
  select *
  from {{ ref('stg_mtr_1202_equ_extranjero_norm') }}
),
final as (
  select
    a.id_equipo,
    a.sku,

    -- asignación
    coalesce(nullif(trim(a.cliente_actual),''), 'Sin cliente') as cliente_asignado,
    nullif(trim(a.persona_actual),'') as persona_asignada,
    nullif(trim(a.tipo_colaborador),'') as tipo_colaborador,
    nullif(trim(a.estado_equipo),'') as estado_equipo,

    -- specs: si existe extranjero, preferimos ese (porque a veces está más completo)
    coalesce(x.marca, a.marca) as marca,
    coalesce(x.modelo, a.modelo) as modelo,
    coalesce(x.sistema_operativo, a.sistema_operativo) as sistema_operativo,
    coalesce(x.condicion, a.condicion) as condicion,

    -- plataforma
    coalesce(x.plataforma, a.plataforma, 'unknown') as plataforma,

    -- ambito laboral / ubicación
    a.ambito_laboral,
    a.ubicacion,
    a.ciudad_comuna,

    -- extranjero/chile
    case
      when x.id_equipo is not null then 'Extranjero'
      when lower(coalesce(a.ambito_laboral,'')) like '%extranj%' then 'Extranjero'
      else 'Chile'
    end as ambito,

    coalesce(x.pais, a.pais, 'Chile') as pais,
    coalesce(x.ciudad, a.ciudad_comuna) as ciudad,

    -- fechas
    coalesce(x.fecha_asignacion, a.fecha_asignacion) as fecha_asignacion,
    coalesce(x.fecha_compra, a.fecha_compra) as fecha_compra,

    -- detalle del equipo
    coalesce(x.modelo, a.modelo) as detalle_modelo

  from a
  left join x using (id_equipo)
)

select * from final