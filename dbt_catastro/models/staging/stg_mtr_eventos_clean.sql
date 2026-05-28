{{ config(materialized='view', tags=['staging','mtr','eventos']) }}

with ingresos as (
    select
        trim(coalesce(cast(id_equipo as text), '')) as id_equipo_raw,
        trim(coalesce(cast(persona as text), '')) as persona,
        null::text as rut,
        trim(coalesce(cast(cliente as text), '')) as cliente,
        cast(solicitud_equipo_explicita as boolean) as solicitud_equipo_explicita,
        trim(coalesce(cast(pais_ingreso as text), '')) as pais_ingreso,
        trim(coalesce(cast(perfil as text), '')) as perfil,
        trim(coalesce(cast(marca as text), '')) as marca,
        trim(coalesce(cast(modelo as text), '')) as modelo,
        trim(coalesce(cast(plataforma as text), '')) as plataforma,
        trim(coalesce(cast(detalle as text), '')) as detalle,
        trim(coalesce(cast(fecha_evento as text), '')) as fecha_evento_txt,
        'MTR_GOOGLE_SHEET'::text as fuente_origen,
        'analytics.stg_mtr_google_sheet_ingresos'::text as source_table,
        'INGRESO'::text as tipo_evento,
        _loaded_at
    from {{ ref('stg_mtr_google_sheet_ingresos') }}
),

salidas as (
    select
        trim(coalesce(cast(id_equipo as text), '')) as id_equipo_raw,
        trim(coalesce(cast(persona as text), '')) as persona,
        trim(coalesce(cast(rut as text), '')) as rut,
        trim(coalesce(cast(cliente as text), '')) as cliente,
        null::boolean as solicitud_equipo_explicita,
        null::text as pais_ingreso,
        trim(coalesce(cast(perfil as text), '')) as perfil,
        trim(coalesce(cast(marca as text), '')) as marca,
        trim(coalesce(cast(modelo as text), '')) as modelo,
        trim(coalesce(cast(plataforma as text), '')) as plataforma,
        trim(coalesce(cast(detalle as text), '')) as detalle,
        trim(coalesce(cast(fecha_evento as text), '')) as fecha_evento_txt,
        trim(coalesce(cast(fuente_origen as text), '')) as fuente_origen,
        'analytics.stg_mtr_google_sheet_salidas'::text as source_table,
        'SALIDA'::text as tipo_evento,
        _loaded_at
    from {{ ref('stg_mtr_google_sheet_salidas') }}
),

base as (
    select * from ingresos
    union all
    select * from salidas
),

parsed as (
    select
        case
            when id_equipo_raw ~ '^SKU-' then id_equipo_raw
            when id_equipo_raw ~ '^[0-9]+$' then 'SKU-' || id_equipo_raw
            when regexp_replace(id_equipo_raw, '[^0-9]', '', 'g') <> ''
                then 'SKU-' || regexp_replace(id_equipo_raw, '[^0-9]', '', 'g')
            else null
        end as id_equipo,
        persona,
        rut,
        cliente,
        solicitud_equipo_explicita,
        pais_ingreso,
        perfil,
        marca,
        modelo,
        plataforma,
        detalle,
        tipo_evento,
        fecha_evento_txt,
        fuente_origen,
        source_table,
        _loaded_at,
        {{ mtr_parse_timestamp("fecha_evento_txt") }} as fecha_evento
    from base
)

select
    id_equipo,
    persona,
    rut,
    cliente,
    solicitud_equipo_explicita,
    pais_ingreso,
    perfil,
    marca,
    modelo,
    plataforma,
    detalle,
    tipo_evento,
    fecha_evento,
    fecha_evento_txt,
    fuente_origen,
    source_table,
    _loaded_at
from parsed
where fecha_evento is not null
  -- El corte operativo de Catastro es "as of today": filas futuras del sheet
  -- pueden existir como planificación, pero no deben contaminar KPIs actuales.
  and fecha_evento::date <= current_date
