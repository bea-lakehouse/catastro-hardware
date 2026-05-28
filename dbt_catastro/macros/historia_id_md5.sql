{% macro historia_id_md5(a='') -%}
  {%- set p = (a ~ '.') if (a | length) > 0 else '' -%}
  md5(
    concat_ws(
      '|',
      coalesce({{ p }}origen_evento,''),
      coalesce({{ p }}id_equipo,''),
      coalesce({{ p }}fecha_evento::text,''),
      coalesce(upper(trim({{ p }}tipo_evento)),''),
      coalesce(trim({{ p }}persona),''),
      coalesce(trim({{ p }}serial),''),
      coalesce(trim({{ p }}detalle_evento),''),
      coalesce(trim({{ p }}problema_detectado),''),
      coalesce(trim({{ p }}reparacion_realizada),''),
      coalesce(trim({{ p }}comentario),'')
    )
  )
{%- endmacro %}
