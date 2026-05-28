{{ config(materialized='view', tags=['ml','intermediate']) }}

{% set has_v2 = relation_exists('analytics', 'ml_scores_v2_latest') %}
{% set has_v1 = relation_exists('analytics', 'ml_scores_latest') %}

{% if has_v2 %}

select
  -- Key
  id_equipo::text as id_equipo,

  -- Score / Risk
  {% if column_exists('analytics','ml_scores_v2_latest','ml_score') %}
    ml_score::double precision
  {% else %}
    null::double precision
  {% endif %} as ml_score,

  {% if column_exists('analytics','ml_scores_v2_latest','ml_risk_level') %}
    ml_risk_level::text
  {% else %}
    null::text
  {% endif %} as ml_risk_level,

  -- Motivo principal (en v2 suele venir como código)
  {% if column_exists('analytics','ml_scores_v2_latest','ml_alert_code') %}
    ml_alert_code::text
  {% else %}
    null::text
  {% endif %} as ml_motivo_principal,

  -- Drivers / fallback (puede no existir en v2)
  {% if column_exists('analytics','ml_scores_v2_latest','drivers') %}
    drivers::jsonb
  {% else %}
    null::jsonb
  {% endif %} as ml_drivers,

  {% if column_exists('analytics','ml_scores_v2_latest','fallback_applied') %}
    fallback_applied::boolean
  {% else %}
    null::boolean
  {% endif %} as ml_fallback_applied,

  -- Versionado / timestamps (tolerante)
  {% if column_exists('analytics','ml_scores_v2_latest','model_version') %}
    model_version::text
  {% else %}
    'v2'::text
  {% endif %} as ml_model_version,

  {% if column_exists('analytics','ml_scores_v2_latest','model_run_at') %}
    model_run_at::timestamp
  {% elif column_exists('analytics','ml_scores_v2_latest','ml_scored_at') %}
    ml_scored_at::timestamp
  {% else %}
    null::timestamp
  {% endif %} as ml_model_run_at,

  {% if column_exists('analytics','ml_scores_v2_latest','trained_at') %}
    trained_at::timestamp
  {% else %}
    null::timestamp
  {% endif %} as ml_trained_at

from analytics.ml_scores_v2_latest

{% elif has_v1 %}

select
  equipo_id::text          as id_equipo,
  score::double precision  as ml_score,
  nivel_riesgo::text       as ml_risk_level,
  motivo_principal::text   as ml_motivo_principal,
  drivers::jsonb           as ml_drivers,
  fallback_applied::boolean as ml_fallback_applied,
  model_version::text      as ml_model_version,
  model_run_at::timestamp  as ml_model_run_at,
  trained_at::timestamp    as ml_trained_at
from analytics.ml_scores_latest

{% else %}

-- Fallback seguro si aún no existe ninguna tabla latest
select
  null::text as id_equipo,
  null::double precision as ml_score,
  null::text as ml_risk_level,
  null::text as ml_motivo_principal,
  null::jsonb as ml_drivers,
  null::boolean as ml_fallback_applied,
  null::text as ml_model_version,
  null::timestamp as ml_model_run_at,
  null::timestamp as ml_trained_at
where 1=0

{% endif %}
