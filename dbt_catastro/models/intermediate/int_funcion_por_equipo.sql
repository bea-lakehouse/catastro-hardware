with e as (
    select *
    from {{ ref('stg_equipos_enriched') }}
),
base as (
    select
        e.id_equipo,
        lower(
            coalesce(
                nullif(trim(coalesce(e.sistema_operativo, '')::text), ''),
                case
                    when lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%mac%'
                      or lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%apple%'
                      or lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%m1%'
                      or lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%m2%'
                      or lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%m3%'
                      or lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%m4%'
                        then 'mac'
                    when lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%hp%'
                      or lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%elitebook%'
                      or lower(coalesce(e.marca, '') || ' ' || coalesce(e.modelo, '')) like '%windows%'
                        then 'windows'
                    else 'unknown'
                end
            )
        ) as plataforma_l,
        lower(coalesce(e.modelo, '')) as modelo_l,
        lower(coalesce(e.marca, '')) as marca_l,
        lower(coalesce(e.persona_actual, '')) as persona_l,
        lower(coalesce(e.tipo_colaborador, 'unknown')) as tipo_colaborador_l
    from e
)
select
    id_equipo,
    plataforma_l,
    modelo_l,
    marca_l,
    persona_l,
    tipo_colaborador_l,
    case
        when plataforma_l like '%mac%' then 'dev'
        when plataforma_l like '%windows%' then 'core'
        else 'core'
    end as segmento_destino
from base
