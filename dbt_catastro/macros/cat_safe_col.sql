{% macro cat_safe_col(relation, alias, colname) -%}
  {%- set cols = adapter.get_columns_in_relation(relation) -%}
  {%- set names = cols | map(attribute='name') | list -%}
  {%- if colname in names -%}
    {{ alias }}.{{ colname }} as {{ colname }}
  {%- else -%}
    null as {{ colname }}
  {%- endif -%}
{%- endmacro %}
