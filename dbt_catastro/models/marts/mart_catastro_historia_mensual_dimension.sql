{{ config(materialized='table', tags=['marts', 'historico', 'catastro', 'dimension']) }}

with base as (
    select *
    from {{ ref('mart_catastro_historia_eventos') }}
),

dimension_rows as (
    select
        mes,
        'empresa'::text as dimension_name,
        empresa::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base

    union all

    select
        mes,
        'tipo_equipo'::text as dimension_name,
        tipo_equipo::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base

    union all

    select
        mes,
        'marca'::text as dimension_name,
        marca::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base

    union all

    select
        mes,
        'modelo'::text as dimension_name,
        modelo::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base

    union all

    select
        mes,
        'os_familia'::text as dimension_name,
        os_familia::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base

    union all

    select
        mes,
        'tipo_colaborador'::text as dimension_name,
        tipo_colaborador::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base

    union all

    select
        mes,
        'ambito'::text as dimension_name,
        ambito::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base

    union all

    select
        mes,
        'politica_modelo'::text as dimension_name,
        politica_modelo::text as dimension_value,
        es_ingreso,
        es_salida,
        es_ingreso_nuevo,
        es_ingreso_interno,
        es_ingreso_con_equipo,
        es_ingreso_sin_equipo,
        es_salida_con_sku,
        es_salida_sin_sku,
        es_presion_compra
    from base
),

final as (
    select
        mes,
        dimension_name,
        coalesce(nullif(trim(dimension_value), ''), 'UNKNOWN') as dimension_value,
        count(*) as movimientos_total,
        count(*) filter (where es_ingreso) as ingresos_totales,
        count(*) filter (where es_salida) as salidas_totales,
        count(*) filter (where es_ingreso_nuevo) as ingresos_nuevos,
        count(*) filter (where es_ingreso_interno) as ingresos_internos,
        count(*) filter (where es_ingreso_con_equipo) as ingresos_con_equipo,
        count(*) filter (where es_ingreso_sin_equipo) as ingresos_sin_equipo,
        count(*) filter (where es_salida_con_sku) as salidas_con_sku,
        count(*) filter (where es_salida_sin_sku) as salidas_sin_sku,
        count(*) filter (where es_presion_compra) as presion_compra
    from dimension_rows
    group by 1, 2, 3
)

select *
from final
where movimientos_total > 0
