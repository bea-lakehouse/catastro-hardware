select
  date_trunc('month', fecha_compra) as mes,
  count(*) as cantidad_compras,
  sum(valor_neto) as total_valor_neto
from {{ ref('fact_compras_2025') }}
group by 1
