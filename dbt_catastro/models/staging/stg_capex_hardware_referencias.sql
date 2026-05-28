{{ config(materialized='view', tags=['staging','capex','planeacion']) }}

select
    trim(modelo) as modelo,
    trim(proveedor) as proveedor,
    trim(empresa) as empresa,
    precio_unitario::numeric(14,2) as precio_unitario,
    upper(trim(moneda)) as moneda,
    vigencia_desde::date as vigencia_desde,
    vigencia_hasta::date as vigencia_hasta,
    nullif(trim(observacion), '') as observacion
from {{ ref('capex_hardware_referencias') }}
