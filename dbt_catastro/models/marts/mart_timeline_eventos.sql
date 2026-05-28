{{ config(materialized='view', tags=['timeline','marts']) }}

select
  t.id_equipo::text as id_equipo,

  -- normalizamos tipo_evento (nunca null)
  coalesce(nullif(trim(t.tipo_evento), ''), 'EVENTO')::text as tipo_evento,

  -- backend + UI requieren fecha válida
  t.fecha_evento::timestamptz as fecha_evento,

  -- backend usa "detalle"
  t.detalle_evento::text as detalle,

  -- UI helpers
  coalesce(nullif(trim(t.tipo_evento), ''), 'EVENTO')::text as detalle_titulo,

  coalesce(
    nullif(trim(t.persona), ''),
    nullif(trim(t.comentario), ''),
    nullif(trim(t.detalle_evento), ''),
    'Sin detalle'
  )::text as detalle_subtitulo,

  coalesce(nullif(trim(t.origen_evento), ''), 'mtr')::text as badge_tipo

from {{ ref('mart_equipo_timeline_v2') }} t
where
  t.id_equipo is not null
  and t.fecha_evento is not null
