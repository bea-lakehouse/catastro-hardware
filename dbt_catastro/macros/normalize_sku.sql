{% macro normalize_sku(expr) -%}
  (
    case
      when {{ expr }} is null then null
      else
        -- Extrae solo el número después de "SKU" con cualquier separador/espacios
        case
          when regexp_replace(upper({{ expr }}), '.*SKU[^0-9]*([0-9]+).*', '\1') ~ '^[0-9]+$'
            then 'SKU-' || regexp_replace(upper({{ expr }}), '.*SKU[^0-9]*([0-9]+).*', '\1')
          else null
        end
    end
  )
{%- endmacro %}
