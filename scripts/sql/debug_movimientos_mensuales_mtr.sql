\echo '=== 1. Resumen mensual: MTR original vs mart UI ==='
with meses as (
  select generate_series(date '2025-03-01', date_trunc('month', current_date)::date, interval '1 month')::date as mes
),
original_bruto as (
  select
    date_trunc('month', fecha_evento)::date as mes,
    'INGRESO'::text as tipo_evento,
    count(*)::int as total_bruto
  from analytics.stg_mtr_google_sheet_ingresos
  where fecha_evento::date between date '2025-03-01' and current_date
  group by 1, 2

  union all

  select
    date_trunc('month', fecha_evento)::date as mes,
    'SALIDA'::text as tipo_evento,
    count(*)::int as total_bruto
  from analytics.stg_mtr_google_sheet_salidas
  where fecha_evento::date between date '2025-03-01' and current_date
  group by 1, 2
),
original_prepared as (
  select
    id_equipo,
    nullif(trim(persona), '') as persona,
    null::text as rut,
    nullif(trim(cliente), '') as cliente,
    nullif(trim(perfil), '') as perfil,
    nullif(trim(marca), '') as marca,
    nullif(trim(modelo), '') as modelo,
    nullif(trim(plataforma), '') as plataforma,
    nullif(trim(detalle), '') as detalle,
    'INGRESO'::text as tipo_evento,
    fecha_evento::timestamp as fecha_evento,
    fecha_evento::date as fecha_evento_dia,
    'analytics.stg_mtr_google_sheet_ingresos'::text as source_table
  from analytics.stg_mtr_google_sheet_ingresos
  where fecha_evento::date between date '2025-03-01' and current_date

  union all

  select
    id_equipo,
    nullif(trim(persona), '') as persona,
    nullif(trim(rut), '') as rut,
    nullif(trim(cliente), '') as cliente,
    nullif(trim(perfil), '') as perfil,
    nullif(trim(marca), '') as marca,
    nullif(trim(modelo), '') as modelo,
    nullif(trim(plataforma), '') as plataforma,
    nullif(trim(detalle), '') as detalle,
    'SALIDA'::text as tipo_evento,
    fecha_evento::timestamp as fecha_evento,
    fecha_evento::date as fecha_evento_dia,
    'analytics.stg_mtr_google_sheet_salidas'::text as source_table
  from analytics.stg_mtr_google_sheet_salidas
  where fecha_evento::date between date '2025-03-01' and current_date
),
original_normalized as (
  select
    op.*,
    nullif(
      trim(
        regexp_replace(
          coalesce(op.persona, ''),
          '\s*\(\s*PC\s*\)\s*',
          '',
          'gi'
        )
      ),
      ''
    ) as persona_normalizada
  from original_prepared op
),
original_ranked as (
  select
    op.*,
    row_number() over (
      partition by
        coalesce(tipo_evento, 'SIN_TIPO'),
        fecha_evento,
        coalesce(persona_normalizada, 'SIN_PERSONA'),
        coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE'),
        coalesce(nullif(trim(detalle), ''), 'SIN_DETALLE')
      order by coalesce(id_equipo, '') desc, source_table
    ) as rn
  from original_normalized op
),
original_dedup as (
  select *
  from original_ranked
  where rn = 1
),
original_dedup_monthly as (
  select
    date_trunc('month', fecha_evento_dia)::date as mes,
    count(*) filter (where tipo_evento = 'INGRESO')::int as ingresos_mtr_deduplicado,
    count(*) filter (where tipo_evento = 'SALIDA')::int as salidas_mtr_deduplicado
  from original_dedup
  group by 1
),
ui as (
  select
    mes,
    ingresos_personas::int as ingresos_ui,
    salidas_personas::int as salidas_ui
  from analytics.mart_estadistica_movimientos_mes_v2
  where mes between date '2025-03-01' and date_trunc('month', current_date)::date
)
select
  m.mes,
  coalesce(max(ob.total_bruto) filter (where ob.tipo_evento = 'INGRESO'), 0) as ingresos_mtr_bruto,
  coalesce(odm.ingresos_mtr_deduplicado, 0) as ingresos_mtr_deduplicado,
  coalesce(ui.ingresos_ui, 0) as ingresos_ui_mart,
  coalesce(ui.ingresos_ui, 0) - coalesce(odm.ingresos_mtr_deduplicado, 0) as delta_ingresos,
  coalesce(max(ob.total_bruto) filter (where ob.tipo_evento = 'SALIDA'), 0) as salidas_mtr_bruto,
  coalesce(odm.salidas_mtr_deduplicado, 0) as salidas_mtr_deduplicado,
  coalesce(ui.salidas_ui, 0) as salidas_ui_mart,
  coalesce(ui.salidas_ui, 0) - coalesce(odm.salidas_mtr_deduplicado, 0) as delta_salidas
from meses m
left join original_bruto ob
  on ob.mes = m.mes
left join original_dedup_monthly odm
  on odm.mes = m.mes
left join ui
  on ui.mes = m.mes
group by m.mes, odm.ingresos_mtr_deduplicado, odm.salidas_mtr_deduplicado, ui.ingresos_ui, ui.salidas_ui
order by m.mes;

\echo '=== 2. Filas exactas que generan diferencia vs MTR original ==='
with original_prepared as (
  select
    id_equipo,
    nullif(trim(persona), '') as persona,
    null::text as rut,
    nullif(trim(cliente), '') as cliente,
    nullif(trim(perfil), '') as perfil,
    nullif(trim(marca), '') as marca,
    nullif(trim(modelo), '') as modelo,
    nullif(trim(plataforma), '') as plataforma,
    nullif(trim(detalle), '') as detalle,
    'INGRESO'::text as tipo_evento,
    fecha_evento::timestamp as fecha_evento,
    fecha_evento::date as fecha_evento_dia,
    'analytics.stg_mtr_google_sheet_ingresos'::text as source_table
  from analytics.stg_mtr_google_sheet_ingresos
  where fecha_evento::date between date '2025-03-01' and current_date

  union all

  select
    id_equipo,
    nullif(trim(persona), '') as persona,
    nullif(trim(rut), '') as rut,
    nullif(trim(cliente), '') as cliente,
    nullif(trim(perfil), '') as perfil,
    nullif(trim(marca), '') as marca,
    nullif(trim(modelo), '') as modelo,
    nullif(trim(plataforma), '') as plataforma,
    nullif(trim(detalle), '') as detalle,
    'SALIDA'::text as tipo_evento,
    fecha_evento::timestamp as fecha_evento,
    fecha_evento::date as fecha_evento_dia,
    'analytics.stg_mtr_google_sheet_salidas'::text as source_table
  from analytics.stg_mtr_google_sheet_salidas
  where fecha_evento::date between date '2025-03-01' and current_date
),
original_normalized as (
  select
    op.*,
    nullif(
      trim(
        regexp_replace(
          coalesce(op.persona, ''),
          '\s*\(\s*PC\s*\)\s*',
          '',
          'gi'
        )
      ),
      ''
    ) as persona_normalizada,
    regexp_replace(
      lower(
        translate(
          coalesce(
            nullif(
              trim(
                regexp_replace(
                  coalesce(op.persona, ''),
                  '\s*\(\s*PC\s*\)\s*',
                  '',
                  'gi'
                )
              ),
              ''
            ),
            ''
          ),
          'ÁÉÍÓÚáéíóúÑñÜü',
          'AEIOUaeiouNnUu'
        )
      ),
      '[^a-z0-9]+',
      '',
      'g'
    ) as persona_key,
    regexp_replace(
      lower(
        translate(
          coalesce(op.cliente, ''),
          'ÁÉÍÓÚáéíóúÑñÜü',
          'AEIOUaeiouNnUu'
        )
      ),
      '[^a-z0-9]+',
      '',
      'g'
    ) as cliente_key
  from original_prepared op
),
original_ranked as (
  select
    op.*,
    row_number() over (
      partition by
        coalesce(tipo_evento, 'SIN_TIPO'),
        fecha_evento,
        coalesce(persona_normalizada, 'SIN_PERSONA'),
        coalesce(nullif(trim(cliente), ''), 'SIN_CLIENTE'),
        coalesce(nullif(trim(detalle), ''), 'SIN_DETALLE')
      order by coalesce(id_equipo, '') desc, source_table
    ) as rn
  from original_normalized op
),
original_dedup as (
  select
    date_trunc('month', fecha_evento_dia)::date as mes,
    tipo_evento,
    fecha_evento_dia,
    id_equipo,
    persona,
    rut,
    cliente,
    modelo,
    source_table,
    md5(
      concat_ws(
        '|',
        coalesce(tipo_evento, ''),
        coalesce(fecha_evento::text, ''),
        coalesce(id_equipo, ''),
        coalesce(persona_key, ''),
        coalesce(cliente_key, ''),
        coalesce(detalle, '')
      )
    ) as event_signature
  from original_ranked
  where rn = 1
),
mart_counted as (
  select
    date_trunc('month', fecha_evento_dia)::date as mes,
    tipo_evento,
    fecha_evento_dia,
    id_equipo,
    persona,
    rut,
    cliente,
    modelo,
    source_table,
    case
      when tipo_evento = 'SALIDA' then 'salida_persona_mtr'
      when coalesce(es_cambio_equipo_real, false) then 'cambio_equipo_real'
      when coalesce(es_movimiento_interno_persona_cliente, false) then 'movimiento_interno_sin_impacto'
      when coalesce(tipo_ingreso, 'nuevo') = 'interno' then 'ingreso_interno_con_equipo'
      when coalesce(ingreso_con_equipo, false) then 'nuevo_con_equipo'
      else 'nuevo_sin_equipo'
    end as clasificacion_operacional,
    md5(
      concat_ws(
        '|',
        coalesce(tipo_evento, ''),
        coalesce(fecha_evento::text, ''),
        coalesce(id_equipo, ''),
        regexp_replace(
          lower(
            translate(
              coalesce(persona, ''),
              'ÁÉÍÓÚáéíóúÑñÜü',
              'AEIOUaeiouNnUu'
            )
          ),
          '[^a-z0-9]+',
          '',
          'g'
        ),
        regexp_replace(
          lower(
            translate(
              coalesce(cliente, ''),
              'ÁÉÍÓÚáéíóúÑñÜü',
              'AEIOUaeiouNnUu'
            )
          ),
          '[^a-z0-9]+',
          '',
          'g'
        ),
        coalesce(detalle, '')
      )
    ) as event_signature
  from analytics.int_mtr_eventos_dedup_stats
  where fecha_evento_dia between date '2025-03-01' and current_date
),
summary as (
  select
    m.mes,
    coalesce(v2.delta_ingresos_vs_mtr_original, 0) as delta_ingresos,
    coalesce(v2.delta_salidas_vs_mtr_original, 0) as delta_salidas
  from (
    select generate_series(date '2025-03-01', date_trunc('month', current_date)::date, interval '1 month')::date as mes
  ) m
  left join analytics.mart_estadistica_movimientos_mes_v2 v2
    on v2.mes = m.mes
),
delta_months as (
  select mes
  from summary
  where delta_ingresos <> 0 or delta_salidas <> 0
),
extra_in_mart as (
  select
    mc.mes,
    'contado_en_mart_sin_match_original'::text as diferencia,
    mc.source_table,
    mc.tipo_evento,
    mc.persona,
    mc.rut,
    mc.fecha_evento_dia as fecha,
    mc.id_equipo as sku,
    mc.modelo,
    mc.clasificacion_operacional,
    true as fue_contado_en_mart
  from mart_counted mc
  join delta_months dm
    on dm.mes = mc.mes
  left join original_dedup od
    on od.event_signature = mc.event_signature
   and od.mes = mc.mes
  where od.event_signature is null
),
missing_from_mart as (
  select
    od.mes,
    'presente_en_mtr_original_no_contado_en_mart'::text as diferencia,
    od.source_table,
    od.tipo_evento,
    od.persona,
    od.rut,
    od.fecha_evento_dia as fecha,
    od.id_equipo as sku,
    od.modelo,
    case
      when od.tipo_evento = 'SALIDA' then 'salida_persona_mtr'
      when coalesce(od.id_equipo, '') <> '' then 'ingreso_mtr_con_equipo'
      else 'ingreso_mtr_sin_equipo'
    end as clasificacion_operacional,
    false as fue_contado_en_mart
  from original_dedup od
  join delta_months dm
    on dm.mes = od.mes
  left join mart_counted mc
    on mc.event_signature = od.event_signature
   and mc.mes = od.mes
  where mc.event_signature is null
)
select *
from extra_in_mart
union all
select *
from missing_from_mart
order by mes, tipo_evento, fecha, persona nulls last, sku nulls last;

\echo '=== 3. Trazabilidad ampliada por fuente original y complementaria ==='
select
  date_trunc('month', fecha_evento)::date as mes,
  coalesce(fuente_origen, 'SIN_FUENTE') as fuente_origen,
  count(*)::int as filas
from analytics.stg_mtr_salidas
where fecha_evento::date between date '2025-03-01' and current_date
group by 1, 2
order by 1, 2;
