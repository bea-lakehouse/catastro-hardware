{{ config(materialized='view', tags=['intermediate','mtr','eventos']) }}

with ranked as (
    select
        id_equipo,
        persona,
        cliente,
        perfil,
        marca,
        modelo,
        plataforma,
        detalle,
        tipo_evento,
        fecha_evento,
        fecha_evento_txt,
        rut,
        fuente_origen,
        source_table,
        _loaded_at,
        row_number() over (
            partition by
                coalesce(id_equipo, 'SIN_SKU'),
                coalesce(tipo_evento, 'SIN_TIPO'),
                fecha_evento,
                coalesce(nullif(trim(persona), ''), 'SIN_PERSONA'),
                coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE')
            order by _loaded_at desc
        ) as rn
    from {{ ref('stg_mtr_eventos_clean') }}
)

select
    id_equipo,
    persona,
    rut,
    cliente,
    perfil,
    marca,
    modelo,
    plataforma,
    detalle,
    tipo_evento,
    fecha_evento,
    fecha_evento::date as fecha_evento_dia,
    fecha_evento_txt,
    fuente_origen,
    source_table
from ranked
where rn = 1
  and coalesce(id_equipo, '') <> ''
