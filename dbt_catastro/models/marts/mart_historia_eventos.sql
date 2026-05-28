-- mart_historia_eventos (robusto)
-- Fuente: staging de movimientos normalizados (ingresos + salidas)
-- Columnas estándar: id_equipo, fecha_evento, tipo_evento, persona, detalle
--
-- Parse de fecha robusto:
-- - YYYY-MM-DD
-- - DD/MM/YYYY
-- - MM/DD/YYYY (algunos registros)
-- Regla:
--   si primer número > 12 => DD/MM
--   si segundo número > 12 => MM/DD
--   si ambos <= 12 => asumimos DD/MM

with mov as (

  select
    id_equipo,
    fecha_evento,
    upper(nullif(trim(tipo_evento::text), '')) as tipo_evento,
    nullif(trim(persona::text), '') as persona,
    nullif(trim(detalle::text), '') as detalle
  from {{ ref('stg_mtr_ingresos') }}

  union all

  select
    id_equipo,
    fecha_evento,
    upper(nullif(trim(tipo_evento::text), '')) as tipo_evento,
    nullif(trim(persona::text), '') as persona,
    nullif(trim(detalle::text), '') as detalle
  from {{ ref('stg_mtr_salidas') }}
),

parsed as (
  select
    id_equipo,

    case
      when fecha_evento is null then null

      -- ISO YYYY-MM-DD...
      when fecha_evento::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then left(fecha_evento::text, 10)::date

      -- Slash date ??/??/????  (DD/MM o MM/DD)
      when fecha_evento::text ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' then
        case
          when split_part(left(fecha_evento::text, 10), '/', 1)::int > 12
            then to_date(left(fecha_evento::text, 10), 'DD/MM/YYYY')
          when split_part(left(fecha_evento::text, 10), '/', 2)::int > 12
            then to_date(left(fecha_evento::text, 10), 'MM/DD/YYYY')
          else to_date(left(fecha_evento::text, 10), 'DD/MM/YYYY')
        end

      else null
    end as fecha_evento,

    tipo_evento,
    persona,
    detalle
  from mov
)

select
  id_equipo,
  fecha_evento,
  tipo_evento,
  persona,
  detalle
from parsed
where id_equipo is not null
  and fecha_evento is not null
  and fecha_evento <= {{ mtr_operational_horizon_date() }}
