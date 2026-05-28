{{ config(materialized='table', tags=['marts', 'specs', 'mtr']) }}

with normalized as (
  select *
  from {{ ref('int_equipo_specs_normalized') }}
),

primary_source as (
  select distinct on (id_equipo)
    id_equipo,
    fuente_origen
  from normalized
  order by id_equipo, filled_specs_count desc, source_priority desc, fuente_origen asc
),

aggregated as (
  select
    id_equipo,
    (array_agg(sku order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where sku is not null))[1] as sku,
    (array_agg(marca order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where marca is not null))[1] as marca,
    (array_agg(modelo order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where modelo is not null))[1] as modelo,
    (array_agg(tipo_equipo order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where tipo_equipo is not null))[1] as tipo_equipo,
    (array_agg(sistema_operativo order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where sistema_operativo is not null))[1] as sistema_operativo,
    (array_agg(procesador order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where procesador is not null))[1] as procesador,
    (array_agg(ram_gb order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where ram_gb is not null))[1] as ram_gb,
    (array_agg(almacenamiento_gb order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where almacenamiento_gb is not null))[1] as almacenamiento_gb,
    (array_agg(almacenamiento_tipo order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where almacenamiento_tipo is not null))[1] as almacenamiento_tipo,
    (array_agg(pantalla order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where pantalla is not null))[1] as pantalla,
    (array_agg(anio_modelo order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where anio_modelo is not null))[1] as anio_modelo,
    (array_agg(serial order by source_priority desc, filled_specs_count desc, fuente_origen asc)
      filter (where serial is not null))[1] as serial
  from normalized
  group by id_equipo
),

final as (
  select
    a.id_equipo,
    a.sku,
    a.marca,
    a.modelo,
    a.tipo_equipo,
    a.sistema_operativo,
    a.procesador,
    a.ram_gb,
    a.almacenamiento_gb,
    a.almacenamiento_tipo,
    a.pantalla,
    a.anio_modelo,
    a.serial,
    ps.fuente_origen,
    case
      when a.marca is not null
       and a.modelo is not null
       and a.ram_gb is not null
       and a.almacenamiento_gb is not null then 1.0::numeric
      when a.marca is not null
       and a.modelo is not null then 0.7::numeric
      when a.marca is not null
        or a.modelo is not null then 0.4::numeric
      else 0.0::numeric
    end as specs_confidence_score,
    case
      when a.marca is not null
       and a.modelo is not null
       and a.ram_gb is not null
       and a.almacenamiento_gb is not null then 'completo'
      when a.marca is not null
        or a.modelo is not null then 'parcial'
      else 'sin_specs'
    end as specs_status,
    current_timestamp as _loaded_at
  from aggregated a
  left join primary_source ps
    on ps.id_equipo = a.id_equipo
)

select * from final
