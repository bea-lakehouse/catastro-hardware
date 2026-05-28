with original as (
with
jira as (
  select * from {{ ref('int_equipo_jira_rollup') }}
),

equipos as (
    select
        e.id_equipo,
        e.marca,
        e.modelo,
        e.estado as estado_equipo,
        e.persona_actual as persona_asignada,
        e.cliente_actual as cliente,
        ov.estado_operativo_override,
        ov.estado_equipo_override,
        ov.clasificacion_operacional_override,
        ov.es_activo_operativo_override,
        ov.motivo as motivo_estado_override,
        ov.override_scope as lifecycle_override_scope,

        -- ubicación desde staging MTR consolidado
        ea.localizacion,
        ea.ciudad_comuna,
        ea.mtr_assignment_source,

        e.fecha_compra

    from {{ ref('stg_equipos_enriched') }} e
    left join {{ ref('stg_mtr_equipos_asignados') }} ea
      on ea.id_equipo = e.id_equipo
    left join {{ ref('stg_mtr_estado_override') }} ov
      on ov.id_equipo = upper(e.id_equipo)
),



last_event as (
  select
    id_equipo,
    fecha_evento as last_event_date,
    tipo_evento  as last_event_type,
    persona      as last_event_persona,
    detalle      as last_event_detalle
  from (
    select
      e.*,
      row_number() over (partition by id_equipo order by fecha_evento desc, tipo_evento) as rn
    from {{ ref('mart_historia_eventos') }} e
  ) x
  where rn = 1
),

metrics_12m as (
  select
    id_equipo,
    count(*) filter (where fecha_evento >= (current_date - interval '12 months')) as movimientos_12m,
    count(distinct persona) filter (where fecha_evento >= (current_date - interval '12 months') and persona is not null) as personas_distintas_12m
  from {{ ref('mart_historia_eventos') }}
  group by 1
),

ml_latest as (
  select
    entity_id as id_equipo,
    score     as ml_score,
    risk_level as ml_risk_level,
    alert_code as ml_alert_code,
    total      as ml_total,
    created_at as ml_scored_at,
    link_path  as ml_ml_link_path,
    ml_source_available,
    ml_source_name
  from {{ ref('int_ml_scores_v2_latest') }}
),

-- depends_on: {{ ref('int_ml_scores_v3_latest') }}
ml_v3_latest as (
  {% if relation_exists('analytics', 'int_ml_scores_v3_latest') %}
  select
    entity_id as id_equipo,
    score as ml_score_v3,
    risk_level as ml_risk_level_v3,
    alert_code as ml_alert_code_v3,
    created_at as ml_scored_at_v3,
    link_path as ml_link_path_v3,
    main_driver as ml_main_driver_v3,
    drivers_json as ml_drivers_json_v3,
    risk_reason as ml_risk_reason_v3,
    model_version as ml_model_version_v3,
    ml_source_available_v3,
    ml_source_name_v3
  from {{ ref('int_ml_scores_v3_latest') }}
  {% else %}
  select
    null::text as id_equipo,
    null::double precision as ml_score_v3,
    null::text as ml_risk_level_v3,
    null::text as ml_alert_code_v3,
    null::timestamp as ml_scored_at_v3,
    null::text as ml_link_path_v3,
    null::text as ml_main_driver_v3,
    null::jsonb as ml_drivers_json_v3,
    null::text as ml_risk_reason_v3,
    null::text as ml_model_version_v3,
    false::boolean as ml_source_available_v3,
    'analytics.int_ml_scores_v3_latest_missing'::text as ml_source_name_v3
  where false
  {% endif %}
),

  pol as (
    select
      equipo_id as id_equipo,
      plataforma,
      generacion_categoria,
      segmento_destino,
      elegible_dev,
      motivo_politica,
      tipo_colaborador,
      factor_colaborador
    from {{ ref('int_politica_equipos') }}
  ),

  ps as (
    select
      segmento_destino,
      generacion_categoria,
      presion_stock,
      presion_nivel
    from {{ ref('int_presion_stock') }}
  ),

  specs as (
    select
      id_equipo,
      sku,
      marca,
      modelo,
      tipo_equipo,
      sistema_operativo,
      procesador,
      ram_gb,
      almacenamiento_gb,
      almacenamiento_tipo,
      pantalla,
      anio_modelo,
      serial,
      fuente_origen as specs_fuente_origen,
      specs_confidence_score,
      specs_status
    from {{ ref('mart_equipo_specs') }}
  ),

  sustainability as (
    select
      id_equipo,
      carbon_electricity_country,
      carbon_grid_factor_kgco2e_kwh,
      carbon_grid_reference_year,
      carbon_grid_source,
      carbon_source_vendor,
      carbon_source_url,
      carbon_assumed_lifetime_years,
      carbon_use_annual_kwh,
      carbon_report_total_kgco2e,
      carbon_embodied_kgco2e,
      carbon_use_annual_kgco2e,
      carbon_use_lifetime_kgco2e,
      carbon_total_estimated_kgco2e,
      carbon_method,
      carbon_confidence_score,
      carbon_status
    from {{ ref('mart_equipo_sustainability') }}
  ),


base as (
  select
    e.id_equipo,
      specs.sku,
      coalesce(specs.marca, e.marca) as marca,
      coalesce(specs.modelo, e.modelo) as modelo,
    e.estado_equipo as estado_equipo_mtr,
    e.estado_operativo_override,
    e.estado_equipo_override,
    e.clasificacion_operacional_override,
    e.es_activo_operativo_override,
    e.motivo_estado_override,
    e.lifecycle_override_scope,

    -- persona SOLO si el equipo está actualmente asignado
    case
        when upper(coalesce(e.estado_equipo, '')) = 'ASIGNADO' then 'ASIGNADO'
        when le.last_event_type = 'ASIGNACION' then 'ASIGNADO'
        when le.last_event_type = 'DEVOLUCION' then 'STAND_BY'
        when le.last_event_type in ('SAL','SALIDA') then 'BAJA'
        else 'DISPONIBLE'
      end as estado_operativo_base,
    coalesce(
      e.estado_operativo_override,
      case
        when upper(coalesce(e.estado_equipo, '')) = 'ASIGNADO' then 'ASIGNADO'
        when le.last_event_type = 'ASIGNACION' then 'ASIGNADO'
        when le.last_event_type = 'DEVOLUCION' then 'STAND_BY'
        when le.last_event_type in ('SAL','SALIDA') then 'BAJA'
        else 'DISPONIBLE'
      end
    ) as estado_operativo,
      -- estado_equipo derivado desde el último evento (sin pisar el MTR)
      case
        when upper(coalesce(e.estado_equipo, '')) = 'ASIGNADO' then 'Asignado'
        when le.last_event_type = 'ASIGNACION' then 'Asignado'
        when le.last_event_type = 'DEVOLUCION' then 'Disponible'
        when le.last_event_type in ('SAL','SALIDA') then 'Baja'
        else null
      end as estado_equipo_eventos_base,
      coalesce(
        e.estado_equipo_override,
        case
          when upper(coalesce(e.estado_equipo, '')) = 'ASIGNADO' then 'Asignado'
          when le.last_event_type = 'ASIGNACION' then 'Asignado'
          when le.last_event_type = 'DEVOLUCION' then 'Disponible'
          when le.last_event_type in ('SAL','SALIDA') then 'Baja'
          else null
        end
      ) as estado_equipo_eventos,
      -- estado_equipo "oficial": si hay eventos, manda eventos; si no, cae al MTR
    e.cliente,
    e.localizacion,
    e.ciudad_comuna,
    e.fecha_compra,
    specs.tipo_equipo,
    specs.sistema_operativo,
    specs.procesador,
    specs.ram_gb,
    specs.almacenamiento_gb,
    specs.almacenamiento_tipo,
    specs.pantalla,
    specs.anio_modelo,
    specs.serial,
    specs.specs_fuente_origen,
    specs.specs_confidence_score,
    specs.specs_status,
    sustainability.carbon_electricity_country,
    sustainability.carbon_grid_factor_kgco2e_kwh,
    sustainability.carbon_grid_reference_year,
    sustainability.carbon_grid_source,
    sustainability.carbon_source_vendor,
    sustainability.carbon_source_url,
    sustainability.carbon_assumed_lifetime_years,
    sustainability.carbon_use_annual_kwh,
    sustainability.carbon_report_total_kgco2e,
    sustainability.carbon_embodied_kgco2e,
    sustainability.carbon_use_annual_kgco2e,
    sustainability.carbon_use_lifetime_kgco2e,
    sustainability.carbon_total_estimated_kgco2e,
    sustainability.carbon_method,
    sustainability.carbon_confidence_score,
    sustainability.carbon_status,

    le.last_event_date,
    le.last_event_type,
    le.last_event_persona,
    le.last_event_detalle,

    coalesce(m.movimientos_12m, 0) as movimientos_12m,
    coalesce(m.personas_distintas_12m, 0) as personas_distintas_12m,

    case when e.fecha_compra is not null then (current_date - e.fecha_compra)::int end as dias_desde_compra,
    case when le.last_event_date is not null then (current_date - le.last_event_date)::int end as dias_desde_ultimo_evento,

    case
      when e.fecha_compra is null then null
      else (e.fecha_compra + ({{ var('vida_util_meses') }} || ' months')::interval)::date
    end as fecha_vencimiento_renovacion,

    case
      when e.fecha_compra is null then null
      else (
        (e.fecha_compra + ({{ var('vida_util_meses') }} || ' months')::interval)::date - current_date
      )::int
    end as dias_a_vencer,

    case
      when e.fecha_compra is null then false
      else (
        (e.fecha_compra + ({{ var('vida_util_meses') }} || ' months')::interval)::date
        <= (current_date + ({{ var('ventana_renovar_dias') }} || ' days')::interval)::date
      )
    end as flag_renovar,

    case
      when upper(coalesce(e.estado_equipo,'')) = 'ASIGNADO' then false
      when le.last_event_date is null then false
      else (current_date - le.last_event_date) > {{ var('sin_asignacion_dias') }}
    end as flag_sin_asignacion,

    case
      when coalesce(m.movimientos_12m, 0) >= {{ var('rotacion_alta_12m') }} then true
      else false
    end as flag_rotacion_alta,

    ml.ml_score,
    ml.ml_risk_level,
    ml.ml_alert_code,
    ml.ml_total,
    ml.ml_scored_at,
    ml.ml_ml_link_path as ml_link_path,
    coalesce(ml.ml_source_available, false) as ml_source_available,
    coalesce(ml.ml_source_name, 'ml.vw_scores_v2_latest_missing') as ml_source_name,
    ml.ml_score as ml_score_v2,
    ml.ml_risk_level as ml_risk_level_v2,
    ml.ml_alert_code as ml_alert_code_v2,
    coalesce(ml.ml_source_available, false) as ml_source_available_v2,
    coalesce(ml.ml_source_name, 'ml.vw_scores_v2_latest_missing') as ml_source_name_v2,
    ml3.ml_score_v3,
    ml3.ml_risk_level_v3,
    ml3.ml_alert_code_v3,
    ml3.ml_scored_at_v3,
    ml3.ml_link_path_v3,
    ml3.ml_main_driver_v3,
    ml3.ml_drivers_json_v3,
    ml3.ml_risk_reason_v3,
    coalesce(ml3.ml_model_version_v3, 'v3') as ml_model_version_v3,
    coalesce(ml3.ml_source_available_v3, false) as ml_source_available_v3,
    coalesce(ml3.ml_source_name_v3, 'analytics.mart_equipos_estado_actual_missing') as ml_source_name_v3,
    case when ml3.ml_score_v3 is not null then 'v3' else 'v2' end as ml_version,
    case
      when ml3.ml_score_v3 is null or ml.ml_score is null then null
      else round((ml3.ml_score_v3 - ml.ml_score)::numeric, 2)
    end as ml_score_delta_v3_vs_v2
    
      , pol.segmento_destino          as segmento_destino
      , pol.generacion_categoria      as generacion_categoria
      , pol.elegible_dev              as elegible_dev
      , pol.tipo_colaborador          as tipo_colaborador
      , pol.factor_colaborador        as factor_colaborador
      , pol.motivo_politica           as motivo_politica
      , ps.presion_nivel              as presion_nivel
      , ps.presion_stock              as presion_stock
, coalesce(j.jira_open_count, 0) as jira_open_count
    , coalesce(j.jira_created_count, 0)     as jira_created_count
    , coalesce(j.jira_reserved_count, 0)    as jira_reserved_count
    , coalesce(j.jira_assigned_count, 0)    as jira_assigned_count
    , j.jira_days_open_max          as jira_days_open_max
    , j.jira_last_event_ts          as jira_last_event_at
    , j.jira_issue_key_top          as jira_issue_key
    , j.jira_summary_top            as jira_summary
    , j.jira_status_name_top        as jira_status_name
    , j.jira_status_category_name_top as jira_status_category_name
    , j.jira_board_bucket_top       as jira_board_bucket
    , j.jira_estado_equipo_top      as jira_estado_equipo
    , j.jira_board_buckets_open     as jira_board_buckets_open
    , j.jira_project_key_top        as jira_project_key
    , j.jira_project_name_top       as jira_project_name
    , j.jira_reporter_display_name_top as jira_reporter_display_name

  from equipos e
  left join last_event le on le.id_equipo = e.id_equipo
  left join metrics_12m m on m.id_equipo = e.id_equipo
  left join ml_latest ml on ml.id_equipo = e.id_equipo
  left join ml_v3_latest ml3 on ml3.id_equipo = e.id_equipo
  left join specs on specs.id_equipo = e.id_equipo
  left join sustainability on sustainability.id_equipo = e.id_equipo
  
    left join pol pol on pol.id_equipo = e.id_equipo
    left join ps  ps
      on ps.segmento_destino     = pol.segmento_destino
     and ps.generacion_categoria = pol.generacion_categoria
left join jira j on j.equipo_id = e.id_equipo
),

alerts_base as (
  select
    b.*,

    case
      when b.flag_renovar and b.dias_a_vencer is not null and b.dias_a_vencer < 0 then 'CRITICAL'
      when b.flag_renovar then 'CRITICAL'
      when b.flag_sin_asignacion or b.flag_rotacion_alta then 'WARN'
      else 'INFO'
    end as alertas_severidad,

    
jsonb_strip_nulls(
  '{}'::jsonb

  || case when b.flag_renovar then jsonb_build_object(
      'renovar', jsonb_build_object(
        'code','RENOVAR',
        'severity','CRITICAL',
        'label', case when b.dias_a_vencer is not null and b.dias_a_vencer < 0 then 'Renovación vencida' else 'Próximo a vencer' end,
        'why', case
          when b.fecha_compra is null then 'No hay fecha de compra.'
          when b.dias_a_vencer is null then 'No se pudo calcular vencimiento.'
          when b.dias_a_vencer < 0 then 'Ya venció hace ' || abs(b.dias_a_vencer)::text || ' días.'
          else 'Vence en ' || b.dias_a_vencer::text || ' días.'
        end
      )
    ) else '{}'::jsonb end

  || case when b.flag_sin_asignacion then jsonb_build_object(
      'sin_asignacion', jsonb_build_object(
        'code','SIN_ASIGNACION',
        'severity','WARN',
        'label','Sin asignación',
        'why','No está ASIGNADO y el último evento fue hace ' || coalesce(b.dias_desde_ultimo_evento::text,'?') || ' días.'
      )
    ) else '{}'::jsonb end

  || case when b.flag_rotacion_alta then jsonb_build_object(
      'rotacion', jsonb_build_object(
        'code','ROTACION_ALTA_12M',
        'severity','WARN',
        'label','Rotación alta (12m)',
        'why','Movimientos últimos 12 meses = ' || b.movimientos_12m::text || ' (umbral ' || {{ var('rotacion_alta_12m') }}::text || ').'
      )
    ) else '{}'::jsonb end

  || case when b.jira_open_count > 0 then jsonb_build_object(
      'jira', jsonb_build_object(
        'code','JIRA_OPEN',
        'label','Tickets Jira abiertos',
        'why','Tickets abiertos = ' || b.jira_open_count::text ||
              coalesce(' (máx días abierto: ' || b.jira_days_open_max::text || ')',''),
        'severity', case
          when coalesce(b.jira_days_open_max,0) >= 30 then 'CRITICAL'
          when coalesce(b.jira_days_open_max,0) >= 7  then 'WARN'
          else 'INFO'
        end
      )
    ) else '{}'::jsonb end
) as alertas_json,

    coalesce(
      (
        select array_agg(distinct (x->>'code') order by (x->>'code'))
        from jsonb_each(
          (
            (case when b.flag_renovar then jsonb_build_object(
              'renovar', jsonb_build_object(
                'code','RENOVAR',
                'severity','CRITICAL',
                'label', case when b.dias_a_vencer is not null and b.dias_a_vencer < 0 then 'Renovación vencida' else 'Próximo a vencer' end,
                'why', case
                  when b.fecha_compra is null then 'No hay fecha de compra.'
                  when b.dias_a_vencer is null then 'No se pudo calcular vencimiento.'
                  when b.dias_a_vencer < 0 then 'Ya venció hace ' || abs(b.dias_a_vencer)::text || ' días.'
                  else 'Vence en ' || b.dias_a_vencer::text || ' días.'
                end
              )
            ) else '{}'::jsonb end)
            || (case when b.flag_sin_asignacion then jsonb_build_object(
              'sin_asignacion', jsonb_build_object(
                'code','SIN_ASIGNACION',
                'severity','WARN',
                'label','Sin asignación',
                'why','No está ASIGNADO y el último evento fue hace ' || coalesce(b.dias_desde_ultimo_evento::text,'?') || ' días.'
              )
            ) else '{}'::jsonb end)
            || (case when b.flag_rotacion_alta then jsonb_build_object(
              'rotacion', jsonb_build_object(
                'code','ROTACION_ALTA_12M',
                'severity','WARN',
                'label','Rotación alta (12m)',
                'why','Movimientos últimos 12 meses = ' || b.movimientos_12m::text || ' (umbral ' || {{ var('rotacion_alta_12m') }}::text || ').'
              )
            ) else '{}'::jsonb end)
            || (case when b.jira_open_count > 0 then jsonb_build_object(
              'jira', jsonb_build_object(
                'code','JIRA_OPEN',
                'label','Tickets Jira abiertos',
                'why','Tickets abiertos = ' || b.jira_open_count::text ||
                      coalesce(' (máx días abierto: ' || b.jira_days_open_max::text || ')',''),
                'severity', case
                  when coalesce(b.jira_days_open_max,0) >= 30 then 'CRITICAL'
                  when coalesce(b.jira_days_open_max,0) >= 7  then 'WARN'
                  else 'INFO'
                end
              )
            ) else '{}'::jsonb end)
          )
        ) as kv(k, x)
        where nullif(x->>'code','') is not null
      ),
      '{}'::text[]
    ) as alertas_codigos,


    concat_ws(' | ',
      case when b.flag_renovar and b.dias_a_vencer is not null and b.dias_a_vencer < 0 then 'Renovación vencida' end,
      case when b.flag_renovar and (b.dias_a_vencer is null or b.dias_a_vencer >= 0) then 'Próximo a vencer' end,
      case when b.flag_sin_asignacion then 'Sin asignación' end,
      case when b.flag_rotacion_alta then 'Rotación alta' end,
      case when b.jira_open_count > 0 then 'Tickets Jira abiertos' end,
      case when (
        not b.flag_renovar
        and not b.flag_sin_asignacion
        and not b.flag_rotacion_alta
        and coalesce(b.jira_open_count,0) = 0
      ) then 'Sin alertas' end
    ) as alertas_resumen,

    case
      when coalesce(b.jira_open_count,0) > 0 and coalesce(b.jira_days_open_max,0) >= 30 then 1
      when (b.flag_renovar) and b.ml_risk_level = 'Alta' then 10
      when (b.flag_renovar) then 20
      when coalesce(b.jira_open_count,0) > 0 then 25
      when (b.flag_sin_asignacion or b.flag_rotacion_alta) and b.ml_risk_level = 'Alta' then 30
      when (b.flag_sin_asignacion or b.flag_rotacion_alta) then 40
      when b.ml_risk_level = 'Alta' then 50
      else 99
    end as priority_rank
  from base b
)


, alerts as (
  select
    ab.*,
    coalesce(ab.estado_equipo_eventos, ab.estado_equipo_mtr) as estado_equipo,

-- prioridad_final: combina prioridad técnica (priority_rank), presión de stock y política



    case



      when ab.presion_nivel = 'alta'  then 8



      when ab.presion_nivel = 'media' then 4



      else 0



    end

      + case when coalesce(ab.presion_stock,0) >= 999 then 4 else 0 end

      + case when coalesce(ab.elegible_dev,false) and ab.segmento_destino = 'dev' then 2 else 0 end



    + case



        when ab.tipo_colaborador = 'core' then 1



        when ab.tipo_colaborador = 'staffing' then -1



        else 0



      end



    as priority_boost,




    greatest(



      1,



      least(



        99,



        ab.priority_rank



        - (



            case



              when ab.presion_nivel = 'alta'  then 8



              when ab.presion_nivel = 'media' then 4



              else 0



            end



            + case when coalesce(ab.elegible_dev,false) and ab.segmento_destino = 'dev' then 2 else 0 end



            + case



                when ab.tipo_colaborador = 'core' then 1



                when ab.tipo_colaborador = 'staffing' then -1



                else 0



              end



          )



      )



    ) as priority_final_rank,




    case



      when ab.presion_nivel = 'alta' and coalesce(ab.elegible_dev,false) and ab.segmento_destino = 'dev' then '🔥 ML+Presión alta + Elegible DEV'



      when ab.presion_nivel = 'alta' then '📈 Presión alta: sube prioridad'



      when ab.presion_nivel = 'media' then '⚖️ Presión media: ajuste moderado'



      else '🧊 Presión baja: manda el riesgo/alertas'



    end as priority_final_motivo,

    -- sort_key para desempatar dentro del mismo priority_final_rank
    ((greatest(



      1,



      least(



        99,



        ab.priority_rank



        - (



            case



              when ab.presion_nivel = 'alta'  then 8



              when ab.presion_nivel = 'media' then 4



              else 0



            end



            + case when coalesce(ab.elegible_dev,false) and ab.segmento_destino = 'dev' then 2 else 0 end



            + case



                when ab.tipo_colaborador = 'core' then 1



                when ab.tipo_colaborador = 'staffing' then -1



                else 0



              end



          )



      )



    ))::int * 1000000)
    + (least(9999, greatest(0, coalesce(ab.presion_stock,0)))::int * 100)
    + (least(99, coalesce(ab.jira_open_count,0))::int * 10)
    + (least(99, coalesce(ab.ml_score,0))::int)
    as priority_final_sort_key,

    current_timestamp as _loaded_at
  from alerts_base ab
)

select * from alerts
)
,
policy_flags as (
  select
    base.*,

    case
      when lower(coalesce(base.modelo,'')) like '%a2141%'
           and lower(coalesce(base.tipo_colaborador,'')) like '%core%'
           and (
             lower(coalesce(base.segmento_destino,'')) like '%core%'
             or lower(coalesce(base.motivo_politica,'')) like '%admin%'
             or lower(coalesce(base.cliente,'')) like '%admin%'
           )
        then false
      when lower(coalesce(base.modelo,'')) like '%a2141%'
        then true
      when lower(coalesce(base.marca,'')) like '%dell%'
           and lower(coalesce(base.modelo,'')) like '%7400%'
           and lower(coalesce(base.tipo_colaborador,'')) like '%staff%'
        then true
      else coalesce(base.flag_renovar, false)
    end as flag_renovar_regla,

    case
      when lower(coalesce(base.marca,'')) like '%dell%'
           and lower(coalesce(base.modelo,'')) like '%7400%'
           and lower(coalesce(base.tipo_colaborador,'')) like '%staff%'
        then true
      else false
    end as flag_dar_baja_regla,

    case
      when lower(coalesce(base.modelo,'')) like '%a2141%'
           and lower(coalesce(base.tipo_colaborador,'')) like '%core%'
           and (
             lower(coalesce(base.segmento_destino,'')) like '%core%'
             or lower(coalesce(base.motivo_politica,'')) like '%admin%'
             or lower(coalesce(base.cliente,'')) like '%admin%'
           )
        then 'CONSERVAR'
      when lower(coalesce(base.modelo,'')) like '%a2141%'
        then 'RENOVAR'
      when lower(coalesce(base.marca,'')) like '%dell%'
           and lower(coalesce(base.modelo,'')) like '%7400%'
           and lower(coalesce(base.tipo_colaborador,'')) like '%staff%'
        then 'RENOVAR_Y_BAJA'
      else null
    end as accion_regla_modelo,

    case
      when lower(coalesce(base.modelo,'')) like '%a2141%'
           and lower(coalesce(base.tipo_colaborador,'')) like '%core%'
           and (
             lower(coalesce(base.segmento_destino,'')) like '%core%'
             or lower(coalesce(base.motivo_politica,'')) like '%admin%'
             or lower(coalesce(base.cliente,'')) like '%admin%'
           )
        then 'a2141_core_admin_conservar'
      when lower(coalesce(base.modelo,'')) like '%a2141%'
        then 'a2141_renovar'
      when lower(coalesce(base.marca,'')) like '%dell%'
           and lower(coalesce(base.modelo,'')) like '%7400%'
           and lower(coalesce(base.tipo_colaborador,'')) like '%staff%'
        then 'dell_7400_staffing_renovar_baja'
      else null
    end as motivo_regla_modelo
  from original base
),

classified as (
  select
    pf.*,

    case
      when coalesce(pf.clasificacion_operacional_override, '') <> ''
        then pf.clasificacion_operacional_override
      when lower(coalesce(pf.motivo_estado_override, '')) ~ '(vendid|vendido|sold)'
        then 'VENDIDO'
      when upper(coalesce(pf.estado_operativo, '')) = 'BAJA'
        then 'DADO_DE_BAJA'
      when lower(coalesce(pf.marca, '')) like '%dell%'
           and lower(coalesce(pf.modelo, '')) like '%7400%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then 'BAJA_REQUERIDA'
      when lower(coalesce(pf.modelo, '')) like '%a2141%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then 'RENOVAR'
      when lower(coalesce(pf.marca, '')) like '%apple%'
           and (
             lower(coalesce(pf.modelo, '')) like '%m1 pro%'
             or lower(coalesce(pf.modelo, '')) like '%macbook pro m1%'
             or lower(coalesce(pf.modelo, '')) like '% m1%'
           )
        then 'OBSERVACION'
      when pf.accion_regla_modelo = 'CONSERVAR'
        then 'MANTENER'
      when upper(coalesce(pf.estado_operativo, '')) = 'ASIGNADO'
        then 'ASIGNADO'
      when upper(coalesce(pf.estado_operativo, '')) in ('DISPONIBLE', 'STAND_BY')
        then 'DISPONIBLE'
      else 'ACTIVO'
    end as clasificacion_operacional,

    case
      when lower(coalesce(pf.motivo_estado_override, '')) ~ '(vendid|vendido|sold)'
        then 'Excluir del parque activo; equipo marcado como vendido en override manual.'
      when upper(coalesce(pf.estado_operativo, '')) = 'BAJA'
        then 'Excluir del parque activo; equipo marcado en baja por override o evento físico.'
      when lower(coalesce(pf.marca, '')) like '%dell%'
           and lower(coalesce(pf.modelo, '')) like '%7400%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then 'Programar salida y recambio; Dell Latitude 7400 staffing sigue política de baja requerida.'
      when lower(coalesce(pf.modelo, '')) like '%a2141%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then 'Renovar como recambio prioritario de staffing.'
      when lower(coalesce(pf.marca, '')) like '%apple%'
           and (
             lower(coalesce(pf.modelo, '')) like '%m1 pro%'
             or lower(coalesce(pf.modelo, '')) like '%macbook pro m1%'
             or lower(coalesce(pf.modelo, '')) like '% m1%'
           )
        then 'Mantener en observación; no requiere recambio inmediato.'
      when pf.accion_regla_modelo = 'CONSERVAR'
        then 'Mantener en operación según política actual.'
      when upper(coalesce(pf.estado_operativo, '')) = 'ASIGNADO'
        then 'Mantener operativo y monitorear rotación.'
      when upper(coalesce(pf.estado_operativo, '')) in ('DISPONIBLE', 'STAND_BY')
        then 'Disponible para asignación o revisión operativa.'
      else 'Mantener operativo.'
    end as decision_sugerida_operativa,

    case
      when coalesce(pf.estado_operativo_override, '') <> ''
        then 'MTR_OVERRIDE'
      when coalesce(pf.clasificacion_operacional_override, '') <> ''
        then 'MTR_OVERRIDE'
      when lower(coalesce(pf.marca, '')) like '%dell%'
           and lower(coalesce(pf.modelo, '')) like '%7400%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then 'REGLA_MODELO'
      when lower(coalesce(pf.modelo, '')) like '%a2141%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then 'REGLA_MODELO'
      when lower(coalesce(pf.marca, '')) like '%apple%'
           and (
             lower(coalesce(pf.modelo, '')) like '%m1 pro%'
             or lower(coalesce(pf.modelo, '')) like '%macbook pro m1%'
             or lower(coalesce(pf.modelo, '')) like '% m1%'
           )
        then 'REGLA_MODELO'
      else 'ESTADO_OPERATIVO'
    end as fuente_clasificacion_operativa,

    coalesce(
      pf.motivo_estado_override,
      pf.motivo_regla_modelo,
      case
        when upper(coalesce(pf.estado_operativo, '')) = 'BAJA' then 'estado_operativo_baja'
        when upper(coalesce(pf.estado_operativo, '')) = 'ASIGNADO' then 'estado_operativo_asignado'
        when upper(coalesce(pf.estado_operativo, '')) in ('DISPONIBLE', 'STAND_BY') then 'estado_operativo_disponible'
        else 'estado_operativo_activo'
      end
    ) as evidencia_fuente_operativa,

    case
      when pf.es_activo_operativo_override is not null then pf.es_activo_operativo_override
      when upper(coalesce(pf.estado_operativo, '')) = 'BAJA' then false
      when lower(coalesce(pf.motivo_estado_override, '')) ~ '(vendid|vendido|sold)' then false
      else true
    end as es_activo_operativo,

    case
      when lower(coalesce(pf.motivo_estado_override, '')) ~ '(obsole|defect|scrap|desuso)'
        then true
      when lower(coalesce(pf.marca, '')) like '%dell%'
           and lower(coalesce(pf.modelo, '')) like '%7400%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then true
      when lower(coalesce(pf.modelo, '')) like '%a2141%'
           and lower(coalesce(pf.tipo_colaborador, '')) like '%staff%'
        then true
      else false
    end as flag_obsoleto_operativo
  from policy_flags pf
)

select
  classified.*,
  classified.clasificacion_operacional as lifecycle_estado,
  classified.es_activo_operativo as ml_activo_operativo
from classified
