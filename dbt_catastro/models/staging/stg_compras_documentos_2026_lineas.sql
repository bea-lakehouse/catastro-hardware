{{ config(materialized='view', tags=['staging','compras','documentos','2026']) }}

select
    trim(linea_id) as linea_id,
    trim(documento_id) as documento_id,
    initcap(trim(marca)) as marca,
    trim(modelo) as modelo,
    trim(descripcion_original) as descripcion_original,
    cantidad::int as cantidad,
    precio_unitario::numeric(14, 0) as precio_unitario,
    total_linea::numeric(14, 0) as total_linea,
    lower(trim(tipo_equipo)) as tipo_equipo,
    ram::int as ram_gb,
    almacenamiento::int as almacenamiento_gb,
    nullif(trim(procesador), '') as procesador,
    nullif(trim(pantalla), '') as pantalla,
    anio_compra::int as anio_compra,
    mes_compra::int as mes_compra,
    nullif(upper(trim(almacenamiento_tipo)), '') as almacenamiento_tipo,
    nullif(trim(sistema_operativo), '') as sistema_operativo,
    nullif(upper(trim(serial)), '') as serial
from {{ ref('compras_documentos_2026_lineas') }}
