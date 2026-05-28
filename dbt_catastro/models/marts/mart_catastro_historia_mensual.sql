{{ config(materialized='table', tags=['marts', 'historico', 'catastro']) }}

with calendario as (
    select
        generate_series(
            date '2024-01-01',
            date_trunc('month', current_date)::date,
            interval '1 month'
        )::date as mes
),

eventos as (
    select *
    from {{ ref('mart_catastro_historia_eventos') }}
),

mensual_eventos as (
    select
        mes,
        count(*) as movimientos_total,
        count(*) filter (where es_ingreso) as ingresos_totales,
        count(*) filter (where es_salida) as salidas_totales,
        count(*) filter (where es_ingreso_nuevo) as ingresos_nuevos,
        count(*) filter (where es_ingreso_interno) as ingresos_internos,
        count(*) filter (where es_ingreso_con_equipo) as ingresos_con_equipo,
        count(*) filter (where es_ingreso_sin_equipo) as ingresos_sin_equipo,
        count(*) filter (where es_ingreso_nuevo and es_ingreso_con_equipo) as ingresos_nuevos_con_equipo,
        count(*) filter (where es_ingreso_nuevo and es_ingreso_sin_equipo) as ingresos_nuevos_sin_equipo,
        count(*) filter (where es_salida_con_sku) as salidas_con_sku,
        count(*) filter (where es_salida_sin_sku) as salidas_sin_sku,
        count(*) filter (where es_presion_compra) as presion_compra,
        count(*) filter (where tipo_evento = 'INGRESO' and ambito = 'EXTRANJERO') as ingresos_extranjeros,
        count(*) filter (where tipo_evento = 'SALIDA' and ambito = 'EXTRANJERO') as salidas_extranjeros
    from eventos
    group by 1
),

movimientos_detalle as (
    select
        date_trunc('month', fecha_movimiento)::date as mes,
        count(*) filter (
            where coalesce(es_ingreso_equipo, false)
               or coalesce(es_reasignacion_equipo, false)
        ) as asignaciones,
        count(*) filter (
            where coalesce(es_salida_devolucion, false)
              and not coalesce(es_baja_equipo, false)
        ) as devoluciones,
        count(*) filter (where coalesce(es_ingreso_equipo, false)) as ingresos_hardware,
        count(*) filter (where coalesce(es_reasignacion_equipo, false)) as reasignaciones_hardware,
        count(*) filter (
            where coalesce(es_salida_devolucion, false)
              and not coalesce(es_baja_equipo, false)
        ) as equipos_retornados,
        count(*) filter (where coalesce(es_baja_equipo, false)) as equipos_baja,
        count(*) filter (where coalesce(es_reasignacion_equipo, false)) as equipos_reutilizados,
        count(*) filter (where coalesce(es_salida_devolucion, false)) as salidas_hardware
    from {{ ref('fct_movimientos_detalle') }}
    where fecha_movimiento::date >= date '2024-01-01'
      and fecha_movimiento::date <= current_date
    group by 1
),

movimientos_persona as (
    select
        date_trunc('month', fecha_evento_dia)::date as mes,
        count(*) filter (where coalesce(es_movimiento_interno_persona_cliente, false)) as movimientos_internos,
        count(*) filter (where coalesce(es_cambio_equipo_real, false)) as cambios_equipo_real
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where fecha_evento_dia::date >= date '2024-01-01'
      and fecha_evento_dia::date <= current_date
    group by 1
),

stock_actual as (
    select count(*)::int as stock_visible_actual_ref
    from {{ ref('mart_equipos_estado_actual') }}
    where coalesce(es_activo_operativo, upper(coalesce(estado_operativo, 'ACTIVO')) <> 'BAJA')
),

asignados_actuales as (
    select count(*)::int as asignados_actual_ref
    from {{ ref('mart_equipos_estado_actual') }}
    where upper(coalesce(estado_operativo, '')) = 'ASIGNADO'
),

oferta_actual as (
    select count(*)::int as oferta_disponible_actual_ref
    from {{ ref('stg_mtr_google_sheet_equipos_disponibles') }}
),

final as (
    select
        c.mes,
        coalesce(e.movimientos_total, 0) as movimientos_total,
        coalesce(e.ingresos_totales, 0) as ingresos_totales,
        coalesce(e.salidas_totales, 0) as salidas_totales,
        coalesce(e.ingresos_nuevos, 0) as ingresos_nuevos,
        coalesce(e.ingresos_internos, 0) as ingresos_internos,
        coalesce(e.ingresos_con_equipo, 0) as ingresos_con_equipo,
        coalesce(e.ingresos_sin_equipo, 0) as ingresos_sin_equipo,
        coalesce(e.ingresos_nuevos_con_equipo, 0) as ingresos_nuevos_con_equipo,
        coalesce(e.ingresos_nuevos_sin_equipo, 0) as ingresos_nuevos_sin_equipo,
        coalesce(e.salidas_con_sku, 0) as salidas_con_sku,
        coalesce(e.salidas_sin_sku, 0) as salidas_sin_sku,
        coalesce(p.movimientos_internos, 0) as movimientos_internos,
        coalesce(p.cambios_equipo_real, 0) as cambios_equipo_real,
        coalesce(m.asignaciones, 0) as asignaciones,
        coalesce(m.devoluciones, 0) as devoluciones,
        coalesce(m.ingresos_hardware, 0) as ingresos_hardware,
        coalesce(m.reasignaciones_hardware, 0) as reasignaciones_hardware,
        coalesce(m.equipos_reutilizados, 0) as equipos_reutilizados,
        coalesce(m.equipos_retornados, 0) as equipos_retornados,
        coalesce(m.equipos_baja, 0) as equipos_baja,
        coalesce(m.salidas_hardware, 0) as salidas_hardware,
        null::int as stock_visible_mes,
        null::int as oferta_disponible_mes,
        s.stock_visible_actual_ref,
        a.asignados_actual_ref,
        o.oferta_disponible_actual_ref,
        coalesce(e.presion_compra, 0) as presion_compra,
        coalesce(e.ingresos_extranjeros, 0) as ingresos_extranjeros,
        coalesce(e.salidas_extranjeros, 0) as salidas_extranjeros,
        coalesce(e.ingresos_totales, 0) - coalesce(e.salidas_totales, 0) as balance_neto,
        case
            when coalesce(s.stock_visible_actual_ref, 0) > 0 then round(
                100.0 * coalesce(e.movimientos_total, 0)::numeric / s.stock_visible_actual_ref::numeric,
                2
            )
            else null
        end as pct_movimiento_sobre_stock_actual_ref,
        greatest(coalesce(e.presion_compra, 0) - coalesce(e.salidas_con_sku, 0), 0) as gap_operativo_estimado,
        greatest(
            coalesce(e.presion_compra, 0)
            - coalesce(e.salidas_con_sku, 0)
            - coalesce(o.oferta_disponible_actual_ref, 0),
            0
        ) as gap_vs_oferta_actual_ref,
        false as stock_historico_reconstruible,
        'No existe snapshot mensual histórico del parque ni de equipos disponibles antes de 2026-04-11; stock_visible_mes y oferta_disponible_mes quedan nulos para evitar una falsa precisión.'::text as nota_stock,
        'Ingresos con SKU quedan clasificados como internos y los ingresos sin SKU siguen presionando compra; la movilidad entre clientes debe contrastarse con movimientos_internos.'::text as nota_ingresos_internos
    from calendario c
    left join mensual_eventos e
      on e.mes = c.mes
    left join movimientos_detalle m
      on m.mes = c.mes
    left join movimientos_persona p
      on p.mes = c.mes
    cross join stock_actual s
    cross join asignados_actuales a
    cross join oferta_actual o
)

select *
from final
order by mes
