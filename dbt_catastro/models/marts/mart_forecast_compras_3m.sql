{{ config(materialized='view', tags=['mart','forecast','compras','regresion','ui']) }}

with hist as (
    select
        mes::date as mes,
        compra_sugerida_base::numeric as y
    from {{ ref('mart_forecast_compras_base') }}
    where mes is not null
    order by mes
),

hist_indexed as (
    select
        mes,
        y,
        row_number() over (order by mes) as x
    from hist
),

stats as (
    select
        count(*)::numeric as n,
        sum(x)::numeric as sum_x,
        sum(y)::numeric as sum_y,
        sum(x * y)::numeric as sum_xy,
        sum(x * x)::numeric as sum_xx
    from hist_indexed
),

coef as (
    select
        case
            when (n * sum_xx - sum_x * sum_x) = 0 then 0::numeric
            else (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x)
        end as pendiente,
        case
            when n = 0 then 0::numeric
            else (
                sum_y
                - (
                    case
                        when (n * sum_xx - sum_x * sum_x) = 0 then 0::numeric
                        else (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x)
                    end
                ) * sum_x
            ) / n
        end as intercepto
    from stats
),

last_hist as (
    select
        max(mes)::date as max_mes,
        max(x)::int as max_x
    from hist_indexed
),

future as (
    select
        (date_trunc('month', l.max_mes) + (gs.i || ' month')::interval)::date as mes,
        l.max_x + gs.i as x
    from last_hist l
    cross join generate_series(1, 3) as gs(i)
),

forecast as (
    select
        f.mes,
        f.x,
        greatest(round(c.intercepto + c.pendiente * f.x, 2), 0::numeric) as compra_base_forecast
    from future f
    cross join coef c
),

final_hist as (
    select
        mes,
        'HIST'::text as tipo,
        y as compra_base_valor
    from hist
),

final_forecast as (
    select
        mes,
        'FORECAST'::text as tipo,
        compra_base_forecast as compra_base_valor
    from forecast
)

select *
from final_hist

union all

select *
from final_forecast

order by mes
