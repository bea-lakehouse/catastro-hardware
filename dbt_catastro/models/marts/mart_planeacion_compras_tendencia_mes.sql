{{ config(materialized='table', tags=['mart','compras','planeacion','tendencia','ui']) }}

with recursive presion as (
    select
        date_trunc('month', fecha_evento_dia)::date as mes,
        count(*) filter (where tipo_evento = 'INGRESO')::int as mtr_ingresos_total,
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
        coalesce(p.mtr_ingresos_total, 0) as mtr_ingresos_total,
        coalesce(p.demanda_presion_compra_mes, 0) as demanda_presion_compra_mes,
        coalesce(p.salidas_mes, 0) as salidas_mes,
        coalesce(p.movimientos_total_mes, 0) as movimientos_total_mes,
        coalesce(c.total_confirmadas, 0) as total_confirmadas,
        coalesce(c.total_pendientes, 0) as total_pendientes,
        coalesce(c.stock_nuevo_confirmado, 0) as stock_nuevo_confirmado,
        coalesce(c.stock_nuevo_proyectado, 0) as stock_nuevo_proyectado,
        coalesce(c.empresas_con_compra, 0) as empresas_con_compra,
        coalesce(c.proveedores_activos, 0) as proveedores_activos,
        coalesce(c.modelos_distintos, 0) as modelos_distintos
    from calendar cal
    left join presion p
      on p.mes = cal.mes
    left join compras_mes c
      on c.mes = cal.mes
),

ordered_months as (
    select
        b.*,
        row_number() over (order by b.mes) as month_rank
    from base_months b
),

presion_reciente as (
    select
        mes,
        demanda_presion_compra_mes,
        row_number() over (order by mes desc) as rn
    from presion
    where demanda_presion_compra_mes > 0
),

presion_estimacion as (
    select
        coalesce(ceil(avg(demanda_presion_compra_mes)::numeric), 0)::int as demanda_estimacion_3m
    from presion_reciente
    where rn <= 3
),

presion_proximo_mes_real as (
    select
        date_trunc('month', fecha_evento_dia)::date as mes,
        count(*) filter (where tipo_evento = 'INGRESO')::int as ingresos_reales_acumulados,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_presiona_compra, true)
        )::int as demanda_real_acumulada,
        count(*) filter (where tipo_evento = 'SALIDA')::int as salidas_reales_acumuladas,
        count(*)::int as movimientos_reales_acumulados,
        greatest(1, extract(day from max(fecha_evento_dia))::int) as dias_observados
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where date_trunc('month', fecha_evento_dia) = date_trunc('month', current_date) + interval '1 month'
    group by 1
),

compras_proximo_mes as (
    select
        (b.ultimo_mes_real + interval '1 month')::date as mes,
        coalesce(c.total_confirmadas, 0) as total_confirmadas,
        coalesce(c.total_pendientes, 0) as total_pendientes,
        coalesce(c.stock_nuevo_confirmado, 0) as stock_confirmado,
        coalesce(c.stock_nuevo_proyectado, 0) as stock_proyectado,
        coalesce(c.empresas_con_compra, 0) as empresas_con_compra,
        coalesce(c.proveedores_activos, 0) as proveedores_activos,
        coalesce(c.modelos_distintos, 0) as modelos_distintos
    from bounds b
    left join compras_mes c
      on c.mes = (b.ultimo_mes_real + interval '1 month')::date
),

ultimo_real_mes as (
    select max(mes) as mes
    from ordered_months
),

real_months as (
    select
        m.mes,
        m.month_rank,
        false as es_proyeccion,
        null::date as mes_base_proyeccion,
        'real_mtr'::text as fuente_presion,
        m.mtr_ingresos_total,
        m.demanda_presion_compra_mes,
        m.salidas_mes,
        m.movimientos_total_mes,
        0::int as stock_heredado_confirmado,
        0::int as stock_heredado_proyectado,
        m.total_confirmadas as compras_nuevas_confirmadas_mes,
        m.total_pendientes as compras_nuevas_pendientes_mes,
        m.total_confirmadas,
        m.total_pendientes,
        m.stock_nuevo_confirmado as stock_confirmado,
        m.stock_nuevo_proyectado as stock_proyectado,
        m.stock_nuevo_confirmado as stock_disponible_confirmado,
        (m.stock_nuevo_confirmado + m.stock_nuevo_proyectado)::int as stock_disponible_total,
        m.empresas_con_compra,
        m.proveedores_activos,
        m.modelos_distintos
    from ordered_months m
    where m.month_rank = 1

    union all

    select
        m.mes,
        m.month_rank,
        false as es_proyeccion,
        null::date as mes_base_proyeccion,
        'real_mtr'::text as fuente_presion,
        m.mtr_ingresos_total,
        m.demanda_presion_compra_mes,
        m.salidas_mes,
        m.movimientos_total_mes,
        r.stock_disponible_confirmado as stock_heredado_confirmado,
        greatest(r.stock_disponible_total - r.stock_disponible_confirmado, 0) as stock_heredado_proyectado,
        m.total_confirmadas as compras_nuevas_confirmadas_mes,
        m.total_pendientes as compras_nuevas_pendientes_mes,
        m.total_confirmadas,
        m.total_pendientes,
        m.stock_nuevo_confirmado as stock_confirmado,
        m.stock_nuevo_proyectado as stock_proyectado,
        (r.stock_disponible_confirmado + m.stock_nuevo_confirmado)::int as stock_disponible_confirmado,
        (r.stock_disponible_total + m.stock_nuevo_confirmado + m.stock_nuevo_proyectado)::int as stock_disponible_total,
        m.empresas_con_compra,
        m.proveedores_activos,
        m.modelos_distintos
    from real_months r
    join ordered_months m
      on m.month_rank = r.month_rank + 1
),

ultimo_real as (
    select *
    from real_months
    where mes = (select mes from ultimo_real_mes)
),

projected_next_month as (
    select
        c.mes,
        null::bigint as month_rank,
        true as es_proyeccion,
        u.mes as mes_base_proyeccion,
        case
            when coalesce(p.demanda_real_acumulada, 0) > 0
                then 'mtr_real_acumulado_proyectado'
            else 'promedio_ultimos_3_meses_con_presion'
        end::text as fuente_presion,
        coalesce(p.ingresos_reales_acumulados, 0)::int as mtr_ingresos_total,
        case
            when coalesce(p.demanda_real_acumulada, 0) > 0
                then (
                    p.demanda_real_acumulada
                    + ceil(
                        (p.demanda_real_acumulada::numeric / greatest(p.dias_observados, 1)::numeric)
                        * greatest(
                            extract(day from (date_trunc('month', c.mes) + interval '1 month - 1 day'))::int - p.dias_observados,
                            0
                        )::numeric
                    )::int
                )
            else e.demanda_estimacion_3m
        end as demanda_presion_compra_mes,
        coalesce(p.salidas_reales_acumuladas, 0)::int as salidas_mes,
        coalesce(p.movimientos_reales_acumulados, 0)::int as movimientos_total_mes,
        coalesce(u.stock_disponible_confirmado, 0) as stock_heredado_confirmado,
        greatest(coalesce(u.stock_disponible_total, 0) - coalesce(u.stock_disponible_confirmado, 0), 0) as stock_heredado_proyectado,
        c.total_confirmadas as compras_nuevas_confirmadas_mes,
        c.total_pendientes as compras_nuevas_pendientes_mes,
        c.total_confirmadas,
        c.total_pendientes,
        c.stock_confirmado,
        c.stock_proyectado,
        (coalesce(u.stock_disponible_confirmado, 0) + c.stock_confirmado)::int as stock_disponible_confirmado,
        (coalesce(u.stock_disponible_total, 0) + c.stock_confirmado + c.stock_proyectado)::int as stock_disponible_total,
        c.empresas_con_compra,
        c.proveedores_activos,
        c.modelos_distintos
    from compras_proximo_mes c
    cross join presion_estimacion e
    cross join ultimo_real u
    left join presion_proximo_mes_real p
      on p.mes = c.mes
),

base as (
    select
        mes,
        es_proyeccion,
        mes_base_proyeccion,
        fuente_presion,
        mtr_ingresos_total,
        demanda_presion_compra_mes,
        salidas_mes,
        movimientos_total_mes,
        stock_heredado_confirmado,
        stock_heredado_proyectado,
        compras_nuevas_confirmadas_mes,
        compras_nuevas_pendientes_mes,
        total_confirmadas,
        total_pendientes,
        stock_confirmado,
        stock_proyectado,
        stock_disponible_confirmado,
        stock_disponible_total,
        empresas_con_compra,
        proveedores_activos,
        modelos_distintos
    from real_months

    union all

    select
        mes,
        es_proyeccion,
        mes_base_proyeccion,
        fuente_presion,
        mtr_ingresos_total,
        demanda_presion_compra_mes,
        salidas_mes,
        movimientos_total_mes,
        stock_heredado_confirmado,
        stock_heredado_proyectado,
        compras_nuevas_confirmadas_mes,
        compras_nuevas_pendientes_mes,
        total_confirmadas,
        total_pendientes,
        stock_confirmado,
        stock_proyectado,
        stock_disponible_confirmado,
        stock_disponible_total,
        empresas_con_compra,
        proveedores_activos,
        modelos_distintos
    from projected_next_month
)

select
    mes,
    es_proyeccion,
    mes_base_proyeccion,
    fuente_presion,
    mtr_ingresos_total,
    demanda_presion_compra_mes,
    salidas_mes,
    movimientos_total_mes,
    stock_heredado_confirmado,
    stock_heredado_proyectado,
    compras_nuevas_confirmadas_mes,
    compras_nuevas_pendientes_mes,
    total_confirmadas,
    total_pendientes,
    stock_confirmado,
    stock_proyectado,
    stock_disponible_confirmado,
    stock_disponible_total,
    empresas_con_compra,
    proveedores_activos,
    modelos_distintos,
    (mes + interval '1 month')::date as mes_siguiente,
    (stock_disponible_confirmado - demanda_presion_compra_mes)::int as balance_confirmado_vs_presion_mes,
    (stock_disponible_total - demanda_presion_compra_mes)::int as balance_total_vs_presion_mes,
    case
        when demanda_presion_compra_mes = 0 then null::numeric
        else round(stock_disponible_confirmado::numeric / demanda_presion_compra_mes::numeric, 2)
    end as cobertura_confirmada_ratio,
    case
        when demanda_presion_compra_mes = 0 then null::numeric
        else round(stock_disponible_total::numeric / demanda_presion_compra_mes::numeric, 2)
    end as cobertura_total_ratio,
    case
        when es_proyeccion and demanda_presion_compra_mes = 0
            then 'No hay presión estimada para el mes proyectado; la continuidad queda anclada solo al stock heredado.'
        when es_proyeccion and stock_disponible_confirmado >= demanda_presion_compra_mes
            then 'El mes proyectado inicia cubierto con stock heredado y no necesita compra adicional inmediata.'
        when es_proyeccion and stock_disponible_total >= demanda_presion_compra_mes
            then 'El mes proyectado queda cubierto si se concreta el stock proyectado heredado del mes anterior.'
        when es_proyeccion
            then 'Incluso con arrastre y pendientes heredados, el mes proyectado sigue con brecha y exige compra adicional.'
        when demanda_presion_compra_mes = 0
            then 'No hay presión MTR en el mes; la lectura queda anclada a stock confirmado y stock proyectado.'
        when stock_disponible_confirmado >= demanda_presion_compra_mes
            then 'La cobertura confirmada alcanza para el mes sin depender de compras pendientes.'
        when stock_disponible_total >= demanda_presion_compra_mes
            then 'La cobertura confirmada queda corta, pero el mes se cubre si se concretan las compras pendientes.'
        else 'Incluso considerando pendientes, la presión mensual sigue abierta y exige compra adicional.'
    end as lectura_preparacion,
    case
        when es_proyeccion
            then case
                when fuente_presion = 'mtr_real_acumulado_proyectado'
                    then 'Proyección del mes siguiente usando arrastre del mes base y demanda MTR real acumulada más una estimación simple para los días restantes.'
                else 'Proyección del mes siguiente usando arrastre confirmado/proyectado del mes base y presión estimada con promedio de los últimos 3 meses con presión.'
            end
        else 'Cierre mensual calculado con presión real del MTR y stock heredado más compras registradas en el mes.'
    end as nota_mes
from base
order by mes
