with base as (
  select
    historia_id::text as historia_id,
    id_equipo,
    fecha_evento,
    nullif(btrim(tipo_evento), '') as tipo_evento,
    persona,
    -- tu tabla base se llama "detalle" (no "detalle_evento")
    detalle as detalle_evento,
    null::text as serial,
    null::text as problema_detectado,
    null::text as reparacion_realizada,
    null::text as comentario,
    coalesce(nullif(btrim(origen_evento), ''), 'mtr')::text as origen_evento
  from {{ ref('mart_equipo_timeline') }}
),

repar as (
  select
    historia_id::text as historia_id,
    id_equipo,
    fecha_evento,
    nullif(btrim(tipo_evento), '') as tipo_evento,
    persona,
    detalle_evento,
    serial,
    problema_detectado,
    reparacion_realizada,
    comentario,
    origen_evento
  from {{ ref('stg_reparaciones_excel') }}
),

unioned as (
  select * from base
  union all
  select * from repar
)
select
  {{ historia_id_md5('u') }} as historia_id,
  u.id_equipo,
  u.fecha_evento,
  u.tipo_evento,
  u.persona,
  u.detalle_evento,
  u.serial,
  u.problema_detectado,
  u.reparacion_realizada,
  u.comentario,
  u.origen_evento
from unioned u
where {{ anti_ghost_filter('u') }}
