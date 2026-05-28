{{ config(materialized='view', tags=['staging','mtr','movimientos']) }}

with raw_sheet as (
    select
        id_equipo,
        coalesce(fecha_evento_raw, fecha_evento::text) as fecha_evento_raw,
        coalesce(nullif(trim(tipo_evento::text), ''), 'ASIGNACION') as tipo_evento,
        nullif(trim(persona::text), '') as persona,
        nullif(trim(cliente::text), '') as cliente,
        nullif(trim(perfil::text), '') as perfil,
        nullif(trim(marca::text), '') as marca,
        nullif(trim(modelo::text), '') as modelo,
        nullif(trim(plataforma::text), '') as plataforma,
        concat_ws(' | ',
            nullif(trim(cliente::text), ''),
            nullif(trim(perfil::text), ''),
            nullif(trim(detalle::text), ''),
            nullif(trim(marca::text), ''),
            nullif(trim(modelo::text), '')
        )::text as detalle
    from {{ ref('stg_mtr_google_sheet_ingresos') }}
),
has_raw as (
    select exists(select 1 from raw_sheet) as ok
),
src as (
    select * from raw_sheet
    union all
    select
        nullif(trim(id_equipo::text), '') as id_equipo,
        nullif(trim(fecha_evento::text), '') as fecha_evento_raw,
        coalesce(nullif(trim(tipo_evento::text), ''), 'ASIGNACION') as tipo_evento,
        nullif(trim(persona::text), '') as persona,
        nullif(trim(cliente::text), '') as cliente,
        nullif(trim(perfil::text), '') as perfil,
        nullif(trim(marca::text), '') as marca,
        nullif(trim(modelo::text), '') as modelo,
        nullif(trim(plataforma::text), '') as plataforma,
        concat_ws(' | ',
            nullif(trim(cliente::text), ''),
            nullif(trim(perfil::text), ''),
            nullif(trim(detalle::text), ''),
            nullif(trim(marca::text), ''),
            nullif(trim(modelo::text), '')
        )::text as detalle
    from analytics.mtr_ingresos_xlsx
    where not (select ok from has_raw)
),
parsed as (
    select
        id_equipo,
        cliente,
        perfil,
        marca,
        modelo,
        plataforma,
        fecha_evento_raw,
        {{ mtr_parse_date("fecha_evento_raw") }} as fecha_evento,
        {{ mtr_date_parse_strategy("fecha_evento_raw") }} as fecha_evento_formato,
        {{ mtr_date_was_normalized("fecha_evento_raw") }} as fecha_evento_normalizada,
        tipo_evento,
        persona,
        detalle
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
    cliente,
    perfil,
    marca,
    {{ normalize_model_name("modelo") }} as modelo,
    plataforma,
    detalle
from parsed
where fecha_evento is not null
  and fecha_evento <= current_date + {{ var('mtr_operational_horizon_days', 7) }}
