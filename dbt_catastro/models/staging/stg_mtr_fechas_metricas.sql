{{ config(materialized='view', tags=['staging','mtr','dq','fechas']) }}

with raw_google as (
  select
    source_name as fuente,
    case
      when source_name = 'salidas' then 'fecha_evento'
      when source_name = 'ingresos' then 'fecha_evento'
      else 'fecha_asignacion'
    end as columna_fecha,
    run_id::text as referencia_fila,
    row_number::text as fila_origen,
    case
      when source_name = 'salidas' then nullif(trim(coalesce(
        row_data->>'Fecha de Salida',
        row_data->>'Fecha Salida',
        row_data->>'Fecha',
        row_data->>'fecha_evento'
      )), '')
      when source_name = 'ingresos' then nullif(trim(coalesce(
        row_data->>'Fecha de Ingreso',
        row_data->>'Fecha de ingreso',
        row_data->>'Fecha Ingreso',
        row_data->>'Fecha ingreso',
        row_data->>'Fecha',
        row_data->>'fecha_evento',
        row_data->>'Fecha de Asignación',
        row_data->>'Fecha de asignación',
        row_data->>'Fecha de Asignacion',
        row_data->>'Fecha de asignacion'
      )), '')
      else nullif(trim(coalesce(
        row_data->>'Fecha de Asignación',
        row_data->>'Fecha de Asignacion',
        row_data->>'fecha_de_asignacion'
      )), '')
    end as fecha_raw
  from {{ source('raw', 'mtr_google_sheet_rows') }}
  where source_name in ('salidas', 'ingresos', 'equipos_asignados')
),

manual_salidas as (
  select
    'manual_salidas'::text as fuente,
    'fecha_evento'::text as columna_fecha,
    row_number() over (order by coalesce(nombre::text, ''), coalesce(fecha_salida::text, ''))::text as referencia_fila,
    null::text as fila_origen,
    nullif(trim(fecha_salida::text), '') as fecha_raw
  from {{ ref('mtr_salidas_manual') }}
),

xlsx_asignados as (
  select
    'xlsx_equipos_asignados'::text as fuente,
    'fecha_asignacion'::text as columna_fecha,
    row_number() over (order by coalesce(id_equipo::text, ''), coalesce(persona_asignada::text, ''))::text as referencia_fila,
    null::text as fila_origen,
    nullif(trim(fecha_asignacion::text), '') as fecha_raw
  from analytics.mtr_equipos_asignados_xlsx
),

legacy_raw_salidas as (
  select
    'legacy_raw_salidas'::text as fuente,
    'fecha_evento'::text as columna_fecha,
    row_number() over (order by coalesce(id_equipo::text, ''), coalesce(fecha_evento::text, ''))::text as referencia_fila,
    null::text as fila_origen,
    nullif(trim(fecha_evento::text), '') as fecha_raw
  from {{ source('raw', 'mtr_salidas') }}
),

audit as (
  select * from raw_google
  union all
  select * from manual_salidas
  union all
  select * from xlsx_asignados
  union all
  select * from legacy_raw_salidas
),

parsed as (
  select
    fuente,
    columna_fecha,
    referencia_fila,
    fila_origen,
    fecha_raw,
    {{ mtr_parse_date("fecha_raw") }} as fecha_parseada,
    {{ mtr_date_parse_strategy("fecha_raw") }} as formato_detectado,
    {{ mtr_date_was_normalized("fecha_raw") }} as fecha_normalizada,
    {{ mtr_date_parse_error("fecha_raw") }} as motivo_error
  from audit
)

select
  fuente,
  columna_fecha,
  date_trunc('month', fecha_parseada)::date as mes_parseado,
  coalesce(formato_detectado, 'sin_valor') as formato_detectado,
  count(*)::int as total_registros,
  count(*) filter (where fecha_parseada is not null)::int as total_parseados,
  count(*) filter (where fecha_normalizada)::int as total_normalizados,
  count(*) filter (where motivo_error is not null)::int as total_invalidos,
  min(fecha_parseada) as min_fecha_parseada,
  max(fecha_parseada) as max_fecha_parseada,
  max(fecha_parseada) as fecha_ultima_actualizacion
from parsed
group by 1, 2, 3, 4
