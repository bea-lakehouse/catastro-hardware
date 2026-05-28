{{ config(materialized='table', tags=['movimientos','core']) }}

with ing as (
  select
    upper(trim(i.id_equipo::text)) as id_equipo,
    i.fecha_evento::timestamptz as fecha_evento,
    'ASIGNACION'::text as tipo_movimiento,
    initcap(trim(i.cliente))::text as cliente,
    nullif(trim(i.persona), '')::text as persona,
    nullif(trim(i.detalle), '')::text as detalle_evento,
    'MTR_GOOGLE_SHEET'::text as fuente_origen,
    2 as evento_orden
  from {{ ref('stg_mtr_ingresos') }} i
  where i.id_equipo is not null
),

sal as (
  select
    upper(trim(s.id_equipo::text)) as id_equipo,
    s.fecha_evento::timestamptz as fecha_evento,
    'DEVOLUCION'::text as tipo_movimiento,
    initcap(trim(s.cliente))::text as cliente,
    nullif(trim(s.persona), '')::text as persona,
    nullif(trim(s.detalle), '')::text as detalle_evento,
    nullif(trim(s.fuente_origen), '')::text as fuente_origen,
    1 as evento_orden
  from {{ ref('stg_mtr_salidas') }} s
  where s.id_equipo is not null
),

eventos as (
  select * from ing
  union all
  select * from sal
),

ordenados as (
  select
    e.*,
    lag(e.cliente) over (
      partition by e.id_equipo
      order by e.fecha_evento, e.evento_orden, coalesce(e.persona, '')
    ) as prev_cliente,
    lag(e.persona) over (
      partition by e.id_equipo
      order by e.fecha_evento, e.evento_orden, coalesce(e.persona, '')
    ) as prev_persona
    ,
    lead(e.tipo_movimiento) over (
      partition by e.id_equipo
      order by e.fecha_evento, e.evento_orden, coalesce(e.persona, '')
    ) as next_tipo_movimiento,
    lead(e.fecha_evento) over (
      partition by e.id_equipo
      order by e.fecha_evento, e.evento_orden, coalesce(e.persona, '')
    ) as next_fecha_evento
  from eventos e
),

mov as (
  select
    o.id_equipo,
    o.fecha_evento as fecha_movimiento,
    o.tipo_movimiento,
    o.detalle_evento,
    o.fuente_origen,
    o.next_tipo_movimiento,
    o.next_fecha_evento,
    case
      when o.tipo_movimiento = 'ASIGNACION'
        then coalesce(nullif(trim(o.prev_cliente), ''), 'stock')
      when o.tipo_movimiento = 'DEVOLUCION'
        then coalesce(nullif(trim(o.cliente), ''), 'desconocido')
    end::text as cliente_origen,
    case
      when o.tipo_movimiento = 'ASIGNACION'
        then coalesce(nullif(trim(o.cliente), ''), 'desconocido')
      when o.tipo_movimiento = 'DEVOLUCION'
        then 'stock'
    end::text as cliente_destino,
    o.prev_persona::text as persona_origen,
    o.persona::text as persona_destino,
    case
      when o.tipo_movimiento = 'DEVOLUCION' then 'salida_devolucion'
      when nullif(trim(o.prev_persona), '') is null
        and nullif(trim(o.prev_cliente), '') is null
        then 'ingreso_equipo'
      when coalesce(nullif(trim(o.prev_persona), ''), 'SIN_PERSONA')
        = coalesce(nullif(trim(o.persona), ''), 'SIN_PERSONA')
        and coalesce(nullif(trim(o.prev_cliente), ''), 'SIN_CLIENTE')
            is distinct from coalesce(nullif(trim(o.cliente), ''), 'SIN_CLIENTE')
        then 'movimiento_interno_persona_cliente'
      when nullif(trim(o.prev_persona), '') is not null
        and coalesce(nullif(trim(o.prev_persona), ''), 'SIN_PERSONA')
            is distinct from coalesce(nullif(trim(o.persona), ''), 'SIN_PERSONA')
        then 'reasignacion_equipo'
      else 'regularizacion_administrativa'
    end::text as tipo_movimiento_normalizado
  from ordenados o
  where
    o.id_equipo is not null
    and o.fecha_evento is not null
    and nullif(trim(o.tipo_movimiento), '') is not null
),

lookup as (
  select
    upper(id_equipo) as id_equipo,
    lower(coalesce(nullif(trim(tipo_colaborador_mtr), ''), 'unknown')) as tipo_colaborador,
    nullif(trim(localizacion), '') as localizacion,
    nullif(trim(ciudad_comuna), '') as ciudad_comuna,
    nullif(trim(sistema_operativo), '') as sistema_operativo,
    nullif(trim(marca), '') as marca,
    nullif(trim(modelo), '') as modelo
  from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
)

select
  md5(
    concat_ws(
      '|',
      coalesce(m.id_equipo, ''),
      coalesce(m.fecha_movimiento::text, ''),
      coalesce(upper(trim(m.tipo_movimiento)), ''),
      coalesce(trim(m.cliente_origen), ''),
      coalesce(trim(m.cliente_destino), ''),
      coalesce(trim(m.persona_destino), '')
    )
  ) as movimiento_id,
  m.id_equipo,
  m.fecha_movimiento,
  m.tipo_movimiento,
  m.detalle_evento,
  m.fuente_origen,
  m.cliente_origen,
  m.cliente_destino,
  m.persona_origen,
  m.persona_destino,
  m.tipo_movimiento_normalizado,
  (m.tipo_movimiento_normalizado = 'ingreso_equipo') as es_ingreso_equipo,
  (m.tipo_movimiento_normalizado = 'reasignacion_equipo') as es_reasignacion_equipo,
  (m.tipo_movimiento_normalizado = 'movimiento_interno_persona_cliente') as es_movimiento_interno_persona_cliente,
  (m.tipo_movimiento_normalizado = 'salida_devolucion') as es_salida_devolucion,
  (
    m.tipo_movimiento_normalizado = 'salida_devolucion'
    and lower(coalesce(m.detalle_evento, '')) ~ '(baja|obsole|retir|retiro|scrap|desuso|decom)'
  ) as es_baja_equipo,
  (
    m.tipo_movimiento_normalizado = 'salida_devolucion'
    and upper(coalesce(m.next_tipo_movimiento, '')) = 'ASIGNACION'
    and m.next_fecha_evento > m.fecha_movimiento
  ) as es_reutilizado_posteriormente,
  (
    coalesce(nullif(trim(m.cliente_origen), ''), 'SIN_CLIENTE')
    is distinct from coalesce(nullif(trim(m.cliente_destino), ''), 'SIN_CLIENTE')
  ) as es_cambio_cliente,
  (
    coalesce(nullif(trim(m.persona_origen), ''), 'SIN_PERSONA')
    is distinct from coalesce(nullif(trim(m.persona_destino), ''), 'SIN_PERSONA')
  ) as es_cambio_persona,
  coalesce(l.tipo_colaborador, 'unknown') as plataforma,
  case
    when upper(coalesce(l.localizacion, '')) like '%CHILE%' then false
    when upper(coalesce(l.ciudad_comuna, '')) like '%SANTIAGO%' then false
    when coalesce(l.localizacion, '') <> '' or coalesce(l.ciudad_comuna, '') <> '' then true
    else false
  end as es_extranjero,
  case
    when lower(coalesce(l.sistema_operativo, '')) like '%mac%'
      or lower(coalesce(l.sistema_operativo, '')) like '%sonoma%'
      or lower(coalesce(l.sistema_operativo, '')) like '%sequoia%'
      or lower(coalesce(l.marca, '')) = 'apple'
      or lower(coalesce(l.modelo, '')) like '%macbook%'
      then 'MAC'
    when coalesce(l.sistema_operativo, '') <> ''
      or coalesce(l.marca, '') <> ''
      or coalesce(l.modelo, '') <> ''
      then 'WIN'
    else 'UNKNOWN'
  end as sistema_operativo_familia,
  'mtr'::text as fuente
from mov m
left join lookup l
  on l.id_equipo = m.id_equipo
