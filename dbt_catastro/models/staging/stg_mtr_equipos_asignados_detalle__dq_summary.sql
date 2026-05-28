with raw_cnt as (
  select count(*)::bigint as raw_rows
  from {{ source('raw','mtr_equipos_asignados_detalle') }}
),
ok_cnt as (
  select count(*)::bigint as stg_ok_rows
  from {{ ref('stg_mtr_equipos_asignados_detalle') }}
),
dq_cnt as (
  select count(*)::bigint as dq_sku_null_rows
  from {{ ref('stg_mtr_equipos_asignados_detalle__dq_sku_null') }}
)
select
  raw_rows,
  stg_ok_rows,
  dq_sku_null_rows,
  (raw_rows - stg_ok_rows - dq_sku_null_rows) as other_gap_rows
from raw_cnt, ok_cnt, dq_cnt
