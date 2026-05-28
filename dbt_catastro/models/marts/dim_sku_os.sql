{{ config(materialized='view', tags=['dim','sku','os','mtr']) }}

with ingresos as (
    select
        nullif(btrim("Entrega Equipo Computacional"), '')::text as id_equipo_raw,
        nullif(btrim("Unnamed: 19"), '')::text as modelo_txt
    from analytics.mtr_ingresos
),

salidas as (
    select
        nullif(btrim("Entrega Equipo Computacional"), '')::text as id_equipo_raw,
        nullif(btrim("Unnamed: 17"), '')::text as modelo_txt
    from analytics.mtr_salidas
),

unioned as (
    select * from ingresos
    union all
    select * from salidas
),

normalized as (
    select
        id_equipo_raw,
        modelo_txt,

        upper(
            regexp_replace(
                regexp_replace(
                    regexp_replace(coalesce(id_equipo_raw,''), '^\s*SKU\s*[- ]*\s*', 'SKU-', 'i'),
                    '\s+', '', 'g'
                ),
                '^SKU-0+', 'SKU-', 'i'
            )
        ) as id_equipo_norm

    from unioned
),

filtered as (
    select
        id_equipo_raw,
        modelo_txt,
        id_equipo_norm
    from normalized
    where id_equipo_norm is not null
      and id_equipo_norm <> ''
      and id_equipo_norm <> 'SKU'
      and id_equipo_norm ~ '^SKU-[0-9]+$'
),

classified as (
    select
        id_equipo_norm as id_equipo,
        modelo_txt,
        case
            when lower(coalesce(modelo_txt,'')) like '%macbook%' then 'MAC'
            when lower(coalesce(modelo_txt,'')) like '%mac mini%' then 'MAC'
            when lower(coalesce(modelo_txt,'')) like '%apple%' then 'MAC'
            when lower(coalesce(modelo_txt,'')) like '%dell%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%lenovo%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%hp%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%elitebook%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%thinkpad%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%latitude%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%asus%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%acer%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%surface%' then 'WIN'
            when lower(coalesce(modelo_txt,'')) like '%legion%' then 'WIN'
            else 'OTRO'
        end as os_familia
    from filtered
),

ranked as (
    select
        *,
        row_number() over (
            partition by id_equipo
            order by
                case when os_familia in ('MAC','WIN') then 0 else 1 end,
                length(coalesce(modelo_txt,'')) desc
        ) as rn
    from classified
)

select
    id_equipo,
    modelo_txt,
    os_familia
from ranked
where rn = 1
