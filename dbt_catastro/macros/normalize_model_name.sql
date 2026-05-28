{% macro normalize_model_name(expr) -%}
case
  when regexp_replace(lower(coalesce({{ expr }}, '')), '[^a-z0-9]+', ' ', 'g') like '%a2141%'
   and regexp_replace(lower(coalesce({{ expr }}, '')), '[^a-z0-9]+', ' ', 'g') like '%macbook%'
   and regexp_replace(lower(coalesce({{ expr }}, '')), '[^a-z0-9]+', ' ', 'g') like '%pro%'
    then 'A2141 MacBook Pro'
  when regexp_replace(lower(coalesce({{ expr }}, '')), '[^a-z0-9]+', '', 'g') like '%latitude7400%'
    then 'Latitude 7400'
  else nullif(trim({{ expr }}), '')
end
{%- endmacro %}
