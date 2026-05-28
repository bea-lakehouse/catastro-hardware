{{ config(materialized='view', tags=['mart','ui','forecast','planeacion']) }}

with forecast_series as (
    select
        mes,
        'FORECAST'::text as bloque,
        case
            when tipo = 'HIST' then 'compra_base_hist'
            else 'compra_base_forecast'
        end as serie,
        compra_base_valor::numeric as valor
    from {{ ref('mart_forecast_compras_3m') }}
),

global_series as (
    select
        mes,
        'GLOBAL'::text as bloque,
        'ingresos_mes'::text as serie,
        ingresos_mes::numeric as valor
    from {{ ref('mart_forecast_compras_base') }}

    union all

    select
        mes,
        'GLOBAL'::text as bloque,
        'ingresos_compra_mes'::text as serie,
        ingresos_compra_mes::numeric as valor
    from {{ ref('mart_forecast_compras_base') }}

    union all

    select
        mes,
        'GLOBAL'::text as bloque,
        'salidas_mes'::text as serie,
        salidas_mes::numeric as valor
    from {{ ref('mart_forecast_compras_base') }}

    union all

    select
        mes,
        'GLOBAL'::text as bloque,
        'compra_base'::text as serie,
        compra_sugerida_base::numeric as valor
    from {{ ref('mart_forecast_compras_base') }}
)

select *
from global_series

union all

select *
from forecast_series

order by mes, bloque, serie
