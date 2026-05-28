{{ config(materialized='view', tags=['ranking','marts']) }}

with r as (
  select *
  from {{ ref('mart_ranking_global') }}
)

select
  equipo_id,
  priority_final_rank,
  priority_final_sort_key,

  alertas_severidad,
  presion_nivel,
  ml_risk_level,
  tipo_colaborador,
  segmento_destino,

  -- bucket explicable (para UI)
  case
    when alertas_severidad = 'CRITICAL' and presion_nivel = 'alta' and ml_risk_level = 'Alta' then 'P0'
    when alertas_severidad = 'CRITICAL' and presion_nivel = 'alta' then 'P1'
    when alertas_severidad = 'CRITICAL' then 'P2'
    when presion_nivel = 'alta' then 'P3'
    else 'P4'
  end as bucket_prioridad

from r
where equipo_id is not null
order by
  priority_final_rank asc nulls last,
  priority_final_sort_key desc nulls last
limit 200;
