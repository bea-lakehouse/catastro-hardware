with equipo as (
  select
    id_equipo,
    null::date as fecha_compra,
    null::text as estado
  from {{ ref('stg_equipos') }}
),

hist as (
  select
    row_number() over (
      partition by id_equipo
      order by fecha_evento desc nulls last
    ) as historia_id,
    id_equipo,
    fecha_evento,
    tipo_evento,
    detalle_evento,
    usuario_evento,
    origen_evento
  from {{ ref('stg_historia_hw') }}
),

final as (
  select
    e.id_equipo,
    e.fecha_compra,
    e.estado,
    h.historia_id,
    h.fecha_evento,
    h.tipo_evento,
    h.detalle_evento,
    h.usuario_evento,
    h.origen_evento
  from equipo e
  left join hist h using (id_equipo)
)

select * from final
