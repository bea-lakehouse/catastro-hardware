{{ config(materialized='view', tags=['staging','mtr','movimientos','manual','dq']) }}

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

classified as (
    select
        persona,
        rut,
        fecha_evento_raw,
        cliente,
        pais,
        fuente,
        observacion,
        {{ mtr_parse_date("fecha_evento_raw") }} as fecha_evento_parseada,
        {{ mtr_date_parse_strategy("fecha_evento_raw") }} as fecha_evento_formato,
        {{ mtr_date_was_normalized("fecha_evento_raw") }} as fecha_evento_normalizada,
        {{ mtr_date_parse_error("fecha_evento_raw") }} as motivo_preliminar
    from src
)

select
    persona,
    rut,
    fecha_evento_raw,
    fecha_evento_parseada,
    fecha_evento_formato,
    fecha_evento_normalizada,
    cliente,
    pais,
    fuente,
    observacion,
    case
        when motivo_preliminar is not null then motivo_preliminar
        when fecha_evento_parseada > current_date + {{ var('mtr_operational_horizon_days', 7) }}
            then 'fecha_fuera_horizonte_operativo'
        else null
    end as motivo_rechazo,
    current_timestamp as _loaded_at
from classified
where motivo_preliminar is not null
   or fecha_evento_parseada > current_date + {{ var('mtr_operational_horizon_days', 7) }}
