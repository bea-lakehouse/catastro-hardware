{% macro mtr_normalize_date_text(expr) -%}
nullif(
    regexp_replace(trim(coalesce(cast({{ expr }} as text), '')), '\s+', ' ', 'g'),
    ''
)
{%- endmacro %}

{% macro mtr_extract_date_token(expr) -%}
substring(
    {{ mtr_normalize_date_text(expr) }}
    from '([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}|[0-9]{1,2}-[0-9]{1,2}-[0-9]{4})'
)
{%- endmacro %}

{% macro mtr_parse_date(expr) -%}
{%- set clean = mtr_normalize_date_text(expr) -%}
{%- set token = mtr_extract_date_token(expr) -%}
{%- set slash_norm = "lpad(split_part(" ~ token ~ ", '/', 1), 2, '0') || '/' || lpad(split_part(" ~ token ~ ", '/', 2), 2, '0') || '/' || split_part(" ~ token ~ ", '/', 3)" -%}
{%- set dash_norm = "lpad(split_part(" ~ token ~ ", '-', 1), 2, '0') || '-' || lpad(split_part(" ~ token ~ ", '-', 2), 2, '0') || '-' || split_part(" ~ token ~ ", '-', 3)" -%}
case
    when {{ clean }} is null then null::date
    when {{ token }} is null then null::date
    when {{ token }} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         and split_part({{ token }}, '-', 1) like '0___'
        then null::date
    when {{ token }} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         and to_char(to_date({{ token }}, 'YYYY-MM-DD'), 'YYYY-MM-DD') = {{ token }}
        then to_date({{ token }}, 'YYYY-MM-DD')
    when {{ token }} ~ '^[0-9]{1,2}/[0-9]{1,2}/0[0-9]{3}$'
        then null::date
    when {{ token }} ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
         and split_part({{ token }}, '/', 1) ~ '^[0-9]+$'
         and split_part({{ token }}, '/', 2) ~ '^[0-9]+$'
         and split_part({{ token }}, '/', 2)::int > 12
         and to_char(to_date({{ slash_norm }}, 'MM/DD/YYYY'), 'MM/DD/YYYY') = {{ slash_norm }}
        then to_date({{ slash_norm }}, 'MM/DD/YYYY')
    when {{ token }} ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
         and split_part({{ token }}, '/', 1) ~ '^[0-9]+$'
         and split_part({{ token }}, '/', 2) ~ '^[0-9]+$'
         and to_char(to_date({{ slash_norm }}, 'DD/MM/YYYY'), 'DD/MM/YYYY') = {{ slash_norm }}
        then to_date({{ slash_norm }}, 'DD/MM/YYYY')
    when {{ token }} ~ '^[0-9]{1,2}-[0-9]{1,2}-0[0-9]{3}$'
        then null::date
    when {{ token }} ~ '^[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}$'
         and to_char(to_date({{ dash_norm }}, 'DD-MM-YYYY'), 'DD-MM-YYYY') = {{ dash_norm }}
        then to_date({{ dash_norm }}, 'DD-MM-YYYY')
    else null::date
end
{%- endmacro %}

{% macro mtr_parse_timestamp(expr) -%}
({{ mtr_parse_date(expr) }})::timestamp
{%- endmacro %}

{% macro mtr_date_parse_strategy(expr) -%}
{%- set clean = mtr_normalize_date_text(expr) -%}
{%- set token = mtr_extract_date_token(expr) -%}
{%- set parsed = mtr_parse_date(expr) -%}
case
    when {{ clean }} is null then null::text
    when {{ token }} is null then 'formato_fecha_no_reconocido'
    when {{ token }} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and {{ parsed }} is not null
        then case when {{ clean }} = {{ token }} then 'iso' else 'iso_timestamp' end
    when {{ token }} ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
         and split_part({{ token }}, '/', 2) ~ '^[0-9]+$'
         and split_part({{ token }}, '/', 2)::int > 12
         and {{ parsed }} is not null
        then 'slash_mm_dd'
    when {{ token }} ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' and {{ parsed }} is not null
        then 'slash_dd_mm'
    when {{ token }} ~ '^[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}$' and {{ parsed }} is not null
        then 'dash_dd_mm'
    when {{ token }} is not null and {{ parsed }} is null
        then 'fecha_invalida'
    else 'formato_fecha_no_reconocido'
end
{%- endmacro %}

{% macro mtr_date_parse_error(expr) -%}
{%- set clean = mtr_normalize_date_text(expr) -%}
{%- set token = mtr_extract_date_token(expr) -%}
{%- set parsed = mtr_parse_date(expr) -%}
case
    when {{ clean }} is null then 'fecha_evento_vacia'
    when {{ token }} is null then 'formato_fecha_no_reconocido'
    when {{ token }} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         and split_part({{ token }}, '-', 1) like '0___'
        then 'anio_mal_tipeado'
    when {{ token }} ~ '^[0-9]{1,2}/[0-9]{1,2}/0[0-9]{3}$'
        then 'anio_mal_tipeado'
    when {{ token }} ~ '^[0-9]{1,2}-[0-9]{1,2}-0[0-9]{3}$'
        then 'anio_mal_tipeado'
    when {{ parsed }} is null then 'fecha_invalida'
    else null
end
{%- endmacro %}

{% macro mtr_date_was_normalized(expr) -%}
{%- set clean = mtr_normalize_date_text(expr) -%}
{%- set parsed = mtr_parse_date(expr) -%}
case
    when {{ parsed }} is null then false
    when {{ clean }} = to_char({{ parsed }}, 'YYYY-MM-DD') then false
    else true
end
{%- endmacro %}
