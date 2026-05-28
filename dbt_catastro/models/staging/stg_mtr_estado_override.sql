{{ config(materialized='view', tags=['staging','mtr','override']) }}
-- depends_on: {{ ref('equipos_lifecycle_override_manual') }}

{% set override_relation = adapter.get_relation(
    database=target.database,
    schema=target.schema,
    identifier='mtr_estado_override'
) %}

{% if override_relation is not none %}
with external_override as (
    select
        upper(trim(id_equipo::text)) as id_equipo,
        nullif(trim(estado_operativo_override::text), '') as estado_operativo_override,
        nullif(trim(estado_equipo_override::text), '') as estado_equipo_override,
        null::text as clasificacion_operacional_override,
        null::boolean as es_activo_operativo_override,
        nullif(trim(motivo::text), '') as motivo,
        'external_mtr_estado_override'::text as override_scope
    from {{ override_relation }}
    where nullif(trim(id_equipo::text), '') is not null
),
manual_override as (
    select
        upper(trim(id_equipo::text)) as id_equipo,
        nullif(trim(estado_operativo_override::text), '') as estado_operativo_override,
        nullif(trim(estado_equipo_override::text), '') as estado_equipo_override,
        nullif(trim(clasificacion_operacional_override::text), '') as clasificacion_operacional_override,
        es_activo_operativo_override,
        nullif(trim(motivo::text), '') as motivo,
        nullif(trim(override_scope::text), '') as override_scope
    from {{ ref('equipos_lifecycle_override_manual') }}
),
unioned as (
    select * from external_override
    union all
    select * from manual_override
),
ranked as (
    select
        *,
        row_number() over (
            partition by id_equipo
            order by case when override_scope = 'external_mtr_estado_override' then 1 else 0 end desc, override_scope, motivo
        ) as rn
    from unioned
)
select
    id_equipo,
    estado_operativo_override,
    estado_equipo_override,
    clasificacion_operacional_override,
    es_activo_operativo_override,
    motivo,
    override_scope
from ranked
where rn = 1
{% else %}
select
    null::text as id_equipo,
    null::text as estado_operativo_override,
    null::text as estado_equipo_override,
    null::text as clasificacion_operacional_override,
    null::boolean as es_activo_operativo_override,
    null::text as motivo,
    null::text as override_scope
where false
{% endif %}
