{{ config(severity='warn') }}

-- Falla si raw trae fechas futuras (más allá de mañana)
-- Robust: soporta ISO, DD/MM/YYYY, DD-MM-YYYY y timestamps accidentales sin depender de datestyle.

with src as (
  select
    fecha_evento::text as f,
    *
  from {{ source('raw','mtr_salidas') }}
),
parsed as (
  select
    {{ mtr_parse_date("f") }} as fecha_parsed,
    *
  from src
)

select *
from parsed
where fecha_parsed is not null
  and fecha_parsed > current_date + 1
