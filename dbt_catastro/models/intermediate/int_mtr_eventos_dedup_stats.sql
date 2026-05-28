{{ config(materialized='view', tags=['intermediate','mtr','eventos','stats']) }}

with prepared as (
    select
        *,
        nullif(
            trim(
                regexp_replace(
                    coalesce(persona, ''),
                    '\s*\(\s*PC\s*\)\s*',
                    '',
                    'gi'
                )
            ),
            ''
        ) as persona_normalizada
    from {{ ref('stg_mtr_eventos_clean') }}
),

prepared_normalized as (
    select
        *,
        regexp_replace(
            lower(
                translate(
                    coalesce(persona_normalizada, ''),
                    'ÁÉÍÓÚáéíóúÑñÜü',
                    'AEIOUaeiouNnUu'
                )
            ),
            '[^a-z0-9]+',
            '',
            'g'
        ) as persona_key,
        array_remove(
            regexp_split_to_array(
                trim(
                    regexp_replace(
                        lower(
                            translate(
                                coalesce(persona_normalizada, ''),
                                'ÁÉÍÓÚáéíóúÑñÜü',
                                'AEIOUaeiouNnUu'
                            )
                        ),
                        '[^a-z0-9]+',
                        ' ',
                        'g'
                    )
                ),
                '\s+'
            ),
            ''
        ) as persona_tokens,
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
        ) as cliente_key
    from prepared
),

assignment_base as (
    select
        id_equipo,
        fecha_asignacion,
        regexp_replace(
            lower(
                translate(
                    coalesce(persona_asignada, ''),
                    'ÁÉÍÓÚáéíóúÑñÜü',
                    'AEIOUaeiouNnUu'
                )
            ),
            '[^a-z0-9]+',
            '',
            'g'
        ) as persona_key,
        array_remove(
            regexp_split_to_array(
                trim(
                    regexp_replace(
                        lower(
                            translate(
                                coalesce(persona_asignada, ''),
                                'ÁÉÍÓÚáéíóúÑñÜü',
                                'AEIOUaeiouNnUu'
                            )
                        ),
                        '[^a-z0-9]+',
                        ' ',
                        'g'
                    )
                ),
                '\s+'
            ),
            ''
        ) as persona_tokens,
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
        ) as cliente_key
    from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
),

prepared_enriched as (
    select
        p.*,
        coalesce(p.id_equipo, matched.id_equipo) as id_equipo_efectivo
    from prepared_normalized p
    left join lateral (
        select
            a.id_equipo,
            (
                select count(*)
                from unnest(a.persona_tokens) token
                where token <> ''
                  and token = any(p.persona_tokens)
            ) as token_overlap
        from assignment_base a
        where p.tipo_evento = 'INGRESO'
          and p.persona_key <> ''
          and p.cliente_key <> ''
          and a.persona_key <> ''
          and a.cliente_key = p.cliente_key
          and (
                select count(*)
                from unnest(a.persona_tokens) token
                where token <> ''
                  and token = any(p.persona_tokens)
          ) >= 2
        order by token_overlap desc, a.fecha_asignacion desc nulls last, a.id_equipo
        limit 1
    ) matched on true
),

ranked as (
    select
        id_equipo_efectivo as id_equipo,
        persona_normalizada,
        persona_key,
        rut,
        cliente,
        pais_ingreso,
        solicitud_equipo_explicita,
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
        _loaded_at,
        nullif(trim(coalesce(pais_ingreso, '')), '') as pais_ingreso_normalizado,
        row_number() over (
            partition by
                coalesce(tipo_evento, 'SIN_TIPO'),
                fecha_evento,
                coalesce(persona_normalizada, 'SIN_PERSONA'),
                coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE'),
                coalesce(nullif(trim(detalle), ''), 'SIN_DETALLE')
            order by _loaded_at desc
        ) as rn
    from prepared_enriched
),

deduped as (
    select
        id_equipo,
        persona_normalizada as persona,
        persona_key,
        rut,
        cliente,
        pais_ingreso_normalizado as pais_ingreso,
        solicitud_equipo_explicita,
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
        source_table,
        null::text as tipo_ingreso,
        case
            when coalesce(id_equipo, '') = '' then 'SIN_EQUIPO'
            else 'CON_EQUIPO'
        end as cobertura_equipo,
        case
            when tipo_evento <> 'INGRESO' then null
            else coalesce(id_equipo, '') <> ''
        end as ingreso_con_equipo,
        case
            when tipo_evento <> 'INGRESO' then null
            when coalesce(id_equipo, '') <> '' then false
            when coalesce(solicitud_equipo_explicita, false) then true
            when upper(coalesce(pais_ingreso_normalizado, '')) = 'CHILE' then true
            when coalesce(nullif(trim(pais_ingreso_normalizado), ''), '') <> '' then false
            else true
        end as ingreso_presiona_compra,
        case
            when upper(coalesce(pais_ingreso_normalizado, '')) = 'CHILE' then 'NACIONAL'
            when coalesce(nullif(trim(pais_ingreso_normalizado), ''), '') <> '' then 'EXTRANJERO'
            when coalesce(id_equipo, '') = '' then 'UNKNOWN'
            else 'NACIONAL'
        end as ambito_registro
    from ranked
    where rn = 1
),

history_by_person as (
    select
        d.*,
        case
            when coalesce(persona_key, '') = '' then null
            else lag(d.fecha_evento) over (
                partition by persona_key
                order by d.fecha_evento, coalesce(d.id_equipo, ''), coalesce(d.cliente, '')
            )
        end as fecha_evento_anterior_persona,
        case
            when coalesce(persona_key, '') = '' then null
            else lag(nullif(d.id_equipo, '')) over (
                partition by persona_key
                order by d.fecha_evento, coalesce(d.id_equipo, ''), coalesce(d.cliente, '')
            )
        end as id_equipo_anterior_persona,
        case
            when coalesce(persona_key, '') = '' then null
            else lag(nullif(trim(d.cliente), '')) over (
                partition by persona_key
                order by d.fecha_evento, coalesce(d.id_equipo, ''), coalesce(d.cliente, '')
            )
        end as cliente_anterior_persona
    from deduped d
)

select
    id_equipo,
    persona,
    rut,
    cliente,
    pais_ingreso,
    solicitud_equipo_explicita,
    perfil,
    marca,
    modelo,
    plataforma,
    detalle,
    tipo_evento,
    fecha_evento,
    fecha_evento_dia,
    fecha_evento_txt,
    fuente_origen,
    source_table,
    case
        when tipo_evento <> 'INGRESO' then null
        when coalesce(persona_key, '') = '' then 'nuevo'
        when fecha_evento_anterior_persona is null then 'nuevo'
        else 'interno'
    end as tipo_ingreso,
    cobertura_equipo,
    ingreso_con_equipo,
    ingreso_presiona_compra,
    ambito_registro,
    id_equipo_anterior_persona,
    cliente_anterior_persona,
    case
        when tipo_evento <> 'INGRESO' then false
        when coalesce(id_equipo, '') = '' then false
        when coalesce(id_equipo_anterior_persona, '') = '' then false
        when coalesce(id_equipo_anterior_persona, '') <> coalesce(id_equipo, '') then true
        else false
    end as es_cambio_equipo_real,
    case
        when tipo_evento <> 'INGRESO' then false
        when coalesce(id_equipo, '') = '' then false
        when coalesce(id_equipo_anterior_persona, '') = '' then false
        when coalesce(id_equipo_anterior_persona, '') <> coalesce(id_equipo, '') then false
        when coalesce(nullif(trim(cliente_anterior_persona), ''), 'SIN_CLIENTE')
            is distinct from coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE')
            then true
        else false
    end as es_movimiento_interno_persona_cliente
from history_by_person
