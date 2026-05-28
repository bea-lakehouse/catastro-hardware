with src as (
  select
    sku,
    nullif(btrim(serial), '') as serial,
    nullif(btrim(usuario), '') as usuario,
    nullif(btrim(problema_detectado), '') as problema_detectado,
    nullif(btrim(reparacion_realizada), '') as reparacion_realizada,
    nullif(btrim(encargado), '') as encargado,
    fecha_reparacion::timestamp as fecha_reparacion,
    nullif(btrim(comentario), '') as comentario
  from {{ ref('reparaciones_raw') }}
),

final as (
  select
    -- tu ecosistema usa "SKU-130" => lo armamos desde el sku numérico
    ('SKU-' || sku::text) as id_equipo,

    -- fecha del evento
    coalesce(fecha_reparacion, now()::timestamp) as fecha_evento,

    'REPARACION'::text as tipo_evento,

    -- detalle lindo para UI
    concat_ws(
      ' | ',
      'Reparación',
      problema_detectado,
      reparacion_realizada,
      coalesce(usuario, encargado)
    ) as detalle_evento,

    coalesce(usuario, encargado) as persona,

    serial,
    problema_detectado,
    reparacion_realizada,
    comentario,

    'excel:reparados'::text as origen_evento,

    -- id estable (para no duplicar si re-seedeas)
    md5(concat_ws('|',
      sku::text,
      coalesce(serial,''),
      coalesce(problema_detectado,''),
      coalesce(reparacion_realizada,''),
      coalesce(encargado,''),
      coalesce(usuario,''),
      coalesce(fecha_reparacion::text,'')
    )) as historia_id
  from src
  where sku is not null
)

select * from final
