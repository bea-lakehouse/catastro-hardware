{{ config(materialized='view', tags=['staging','compras','planeacion']) }}

select
    trim(id_compra_manual) as id_compra_manual,
    trim(id_compra_manual) as id_compra,
    mes_referencia::date as mes_referencia,
    fecha_compra::date as fecha_compra,
    trim(empresa) as empresa,
    trim(proveedor) as proveedor,
    trim(marca) as marca,
    trim(modelo) as modelo,
    upper(trim(os_familia)) as os_familia,
    upper(trim(tipo_equipo)) as tipo_equipo,
    cantidad::int as cantidad,
    upper(trim(estado_compra)) as estado_compra,
    upper(trim(tipo_stock)) as tipo_stock,
    coalesce(cuenta_stock_disponible, false) as cuenta_stock_disponible,
    coalesce(cuenta_stock_planificado, false) as cuenta_stock_planificado,
    fecha_estimada_entrega::date as fecha_estimada_entrega,
    fecha_ingreso_real::date as fecha_ingreso_real,
    nullif(trim(observaciones), '') as observacion
from {{ ref('planeacion_compras_manual') }}
