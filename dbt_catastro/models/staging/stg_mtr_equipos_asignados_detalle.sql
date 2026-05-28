with src as (
    select
        nullif(trim(sku::text), '') as sku,
        nullif(trim(id_equipo::text), '') as id_equipo,
        nullif(trim(persona_asignada::text), '') as persona_asignada,
        nullif(trim(cliente::text), '') as cliente,
        nullif(trim(tipo_colaborador::text), '') as tipo_colaborador_raw,
        nullif(trim(fecha_asignacion::text), '') as fecha_asignacion_raw,
        nullif(trim(estatus_equipo::text), '') as estatus_equipo,
        nullif(trim(condicion::text), '') as condicion,
        nullif(trim(marca::text), '') as marca,
        nullif(trim(modelo::text), '') as modelo,
        nullif(trim(localizacion::text), '') as localizacion,
        nullif(trim(ciudad_comuna::text), '') as ciudad_comuna,
        nullif(trim(sistema_operativo::text), '') as sistema_operativo,
        nullif(trim(plataforma::text), '') as plataforma
    from analytics.mtr_equipos_asignados_xlsx
),

norm as (
    select
        sku,
        id_equipo,
        persona_asignada,
        cliente,
        case
            when lower(coalesce(tipo_colaborador_raw, '')) in ('core', 'interno', 'internal') then 'core'
            when lower(coalesce(tipo_colaborador_raw, '')) in ('staffing', 'externo', 'external') then 'staffing'
            when lower(coalesce(tipo_colaborador_raw, '')) like '%core%' then 'core'
            when lower(coalesce(tipo_colaborador_raw, '')) like '%staff%' then 'staffing'
            when lower(coalesce(tipo_colaborador_raw, '')) like '%extern%' then 'staffing'
            when lower(coalesce(tipo_colaborador_raw, '')) like '%intern%' then 'core'
            else 'unknown'
        end as tipo_colaborador,
        fecha_asignacion_raw,
        {{ mtr_parse_date("fecha_asignacion_raw") }} as fecha_asignacion,
        estatus_equipo,
        condicion,
        marca,
        modelo,
        localizacion,
        ciudad_comuna,
        sistema_operativo,
        plataforma
    from src
)

select
    sku,
    id_equipo,
    persona_asignada,
    cliente,
    tipo_colaborador,
    fecha_asignacion,
    fecha_asignacion_raw,
    estatus_equipo,
    condicion,
    marca,
    modelo,
    localizacion,
    ciudad_comuna,
    sistema_operativo,
    plataforma
from norm
where sku is not null
  and id_equipo is not null
