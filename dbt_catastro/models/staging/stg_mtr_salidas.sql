{{ config(materialized='view', tags=['staging','mtr','movimientos']) }}

with raw_sheet as (
    select
        id_equipo,
        coalesce(fecha_evento_raw, fecha_evento::text) as fecha_evento_raw,
        coalesce(nullif(trim(tipo_evento::text), ''), 'DEVOLUCION') as tipo_evento,
        nullif(trim(persona::text), '') as persona,
        nullif(trim(rut::text), '') as rut,
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
        )::text as detalle,
        nullif(trim(fuente_origen::text), '') as fuente_origen
    from {{ ref('stg_mtr_google_sheet_salidas') }}
),

manual_source as (
    select
        id_equipo,
        coalesce(fecha_evento_raw, fecha_evento::text) as fecha_evento_raw,
        coalesce(nullif(trim(tipo_evento::text), ''), 'SALIDA') as tipo_evento,
        nullif(trim(persona::text), '') as persona,
        nullif(trim(rut::text), '') as rut,
        nullif(trim(cliente::text), '') as cliente,
        nullif(trim(perfil::text), '') as perfil,
        nullif(trim(marca::text), '') as marca,
        nullif(trim(modelo::text), '') as modelo,
        nullif(trim(plataforma::text), '') as plataforma,
        concat_ws(' | ',
            nullif(trim(cliente::text), ''),
            nullif(trim(detalle::text), '')
        )::text as detalle,
        nullif(trim(fuente_origen::text), '') as fuente_origen
    from {{ ref('stg_mtr_salidas_manual') }}
),

has_raw_sheet as (
    select exists(select 1 from raw_sheet) as ok
),

legacy_raw_source as (
    select
        nullif(trim(id_equipo::text), '') as id_equipo,
        nullif(trim(fecha_evento::text), '') as fecha_evento_raw,
        coalesce(nullif(trim(tipo_evento::text), ''), 'DEVOLUCION') as tipo_evento,
        nullif(trim(persona::text), '') as persona,
        null::text as rut,
        nullif(trim(cliente::text), '') as cliente,
        nullif(trim(perfil::text), '') as perfil,
        nullif(trim(marca::text), '') as marca,
        nullif(trim(modelo::text), '') as modelo,
        nullif(trim(plataforma::text), '') as plataforma,
        nullif(trim(detalle::text), '') as detalle,
        'RAW_MTR_LEGACY'::text as fuente_origen
    from {{ source('raw', 'mtr_salidas') }}
),

src as (
    select * from raw_sheet
    union all
    select * from manual_source
    union all
    select * from legacy_raw_source
    union all
    select
        nullif(trim(id_equipo::text), '') as id_equipo,
        nullif(trim(fecha_evento::text), '') as fecha_evento_raw,
        coalesce(nullif(trim(tipo_evento::text), ''), 'DEVOLUCION') as tipo_evento,
        nullif(trim(persona::text), '') as persona,
        null::text as rut,
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
        )::text as detalle,
        'MTR_XLSX'::text as fuente_origen
    from analytics.mtr_salidas_xlsx
    where not (select ok from has_raw_sheet)
),

parsed as (
    select
        id_equipo,
        rut,
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
        detalle,
        fuente_origen
    from src
),

prepared as (
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
        {{ normalize_model_name("modelo") }} as modelo,
        plataforma,
        detalle,
        fuente_origen,
        regexp_replace(
            lower(
                translate(
                    coalesce(persona, ''),
                    'ÁÉÍÓÚáéíóúÑñÜü',
                    'AEIOUaeiouNnUu'
                )
            ),
            '[^a-z0-9]+',
            '',
            'g'
        ) as persona_key,
        regexp_replace(
            lower(
                translate(
                    coalesce(cliente, ''),
                    'ÁÉÍÓÚáéíóúÑñÜü',
                    'AEIOUaeiouNnUu'
                )
            ),
            '[^a-z0-9]+',
            '',
            'g'
        ) as cliente_key,
        regexp_replace(
            lower(coalesce(rut, '')),
            '[^a-z0-9]+',
            '',
            'g'
        ) as rut_key
    from parsed
    where fecha_evento is not null
      and fecha_evento <= current_date + {{ var('mtr_operational_horizon_days', 7) }}
),

deduped as (
    select
        *,
        row_number() over (
            partition by
                fecha_evento,
                coalesce(nullif(cliente_key, ''), 'sin_cliente'),
                coalesce(nullif(persona_key, ''), 'sin_persona')
            order by
                case when coalesce(id_equipo, '') <> '' then 0 else 1 end,
                case when coalesce(rut_key, '') <> '' then 0 else 1 end,
                case
                    when fuente_origen = 'MTR_GOOGLE_SHEET' then 0
                    when fuente_origen = 'MANUAL' then 1
                    when fuente_origen = 'RAW_MTR_LEGACY' then 2
                    else 3
                end,
                coalesce(length(detalle), 0) desc
        ) as rn
    from prepared
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
    fuente_origen
from deduped
where rn = 1
