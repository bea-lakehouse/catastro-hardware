{% macro anti_ghost_filter(a='') -%}
  {%- set p = (a ~ '.') if (a | length) > 0 else '' -%}
  {{ p }}id_equipo is not null
  and nullif(trim({{ p }}id_equipo),'') is not null
  and {{ p }}fecha_evento is not null
  and nullif(trim({{ p }}tipo_evento),'') is not null
  and nullif(trim({{ p }}persona),'') is not null
{%- endmacro %}
