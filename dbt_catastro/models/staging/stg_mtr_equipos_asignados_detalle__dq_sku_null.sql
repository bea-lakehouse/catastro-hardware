select
  -- filas del raw que no llegan a staging porque no tienen SKU válido
  *
from {{ source('raw','mtr_equipos_asignados_detalle') }}
where sku is null
