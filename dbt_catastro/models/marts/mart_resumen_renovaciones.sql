with base as (
    select *
    from {{ ref('mart_equipos_estado_actual_politica') }}
),

detalle as (
    select
        coalesce(nullif(trim(accion_regla_modelo::text), ''), 'SIN_ACCION') as accion_regla_modelo,
        coalesce(nullif(trim(motivo_regla_modelo::text), ''), 'sin_motivo') as motivo_regla_modelo,
        coalesce(nullif(trim(marca::text), ''), 'SIN_MARCA') as marca,
        coalesce(nullif(trim(modelo::text), ''), 'SIN_MODELO') as modelo,
        coalesce(nullif(trim(tipo_colaborador::text), ''), 'unknown') as tipo_colaborador,
        coalesce(nullif(trim(segmento_destino::text), ''), 'unknown') as segmento_destino,
        coalesce(nullif(trim(cliente::text), ''), 'SIN_CLIENTE') as cliente,
        coalesce(flag_renovar_regla, false) as flag_renovar_regla,
        coalesce(flag_dar_baja_regla, false) as flag_dar_baja_regla
    from base
),

resumen as (
    select
        accion_regla_modelo,
        motivo_regla_modelo,
        marca,
        modelo,
        tipo_colaborador,
        segmento_destino,
        cliente,
        count(*) as equipos,
        count(*) filter (where flag_renovar_regla) as equipos_renovar,
        count(*) filter (where flag_dar_baja_regla) as equipos_baja
    from detalle
    group by 1,2,3,4,5,6,7
)

select *
from resumen
order by
    case accion_regla_modelo
        when 'RENOVAR_Y_BAJA' then 1
        when 'RENOVAR' then 2
        when 'CONSERVAR' then 3
        else 4
    end,
    equipos desc,
    marca,
    modelo,
    cliente
