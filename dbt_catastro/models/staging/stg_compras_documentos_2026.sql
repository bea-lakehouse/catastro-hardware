{{ config(materialized='view', tags=['staging','compras','documentos','2026']) }}

select
    trim(documento_id) as documento_id,
    trim(coalesce(empresa, 'Acid Labs')) as empresa,
    trim(proveedor) as proveedor,
    lower(trim(tipo_documento)) as tipo_documento,
    trim(numero_documento) as numero_documento,
    fecha_emision::date as fecha_emision,
    fecha_vencimiento::date as fecha_vencimiento,
    nullif(trim(orden_compra), '') as orden_compra,
    total_neto::numeric(14, 0) as total_neto,
    iva::numeric(14, 0) as iva,
    total::numeric(14, 0) as total,
    upper(coalesce(nullif(trim(moneda), ''), 'CLP')) as moneda,
    trim(archivo_origen) as archivo_origen,
    nullif(trim(observaciones), '') as observaciones
from {{ ref('compras_documentos_2026') }}
