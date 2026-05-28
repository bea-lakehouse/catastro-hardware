{{ config(materialized='table', tags=['mart','compras','documentos','2026']) }}

with docs as (
    select *
    from {{ ref('stg_compras_documentos_2026') }}
),

lines as (
    select
        *,
        case
            when lower(marca) = 'apple' or lower(tipo_equipo) = 'macbook' then 'macbook'
            when lower(marca) = 'hp' or lower(tipo_equipo) = 'hp' then 'hp'
            when lower(tipo_equipo) = 'servicio' then 'servicio'
            when lower(tipo_equipo) = 'accesorio' then 'accesorio'
            else lower(tipo_equipo)
        end as categoria_equipo,
        case
            when lower(marca) = 'apple' then 'macbook_pro_14_m4_pro'
            when lower(marca) = 'hp' and lower(modelo) like '%elitebook 8 g1i%' then 'hp_elitebook_8_g1i'
            else lower(regexp_replace(coalesce(modelo, 'sin_modelo'), '[^a-z0-9]+', '_', 'g'))
        end as modelo_match_key
    from {{ ref('stg_compras_documentos_2026_lineas') }}
),

equipos as (
    select
        id_equipo,
        upper(nullif(trim(serial), '')) as serial,
        marca,
        modelo,
        estado_operativo,
        cliente
    from {{ ref('mart_equipos_estado_actual') }}
),

guide_received as (
    select
        l.modelo_match_key,
        d.proveedor,
        d.fecha_emision,
        sum(l.cantidad)::int as cantidad_recibida
    from lines l
    join docs d
      on d.documento_id = l.documento_id
    where d.tipo_documento = 'guia_despacho'
      and l.categoria_equipo in ('macbook', 'hp')
    group by 1,2,3
),

base as (
    select
        d.documento_id,
        d.empresa,
        d.proveedor,
        d.tipo_documento,
        d.numero_documento,
        d.fecha_emision,
        d.fecha_vencimiento,
        d.orden_compra,
        d.total_neto,
        d.iva,
        d.total,
        d.moneda,
        d.archivo_origen,
        d.observaciones,
        l.linea_id,
        l.marca,
        l.modelo,
        l.descripcion_original,
        l.cantidad,
        l.precio_unitario,
        l.total_linea,
        l.tipo_equipo,
        l.categoria_equipo,
        l.ram_gb,
        l.almacenamiento_gb,
        l.procesador,
        l.pantalla,
        l.anio_compra,
        l.mes_compra,
        l.almacenamiento_tipo,
        l.sistema_operativo,
        l.serial,
        l.modelo_match_key,
        date_trunc('month', d.fecha_emision)::date as mes_documento,
        e.id_equipo as matched_equipo_id,
        e.estado_operativo as matched_estado_operativo,
        e.cliente as matched_cliente,
        case
            when d.tipo_documento = 'factura' and l.categoria_equipo in ('macbook', 'hp') then (
                select coalesce(sum(gr.cantidad_recibida), 0)
                from guide_received gr
                where gr.modelo_match_key = l.modelo_match_key
                  and gr.proveedor = d.proveedor
                  and gr.fecha_emision >= d.fecha_emision
            )
            else 0
        end::int as cantidad_recibida_relacionada
    from docs d
    join lines l
      on l.documento_id = d.documento_id
    left join equipos e
      on e.serial = l.serial
),

final as (
    select
        *,
        greatest(
            case
                when tipo_documento = 'factura' and categoria_equipo in ('macbook', 'hp')
                    then cantidad - coalesce(cantidad_recibida_relacionada, 0)
                else 0
            end,
            0
        )::int as unidades_pendientes_recepcion,
        case
            when categoria_equipo not in ('macbook', 'hp') then 'sin_aplicar'
            when tipo_documento = 'guia_despacho' and matched_equipo_id is not null then 'conciliado_serial'
            when tipo_documento = 'guia_despacho' and matched_equipo_id is null then 'pendiente_conciliacion'
            when tipo_documento = 'orden_compra' then 'forecast_planeado'
            when tipo_documento = 'factura' then 'compra_confirmada'
            else 'pendiente_conciliacion'
        end as conciliacion_status,
        case
            when tipo_documento = 'guia_despacho' then 'recibido_documental'
            when tipo_documento = 'orden_compra' then 'planificado'
            when tipo_documento = 'factura' and coalesce(cantidad_recibida_relacionada, 0) > 0 then 'facturado_parcialmente_recibido'
            when tipo_documento = 'factura' then 'facturado_sin_recepcion'
            else 'sin_estado'
        end as recepcion_status
    from base
)

select
    documento_id,
    empresa,
    proveedor,
    tipo_documento,
    numero_documento,
    fecha_emision,
    fecha_vencimiento,
    orden_compra,
    total_neto,
    iva,
    total,
    moneda,
    archivo_origen,
    observaciones,
    linea_id,
    marca,
    modelo,
    descripcion_original,
    cantidad,
    precio_unitario,
    total_linea,
    tipo_equipo,
    categoria_equipo,
    ram_gb,
    almacenamiento_gb,
    procesador,
    pantalla,
    anio_compra,
    mes_compra,
    almacenamiento_tipo,
    sistema_operativo,
    serial,
    mes_documento,
    matched_equipo_id,
    matched_estado_operativo,
    matched_cliente,
    cantidad_recibida_relacionada,
    unidades_pendientes_recepcion,
    conciliacion_status,
    recepcion_status
from final
