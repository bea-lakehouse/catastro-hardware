{{ config(materialized='table', tags=['estadisticas','movimientos','mart']) }}

with base as (
    select
        mes,
        estado_mes,
        fecha_ultima_actualizacion,
        fecha_ultimo_evento_mtr,
        fuente,
        movimientos_total,
        mtr_ingresos_total,
        ingresos_mtr_original,
        ingresos_personas,
        ingresos_nuevos,
        ingresos_internos,
        movimientos_internos_sin_impacto,
        ingresos_con_equipo,
        ingresos_sin_equipo,
        ingresos_nuevos_con_equipo,
        nuevos_con_equipo,
        ingresos_nuevos_sin_equipo,
        nuevos_sin_equipo,
        nacionales_con_equipo_asignado,
        nacionales_pendientes_equipo,
        internacionales_con_equipo_asignado,
        internacionales_sin_equipo_no_requerido,
        ingresos_presion_compra,
        ingresos_extranjeros,
        mtr_salidas_total,
        salidas_mtr_original,
        salidas_personas,
        salidas_extranjeros,
        movimientos_internos,
        cambios_equipo_real,
        cambios_equipo_real_base,
        cambios_reemplazos_mtr,
        asignaciones,
        devoluciones,
        devoluciones_hardware,
        ingresos_hardware,
        reasignaciones_hardware,
        equipos_reutilizados,
        equipos_retornados,
        equipos_baja,
        salidas_hardware,
        total_ingresos,
        total_salidas,
        presion_compra,
        stock_activo,
        stock_disponible,
        gap,
        override_manual_aplicado,
        override_scope,
        override_note,
        personas_resueltas_con_equipo,
        coherencia_operacional_ingresos,
        estado_coherencia_operacional,
        delta_ingresos_vs_mtr_original,
        delta_salidas_vs_mtr_original,
        conteo_validado_mtr_original,
        estado_validacion_mtr_original,
        pct_movimientos_100
    from {{ ref('mart_estadistica_movimientos_mes_v2') }}
),

historia as (
    select
        mes,
        coalesce(asignaciones, 0) as asignaciones
    from {{ ref('mart_catastro_historia_mensual') }}
),

metrics as (
    select
        b.*,
        coalesce(h.asignaciones, 0) as asignaciones_hist,
        round(
            100 * coalesce(h.asignaciones, 0)::numeric
            / nullif(coalesce(b.movimientos_total, 0), 0),
            2
        ) as mix_asignaciones_100,
        sum(coalesce(b.movimientos_total, 0)) over (order by b.mes) as movimientos_ytd,
        round(
            100 * sum(coalesce(b.movimientos_total, 0)) over (order by b.mes)::numeric
            / nullif(coalesce(b.stock_activo, 0), 0),
            2
        ) as pct_movimientos_ytd_100,
        coalesce(b.movimientos_total, 0)
          - lag(coalesce(b.movimientos_total, 0)) over (order by b.mes) as delta_movimientos
    from base b
    left join historia h
      on h.mes = b.mes
),

final as (
    select
        m.*,
        format(
            'En %s de %s se movió %s%% del stock (%s/%s).',
            case extract(month from m.mes)::int
                when 1 then 'enero'
                when 2 then 'febrero'
                when 3 then 'marzo'
                when 4 then 'abril'
                when 5 then 'mayo'
                when 6 then 'junio'
                when 7 then 'julio'
                when 8 then 'agosto'
                when 9 then 'septiembre'
                when 10 then 'octubre'
                when 11 then 'noviembre'
                when 12 then 'diciembre'
                else to_char(m.mes, 'YYYY-MM')
            end,
            to_char(m.mes, 'YYYY'),
            coalesce(to_char(m.pct_movimientos_100, 'FM999990D00'),'0'),
            m.movimientos_total,
            m.stock_activo
        ) as insight_movimientos,
        format(
            'El mix fue %s%% asignaciones.',
            coalesce(to_char(m.mix_asignaciones_100, 'FM999990D00'),'0')
        ) as insight_mix,
        case
            when lag(m.movimientos_total) over (order by m.mes) is null then
                'Primer mes del período.'
            else
                format(
                    'Vs mes anterior: %s movimientos.',
                    case
                        when m.delta_movimientos > 0 then '+' || m.delta_movimientos::text
                        else coalesce(m.delta_movimientos::text, '0')
                    end
                )
        end as insight_delta,
        format(
            'MTR: %s ingresos de personas · %s salidas de personas · %s ingresos de hardware · %s equipos reutilizados/reasignados · %s equipos devueltos/retornados · %s equipos enviados a baja explícita en MTR. Nota: las salidas de personas no equivalen automáticamente a bajas de equipo.',
            m.ingresos_personas,
            m.salidas_personas,
            m.ingresos_hardware,
            m.equipos_reutilizados,
            m.equipos_retornados,
            m.equipos_baja
        )
        || case
            when m.override_manual_aplicado and m.cambios_reemplazos_mtr is not null
              then format(
                ' Ajuste manual auditable: el cuadro MTR reporta %s en Cambios/Reemplazos; este valor no necesariamente equivale a cambio real de equipo.',
                m.cambios_reemplazos_mtr
              )
            else ''
          end
        || case
            when coalesce(m.override_note, '') <> '' then ' ' || m.override_note
            else ''
          end as insight_mtr
    from metrics m
)

select *
from final
order by mes asc
