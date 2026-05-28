{% macro normalize_specs_brand(expr) -%}
case
  when {{ expr }} is null or trim({{ expr }}) = '' then null
  when lower({{ expr }}) ~ '(apple|macbook|iphone|ipad)' then 'Apple'
  when lower({{ expr }}) ~ '(^|[^a-z])dell([^a-z]|$)' then 'Dell'
  when lower({{ expr }}) ~ '(hp|elitebook)' then 'HP'
  when lower({{ expr }}) ~ 'lenovo' then 'Lenovo'
  when lower({{ expr }}) ~ 'asus' then 'Asus'
  else initcap(trim({{ expr }}))
end
{%- endmacro %}

{% macro normalize_specs_model(expr) -%}
nullif(
  trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce({{ expr }}, ''), '\s+', ' ', 'g'),
              'macbook pro',
              'MacBook Pro',
              'gi'
            ),
            'macbook air',
            'MacBook Air',
            'gi'
          ),
          'macbook',
          'MacBook',
          'gi'
        ),
        'elitebook',
        'EliteBook',
        'gi'
      ),
      'thinkpad',
      'ThinkPad',
      'gi'
    )
  ),
  ''
)
{%- endmacro %}

{% macro normalize_specs_os(os_expr, platform_expr='null') -%}
case
  when coalesce({{ os_expr }}, {{ platform_expr }}) is null then null
  when lower(coalesce({{ os_expr }}, {{ platform_expr }})) like '%mac%' then 'macOS'
  when lower(coalesce({{ os_expr }}, {{ platform_expr }})) like '%os x%' then 'macOS'
  when lower(coalesce({{ os_expr }}, {{ platform_expr }})) like '%win%' then 'Windows'
  when lower(coalesce({{ os_expr }}, {{ platform_expr }})) like '%android%' then 'Android'
  when lower(coalesce({{ os_expr }}, {{ platform_expr }})) like '%ios%' then 'iOS'
  when lower(coalesce({{ os_expr }}, {{ platform_expr }})) like '%ipad%' then 'iPadOS'
  else nullif(trim(coalesce({{ os_expr }}, {{ platform_expr }})), '')
end
{%- endmacro %}

{% macro normalize_specs_type(expr) -%}
case
  when {{ expr }} is null or trim({{ expr }}) = '' then null
  when lower({{ expr }}) like '%ordenador%' then 'Ordenador'
  when lower({{ expr }}) like '%notebook%' then 'Notebook'
  when lower({{ expr }}) like '%laptop%' then 'Notebook'
  when lower({{ expr }}) like '%desktop%' then 'Desktop'
  when lower({{ expr }}) like '%torre%' then 'Desktop'
  when lower({{ expr }}) like '%tablet%' then 'Tablet'
  when lower({{ expr }}) like '%ipad%' then 'Tablet'
  when lower({{ expr }}) like '%celular%' then 'Telefono'
  when lower({{ expr }}) like '%telefono%' then 'Telefono'
  when lower({{ expr }}) like '%monitor%' then 'Monitor'
  else initcap(trim({{ expr }}))
end
{%- endmacro %}

{% macro normalize_specs_storage_type(expr) -%}
case
  when {{ expr }} is null or trim({{ expr }}) = '' then null
  when lower({{ expr }}) like '%nvme%' then 'SSD'
  when lower({{ expr }}) like '%ssd%' then 'SSD'
  when lower({{ expr }}) like '%solid%' then 'SSD'
  when lower({{ expr }}) like '%hdd%' then 'HDD'
  when lower({{ expr }}) like '%sata%' then 'HDD'
  when lower({{ expr }}) like '%mecanic%' then 'HDD'
  when lower({{ expr }}) like '%emmc%' then 'eMMC'
  else null
end
{%- endmacro %}
