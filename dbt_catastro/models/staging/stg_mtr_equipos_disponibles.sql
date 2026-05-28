with src as (
  select * from {{ source('raw', 'mtr_equipos_disponibles') }}
)
select
  nullif(trim(sku::text), '') as sku,
  nullif(trim(id_equipo::text), '') as id_equipo,
  nullif(trim(marca::text), '') as marca,
  nullif(trim(modelo::text), '') as modelo,
  nullif(trim(serial::text), '') as serial,
  nullif(trim(condicion::text), '') as condicion,
  nullif(trim(ubicacion::text), '') as ubicacion,
  nullif(trim(plataforma::text), '') as plataforma,
  null::text as color,
  null::text as ano,
  null::text as sistema_operativo,
  null::text as cpu,
  null::text as ram,
  null::text as capacidad_disco_duro
from src
