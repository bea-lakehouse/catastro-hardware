{{ config(materialized='table') }}

select *
from {{ ref('stg_ml_features_equipos') }}
