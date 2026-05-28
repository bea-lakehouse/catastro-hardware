{{ config(materialized='view') }}

with base as (

    select *
    from {{ ref('mart_equipos_estado_actual_v2') }}

),

mtr_modelo as (

    select
        upper(id_equipo) as id_equipo,
        nullif(trim(marca), '') as marca,
        nullif(trim(modelo), '') as modelo
    from analytics.v_mtr1203_equipos_asignados_latest_norm

),

backfill as (

    select
        upper(id_equipo) as id_equipo,
        nullif(trim(marca), '') as marca,
        nullif(trim(modelo), '') as modelo
    from analytics.equipos_backfill

),

final as (

    select
        b.*,

        coalesce(nullif(mtr.modelo,''), nullif(bf.modelo,''), 'UNKNOWN') as modelo,
        coalesce(nullif(mtr.marca,''), nullif(bf.marca,''), 'UNKNOWN') as marca,

        upper(coalesce(mtr.modelo, bf.modelo, '')) as modelo_norm,
        upper(coalesce(mtr.marca, bf.marca, '')) as marca_norm

    from base b
    left join mtr_modelo mtr
        on upper(b.id_equipo) = mtr.id_equipo
    left join backfill bf
        on upper(b.id_equipo) = bf.id_equipo

)

select *
from final
