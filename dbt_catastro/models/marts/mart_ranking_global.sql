{{ config(materialized='view', tags=['ranking','prioridad','marts']) }}

{% set base_rel = ref('mart_equipos_estado_actual') %}

with base as (
  select * from {{ base_rel }}
)

select
  base.id_equipo::text as equipo_id,

  base.priority_final_rank::int as priority_final_rank,
  base.priority_final_sort_key::int as priority_final_sort_key,
  base.priority_final_motivo::text as priority_final_motivo,

  base.alertas_severidad::text as alertas_severidad,
  base.presion_nivel::text as presion_nivel,
  base.ml_risk_level::text as ml_risk_level,
  base.flag_renovar::boolean as flag_renovar,

  base.tipo_colaborador::text as tipo_colaborador,
  base.factor_colaborador::int as factor_colaborador,
  coalesce(nullif(trim(base.motivo_politica), ''), 'asignacion_por_regla')::text
    as motivo_tipo_colaborador,

  base.segmento_destino::text as segmento_destino,
  base.cliente::text as cliente,
  base.estado_equipo::text as estado_equipo,
  ''::text as persona_asignada,
  base.localizacion::text as localizacion,
  base.ciudad_comuna::text as ciudad_comuna,

  base.elegible_dev::boolean as elegible_dev,
  base.generacion_categoria::text as generacion_categoria,
  base.presion_stock::numeric as presion_stock,

  base.ml_score::double precision as ml_score,
  base.ml_alert_code::text as ml_alert_code,
  base.ml_scored_at::timestamptz as ml_scored_at,
  base.ml_link_path::text as ml_link_path,

  base.fecha_compra::date as fecha_compra,
  base.fecha_vencimiento_renovacion::date as fecha_vencimiento_renovacion,
  base.dias_a_vencer::int as dias_a_vencer,

  base.movimientos_12m::bigint as movimientos_12m,
  base.personas_distintas_12m::bigint as personas_distintas_12m,
  base.dias_desde_compra::int as dias_desde_compra,
  base.dias_desde_ultimo_evento::int as dias_desde_ultimo_evento,

  base._loaded_at::timestamptz as _loaded_at

from base
where base.id_equipo is not null
