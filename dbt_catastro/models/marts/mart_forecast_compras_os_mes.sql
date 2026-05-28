{{ config(materialized='view', tags=['mart','forecast','compras','os']) }}

with eventos_ingresos as (
    select
        date_trunc('month', fecha_evento)::date as mes,
        upper(
            regexp_replace(
                regexp_replace(
                    regexp_replace(coalesce(id_equipo,''), '^\s*SKU\s*[- ]*\s*', 'SKU-', 'i'),
                    '\s+', '', 'g'
                ),
                '^SKU-0+', 'SKU-', 'i'
            )
        ) as id_equipo_norm
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where tipo_evento = 'INGRESO'
      and coalesce(ingreso_presiona_compra, true)
      and fecha_evento >= date '2024-01-01'
      and fecha_evento <  date '2030-01-01'
      and id_equipo is not null
),

sku_os as (
    select
        upper(trim(id_equipo)) as id_equipo_norm,
        os_familia
    from analytics.dim_sku_os
),

historia_norm as (
    select
        date_trunc('month', h.fecha_evento)::date as mes,
        h.tipo_evento,
        upper(
            regexp_replace(
                regexp_replace(
                    regexp_replace(coalesce(h.id_equipo,''), '^\s*SKU\s*[- ]*\s*', 'SKU-', 'i'),
                    '\s+', '', 'g'
                ),
                '^SKU-0+', 'SKU-', 'i'
            )
        ) as id_equipo_norm
    from {{ ref('stg_historia_hw') }} h
    where h.fecha_evento >= date '2024-01-01'
      and h.fecha_evento <  date '2030-01-01'
      and h.id_equipo is not null
),

salidas_norm as (
    select
        date_trunc('month', x.fecha_evento)::date as mes,
        upper(
            regexp_replace(
                regexp_replace(
                    regexp_replace(coalesce(x.id_equipo,''), '^\s*SKU\s*[- ]*\s*', 'SKU-', 'i'),
                    '\s+', '', 'g'
                ),
                '^SKU-0+', 'SKU-', 'i'
            )
        ) as id_equipo_norm
    from {{ ref('stg_mtr_salidas') }} x
    where x.fecha_evento >= date '2024-01-01'
      and x.fecha_evento <  date '2030-01-01'
      and x.id_equipo is not null
),

eventos as (
    select
        h.mes,
        coalesce(s.os_familia, 'OTRO') as os_familia,
        h.tipo_evento
    from historia_norm h
    left join sku_os s
      on h.id_equipo_norm = s.id_equipo_norm
    where h.id_equipo_norm ~ '^SKU-[0-9]+$'
),

ingresos as (
    select
        i.mes,
        coalesce(s.os_familia, 'OTRO') as os_familia,
        count(*) as ingresos_mes
    from eventos_ingresos i
    left join sku_os s
      on i.id_equipo_norm = s.id_equipo_norm
    where i.id_equipo_norm ~ '^SKU-[0-9]+$'
    group by 1,2
),

salidas as (
    select
        x.mes,
        coalesce(s.os_familia, 'OTRO') as os_familia,
        count(*) as salidas_mes
    from salidas_norm x
    left join sku_os s
      on x.id_equipo_norm = s.id_equipo_norm
    where x.id_equipo_norm ~ '^SKU-[0-9]+$'
    group by 1,2
),

movimientos as (
    select
        mes,
        os_familia,
        count(*) as movimientos_mes
    from eventos
    group by 1,2
),

base as (
    select
        coalesce(m.mes, i.mes, s.mes) as mes,
        coalesce(m.os_familia, i.os_familia, s.os_familia) as os_familia,
        coalesce(m.movimientos_mes, 0) as movimientos_mes,
        coalesce(i.ingresos_mes, 0) as ingresos_mes,
        coalesce(s.salidas_mes, 0) as salidas_mes
    from movimientos m
    full join ingresos i using (mes, os_familia)
    full join salidas s using (mes, os_familia)
),

tendencia as (
    select
        *,
        greatest(ingresos_mes - salidas_mes, 0) as demanda_neta_mes,
        avg(ingresos_mes::numeric) over (
            partition by os_familia
            order by mes
            rows between 2 preceding and current row
        ) as ingresos_mm3,
        avg(salidas_mes::numeric) over (
            partition by os_familia
            order by mes
            rows between 2 preceding and current row
        ) as salidas_mm3,
        avg(greatest(ingresos_mes - salidas_mes, 0)::numeric) over (
            partition by os_familia
            order by mes
            rows between 2 preceding and current row
        ) as demanda_neta_mm3
    from base
)

select
    mes,
    os_familia,
    movimientos_mes,
    ingresos_mes,
    salidas_mes,
    demanda_neta_mes,
    round(ingresos_mm3, 2) as ingresos_mm3,
    round(salidas_mm3, 2) as salidas_mm3,
    round(demanda_neta_mm3, 2) as demanda_neta_mm3,
    ceil(coalesce(demanda_neta_mm3, 0))::int as compra_conservadora,
    ceil(coalesce(ingresos_mm3, 0))::int as compra_base,
    ceil(greatest(coalesce(ingresos_mm3, 0), coalesce(salidas_mm3, 0)) * 1.10)::int as compra_alta
from tendencia
order by mes, os_familia
