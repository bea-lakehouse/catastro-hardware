{{ config(materialized='view', tags=['intermediate', 'sustainability', 'carbon']) }}

with inputs as (
  select *
  from {{ ref('stg_equipo_sustainability_inputs') }}
),

oem_match as (
  select
    i.id_equipo,
    r.report_name,
    r.report_region,
    r.report_total_kgco2e,
    r.report_use_share_pct,
    r.assumed_lifetime_years as oem_assumed_lifetime_years,
    r.source_name as oem_source_name,
    r.source_url as oem_source_url,
    r.source_confidence as oem_source_confidence,
    r.methodology as oem_methodology
  from inputs i
  left join lateral (
    select *
    from {{ ref('dim_oem_product_carbon_reports') }} r
    where (nullif(trim(r.match_brand), '') is null or lower(coalesce(i.marca, '')) = lower(r.match_brand))
      and (nullif(trim(r.match_model_pattern), '') is null or lower(coalesce(i.modelo, '')) like lower(r.match_model_pattern))
      and (nullif(trim(r.match_model_year), '') is null or coalesce(i.anio_modelo, '') = r.match_model_year)
      and (nullif(trim(r.device_category), '') is null or lower(coalesce(i.device_category, '')) = lower(r.device_category))
    order by r.priority asc
    limit 1
  ) r on true
),

power_match as (
  select
    i.id_equipo,
    p.annual_kwh_estimate,
    p.assumed_lifetime_years as power_assumed_lifetime_years,
    p.source_name as power_source_name,
    p.source_url as power_source_url,
    p.source_confidence as power_source_confidence
  from inputs i
  left join lateral (
    select *
    from {{ ref('dim_device_power_profiles') }} p
    where (nullif(trim(p.match_brand), '') is null or lower(coalesce(i.marca, '')) = lower(p.match_brand))
      and (nullif(trim(p.match_model_pattern), '') is null or lower(coalesce(i.modelo, '')) like lower(p.match_model_pattern))
      and (nullif(trim(p.match_model_year), '') is null or coalesce(i.anio_modelo, '') = p.match_model_year)
      and (nullif(trim(p.device_category), '') is null or lower(coalesce(i.device_category, '')) = lower(p.device_category))
    order by p.priority asc
    limit 1
  ) p on true
),

grid_match as (
  select
    i.id_equipo,
    g.country_name,
    g.reference_year,
    g.grid_factor_kgco2e_kwh,
    g.source_name as grid_source_name,
    g.source_url as grid_source_url,
    g.source_confidence as grid_source_confidence
  from inputs i
  left join lateral (
    select *
    from {{ ref('dim_grid_emission_factors_country_year') }} g
    where lower(g.country_name) = lower(coalesce(i.electricity_country, ''))
    order by g.priority asc, g.reference_year desc
    limit 1
  ) g on true
),

overrides as (
  select
    upper(trim(id_equipo)) as id_equipo,
    carbon_report_total_kgco2e,
    carbon_embodied_kgco2e,
    carbon_use_annual_kwh,
    carbon_use_annual_kgco2e,
    nullif(trim(electricity_country), '') as electricity_country_override,
    grid_factor_kgco2e_kwh as grid_factor_override,
    assumed_lifetime_years as assumed_lifetime_years_override,
    nullif(trim(override_reason), '') as override_reason,
    nullif(trim(override_source), '') as override_source
  from {{ ref('dim_carbon_overrides_manual') }}
)

select
  i.*,
  oem.report_name,
  oem.report_region,
  oem.report_total_kgco2e,
  oem.report_use_share_pct,
  oem.oem_assumed_lifetime_years,
  oem.oem_source_name,
  oem.oem_source_url,
  oem.oem_source_confidence,
  oem.oem_methodology,
  power.annual_kwh_estimate,
  power.power_assumed_lifetime_years,
  power.power_source_name,
  power.power_source_url,
  power.power_source_confidence,
  coalesce(overrides.electricity_country_override, grid.country_name, i.electricity_country) as electricity_country_final,
  coalesce(overrides.grid_factor_override, grid.grid_factor_kgco2e_kwh) as grid_factor_kgco2e_kwh,
  grid.reference_year as grid_reference_year,
  grid.grid_source_name,
  grid.grid_source_url,
  grid.grid_source_confidence,
  overrides.carbon_report_total_kgco2e as override_report_total_kgco2e,
  overrides.carbon_embodied_kgco2e as override_embodied_kgco2e,
  overrides.carbon_use_annual_kwh as override_use_annual_kwh,
  overrides.carbon_use_annual_kgco2e as override_use_annual_kgco2e,
  overrides.assumed_lifetime_years_override,
  overrides.override_reason,
  overrides.override_source,
  current_timestamp as _matched_at
from inputs i
left join oem_match oem
  on oem.id_equipo = i.id_equipo
left join power_match power
  on power.id_equipo = i.id_equipo
left join grid_match grid
  on grid.id_equipo = i.id_equipo
left join overrides
  on overrides.id_equipo = upper(i.id_equipo)
