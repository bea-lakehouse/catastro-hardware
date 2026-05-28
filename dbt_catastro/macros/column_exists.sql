{% macro column_exists(schema_name, identifier, column_name) %}
  {% set rel = adapter.get_relation(database=target.database, schema=schema_name, identifier=identifier) %}
  {% if rel is none %}
    {{ return(false) }}
  {% endif %}

  {% set cols = adapter.get_columns_in_relation(rel) %}
  {% for c in cols %}
    {% if (c.name | lower) == (column_name | lower) %}
      {{ return(true) }}
    {% endif %}
  {% endfor %}

  {{ return(false) }}
{% endmacro %}
