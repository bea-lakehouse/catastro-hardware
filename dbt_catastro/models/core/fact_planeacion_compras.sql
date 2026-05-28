{{ config(materialized='table', tags=['core','compras','planeacion']) }}

select
    id_compra_manual,
    id_compra,
    mes_referencia,
    coalesce(date_trunc('month', fecha_compra)::date, mes_referencia) as mes_operacion,
    coalesce(date_trunc('month', fecha_compra)::date, mes_referencia) as mes_compra,
    fecha_compra,
    fecha_estimada_entrega,
    fecha_ingreso_real,
    empresa,
    proveedor,
    marca,
    modelo,
    os_familia,
    tipo_equipo,
    cantidad,
    estado_compra,
    tipo_stock,
    cuenta_stock_disponible,
    cuenta_stock_planificado,
    case when estado_compra in ('CONFIRMADA', 'RECIBIDA') then cantidad else 0 end as equipos_confirmados,
    case when estado_compra = 'PENDIENTE' then cantidad else 0 end as equipos_pendientes,
    case when cuenta_stock_disponible then cantidad else 0 end as stock_disponible_delta,
    case when cuenta_stock_planificado then cantidad else 0 end as stock_planificado_delta,
    case
        when estado_compra = 'RECIBIDA' and cuenta_stock_disponible then true
        else false
    end as cuenta_stock_real,
    case
        when estado_compra = 'PENDIENTE' and cuenta_stock_planificado then true
        else false
    end as cuenta_stock_proyectado,
    observacion
from {{ ref('stg_planeacion_compras_manual') }}
