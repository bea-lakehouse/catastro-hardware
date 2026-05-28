select
  id_compra,
  fecha_compra,
  valor_neto
from {{ source('raw', 'compras_2025_raw') }}
