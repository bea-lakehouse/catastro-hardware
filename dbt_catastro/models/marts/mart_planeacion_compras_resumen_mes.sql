{{ config(materialized='table', tags=['mart','compras','planeacion','ui']) }}

with base as (
    select *
    from {{ ref('fact_planeacion_compras') }}
),

agregado as (
    select
        mes_operacion as mes,
        empresa,
        proveedor,
        marca,
        modelo,
        os_familia,
        tipo_equipo,
        estado_compra,
        sum(cantidad)::int as equipos_total,
        sum(equipos_confirmados)::int as equipos_confirmados,
        sum(equipos_pendientes)::int as equipos_pendientes,
        sum(stock_disponible_delta)::int as stock_disponible_delta,
        sum(stock_planificado_delta)::int as stock_planificado_delta
    from base
    group by 1,2,3,4,5,6,7,8
)

select
    mes,
    empresa,
    proveedor,
    marca,
    modelo,
    os_familia,
    tipo_equipo,
    estado_compra,
    equipos_total,
    equipos_confirmados,
    equipos_pendientes,
    stock_disponible_delta,
    stock_planificado_delta
from agregado
order by mes, empresa, proveedor, marca, modelo, estado_compra
