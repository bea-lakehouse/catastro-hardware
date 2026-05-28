with src as (
  select
    md5(concat_ws('||',
      coalesce(id_equipo::text,''),
      coalesce(fecha_evento::text,''),
      coalesce(tipo_evento::text,''),
      coalesce(persona::text,''),
      coalesce(detalle::text,'')
    ))::text                  as historia_id,
    id_equipo::text          as id_equipo,
    fecha_evento::timestamp  as fecha_evento,
    nullif(btrim(tipo_evento), '')::text as tipo_evento,
    nullif(btrim(detalle), '')::text     as detalle_evento,
    nullif(btrim(persona), '')::text     as usuario_evento,
    'mtr'::text              as origen_evento
  from {{ ref('mart_historia_eventos') }}
)
select *
from src
