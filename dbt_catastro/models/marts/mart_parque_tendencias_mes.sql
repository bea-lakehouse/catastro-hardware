{{ config(materialized='view', tags=['mart','forecast','tendencias','compras']) }}

with base as (
    select
        current.mes,
        coalesce(current.movimientos_total, 0) as movimientos_total_mes,
        coalesce(legacy.asignaciones, 0) as asignaciones_mes,
        coalesce(current.mtr_ingresos_total, 0) as ingresos_mes,
        coalesce(current.ingresos_presion_compra, coalesce(current.mtr_ingresos_total, 0)) as ingresos_compra_mes,
        coalesce(current.ingresos_internos, 0) as ingresos_internos_mes,
        coalesce(current.mtr_salidas_total, 0) as salidas_mes,
        coalesce(current.stock_activo, 0) as stock_activo
    from {{ ref('mart_estadistica_movimientos_mes_v2') }} current
    left join {{ ref('mart_estadistica_movimientos_mes') }} legacy
      on legacy.mes = current.mes
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

        greatest(ingresos_compra_mes - salidas_mes, 0) as demanda_neta_mes,

        case
            when nullif(stock_activo, 0) is null then null
            else round(
                100.0 * greatest(ingresos_compra_mes - salidas_mes, 0)::numeric / stock_activo::numeric,
                2
            )
        end as pct_demanda_neta_sobre_stock,

        round(avg(movimientos_total_mes::numeric) over (
            order by mes
            rows between 2 preceding and current row
        ), 2) as movimientos_total_mm3,

        round(avg(ingresos_mes::numeric) over (
            order by mes
            rows between 2 preceding and current row
        ), 2) as ingresos_mm3,

        round(avg(ingresos_compra_mes::numeric) over (
            order by mes
            rows between 2 preceding and current row
        ), 2) as ingresos_compra_mm3,

        round(avg(salidas_mes::numeric) over (
            order by mes
            rows between 2 preceding and current row
        ), 2) as salidas_mm3,

        round(avg(greatest(ingresos_compra_mes - salidas_mes, 0)::numeric) over (
            order by mes
            rows between 2 preceding and current row
        ), 2) as demanda_neta_mm3

    from base
)

select *
from final
order by mes
