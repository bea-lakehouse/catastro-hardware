{{ config(materialized='table', tags=['marts','mtr','estadisticas']) }}

with calendario as (
    select
        generate_series(
            date '2024-01-01',
            date_trunc('month', current_date)::date,
            interval '1 month'
        )::date as mes
),

original_mtr_ingresos as (
    select
        date_trunc('month', fecha_evento)::date as mes,
        count(*)::int as ingresos_mtr_original
    from {{ ref('stg_mtr_google_sheet_ingresos') }}
    where fecha_evento::date >= date '2024-01-01'
      and fecha_evento::date <= current_date
    group by 1
),

original_mtr_salidas as (
    select
        date_trunc('month', fecha_evento)::date as mes,
        count(*)::int as salidas_mtr_original
    from {{ ref('stg_mtr_google_sheet_salidas') }}
    where fecha_evento::date >= date '2024-01-01'
      and fecha_evento::date <= current_date
    group by 1
),

eventos as (
    select *
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where fecha_evento_dia::date >= date '2024-01-01'
      and fecha_evento_dia::date <= current_date
),

mensual as (
    select
        date_trunc('month', fecha_evento_dia)::date as mes,
        count(*)::int as movimientos_total,
        count(*) filter (
            where tipo_evento = 'INGRESO'
        )::int as mtr_ingresos_total,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(tipo_ingreso, 'nuevo') = 'nuevo'
        )::int as ingresos_nuevos,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and tipo_ingreso = 'interno'
        )::int as ingresos_internos,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_con_equipo, false)
        )::int as ingresos_con_equipo,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and not coalesce(ingreso_con_equipo, false)
        )::int as ingresos_sin_equipo,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(tipo_ingreso, 'nuevo') = 'nuevo'
              and coalesce(ingreso_con_equipo, false)
        )::int as ingresos_nuevos_con_equipo,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(tipo_ingreso, 'nuevo') = 'nuevo'
              and not coalesce(ingreso_con_equipo, false)
              and coalesce(ingreso_presiona_compra, false)
        )::int as ingresos_nuevos_sin_equipo,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(tipo_ingreso, 'nuevo') = 'nuevo'
              and coalesce(ambito_registro, 'UNKNOWN') = 'NACIONAL'
              and coalesce(ingreso_con_equipo, false)
        )::int as ingresos_nuevos_nacionales_con_equipo,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(tipo_ingreso, 'nuevo') = 'nuevo'
              and coalesce(ambito_registro, 'UNKNOWN') = 'NACIONAL'
              and not coalesce(ingreso_con_equipo, false)
              and coalesce(ingreso_presiona_compra, false)
        )::int as ingresos_nuevos_nacionales_sin_equipo,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(tipo_ingreso, 'nuevo') = 'nuevo'
              and coalesce(ambito_registro, 'UNKNOWN') = 'EXTRANJERO'
              and coalesce(ingreso_con_equipo, false)
        )::int as ingresos_nuevos_internacionales_con_equipo,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(tipo_ingreso, 'nuevo') = 'nuevo'
              and coalesce(ambito_registro, 'UNKNOWN') = 'EXTRANJERO'
              and not coalesce(ingreso_con_equipo, false)
              and not coalesce(ingreso_presiona_compra, false)
        )::int as ingresos_nuevos_internacionales_sin_equipo_no_requerido,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ingreso_presiona_compra, true)
        )::int as ingresos_presion_compra,
        count(*) filter (
            where tipo_evento = 'INGRESO'
              and coalesce(ambito_registro, 'UNKNOWN') = 'EXTRANJERO'
        )::int as ingresos_extranjeros,
        count(*) filter (
            where tipo_evento = 'SALIDA'
        )::int as mtr_salidas_total,
        count(*) filter (
            where tipo_evento = 'SALIDA'
              and coalesce(ambito_registro, 'UNKNOWN') = 'EXTRANJERO'
        )::int as salidas_extranjeros,
        max(fecha_evento_dia)::date as fecha_ultima_actualizacion
    from eventos
    group by 1
),

historia as (
    select
        mes,
        coalesce(asignaciones, 0)::int as asignaciones,
        coalesce(devoluciones, 0)::int as devoluciones,
        coalesce(movimientos_internos, 0)::int as movimientos_internos,
        coalesce(cambios_equipo_real, 0)::int as cambios_equipo_real,
        coalesce(ingresos_hardware, 0)::int as ingresos_hardware,
        coalesce(reasignaciones_hardware, 0)::int as reasignaciones_hardware,
        coalesce(equipos_reutilizados, 0)::int as equipos_reutilizados,
        coalesce(equipos_retornados, 0)::int as equipos_retornados,
        coalesce(equipos_baja, 0)::int as equipos_baja,
        coalesce(salidas_hardware, 0)::int as salidas_hardware,
        coalesce(ingresos_nuevos_con_equipo, 0)::int as ingresos_nuevos_con_equipo,
        coalesce(ingresos_nuevos_sin_equipo, 0)::int as ingresos_nuevos_sin_equipo,
        coalesce(presion_compra, 0)::int as presion_compra,
        coalesce(gap_operativo_estimado, 0)::int as gap_operativo,
        coalesce(gap_vs_oferta_actual_ref, 0)::int as gap_vs_stock_disponible,
        coalesce(stock_visible_mes, stock_visible_actual_ref, 0)::int as stock_activo_hist,
        coalesce(oferta_disponible_mes, oferta_disponible_actual_ref, 0)::int as stock_disponible_hist,
        coalesce(stock_visible_actual_ref, 0)::int as stock_activo_actual_ref,
        coalesce(oferta_disponible_actual_ref, 0)::int as stock_disponible_actual_ref
    from {{ ref('mart_catastro_historia_mensual') }}
),

stock_disponible_actual as (
    select count(*)::int as stock_disponible_actual
    from {{ ref('stg_mtr_google_sheet_equipos_disponibles') }}
),

stock_activo_actual as (
    select count(*)::int as stock_activo_actual
    from {{ ref('mart_equipos_estado_actual') }}
    where coalesce(es_activo_operativo, upper(coalesce(estado_operativo, 'ACTIVO')) <> 'BAJA')
),

overrides_manual as (
    select
        mes::date as mes,
        cambios_reemplazos_mtr,
        ingresos_hardware_override,
        equipos_reutilizados_override,
        reasignaciones_hardware_override,
        cambios_equipo_real_override,
        equipos_retornados_override,
        devoluciones_hardware_override,
        equipos_baja_override,
        movimientos_internos_sin_impacto_override,
        ingresos_internos_override,
        nuevos_con_equipo_override,
        ingresos_nuevos_con_equipo_override,
        nuevos_sin_equipo_override,
        ingresos_nuevos_sin_equipo_override,
        presion_compra_override,
        stock_disponible_override,
        override_scope,
        override_note
    from {{ ref('estadisticas_movimientos_override_manual') }}
),

base as (
    select
        c.mes,
        case
            when c.mes = date_trunc('month', current_date)::date then 'en_curso'
            else 'cerrado'
        end as estado_mes,
        case
            when c.mes = date_trunc('month', current_date)::date then coalesce(m.fecha_ultima_actualizacion, current_date)
            else coalesce(m.fecha_ultima_actualizacion, (c.mes + interval '1 month - 1 day')::date)
        end as fecha_ultima_actualizacion,
        m.fecha_ultima_actualizacion as fecha_ultimo_evento_mtr,
        'analytics.int_mtr_eventos_dedup_stats + analytics.fct_movimientos_detalle + analytics.stg_mtr_google_sheet_equipos_disponibles + analytics.mart_equipos_estado_actual'::text as fuente,
        coalesce(m.movimientos_total, 0) as movimientos_total,
        coalesce(m.mtr_ingresos_total, 0) as mtr_ingresos_total,
        coalesce(m.mtr_ingresos_total, 0) as ingresos_personas,
        coalesce(m.ingresos_nuevos, 0) as ingresos_nuevos,
        coalesce(ov.ingresos_internos_override, m.ingresos_internos, 0) as ingresos_internos,
        coalesce(ov.movimientos_internos_sin_impacto_override, ov.ingresos_internos_override, m.ingresos_internos, 0) as movimientos_internos_sin_impacto,
        coalesce(m.ingresos_con_equipo, 0) as ingresos_con_equipo,
        coalesce(m.ingresos_sin_equipo, 0) as ingresos_sin_equipo,
        coalesce(ov.ingresos_nuevos_con_equipo_override, m.ingresos_nuevos_con_equipo, 0) as ingresos_nuevos_con_equipo,
        coalesce(ov.nuevos_con_equipo_override, ov.ingresos_nuevos_con_equipo_override, m.ingresos_nuevos_con_equipo, 0) as nuevos_con_equipo,
        coalesce(ov.ingresos_nuevos_sin_equipo_override, m.ingresos_nuevos_sin_equipo, 0) as ingresos_nuevos_sin_equipo,
        coalesce(ov.nuevos_sin_equipo_override, ov.ingresos_nuevos_sin_equipo_override, m.ingresos_nuevos_sin_equipo, 0) as nuevos_sin_equipo,
        coalesce(m.ingresos_nuevos_nacionales_con_equipo, 0) as nacionales_con_equipo_asignado,
        coalesce(m.ingresos_nuevos_nacionales_sin_equipo, 0) as nacionales_pendientes_equipo,
        coalesce(m.ingresos_nuevos_internacionales_con_equipo, 0) as internacionales_con_equipo_asignado,
        coalesce(m.ingresos_nuevos_internacionales_sin_equipo_no_requerido, 0) as internacionales_sin_equipo_no_requerido,
        coalesce(m.ingresos_presion_compra, 0) as ingresos_presion_compra,
        coalesce(m.ingresos_extranjeros, 0) as ingresos_extranjeros,
        coalesce(m.mtr_salidas_total, 0) as mtr_salidas_total,
        coalesce(m.mtr_salidas_total, 0) as salidas_personas,
        coalesce(m.salidas_extranjeros, 0) as salidas_extranjeros,
        coalesce(h.movimientos_internos, 0) as movimientos_internos,
        coalesce(ov.cambios_equipo_real_override, ov.cambios_reemplazos_mtr, h.cambios_equipo_real, 0) as cambios_equipo_real,
        coalesce(h.cambios_equipo_real, 0) as cambios_equipo_real_base,
        ov.cambios_reemplazos_mtr as cambios_reemplazos_mtr,
        coalesce(h.asignaciones, 0) as asignaciones,
        coalesce(h.devoluciones, 0) as devoluciones,
        coalesce(ov.devoluciones_hardware_override, h.devoluciones, 0) as devoluciones_hardware,
        coalesce(ov.ingresos_hardware_override, h.ingresos_hardware, 0) as ingresos_hardware,
        coalesce(ov.reasignaciones_hardware_override, h.reasignaciones_hardware, 0) as reasignaciones_hardware,
        coalesce(ov.equipos_reutilizados_override, ov.reasignaciones_hardware_override, h.equipos_reutilizados, h.reasignaciones_hardware, 0) as equipos_reutilizados,
        coalesce(ov.equipos_retornados_override, ov.devoluciones_hardware_override, h.equipos_retornados, coalesce(h.devoluciones, 0), 0) as equipos_retornados,
        coalesce(ov.equipos_baja_override, h.equipos_baja, 0) as equipos_baja,
        coalesce(h.salidas_hardware, 0) as salidas_hardware,
        coalesce(ov.presion_compra_override, h.presion_compra, coalesce(m.ingresos_presion_compra, 0)) as presion_compra,
        coalesce(h.stock_activo_hist, h.stock_activo_actual_ref, sa.stock_activo_actual, 0) as stock_activo,
        case
            when c.mes = date_trunc('month', current_date)::date
                then coalesce(ov.stock_disponible_override, h.stock_disponible_actual_ref, d.stock_disponible_actual, 0)
            else coalesce(ov.stock_disponible_override, h.stock_disponible_hist, h.stock_disponible_actual_ref, d.stock_disponible_actual, 0)
        end as stock_disponible,
        coalesce(omi.ingresos_mtr_original, 0) as ingresos_mtr_original,
        coalesce(oms.salidas_mtr_original, 0) as salidas_mtr_original,
        (ov.mes is not null) as override_manual_aplicado,
        ov.override_scope,
        ov.override_note,
        coalesce(
            h.gap_vs_stock_disponible,
            h.gap_operativo,
            greatest(
                coalesce(ov.presion_compra_override, h.presion_compra, coalesce(m.ingresos_presion_compra, 0))
                - coalesce(ov.stock_disponible_override, h.stock_disponible_hist, h.stock_disponible_actual_ref, d.stock_disponible_actual, 0),
                0
            )
        ) as gap
    from calendario c
    left join mensual m
      on m.mes = c.mes
    left join historia h
      on h.mes = c.mes
    left join original_mtr_ingresos omi
      on omi.mes = c.mes
    left join original_mtr_salidas oms
      on oms.mes = c.mes
    left join overrides_manual ov
      on ov.mes = c.mes
    cross join stock_disponible_actual d
    cross join stock_activo_actual sa
),

final as (
    select
        b.*,
        b.mtr_ingresos_total as total_ingresos,
        b.mtr_salidas_total as total_salidas,
        (b.ingresos_personas - b.ingresos_mtr_original) as delta_ingresos_vs_mtr_original,
        (b.salidas_personas - b.salidas_mtr_original) as delta_salidas_vs_mtr_original,
        (
            b.ingresos_personas = b.ingresos_mtr_original
            and b.salidas_personas = b.salidas_mtr_original
        ) as conteo_validado_mtr_original,
        case
            when b.ingresos_personas = b.ingresos_mtr_original
             and b.salidas_personas = b.salidas_mtr_original
                then 'VALIDADO'
            else 'PENDIENTE_CONCILIACION'
        end::text as estado_validacion_mtr_original,
        round(
            case
                when b.stock_activo > 0
                    then (b.movimientos_total::numeric / b.stock_activo::numeric) * 100
                else 0
            end,
            2
        ) as pct_movimientos_100
    from base b
)

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
    greatest(ingresos_personas - nuevos_sin_equipo, 0) as personas_resueltas_con_equipo,
    (
      ingresos_personas = (
        movimientos_internos_sin_impacto
        + nuevos_con_equipo
        + nuevos_sin_equipo
        + internacionales_sin_equipo_no_requerido
      )
    ) as coherencia_operacional_ingresos,
    case
      when ingresos_personas = (
        movimientos_internos_sin_impacto
        + nuevos_con_equipo
        + nuevos_sin_equipo
        + internacionales_sin_equipo_no_requerido
      )
        then 'COHERENTE'
      else 'REVISAR_SEMANTICA'
    end::text as estado_coherencia_operacional,
    delta_ingresos_vs_mtr_original,
    delta_salidas_vs_mtr_original,
    conteo_validado_mtr_original,
    estado_validacion_mtr_original,
    pct_movimientos_100,
    'En '
      || case extract(month from mes)::int
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
          else to_char(mes, 'YYYY-MM')
        end
      || ' de '
      || to_char(mes, 'YYYY')
      || ' se movió '
      || to_char(pct_movimientos_100, 'FM999990.00')
      || '% del stock ('
      || movimientos_total
      || '/'
      || stock_activo
      || ').' as insight_movimientos,
    'MTR: '
      || ingresos_personas
      || ' ingresos de personas · '
      || salidas_personas
      || ' salidas de personas · '
      || ingresos_hardware
      || ' ingresos de hardware · '
      || equipos_reutilizados
      || ' equipos reutilizados/reasignados · '
      || cambios_equipo_real
      || ' cambios reales de equipo · '
      || equipos_retornados
      || ' equipos devueltos/retornados · '
      || equipos_baja
      || ' equipos enviados a baja explícita en MTR · '
      || movimientos_internos_sin_impacto
      || ' ingresos internos sin impacto · '
      || nuevos_con_equipo
      || ' nuevos con equipo · '
      || nuevos_sin_equipo
      || ' nuevos sin equipo · '
      || internacionales_sin_equipo_no_requerido
      || ' internacionales sin equipo requerido · '
      || presion_compra
      || ' casos con presión de compra · stock disponible '
      || stock_disponible
      || '. Nota: las salidas de personas no equivalen automáticamente a bajas de equipo.'
      || case
          when override_manual_aplicado and cambios_reemplazos_mtr is not null
            then ' Ajuste manual auditable: el cuadro MTR reporta '
              || cambios_reemplazos_mtr
              || ' en Cambios/Reemplazos; este valor no necesariamente equivale a cambio real de equipo.'
          else ''
        end
      || case
          when coalesce(override_note, '') <> ''
            then ' ' || override_note
          else ''
        end as insight_mtr
from final
order by mes
