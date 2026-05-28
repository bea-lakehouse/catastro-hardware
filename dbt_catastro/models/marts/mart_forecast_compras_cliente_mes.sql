{{ config(materialized='view', tags=['mart','forecast','cliente','compras']) }}

with historia as (
    select
        date_trunc('month', fecha_evento)::date as mes,
        coalesce(
            nullif(btrim(split_part(coalesce(detalle_evento,''), '|', 1)), ''),
            'SIN_CLIENTE'
        ) as cliente_raw,
        tipo_evento
    from {{ ref('stg_historia_hw') }}
    where fecha_evento >= date '2024-01-01'
      and fecha_evento <  date '2030-01-01'
),

ingresos as (
    select
        date_trunc('month', fecha_evento)::date as mes,
        coalesce(
            nullif(btrim(cliente), ''),
            nullif(btrim(split_part(coalesce(detalle,''), '|', 1)), ''),
            'SIN_CLIENTE'
        ) as cliente_raw,
        count(*) as ingresos_mes
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where tipo_evento = 'INGRESO'
      and coalesce(ingreso_presiona_compra, true)
      and fecha_evento >= date '2024-01-01'
      and fecha_evento <  date '2030-01-01'
    group by 1,2
),

salidas as (
    select
        date_trunc('month', fecha_evento)::date as mes,
        coalesce(
            nullif(btrim(cliente), ''),
            nullif(btrim(split_part(coalesce(detalle,''), '|', 1)), ''),
            'SIN_CLIENTE'
        ) as cliente_raw,
        count(*) as salidas_mes
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where tipo_evento = 'SALIDA'
      and fecha_evento >= date '2024-01-01'
      and fecha_evento <  date '2030-01-01'
    group by 1,2
),

movimientos as (
    select
        mes,
        cliente_raw,
        count(*) as movimientos_mes
    from historia
    group by 1,2
),

base as (
    select
        coalesce(m.mes, i.mes, s.mes) as mes,
        coalesce(m.cliente_raw, i.cliente_raw, s.cliente_raw) as cliente_raw,
        coalesce(m.movimientos_mes, 0) as movimientos_mes,
        coalesce(i.ingresos_mes, 0) as ingresos_mes,
        coalesce(s.salidas_mes, 0) as salidas_mes
    from movimientos m
    full join ingresos i using (mes, cliente_raw)
    full join salidas s using (mes, cliente_raw)
),

normalizado as (
    select
        mes,
        case
            when upper(cliente_raw) in ('LATAM', 'LATAM AIRLINES') then 'Latam'
            when upper(replace(cliente_raw, ' ', '')) in ('REDSALUD') then 'RedSalud'
            when upper(cliente_raw) in ('ACID', 'ACID LABS') then 'Acid Labs'
            when upper(cliente_raw) in ('BCI', 'BANCO BCI') then 'BCI'
            else initcap(lower(cliente_raw))
        end as cliente,
        movimientos_mes,
        ingresos_mes,
        salidas_mes
    from base
),

agrupado as (
    select
        mes,
        cliente,
        sum(movimientos_mes) as movimientos_mes,
        sum(ingresos_mes) as ingresos_mes,
        sum(salidas_mes) as salidas_mes
    from normalizado
    group by 1,2
),

tendencia as (
    select
        *,
        greatest(ingresos_mes - salidas_mes, 0) as demanda_neta_mes,
        avg(ingresos_mes::numeric) over (
            partition by cliente
            order by mes
            rows between 2 preceding and current row
        ) as ingresos_mm3,
        avg(salidas_mes::numeric) over (
            partition by cliente
            order by mes
            rows between 2 preceding and current row
        ) as salidas_mm3
    from agrupado
)

select
    mes,
    cliente,
    movimientos_mes,
    ingresos_mes,
    salidas_mes,
    demanda_neta_mes,
    round(ingresos_mm3, 2) as ingresos_mm3,
    round(salidas_mm3, 2) as salidas_mm3,
    ceil(coalesce(ingresos_mm3, 0))::int as compra_base,
    ceil(greatest(coalesce(ingresos_mm3, 0), coalesce(salidas_mm3, 0)) * 1.10)::int as compra_alta
from tendencia
order by mes, cliente
