{{ config(materialized='table', tags=['mart','compras','planeacion','ui','ejecutivo']) }}

with recursive presion as (
    select
        date_trunc('month', fecha_evento_dia)::date as mes,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_presiona_compra, true)
        )::int as demanda_presion_compra_mes,
        count(*) filter (where tipo_evento = 'SALIDA')::int as salidas_mes,
        count(*)::int as movimientos_total_mes
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where date_trunc('year', fecha_evento_dia) = date_trunc('year', current_date)
    group by 1
),

compras_mes as (
    select
        c.mes_operacion as mes,
        sum(c.equipos_confirmados)::int as total_confirmadas,
        sum(c.equipos_pendientes)::int as total_pendientes,
        sum(c.stock_disponible_delta)::int as stock_nuevo_confirmado,
        sum(c.stock_planificado_delta)::int as stock_nuevo_proyectado,
        count(distinct c.empresa)::int as empresas_con_compra,
        count(distinct c.proveedor)::int as proveedores_activos,
        count(distinct c.modelo)::int as modelos_distintos
    from {{ ref('fact_planeacion_compras') }} c
    where date_trunc('year', c.mes_operacion) = date_trunc('year', current_date)
    group by 1
),

bounds as (
    select
        date_trunc('year', current_date)::date as inicio_anio,
        greatest(
            coalesce(max(p.mes), date_trunc('month', current_date)::date),
            coalesce(max(c.mes), date_trunc('month', current_date)::date),
            date_trunc('month', current_date)::date
        )::date as ultimo_mes_real
    from presion p
    full outer join compras_mes c
      on c.mes = p.mes
),

calendar as (
    select
        gs::date as mes
    from bounds b
    cross join lateral generate_series(
        b.inicio_anio,
        b.ultimo_mes_real,
        interval '1 month'
    ) as gs
),

base_months as (
    select
        cal.mes,
        coalesce(c.total_confirmadas, 0) as total_confirmadas,
        coalesce(c.total_pendientes, 0) as total_pendientes,
        coalesce(c.stock_nuevo_confirmado, 0) as stock_nuevo_confirmado,
        coalesce(c.stock_nuevo_proyectado, 0) as stock_nuevo_proyectado,
        coalesce(c.empresas_con_compra, 0) as empresas_con_compra,
        coalesce(c.proveedores_activos, 0) as proveedores_activos,
        coalesce(c.modelos_distintos, 0) as modelos_distintos,
        coalesce(p.demanda_presion_compra_mes, 0) as demanda_presion_compra_mes,
        coalesce(p.salidas_mes, 0) as salidas_mes,
        coalesce(p.movimientos_total_mes, 0) as movimientos_total_mes
    from calendar cal
    left join compras_mes c
      on c.mes = cal.mes
    left join presion p
      on p.mes = cal.mes
),

rollforward as (
    select
        b.mes,
        b.total_confirmadas,
        b.total_pendientes,
        b.stock_nuevo_confirmado::int as stock_confirmado,
        b.stock_nuevo_proyectado::int as stock_proyectado,
        b.empresas_con_compra,
        b.proveedores_activos,
        b.modelos_distintos,
        b.demanda_presion_compra_mes,
        b.salidas_mes,
        b.movimientos_total_mes
    from base_months b
    where b.mes = (select min(mes) from base_months)

    union all

    select
        b.mes,
        b.total_confirmadas,
        b.total_pendientes,
        (r.stock_confirmado + b.stock_nuevo_confirmado)::int as stock_confirmado,
        (r.stock_proyectado + b.stock_nuevo_proyectado)::int as stock_proyectado,
        b.empresas_con_compra,
        b.proveedores_activos,
        b.modelos_distintos,
        b.demanda_presion_compra_mes,
        b.salidas_mes,
        b.movimientos_total_mes
    from rollforward r
    join base_months b
      on b.mes = (r.mes + interval '1 month')::date
)

select
    r.mes,
    r.total_confirmadas,
    r.total_pendientes,
    r.stock_confirmado,
    r.stock_proyectado,
    r.empresas_con_compra,
    r.proveedores_activos,
    r.modelos_distintos,
    r.demanda_presion_compra_mes,
    r.salidas_mes,
    r.movimientos_total_mes,
    (r.mes + interval '1 month')::date as mes_siguiente,
    (r.stock_confirmado - r.demanda_presion_compra_mes)::int as balance_confirmado_vs_presion_mes,
    (r.stock_confirmado + r.stock_proyectado - r.demanda_presion_compra_mes)::int as balance_total_vs_presion_mes,
    case
        when r.demanda_presion_compra_mes = 0 then null::numeric
        else round(r.stock_confirmado::numeric / r.demanda_presion_compra_mes::numeric, 2)
    end as cobertura_confirmada_ratio,
    case
        when r.demanda_presion_compra_mes = 0 then null::numeric
        else round((r.stock_confirmado + r.stock_proyectado)::numeric / r.demanda_presion_compra_mes::numeric, 2)
    end as cobertura_total_ratio,
    case
        when r.demanda_presion_compra_mes = 0
            then 'No hay demanda de referencia del MTR en el mes; la preparación queda basada solo en stock confirmado y proyectado heredado.'
        when r.stock_confirmado >= r.demanda_presion_compra_mes
            then 'El stock confirmado acumulado alcanza a cubrir la presión de compra observada y deja el corte con cobertura positiva.'
        when (r.stock_confirmado + r.stock_proyectado) >= r.demanda_presion_compra_mes
            then 'El stock confirmado no cubre por sí solo la presión del mes, pero la cobertura total se completa si se concretan las pendientes.'
        else 'Incluso considerando las compras pendientes, el corte sigue con brecha abierta frente a la presión observada del mes.'
    end as lectura_preparacion
from rollforward r
order by r.mes
