with x as (
  select
    id_equipo,
    sku,
    estado,
    cliente_actual,
    persona_actual,
    marca,
    modelo,
    cpu,
    ram,
    sistema_operativo,
    nro_serie,
    tipo_colaborador
  from {{ ref('stg_equipos_enriched') }}
),

dq as (
  select
    *,
    -- flags simples y auditables
    (marca is null) as missing_marca,
    (modelo is null) as missing_modelo,
    (cpu is null) as missing_cpu,
    (ram is null) as missing_ram,
    (sistema_operativo is null) as missing_so,
    (nro_serie is null) as missing_nro_serie
  from x
)

select *
from dq
where missing_marca
   or missing_modelo
   or missing_cpu
   or missing_ram
   or missing_so
   or missing_nro_serie
