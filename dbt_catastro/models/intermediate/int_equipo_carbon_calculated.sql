{{ config(materialized='view', tags=['intermediate', 'sustainability', 'carbon']) }}

with matched as (
  select *
  from {{ ref('int_equipo_carbon_matched') }}
),

prepared as (
  select
    *,
    coalesce(
      assumed_lifetime_years_override,
      oem_assumed_lifetime_years,
      power_assumed_lifetime_years,
      case when device_category = 'notebook' then 4 else null end
    )::numeric as assumed_lifetime_years_final,
    coalesce(override_report_total_kgco2e, report_total_kgco2e)::numeric as report_total_final,
    coalesce(override_use_annual_kwh, annual_kwh_estimate)::numeric as annual_kwh_final
  from matched
),

estimated as (
  select
    *,
    case
      when override_embodied_kgco2e is not null then override_embodied_kgco2e::numeric
      when report_total_final is not null and report_use_share_pct is not null then round((report_total_final * (1 - report_use_share_pct))::numeric, 2)
      else null
    end as carbon_embodied_estimated_kgco2e,
    case
      when override_use_annual_kgco2e is not null then override_use_annual_kgco2e::numeric
      when annual_kwh_final is not null and grid_factor_kgco2e_kwh is not null then round((annual_kwh_final * grid_factor_kgco2e_kwh)::numeric, 2)
      when report_total_final is not null and report_use_share_pct is not null and assumed_lifetime_years_final is not null and assumed_lifetime_years_final > 0
        then round((report_total_final * report_use_share_pct / assumed_lifetime_years_final)::numeric, 2)
      else null
    end as carbon_use_annual_estimated_kgco2e,
    case
      when report_total_final is not null and report_use_share_pct is not null then round((report_total_final * report_use_share_pct)::numeric, 2)
      when annual_kwh_final is not null and grid_factor_kgco2e_kwh is not null and assumed_lifetime_years_final is not null
        then round((annual_kwh_final * grid_factor_kgco2e_kwh * assumed_lifetime_years_final)::numeric, 2)
      else null
    end as carbon_use_lifetime_estimated_kgco2e
  from prepared
),

final as (
  select
    id_equipo,
    sku,
    marca,
    modelo,
    tipo_equipo,
    sistema_operativo,
    procesador,
    ram_gb,
    almacenamiento_gb,
    almacenamiento_tipo,
    pantalla,
    anio_modelo,
    serial,
    cliente,
    fecha_compra,
    tipo_colaborador,
    localizacion_raw,
    ciudad_comuna,
    specs_fuente_origen,
    specs_confidence_score,
    specs_status,
    device_category,
    electricity_country_final as carbon_electricity_country,
    electricity_country_confidence,
    electricity_country_source,
    grid_factor_kgco2e_kwh as carbon_grid_factor_kgco2e_kwh,
    grid_reference_year as carbon_grid_reference_year,
    grid_source_name as carbon_grid_source,
    grid_source_url as carbon_grid_source_url,
    grid_source_confidence as carbon_grid_source_confidence,
    report_name as carbon_report_name,
    report_region as carbon_report_region,
    oem_source_name as carbon_source_vendor,
    oem_source_url as carbon_source_url,
    oem_source_confidence as carbon_source_vendor_confidence,
    oem_methodology as carbon_methodology_source,
    assumed_lifetime_years_final as carbon_assumed_lifetime_years,
    annual_kwh_final as carbon_use_annual_kwh,
    report_total_final as carbon_report_total_kgco2e,
    carbon_embodied_estimated_kgco2e as carbon_embodied_kgco2e,
    carbon_use_annual_estimated_kgco2e as carbon_use_annual_kgco2e,
    carbon_use_lifetime_estimated_kgco2e as carbon_use_lifetime_kgco2e,
    coalesce(
      report_total_final,
      case
        when carbon_embodied_estimated_kgco2e is not null and carbon_use_lifetime_estimated_kgco2e is not null
          then round((carbon_embodied_estimated_kgco2e + carbon_use_lifetime_estimated_kgco2e)::numeric, 2)
        else null
      end
    ) as carbon_total_estimated_kgco2e,
    case
      when report_total_final is not null and report_use_share_pct is not null then 'vendor_lifecycle_report'
      when report_total_final is not null then 'vendor_total_report'
      when annual_kwh_final is not null and grid_factor_kgco2e_kwh is not null then 'grid_factor_x_vendor_energy'
      when electricity_country_final is not null then 'country_only'
      else 'sin_match'
    end as carbon_method,
    case
      when report_total_final is not null and report_use_share_pct is not null and grid_factor_kgco2e_kwh is not null then 1.0::numeric
      when report_total_final is not null and report_use_share_pct is not null then 0.8::numeric
      when report_total_final is not null then 0.7::numeric
      when annual_kwh_final is not null and grid_factor_kgco2e_kwh is not null then 0.6::numeric
      when electricity_country_final is not null then 0.3::numeric
      else 0.0::numeric
    end as carbon_confidence_score,
    case
      when report_total_final is not null and report_use_share_pct is not null then 'estimado_completo'
      when report_total_final is not null or (annual_kwh_final is not null and grid_factor_kgco2e_kwh is not null) then 'estimado_parcial'
      else 'sin_datos_carbono'
    end as carbon_status,
    override_reason as carbon_override_reason,
    override_source as carbon_override_source,
    current_timestamp as _loaded_at
  from estimated
)

select * from final
