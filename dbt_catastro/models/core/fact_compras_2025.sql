select
  id_compra,
  fecha_compra,
  valor_neto
from {{ ref('stg_compras_2025_raw') }}
