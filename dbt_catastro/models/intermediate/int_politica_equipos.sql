-- Política MVP segura (con llaves normalizadas para evitar NULL=NULL)
select
  e.id_equipo as equipo_id,

  -- generacion_categoria: si no existe en stg, dejamos NULL pero normalizamos a 'unknown'
  -- (en este staging tuyo, generacion_categoria no está, por eso queda null hoy)
  'antiguo'::text as generacion_categoria,

  -- segmento_destino: derivado simple por sistema operativo (Windows/Core vs Mac/Dev)
  case
    when lower(coalesce(e.sistema_operativo,'')) like '%mac%' then 'dev'
    else 'core'
  end as segmento_destino,

  -- elegible_dev: si es mac, true
  (lower(coalesce(e.sistema_operativo,'')) like '%mac%') as elegible_dev,

  -- tipo_colaborador viene del stg (ya lo tienes)
  coalesce(nullif(lower(e.tipo_colaborador),''), 'unknown') as tipo_colaborador,

  -- factor simple por tipo_colaborador
  case
    when coalesce(nullif(lower(e.tipo_colaborador),''),'') = 'core' then 1
    when coalesce(nullif(lower(e.tipo_colaborador),''),'') = 'staffing' then -1
    else 0
  end::int as factor_colaborador,

  -- motivo
  case
    when coalesce(nullif(lower(e.tipo_colaborador),''),'') = 'core' then 'Equipo Core'
    when coalesce(nullif(lower(e.tipo_colaborador),''),'') = 'staffing' then 'Equipo Staffing'
    else 'Sin tipo colaborador'
  end as motivo_politica,

  -- opcional: plataforma (no la tienes en este stg)
  null::text as plataforma

from {{ ref('stg_equipos_enriched') }} e
