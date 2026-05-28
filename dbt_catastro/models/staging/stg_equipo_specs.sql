{{ config(materialized='view', tags=['staging', 'specs', 'mtr']) }}

with assigned_universe as (
  select
    id_equipo,
    null::text as sku_raw,
    null::text as marca_raw,
    null::text as modelo_raw,
    null::text as tipo_equipo_raw,
    null::text as sistema_operativo_raw,
    null::text as procesador_raw,
    null::text as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    null::text as serial_raw,
    null::text as plataforma_raw,
    'stg_mtr_equipos_asignados'::text as fuente_origen,
    5::int as source_priority
  from {{ ref('stg_mtr_equipos_asignados') }}
),

google_sheet_asignados as (
  select
    id_equipo,
    sku::text as sku_raw,
    marca as marca_raw,
    modelo as modelo_raw,
    null::text as tipo_equipo_raw,
    sistema_operativo as sistema_operativo_raw,
    cpu as procesador_raw,
    ram as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    nro_serie as serial_raw,
    null::text as plataforma_raw,
    'stg_mtr_google_sheet_equipos_asignados'::text as fuente_origen,
    90::int as source_priority
  from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
),

legacy_asignados as (
  {% if relation_exists('analytics', 'mtr_equipos_asignados') %}
  select
    case
      when "SKU" is null then null
      when "SKU"::text ~ '^[0-9]+(\.0+)?$' then 'SKU-' || split_part("SKU"::text, '.', 1)
      else upper(trim("SKU"::text))
    end as id_equipo,
    "SKU"::text as sku_raw,
    nullif(trim("Marca"), '') as marca_raw,
    nullif(trim("Modelo"), '') as modelo_raw,
    nullif(trim("Tipo"), '') as tipo_equipo_raw,
    nullif(trim("Sistema Operativo"), '') as sistema_operativo_raw,
    nullif(trim("CPU"), '') as procesador_raw,
    nullif(trim("Ram"), '') as ram_raw,
    nullif(trim("Capacidad Disco Duro"), '') as almacenamiento_raw,
    nullif(trim("Pantalla"), '') as pantalla_raw,
    nullif(trim("Año"::text), '') as anio_modelo_raw,
    nullif(trim("Nro Serie"), '') as serial_raw,
    null::text as plataforma_raw,
    'analytics.mtr_equipos_asignados'::text as fuente_origen,
    100::int as source_priority
  from analytics.mtr_equipos_asignados
  {% else %}
  select
    null::text as id_equipo,
    null::text as sku_raw,
    null::text as marca_raw,
    null::text as modelo_raw,
    null::text as tipo_equipo_raw,
    null::text as sistema_operativo_raw,
    null::text as procesador_raw,
    null::text as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    null::text as serial_raw,
    null::text as plataforma_raw,
    null::text as fuente_origen,
    null::int as source_priority
  where false
  {% endif %}
),

asignados_detalle as (
  select
    id_equipo,
    sku::text as sku_raw,
    marca as marca_raw,
    modelo as modelo_raw,
    null::text as tipo_equipo_raw,
    sistema_operativo as sistema_operativo_raw,
    null::text as procesador_raw,
    null::text as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    null::text as serial_raw,
    plataforma as plataforma_raw,
    'stg_mtr_equipos_asignados_detalle'::text as fuente_origen,
    70::int as source_priority
  from {{ ref('stg_mtr_equipos_asignados_detalle') }}
),

google_sheet_disponibles as (
  select
    id_equipo,
    sku::text as sku_raw,
    marca as marca_raw,
    modelo as modelo_raw,
    null::text as tipo_equipo_raw,
    null::text as sistema_operativo_raw,
    null::text as procesador_raw,
    null::text as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    serial as serial_raw,
    plataforma as plataforma_raw,
    'stg_mtr_google_sheet_equipos_disponibles'::text as fuente_origen,
    60::int as source_priority
  from {{ ref('stg_mtr_google_sheet_equipos_disponibles') }}
),

disponibles_raw as (
  select
    id_equipo,
    sku::text as sku_raw,
    marca as marca_raw,
    modelo as modelo_raw,
    null::text as tipo_equipo_raw,
    null::text as sistema_operativo_raw,
    null::text as procesador_raw,
    null::text as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    serial as serial_raw,
    plataforma as plataforma_raw,
    'stg_mtr_equipos_disponibles'::text as fuente_origen,
    55::int as source_priority
  from {{ ref('stg_mtr_equipos_disponibles') }}
),

equipos_base as (
  select
    id_equipo,
    sku::text as sku_raw,
    marca as marca_raw,
    modelo as modelo_raw,
    null::text as tipo_equipo_raw,
    sistema_operativo as sistema_operativo_raw,
    cpu as procesador_raw,
    ram as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    nro_serie as serial_raw,
    null::text as plataforma_raw,
    'stg_equipos'::text as fuente_origen,
    50::int as source_priority
  from {{ ref('stg_equipos') }}
),

equipos_enriched as (
  select
    id_equipo,
    sku::text as sku_raw,
    marca as marca_raw,
    modelo as modelo_raw,
    null::text as tipo_equipo_raw,
    sistema_operativo as sistema_operativo_raw,
    cpu as procesador_raw,
    ram as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    nro_serie as serial_raw,
    null::text as plataforma_raw,
    'stg_equipos_enriched'::text as fuente_origen,
    45::int as source_priority
  from {{ ref('stg_equipos_enriched') }}
),

equipos_backfill as (
  select
    upper(trim(id_equipo)) as id_equipo,
    null::text as sku_raw,
    marca as marca_raw,
    modelo as modelo_raw,
    null::text as tipo_equipo_raw,
    sistema_operativo as sistema_operativo_raw,
    null::text as procesador_raw,
    null::text as ram_raw,
    null::text as almacenamiento_raw,
    null::text as pantalla_raw,
    null::text as anio_modelo_raw,
    serial as serial_raw,
    null::text as plataforma_raw,
    'source.analytics.equipos_backfill'::text as fuente_origen,
    40::int as source_priority
  from {{ source('analytics', 'equipos_backfill') }}
),

unioned as (
  select * from assigned_universe
  union all
  select * from google_sheet_asignados
  union all
  select * from legacy_asignados
  union all
  select * from asignados_detalle
  union all
  select * from google_sheet_disponibles
  union all
  select * from disponibles_raw
  union all
  select * from equipos_base
  union all
  select * from equipos_enriched
  union all
  select * from equipos_backfill
)

select
  id_equipo,
  sku_raw,
  marca_raw,
  modelo_raw,
  tipo_equipo_raw,
  sistema_operativo_raw,
  procesador_raw,
  ram_raw,
  almacenamiento_raw,
  pantalla_raw,
  anio_modelo_raw,
  serial_raw,
  plataforma_raw,
  fuente_origen,
  source_priority,
  current_timestamp as _loaded_at
from unioned
where id_equipo is not null
