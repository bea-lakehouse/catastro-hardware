{{ config(materialized='view', tags=['mart','equipos','estado','actual','ml']) }}

with base as (

    select *
    from {{ ref('mart_equipos_estado_actual') }}

),

ml_hist_latest as (

    select *
    from (
        select
            upper(entity_id) as id_equipo,
            score::numeric as hist_ml_score,
            risk_level::text as hist_ml_risk_level,
            alert_code::text as hist_ml_alert_code,
            created_at as hist_ml_scored_at,
            total::numeric as hist_ml_total,
            link_path::text as hist_ml_link_path,
            drivers_json,
            row_number() over (
                partition by upper(entity_id)
                order by created_at desc nulls last
            ) as rn
        from analytics.ml_scores_v2_history
    ) x
    where rn = 1

),

ml_latest_view as (

    select
        upper(id_equipo) as id_equipo,
        nullif(trim(cliente_ref::text), '') as ml_cliente_ref,
        nullif(trim(persona_ref::text), '') as ml_persona_ref,
        score_riesgo_rotacion::numeric as view_ml_score,
        upper(coalesce(bucket_riesgo, 'BAJO')) as view_ml_risk_level,
        factores_riesgo::text as view_ml_alert_code,
        null::timestamptz as view_ml_scored_at
    from analytics.v_mtr1203_ml_scores_latest

),

ml_unified as (

    select
        coalesce(h.id_equipo, v.id_equipo) as id_equipo,
        coalesce(h.hist_ml_score, v.view_ml_score) as ml_score_final,
        coalesce(h.hist_ml_risk_level, v.view_ml_risk_level) as ml_risk_level_final,
        coalesce(h.hist_ml_alert_code, v.view_ml_alert_code) as ml_alert_code_final,
        coalesce(h.hist_ml_scored_at, v.view_ml_scored_at) as ml_scored_at_final,
        h.hist_ml_total as ml_total_final,
        h.hist_ml_link_path as ml_link_path_final,
        h.drivers_json as ml_drivers_json_final,
        v.ml_cliente_ref,
        v.ml_persona_ref
    from ml_hist_latest h
    full outer join ml_latest_view v
        on upper(h.id_equipo) = upper(v.id_equipo)

),

mtr1903_fallback as (

    select
        upper(id_equipo) as id_equipo,
        cliente as mtr1903_cliente,
        persona_asignada as mtr1903_persona_asignada,
        tipo_colaborador as mtr1903_tipo_colaborador,
        ambito_laboral as mtr1903_ambito_laboral,
        pais as mtr1903_pais,
        ciudad as mtr1903_ciudad,
        fuente as mtr1903_fuente
    from analytics.tmp_mtr1903_asignacion_actual

),

final as (

    select
        b.*,

        ml.ml_cliente_ref,
        ml.ml_persona_ref,
        ml.ml_score_final,
        ml.ml_risk_level_final,
        ml.ml_alert_code_final,
        ml.ml_scored_at_final,
        ml.ml_total_final,
        ml.ml_link_path_final,
        ml.ml_drivers_json_final,

        mtr.mtr1903_fuente,
        mtr.mtr1903_tipo_colaborador,
        mtr.mtr1903_ambito_laboral,
        mtr.mtr1903_pais,
        mtr.mtr1903_ciudad,

        coalesce(
            mtr.mtr1903_cliente,
            nullif(b.cliente::text, ''),
            ml.ml_cliente_ref
        ) as cliente_final,

        coalesce(
            mtr.mtr1903_persona_asignada,
            nullif(b.last_event_persona::text, ''),
            ml.ml_persona_ref
        ) as persona_asignada_final,

        coalesce(
            nullif(mtr.mtr1903_tipo_colaborador::text, ''),
            nullif(b.tipo_colaborador::text, '')
        ) as tipo_colaborador_final,

        coalesce(
            nullif(mtr.mtr1903_ambito_laboral::text, ''),
            case
                when upper(coalesce(b.segmento_destino, '')) = 'CORE' then 'Internacional'
                else null
            end
        ) as ambito_laboral_final

    from base b
    left join ml_unified ml
        on upper(ml.id_equipo) = upper(b.id_equipo)
    left join mtr1903_fallback mtr
        on upper(mtr.id_equipo) = upper(b.id_equipo)

)

select *
from final
