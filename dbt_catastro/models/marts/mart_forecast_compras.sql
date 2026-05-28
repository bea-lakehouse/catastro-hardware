{{ config(materialized='table', tags=['mart','compras','forecast','2026']) }}

with base as (
    select
        mes_documento as mes,
        empresa,
        proveedor,
        marca,
        modelo,
        categoria_equipo,
        cantidad,
        precio_unitario,
        total_linea,
        documento_id,
        numero_documento,
        orden_compra
    from {{ ref('mart_compras_equipos_2026') }}
    where tipo_documento = 'orden_compra'
      and categoria_equipo in ('macbook', 'hp')
),

planeacion as (
    select
        mes,
        demanda_presion_compra_mes,
        stock_disponible_confirmado,
        stock_disponible_total
    from {{ ref('mart_planeacion_compras_tendencia_mes') }}
),

agregado as (
    select
        b.mes,
        b.empresa,
        b.proveedor,
        b.marca,
        b.modelo,
        b.categoria_equipo,
        sum(b.cantidad)::int as cantidad_planeada,
        max(b.precio_unitario)::numeric(14,0) as precio_unitario_referencia,
        sum(coalesce(b.total_linea, 0))::numeric(14,0) as presupuesto_estimado_clp,
        string_agg(distinct b.numero_documento, ' | ' order by b.numero_documento) as documentos,
        string_agg(distinct coalesce(b.orden_compra, b.documento_id), ' | ' order by coalesce(b.orden_compra, b.documento_id)) as ordenes_compra
    from base b
    group by 1,2,3,4,5,6
)

select
    a.mes,
    a.empresa,
    a.proveedor,
    a.marca,
    a.modelo,
    a.categoria_equipo,
    a.cantidad_planeada,
    a.precio_unitario_referencia,
    a.presupuesto_estimado_clp,
    a.documentos,
    a.ordenes_compra,
    coalesce(p.demanda_presion_compra_mes, 0)::int as demanda_presion_compra_mes_base,
    coalesce(p.stock_disponible_confirmado, 0)::int as stock_disponible_confirmado_base,
    coalesce(p.stock_disponible_total, 0)::int as stock_disponible_total_base
from agregado a
left join planeacion p
  on p.mes = a.mes
order by a.mes, a.proveedor, a.marca, a.modelo
