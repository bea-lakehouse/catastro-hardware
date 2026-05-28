{{ config(materialized='view', tags=['staging','mtr','movimientos','manual']) }}

with src as (
    select
        nullif(trim(nombre::text), '') as persona,
        nullif(trim(rut::text), '') as rut,
        nullif(trim(fecha_salida::text), '') as fecha_evento_raw,
        nullif(trim(cliente::text), '') as cliente,
        nullif(trim(pais::text), '') as pais,
        nullif(trim(fuente::text), '') as fuente,
        nullif(trim(observacion::text), '') as observacion
    from {{ ref('mtr_salidas_manual') }}
),

parsed as (
    select
        null::text as id_equipo,
        fecha_evento_raw,
        {{ mtr_parse_date("fecha_evento_raw") }} as fecha_evento,
        {{ mtr_date_parse_strategy("fecha_evento_raw") }} as fecha_evento_formato,
        {{ mtr_date_was_normalized("fecha_evento_raw") }} as fecha_evento_normalizada,
        'SALIDA'::text as tipo_evento,
        persona,
        rut,
        cliente,
        null::text as perfil,
        null::text as marca,
        null::text as modelo,
        null::text as plataforma,
        concat_ws(' | ', cliente, pais, fuente, observacion)::text as detalle,
        pais,
        fuente,
        observacion,
        'MANUAL'::text as fuente_origen
    from src
)

select
    id_equipo,
    fecha_evento,
    fecha_evento_raw,
    fecha_evento_formato,
    fecha_evento_normalizada,
    tipo_evento,
    persona,
    rut,
    cliente,
    perfil,
    marca,
    modelo,
    plataforma,
    detalle,
    pais,
    fuente,
    observacion,
    fuente_origen
from parsed
where fecha_evento is not null
  and fecha_evento <= current_date + {{ var('mtr_operational_horizon_days', 7) }}
