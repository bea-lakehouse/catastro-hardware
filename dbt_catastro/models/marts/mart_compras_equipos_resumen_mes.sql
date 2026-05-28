{{ config(materialized='table', tags=['mart','compras','documentos','2026','resumen']) }}

with base as (
    select *
    from {{ ref('mart_compras_equipos_2026') }}
),

docs as (
    select distinct
        documento_id,
        mes_documento,
        tipo_documento,
        total_neto,
        iva,
        total,
        proveedor
    from base
),

doc_summary as (
    select
        mes_documento as mes,
        count(distinct documento_id) as documentos_total,
        count(distinct case when tipo_documento = 'factura' then documento_id end) as documentos_factura,
        count(distinct case when tipo_documento = 'guia_despacho' then documento_id end) as documentos_guia_despacho,
        count(distinct case when tipo_documento = 'orden_compra' then documento_id end) as documentos_orden_compra,
        count(distinct proveedor) as proveedores_activos,
        sum(case when tipo_documento = 'factura' then total_neto else 0 end)::numeric(14,0) as total_neto_facturado,
        sum(case when tipo_documento = 'factura' then iva else 0 end)::numeric(14,0) as iva_facturado,
        sum(case when tipo_documento = 'factura' then total else 0 end)::numeric(14,0) as total_facturado,
        sum(case when tipo_documento = 'orden_compra' then total_neto else 0 end)::numeric(14,0) as presupuesto_neto_proyectado,
        sum(case when tipo_documento = 'orden_compra' then total else 0 end)::numeric(14,0) as presupuesto_total_proyectado
    from docs
    group by 1
),

line_summary as (
    select
        mes_documento as mes,
        sum(case when tipo_documento = 'factura' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_facturadas,
        sum(case when tipo_documento = 'guia_despacho' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_recibidas,
        sum(case when tipo_documento = 'orden_compra' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_proyectadas,
        sum(case when tipo_documento = 'factura' and categoria_equipo = 'macbook' then cantidad else 0 end)::int as macbook_facturadas,
        sum(case when tipo_documento = 'factura' and categoria_equipo = 'hp' then cantidad else 0 end)::int as hp_facturadas,
        sum(case when tipo_documento = 'guia_despacho' and categoria_equipo = 'macbook' then cantidad else 0 end)::int as macbook_recibidas,
        sum(case when tipo_documento = 'guia_despacho' and categoria_equipo = 'hp' then cantidad else 0 end)::int as hp_recibidas,
        sum(case when tipo_documento = 'orden_compra' and categoria_equipo = 'macbook' then cantidad else 0 end)::int as macbook_proyectadas,
        sum(case when tipo_documento = 'orden_compra' and categoria_equipo = 'hp' then cantidad else 0 end)::int as hp_proyectadas,
        sum(case when tipo_documento = 'factura' then unidades_pendientes_recepcion else 0 end)::int as unidades_pendientes_recepcion,
        sum(case when tipo_documento = 'guia_despacho' and conciliacion_status = 'pendiente_conciliacion' then cantidad else 0 end)::int as unidades_pendientes_conciliacion,
        count(distinct case when tipo_documento = 'guia_despacho' and conciliacion_status = 'pendiente_conciliacion' then documento_id end) as documentos_guia_sin_match_mtr,
        count(distinct case when tipo_documento = 'factura' and unidades_pendientes_recepcion > 0 then documento_id end) as documentos_factura_sin_ingreso_stock,
        count(distinct modelo) as modelos_distintos
    from base
    where categoria_equipo in ('macbook', 'hp', 'servicio', 'accesorio')
    group by 1
)

select
    d.mes,
    d.documentos_total,
    d.documentos_factura,
    d.documentos_guia_despacho,
    d.documentos_orden_compra,
    d.proveedores_activos,
    coalesce(l.modelos_distintos, 0) as modelos_distintos,
    d.total_neto_facturado,
    d.iva_facturado,
    d.total_facturado,
    d.presupuesto_neto_proyectado,
    d.presupuesto_total_proyectado,
    coalesce(l.unidades_facturadas, 0) as unidades_facturadas,
    coalesce(l.unidades_recibidas, 0) as unidades_recibidas,
    coalesce(l.unidades_proyectadas, 0) as unidades_proyectadas,
    coalesce(l.macbook_facturadas, 0) as macbook_facturadas,
    coalesce(l.hp_facturadas, 0) as hp_facturadas,
    coalesce(l.macbook_recibidas, 0) as macbook_recibidas,
    coalesce(l.hp_recibidas, 0) as hp_recibidas,
    coalesce(l.macbook_proyectadas, 0) as macbook_proyectadas,
    coalesce(l.hp_proyectadas, 0) as hp_proyectadas,
    coalesce(l.unidades_pendientes_recepcion, 0) as unidades_pendientes_recepcion,
    coalesce(l.unidades_pendientes_conciliacion, 0) as unidades_pendientes_conciliacion,
    coalesce(l.documentos_guia_sin_match_mtr, 0) as documentos_guia_sin_match_mtr,
    coalesce(l.documentos_factura_sin_ingreso_stock, 0) as documentos_factura_sin_ingreso_stock
from doc_summary d
left join line_summary l
  on l.mes = d.mes
order by d.mes
