{{ config(materialized='table', tags=['mart','compras','planeacion','forecast','ui']) }}

with trend as (
    select
        mes,
        es_proyeccion,
        demanda_presion_compra_mes,
        stock_disponible_confirmado,
        stock_disponible_total
    from {{ ref('mart_planeacion_compras_tendencia_mes') }}
),

lagged as (
    select
        mes,
        es_proyeccion,
        lag(demanda_presion_compra_mes, 1) over (order by mes) as presion_mes,
        lag(demanda_presion_compra_mes, 2) over (order by mes) as presion_mes_anterior,
        lag(demanda_presion_compra_mes, 3) over (order by mes) as presion_hace_2_meses,
        stock_disponible_confirmado as stock_confirmado,
        stock_disponible_total as stock_total
    from trend
),

forecast as (
    select
        mes,
        es_proyeccion,
        presion_mes,
        presion_mes_anterior,
        presion_hace_2_meses,
        round(
            (
                coalesce(presion_mes, 0)::numeric * 0.5
                + coalesce(presion_mes_anterior, 0)::numeric * 0.3
                + coalesce(presion_hace_2_meses, 0)::numeric * 0.2
            ),
            0
        )::int as forecast_presion_base,
        stock_confirmado,
        stock_total
    from lagged
)

select
    mes,
    es_proyeccion,
    presion_mes,
    presion_mes_anterior,
    presion_hace_2_meses,
    forecast_presion_base,
    round(forecast_presion_base::numeric * 0.9, 0)::int as forecast_presion_bajo,
    round(forecast_presion_base::numeric * 1.1, 0)::int as forecast_presion_alto,
    stock_confirmado,
    stock_total,
    (stock_confirmado - forecast_presion_base)::int as gap_base_confirmado,
    (stock_confirmado - round(forecast_presion_base::numeric * 1.1, 0)::int)::int as gap_alto_confirmado,
    (stock_total - forecast_presion_base)::int as gap_base_total,
    (stock_total - round(forecast_presion_base::numeric * 1.1, 0)::int)::int as gap_alto_total,
    'ponderacion_50_30_20_ultimos_3_meses'::text as fuente_forecast,
    case
        when forecast_presion_base = 0
            then 'No hay suficiente presión histórica reciente para construir un forecast útil.'
        when (stock_confirmado - round(forecast_presion_base::numeric * 1.1, 0)::int) >= 0
            then 'Incluso con el escenario alto, la cobertura confirmada se mantiene suficiente.'
        when (stock_total - round(forecast_presion_base::numeric * 1.1, 0)::int) >= 0
            then 'El escenario alto exige acelerar pendientes, pero no abre compra adicional inmediata.'
        else 'Si el escenario alto se materializa, conviene evaluar compra adicional.'
    end as insight_forecast
from forecast
where presion_mes is not null
order by mes
