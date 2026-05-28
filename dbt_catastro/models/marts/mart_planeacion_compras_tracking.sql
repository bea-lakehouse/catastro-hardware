{{ config(materialized='table', tags=['mart','compras','planeacion','tracking','ui']) }}

with base as (
    select *
    from {{ ref('fact_planeacion_compras') }}
    where estado_compra <> 'CANCELADA'
),

agregado as (
    select
        mes_operacion as mes,
        mes_compra,
        string_agg(id_compra, ' | ' order by id_compra) as id_compra,
        empresa,
        proveedor,
        string_agg(modelo, ' + ' order by id_compra) as modelo,
        sum(cantidad)::int as cantidad,
        estado_compra as estado,
        tipo_stock,
        min(fecha_estimada_entrega) as fecha_estimada_entrega,
        max(fecha_ingreso_real) as fecha_ingreso_real,
        case
            when estado_compra = 'PENDIENTE' and min(fecha_estimada_entrega) is null
                then 'Confirmar fecha de entrega'
            when estado_compra = 'PENDIENTE'
                then 'Monitorear entrega comprometida'
            when estado_compra = 'CONFIRMADA' and max(fecha_ingreso_real) is null
                then 'Confirmar ingreso fisico al parque'
            when estado_compra = 'RECIBIDA'
                then 'Ingreso completado'
            else 'Excluir de cobertura y cerrar seguimiento'
        end as accion_recomendada,
        bool_or(cuenta_stock_real) as cuenta_stock_real,
        bool_or(cuenta_stock_proyectado) as cuenta_stock_proyectado,
        string_agg(coalesce(observacion, ''), ' | ' order by id_compra) filter (where observacion is not null) as observacion
    from base
    group by 1,2,4,5,8,9
)

select
    mes,
    mes_compra,
    id_compra,
    empresa,
    proveedor,
    modelo,
    cantidad,
    estado,
    tipo_stock,
    fecha_estimada_entrega,
    fecha_ingreso_real,
    accion_recomendada,
    cuenta_stock_real,
    cuenta_stock_proyectado,
    observacion
from agregado
order by
    mes,
    case estado
        when 'PENDIENTE' then 1
        when 'CONFIRMADA' then 2
        when 'RECIBIDA' then 3
        else 4
    end,
    proveedor,
    empresa,
    modelo
