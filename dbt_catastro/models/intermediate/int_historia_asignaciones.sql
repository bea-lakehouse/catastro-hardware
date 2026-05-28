-- int_historia_asignaciones (sin ciclo)
-- Fuente: staging de movimientos (ingresos/salidas) + estado actual de asignados.
-- Evita depender de mart_historia_eventos (que depende de int_historia_asignaciones).

with current_asg as (
  select
    id_equipo,
    persona_asignada as persona,
    fecha_asignacion as fecha_asignacion
  from {{ ref('stg_mtr_equipos_asignados') }}
  where persona_asignada is not null
),

mov_asg as (
  -- asignaciones desde movimientos (ingresos)
  select
    id_equipo,
    persona,
    fecha_evento as fecha_asignacion
  from {{ ref('stg_mtr_ingresos') }}
  where upper(tipo_evento) = 'ASIGNACION'
    and persona is not null

  union all

  -- en caso que venga ASIGNACION en salidas (a veces hay data rara)
  select
    id_equipo,
    persona,
    fecha_evento as fecha_asignacion
  from {{ ref('stg_mtr_salidas') }}
  where upper(tipo_evento) = 'ASIGNACION'
    and persona is not null
)

select * from current_asg
union all
select * from mov_asg
