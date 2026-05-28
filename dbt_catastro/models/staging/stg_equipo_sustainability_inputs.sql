{{ config(materialized='view', tags=['staging', 'sustainability', 'carbon']) }}

with specs as (
  select
    id_equipo,
    sku,
    marca,
    modelo,
    tipo_equipo,
    sistema_operativo,
    procesador,
    ram_gb,
    almacenamiento_gb,
    almacenamiento_tipo,
    pantalla,
    anio_modelo,
    serial,
    fuente_origen as specs_fuente_origen,
    specs_confidence_score,
    specs_status
  from {{ ref('mart_equipo_specs') }}
),

ops as (
  select
    e.id_equipo,
    e.fecha_compra,
    e.tipo_colaborador,
    a.cliente,
    a.localizacion,
    a.ciudad_comuna
  from {{ ref('stg_equipos_enriched') }} e
  left join {{ ref('stg_mtr_equipos_asignados') }} a
    on a.id_equipo = e.id_equipo
),

base as (
  select
    s.id_equipo,
    s.sku,
    s.marca,
    s.modelo,
    s.tipo_equipo,
    s.sistema_operativo,
    s.procesador,
    s.ram_gb,
    s.almacenamiento_gb,
    s.almacenamiento_tipo,
    s.pantalla,
    s.anio_modelo,
    s.serial,
    s.specs_fuente_origen,
    s.specs_confidence_score,
    s.specs_status,
    o.fecha_compra,
    o.tipo_colaborador,
    o.cliente,
    o.localizacion as localizacion_raw,
    o.ciudad_comuna,
    case
      when upper(coalesce(o.localizacion, '')) like '%ARGENT%' then 'Argentina'
      when upper(coalesce(o.localizacion, '')) like '%CHILE%' then 'Chile'
      when upper(coalesce(o.localizacion, '')) like '%URUGU%' then 'Uruguay'
      when upper(coalesce(o.localizacion, '')) like '%COLOMB%' then 'Colombia'
      when upper(coalesce(o.localizacion, '')) like '%PERU%' then 'Peru'
      when upper(coalesce(o.localizacion, '')) like '%BRASIL%' or upper(coalesce(o.localizacion, '')) like '%BRAZIL%' then 'Brazil'
      when upper(coalesce(o.ciudad_comuna, '')) like '%SANTIAGO%' then 'Chile'
      when upper(coalesce(o.ciudad_comuna, '')) like '%LAS CONDES%' then 'Chile'
      when upper(coalesce(o.ciudad_comuna, '')) like '%VITACURA%' then 'Chile'
      when upper(coalesce(o.ciudad_comuna, '')) like '%LO BARNECHEA%' then 'Chile'
      when upper(coalesce(o.ciudad_comuna, '')) like '%BUENOS AIRES%' then 'Argentina'
      when upper(coalesce(o.ciudad_comuna, '')) like '%MONTEVIDEO%' then 'Uruguay'
      else null
    end as electricity_country,
    case
      when upper(coalesce(o.localizacion, '')) like '%ARGENT%'
        or upper(coalesce(o.localizacion, '')) like '%CHILE%'
        or upper(coalesce(o.localizacion, '')) like '%URUGU%'
        or upper(coalesce(o.localizacion, '')) like '%COLOMB%'
        or upper(coalesce(o.localizacion, '')) like '%PERU%'
        or upper(coalesce(o.localizacion, '')) like '%BRASIL%'
        or upper(coalesce(o.localizacion, '')) like '%BRAZIL%' then 'alta'
      when upper(coalesce(o.ciudad_comuna, '')) like '%SANTIAGO%'
        or upper(coalesce(o.ciudad_comuna, '')) like '%LAS CONDES%'
        or upper(coalesce(o.ciudad_comuna, '')) like '%VITACURA%'
        or upper(coalesce(o.ciudad_comuna, '')) like '%LO BARNECHEA%'
        or upper(coalesce(o.ciudad_comuna, '')) like '%BUENOS AIRES%'
        or upper(coalesce(o.ciudad_comuna, '')) like '%MONTEVIDEO%' then 'media'
      else 'baja'
    end as electricity_country_confidence,
    case
      when o.localizacion is not null then 'mtr_localizacion'
      when o.ciudad_comuna is not null then 'mtr_ciudad_comuna'
      else 'sin_fuente'
    end as electricity_country_source,
    case
      when lower(coalesce(s.tipo_equipo, '')) in ('ordenador', 'notebook', 'laptop') then 'notebook'
      when lower(coalesce(s.modelo, '')) like '%macbook%' then 'notebook'
      when lower(coalesce(s.modelo, '')) like '%elitebook%' then 'notebook'
      when lower(coalesce(s.modelo, '')) like '%latitude%' then 'notebook'
      when lower(coalesce(s.modelo, '')) like '%thinkpad%' then 'notebook'
      else 'unknown'
    end as device_category
  from specs s
  left join ops o
    on o.id_equipo = s.id_equipo
)

select
  *,
  current_timestamp as _loaded_at
from base
