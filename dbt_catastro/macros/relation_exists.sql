{% macro relation_exists(schema_name, identifier) %}
  {% set rel = adapter.get_relation(database=target.database, schema=schema_name, identifier=identifier) %}
  {{ return(rel is not none) }}
{% endmacro %}
