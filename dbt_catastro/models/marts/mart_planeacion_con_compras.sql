{{ config(materialized='table', tags=['mart','compras','planeacion','2026']) }}

with trend as (
    select
        mes,
        es_proyeccion,
        fuente_presion,
        demanda_presion_compra_mes,
        stock_disponible_confirmado,
        stock_disponible_total,
        cobertura_confirmada_ratio,
        cobertura_total_ratio
    from {{ ref('mart_planeacion_compras_tendencia_mes') }}
),

summary_docs as (
    select *
    from {{ ref('mart_compras_equipos_resumen_mes') }}
),

forecast as (
    select
        mes,
        sum(cantidad_planeada)::int as compras_proyectadas,
        sum(case when categoria_equipo = 'macbook' then cantidad_planeada else 0 end)::int as macbook_proyectadas,
        sum(case when categoria_equipo = 'hp' then cantidad_planeada else 0 end)::int as hp_proyectadas,
        sum(presupuesto_estimado_clp)::numeric(14,0) as presupuesto_proyectado_clp
    from {{ ref('mart_forecast_compras') }}
    group by 1
),

calendar as (
    select mes from trend
    union
    select mes from summary_docs
    union
    select mes from forecast
),

base as (
    select
        c.mes,
        t.es_proyeccion,
        t.fuente_presion,
        coalesce(t.demanda_presion_compra_mes, 0)::int as demanda_presion_compra_mes,
        coalesce(t.stock_disponible_confirmado, 0)::int as stock_disponible_confirmado_base,
        coalesce(t.stock_disponible_total, 0)::int as stock_disponible_total_base,
        coalesce(t.cobertura_confirmada_ratio, null) as cobertura_confirmada_ratio_base,
        coalesce(t.cobertura_total_ratio, null) as cobertura_total_ratio_base,
        coalesce(s.unidades_facturadas, 0)::int as compras_documentales_facturadas,
        coalesce(s.unidades_recibidas, 0)::int as compras_documentales_recibidas,
        coalesce(s.unidades_pendientes_recepcion, 0)::int as compras_documentales_pendientes_recepcion,
        coalesce(s.unidades_pendientes_conciliacion, 0)::int as compras_documentales_pendientes_conciliacion,
        coalesce(s.documentos_factura_sin_ingreso_stock, 0)::int as documentos_factura_sin_ingreso_stock,
        coalesce(s.documentos_guia_sin_match_mtr, 0)::int as documentos_guia_sin_match_mtr,
        coalesce(s.macbook_facturadas, 0)::int as macbook_facturadas,
        coalesce(s.hp_facturadas, 0)::int as hp_facturadas,
        coalesce(s.macbook_recibidas, 0)::int as macbook_recibidas,
        coalesce(s.hp_recibidas, 0)::int as hp_recibidas,
        coalesce(f.compras_proyectadas, 0)::int as compras_proyectadas,
        coalesce(f.macbook_proyectadas, 0)::int as macbook_proyectadas,
        coalesce(f.hp_proyectadas, 0)::int as hp_proyectadas,
        coalesce(f.presupuesto_proyectado_clp, 0)::numeric(14,0) as presupuesto_proyectado_clp
    from calendar c
    left join trend t
      on t.mes = c.mes
    left join summary_docs s
      on s.mes = c.mes
    left join forecast f
      on f.mes = c.mes
),

final as (
    select
        *,
        (stock_disponible_confirmado_base + compras_documentales_recibidas)::int as stock_esperado_confirmado,
        (
            stock_disponible_total_base
            + compras_documentales_pendientes_recepcion
            + compras_proyectadas
        )::int as stock_esperado_total
    from base
)

select
    mes,
    es_proyeccion,
    fuente_presion,
    demanda_presion_compra_mes,
    stock_disponible_confirmado_base,
    stock_disponible_total_base,
    cobertura_confirmada_ratio_base,
    cobertura_total_ratio_base,
    compras_documentales_facturadas,
    compras_documentales_recibidas,
    compras_documentales_pendientes_recepcion,
    compras_documentales_pendientes_conciliacion,
    documentos_factura_sin_ingreso_stock,
    documentos_guia_sin_match_mtr,
    macbook_facturadas,
    hp_facturadas,
    macbook_recibidas,
    hp_recibidas,
    compras_proyectadas,
    macbook_proyectadas,
    hp_proyectadas,
    presupuesto_proyectado_clp,
    stock_esperado_confirmado,
    stock_esperado_total,
    (stock_esperado_confirmado - demanda_presion_compra_mes)::int as gap_confirmado_con_compras,
    (stock_esperado_total - demanda_presion_compra_mes)::int as gap_total_con_compras,
    case
        when demanda_presion_compra_mes = 0 then null::numeric
        else round(stock_esperado_confirmado::numeric / demanda_presion_compra_mes::numeric, 2)
    end as cobertura_confirmada_con_compras,
    case
        when demanda_presion_compra_mes = 0 then null::numeric
        else round(stock_esperado_total::numeric / demanda_presion_compra_mes::numeric, 2)
    end as cobertura_total_con_compras,
    case
        when compras_proyectadas > 0 and (stock_esperado_total - demanda_presion_compra_mes) >= 0
            then 'El escenario de compras 2026 cubre la presión visible del mes y deja stock proyectado positivo.'
        when compras_proyectadas > 0 and (stock_esperado_total - demanda_presion_compra_mes) < 0
            then 'Aun con la compra proyectada sigue existiendo brecha de cobertura; conviene monitorear demanda y recepción.'
        when compras_documentales_recibidas > 0
            then 'Hay recepción documental real que mejora disponibilidad confirmada, pero todavía requiere conciliación física contra MTR.'
        when compras_documentales_facturadas > 0
            then 'Existen compras facturadas visibles, pero el parque aún no muestra recepción suficiente para tratarlas como stock confirmado.'
        else 'Sin compras documentales visibles para enriquecer este corte.'
    end as lectura_planeacion_con_compras,
    case
        when macbook_proyectadas > 0 and hp_proyectadas > 0
            then 'MacBook empuja cobertura para perfiles core/dev; HP sostiene presión de staffing/windows.'
        when macbook_proyectadas > 0
            then 'La presión proyectada se cubre principalmente con MacBook para perfiles core/dev.'
        when hp_proyectadas > 0
            then 'La presión proyectada se cubre principalmente con HP para perfiles staffing/windows.'
        else 'Sin escenario proyectado cargado para presión staffing/core.'
    end as lectura_staffing_core
from final
order by mes
