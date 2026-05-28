{{ config(materialized='view', tags=['marts', 'historico', 'catastro']) }}

with eventos as (
    select *
    from {{ ref('int_mtr_eventos_dedup_stats') }}
    where fecha_evento_dia >= date '2024-01-01'
      and fecha_evento_dia <= {{ mtr_operational_horizon_date() }}
),

dim_asignados as (
    select
        upper(id_equipo) as id_equipo,
        nullif(trim(cliente), '') as cliente_dim,
        nullif(trim(persona_asignada), '') as persona_asignada_dim,
        nullif(trim(ambito_laboral), '') as ambito_laboral,
        nullif(trim(localizacion), '') as localizacion,
        nullif(trim(ciudad_comuna), '') as ciudad_comuna,
        nullif(trim(marca), '') as marca_dim,
        nullif(trim(modelo), '') as modelo_dim,
        nullif(trim(sistema_operativo), '') as sistema_operativo_dim,
        nullif(trim(condicion), '') as condicion_dim,
        nullif(trim(tipo_colaborador_mtr), '') as tipo_colaborador_dim,
        fecha_compra
    from {{ ref('stg_mtr_google_sheet_equipos_asignados') }}
),

estado_actual as (
    select
        upper(id_equipo) as id_equipo,
        nullif(trim(cliente), '') as cliente_actual,
        nullif(trim(localizacion), '') as localizacion_actual,
        nullif(trim(ciudad_comuna), '') as ciudad_comuna_actual,
        nullif(trim(marca), '') as marca_actual,
        nullif(trim(modelo), '') as modelo_actual,
        nullif(trim(tipo_colaborador), '') as tipo_colaborador_actual,
        nullif(trim(accion_regla_modelo), '') as accion_regla_modelo,
        nullif(trim(motivo_regla_modelo), '') as motivo_regla_modelo
    from {{ ref('mart_equipos_estado_actual') }}
),

base as (
    select
        e.fecha_evento_dia as fecha_evento,
        date_trunc('month', e.fecha_evento_dia)::date as mes,
        e.id_equipo,
        e.tipo_evento,
        e.persona,
        e.cliente as cliente_evento,
        e.perfil,
        e.marca as marca_evento,
        e.modelo as modelo_evento,
        e.plataforma as plataforma_evento,
        e.detalle,
        e.tipo_ingreso,
        e.cobertura_equipo,
        e.ingreso_con_equipo,
        e.ingreso_presiona_compra,
        e.solicitud_equipo_explicita,
        e.ambito_registro,
        e.pais_ingreso,

        da.cliente_dim,
        da.persona_asignada_dim,
        da.ambito_laboral,
        da.localizacion,
        da.ciudad_comuna,
        da.marca_dim,
        da.modelo_dim,
        da.sistema_operativo_dim,
        da.condicion_dim,
        da.tipo_colaborador_dim,
        da.fecha_compra,

        ea.cliente_actual,
        ea.localizacion_actual,
        ea.ciudad_comuna_actual,
        ea.marca_actual,
        ea.modelo_actual,
        ea.tipo_colaborador_actual,
        ea.accion_regla_modelo,
        ea.motivo_regla_modelo,

        case
            when da.id_equipo is not null then 'asignados_sheet'
            when ea.id_equipo is not null then 'estado_actual'
            else 'evento'
        end as enrichment_source
    from eventos e
    left join dim_asignados da
      on upper(coalesce(e.id_equipo, '')) = da.id_equipo
    left join estado_actual ea
      on upper(coalesce(e.id_equipo, '')) = ea.id_equipo
),

normalized as (
    select
        fecha_evento,
        mes,
        id_equipo,
        tipo_evento,
        persona,
        perfil,
        detalle,
        tipo_ingreso,
        cobertura_equipo,
        ingreso_con_equipo,
        ingreso_presiona_compra,
        solicitud_equipo_explicita,
        ambito_registro,
        coalesce(
            nullif(trim(pais_ingreso), ''),
            nullif(trim(localizacion), ''),
            nullif(trim(localizacion_actual), '')
        ) as pais_ingreso_raw,
        enrichment_source,
        accion_regla_modelo,
        motivo_regla_modelo,
        fecha_compra,
        coalesce(
            nullif(trim(cliente_evento), ''),
            cliente_dim,
            cliente_actual
        ) as cliente_raw,
        coalesce(
            nullif(trim(marca_evento), ''),
            marca_dim,
            marca_actual
        ) as marca_raw,
        coalesce(
            nullif(trim(modelo_evento), ''),
            modelo_dim,
            modelo_actual
        ) as modelo_raw,
        coalesce(
            nullif(trim(sistema_operativo_dim), ''),
            nullif(trim(plataforma_evento), '')
        ) as sistema_operativo_raw,
        coalesce(
            nullif(trim(tipo_colaborador_dim), ''),
            nullif(trim(tipo_colaborador_actual), '')
        ) as tipo_colaborador_raw,
        coalesce(
            nullif(trim(localizacion), ''),
            nullif(trim(localizacion_actual), '')
        ) as localizacion_raw,
        coalesce(
            nullif(trim(ciudad_comuna), ''),
            nullif(trim(ciudad_comuna_actual), '')
        ) as ciudad_comuna_raw,
        coalesce(
            nullif(trim(condicion_dim), ''),
            nullif(trim(persona_asignada_dim), '')
        ) as condicion_o_persona_dim,
        lower(
            concat_ws(
                ' ',
                coalesce(nullif(trim(marca_evento), ''), marca_dim, marca_actual),
                coalesce(nullif(trim(modelo_evento), ''), modelo_dim, modelo_actual),
                coalesce(nullif(trim(sistema_operativo_dim), ''), nullif(trim(plataforma_evento), ''))
            )
        ) as equipo_txt
    from base
),

final as (
    select
        fecha_evento,
        mes,
        id_equipo,
        tipo_evento,
        persona,
        case
            when upper(coalesce(cliente_raw, '')) in ('LATAM', 'LATAM AIRLINES') then 'Latam'
            when upper(replace(coalesce(cliente_raw, ''), ' ', '')) = 'REDSALUD' then 'RedSalud'
            when upper(coalesce(cliente_raw, '')) in ('ACID', 'ACID LABS') then 'Acid Labs'
            when upper(coalesce(cliente_raw, '')) in ('BCI', 'BANCO BCI') then 'BCI'
            when upper(coalesce(cliente_raw, '')) in ('JETSMART', 'JET SMART') then 'JetSMART'
            when upper(coalesce(cliente_raw, '')) = 'SKY' then 'Sky'
            when upper(coalesce(cliente_raw, '')) = 'BUPA' then 'Bupa'
            when nullif(trim(cliente_raw), '') is null then 'SIN_CLIENTE'
            else initcap(lower(cliente_raw))
        end as empresa,
        case
            when upper(trim(coalesce(marca_raw, ''))) = 'HP' then 'HP'
            else coalesce(nullif(trim(marca_raw), ''), 'SIN_MARCA')
        end as marca,
        coalesce(nullif(trim(modelo_raw), ''), 'SIN_MODELO') as modelo,
        coalesce(nullif(trim(sistema_operativo_raw), ''), 'SIN_SO') as sistema_operativo,
        case
            when lower(coalesce(tipo_colaborador_raw, '')) in ('core', 'staffing') then lower(tipo_colaborador_raw)
            else 'unknown'
        end as tipo_colaborador,
        case
            when equipo_txt like '%iphone%'
              or equipo_txt like '%galaxy%'
              or equipo_txt like '%vivo%'
              or equipo_txt like '%celular%'
              then 'MOVIL'
            when equipo_txt like '%ipad%'
              or equipo_txt like '%tablet%'
              then 'TABLET'
            when equipo_txt like '%monitor%'
              then 'MONITOR'
            when equipo_txt like '%desktop%'
              or equipo_txt like '%workstation%'
              or equipo_txt like '%optiplex%'
              then 'DESKTOP'
            when equipo_txt like '%macbook%'
              or equipo_txt like '%elitebook%'
              or equipo_txt like '%latitude%'
              or equipo_txt like '%thinkpad%'
              or equipo_txt like '%notebook%'
              or equipo_txt like '%laptop%'
              or equipo_txt like '%book%'
              then 'NOTEBOOK'
            else 'UNKNOWN'
        end as tipo_equipo,
        case
            when equipo_txt like '%iphone%'
              or equipo_txt like '%ipad%'
              or equipo_txt like '%ios%'
              then 'APPLE_MOBILE'
            when equipo_txt like '%mac%'
              or equipo_txt like '%macbook%'
              or equipo_txt like '%apple%'
              then 'MAC'
            when equipo_txt like '%windows%'
              or equipo_txt like '%win%'
              or coalesce(id_equipo, '') <> ''
              then 'WIN'
            else 'UNKNOWN'
        end as os_familia,
        coalesce(
            case
                when upper(trim(coalesce(pais_ingreso_raw, ''))) = 'CHILE' then 'Chile'
                when nullif(trim(pais_ingreso_raw), '') is not null then initcap(lower(trim(pais_ingreso_raw)))
                else null
            end,
            case
                when upper(coalesce(localizacion_raw, '')) like '%CHILE%' then 'Chile'
                when nullif(trim(localizacion_raw), '') is not null then initcap(lower(trim(localizacion_raw)))
                else null
            end
        ) as pais,
        case
            when upper(trim(coalesce(pais_ingreso_raw, ''))) = 'CHILE' then 'NACIONAL'
            when nullif(trim(pais_ingreso_raw), '') is not null then 'EXTRANJERO'
            when upper(coalesce(localizacion_raw, '')) like '%CHILE%' then 'NACIONAL'
            when upper(coalesce(ciudad_comuna_raw, '')) like '%SANTIAGO%' then 'NACIONAL'
            when nullif(trim(localizacion_raw), '') is not null
              or nullif(trim(ciudad_comuna_raw), '') is not null
              then 'EXTRANJERO'
            when ambito_registro = 'EXTRANJERO' then 'EXTRANJERO'
            when ambito_registro = 'NACIONAL' then 'NACIONAL'
            else 'UNKNOWN'
        end as ambito,
        case
            when lower(coalesce(motivo_regla_modelo, '')) like '%dell%'
              or equipo_txt like '%dell%'
              or equipo_txt like '%latitude%'
              then 'DELL_BAJA'
            when equipo_txt like '%m1%'
              or equipo_txt like '%m1 pro%'
              or equipo_txt like '%a2442%'
              or equipo_txt like '%a2485%'
              or equipo_txt like '%a2338%'
              or equipo_txt like '%a2337%'
              then 'M1_OBSERVACION'
            when lower(coalesce(motivo_regla_modelo, '')) like '%a2141%'
              or equipo_txt like '%a2141%'
              then 'A2141_RENOVAR'
            else 'ESTANDAR'
        end as politica_modelo,
        fecha_compra,
        tipo_ingreso,
        cobertura_equipo,
        ingreso_con_equipo,
        ingreso_presiona_compra,
        solicitud_equipo_explicita,
        case
            when tipo_evento <> 'INGRESO' then null
            when coalesce(ingreso_con_equipo, false) then true
            else coalesce(ingreso_presiona_compra, false)
        end as requiere_equipo_regla,
        ambito_registro,
        enrichment_source,
        accion_regla_modelo,
        motivo_regla_modelo,
        (tipo_evento = 'INGRESO') as es_ingreso,
        (tipo_evento = 'SALIDA') as es_salida,
        (tipo_evento = 'INGRESO' and coalesce(tipo_ingreso, 'nuevo') = 'nuevo') as es_ingreso_nuevo,
        (tipo_evento = 'INGRESO' and tipo_ingreso = 'interno') as es_ingreso_interno,
        (tipo_evento = 'INGRESO' and coalesce(ingreso_con_equipo, false)) as es_ingreso_con_equipo,
        (tipo_evento = 'INGRESO' and not coalesce(ingreso_con_equipo, false)) as es_ingreso_sin_equipo,
        (tipo_evento = 'SALIDA' and coalesce(id_equipo, '') <> '') as es_salida_con_sku,
        (tipo_evento = 'SALIDA' and coalesce(id_equipo, '') = '') as es_salida_sin_sku,
        (tipo_evento = 'INGRESO' and coalesce(ingreso_presiona_compra, false)) as es_presion_compra
    from normalized
)

select *
from final
