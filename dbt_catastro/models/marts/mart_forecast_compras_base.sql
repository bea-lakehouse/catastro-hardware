{{ config(materialized='view', tags=['mart','forecast','compras','planeacion']) }}

with base as (
    select
        mes,
        movimientos_total_mes,
        asignaciones_mes,
        ingresos_mes,
        ingresos_compra_mes,
        ingresos_internos_mes,
        salidas_mes,
        stock_activo,
        demanda_neta_mes,
        pct_demanda_neta_sobre_stock,
        movimientos_total_mm3,
        ingresos_mm3,
        ingresos_compra_mm3,
        salidas_mm3,
        demanda_neta_mm3
    from {{ ref('mart_parque_tendencias_mes') }}
),

final as (
    select
        mes,
        movimientos_total_mes,
        asignaciones_mes,
        ingresos_mes,
        ingresos_compra_mes,
        ingresos_internos_mes,
        salidas_mes,
        stock_activo,
        demanda_neta_mes,
        pct_demanda_neta_sobre_stock,
        movimientos_total_mm3,
        ingresos_mm3,
        ingresos_compra_mm3,
        salidas_mm3,
        demanda_neta_mm3,

        -- escenario conservador:
        -- compra solo lo que la demanda neta reciente viene mostrando
        greatest(ceil(coalesce(demanda_neta_mm3, 0)), 0)::bigint
            as compra_sugerida_conservadora,

        -- escenario base:
        -- acompaña el ritmo promedio reciente de ingresos que sí presionan compra
        greatest(ceil(coalesce(ingresos_compra_mm3, 0)), 0)::bigint
            as compra_sugerida_base,

        -- escenario alto:
        -- toma el mayor ritmo reciente entre ingresos que presionan compra y salidas + 10%
        greatest(
            ceil(greatest(coalesce(ingresos_compra_mm3, 0), coalesce(salidas_mm3, 0)) * 1.10),
            0
        )::bigint as compra_sugerida_alta,

        -- presión operacional simple
        case
            when coalesce(pct_demanda_neta_sobre_stock, 0) >= 8 then 'ALTA'
            when coalesce(pct_demanda_neta_sobre_stock, 0) >= 4 then 'MEDIA'
            else 'BAJA'
        end as presion_stock,

        case
            when coalesce(ingresos_compra_mes, 0) > coalesce(salidas_mes, 0)
                then coalesce(ingresos_compra_mes, 0) - coalesce(salidas_mes, 0)
            else 0
        end as brecha_operativa_mes,

        case
            when coalesce(demanda_neta_mm3, 0) <= 0
                then 'Sin presión neta de compra en tendencia reciente.'
            when coalesce(pct_demanda_neta_sobre_stock, 0) >= 8
                then 'Presión alta: conviene anticipar compras.'
            when coalesce(pct_demanda_neta_sobre_stock, 0) >= 4
                then 'Presión media: monitorear reposición.'
            when coalesce(ingresos_internos_mes, 0) > 0
                then 'Se excluyeron ingresos internos del cálculo de compra proyectada.'
            else
                'Presión baja: compra táctica o reposición puntual.'
        end as insight_forecast

    from base
)

select *
from final
order by mes
