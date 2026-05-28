{{ config(materialized='view', tags=['marts', 'jira', 'mtr', 'reconciliation']) }}

with inventory as (
  select
    id_equipo,
    marca,
    modelo,
    fecha_compra,
    estado as inventario_estado,
    cliente_actual,
    persona_actual,
    condicion,
    sistema_operativo
  from {{ ref('stg_equipos_enriched') }}
),

mtr_current as (
  select
    id_equipo,
    estado_equipo as mtr_estado_equipo,
    persona_asignada,
    cliente,
    localizacion,
    ciudad_comuna,
    fecha_compra as mtr_fecha_compra,
    fecha_asignacion,
    mtr_assignment_source
  from {{ ref('stg_mtr_equipos_asignados') }}
),

mtr_events as (
  select
    id_equipo,
    max(fecha_evento) as mtr_last_event_at,
    (array_agg(upper(tipo_evento) order by fecha_evento desc nulls last))[1] as mtr_last_event_type,
    max(fecha_evento) filter (where upper(tipo_evento) = 'INGRESO') as mtr_last_ingreso_at,
    max(fecha_evento) filter (where upper(tipo_evento) = 'SALIDA') as mtr_last_salida_at,
    count(*) filter (where upper(tipo_evento) = 'INGRESO') as mtr_ingresos_total,
    count(*) filter (where upper(tipo_evento) = 'SALIDA') as mtr_salidas_total,
    count(*) filter (where upper(tipo_evento) = 'ASIGNACION') as mtr_asignaciones_total,
    count(*) filter (where upper(tipo_evento) = 'DEVOLUCION') as mtr_devoluciones_total,
    count(*) filter (where coalesce(es_cambio_equipo_real, false)) as mtr_cambios_equipo_real_total,
    count(*) filter (where coalesce(es_movimiento_interno_persona_cliente, false)) as mtr_movimientos_internos_total
  from {{ ref('int_mtr_eventos_dedup_stats') }}
  group by 1
),

jira as (
  select
    equipo_id as id_equipo,
    jira_events_total,
    jira_open_count,
    jira_created_count,
    jira_reserved_count,
    jira_assigned_count,
    jira_days_open_max,
    jira_last_event_ts,
    jira_last_open_event_ts,
    jira_issue_key_top,
    jira_issue_keys_open,
    jira_summary_top,
    jira_status_name_top,
    jira_status_category_name_top,
    jira_board_bucket_top,
    jira_estado_equipo_top,
    jira_project_key_top,
    jira_project_name_top,
    jira_reporter_display_name_top,
    jira_board_buckets_open
  from {{ ref('int_equipo_jira_rollup') }}
),

universe as (
  select id_equipo from inventory where id_equipo is not null
  union
  select id_equipo from mtr_current where id_equipo is not null
  union
  select id_equipo from mtr_events where id_equipo is not null
  union
  select id_equipo from jira where id_equipo is not null
),

joined as (
  select
    u.id_equipo,

    i.id_equipo is not null as in_inventario,
    c.id_equipo is not null as in_mtr_actual,
    e.id_equipo is not null as in_mtr_eventos,
    j.id_equipo is not null as in_jira,

    i.marca,
    i.modelo,
    i.fecha_compra,
    i.inventario_estado,
    i.cliente_actual,
    i.persona_actual,
    i.condicion,
    i.sistema_operativo,

    c.mtr_estado_equipo,
    c.persona_asignada,
    c.cliente as mtr_cliente,
    c.localizacion,
    c.ciudad_comuna,
    c.mtr_fecha_compra,
    c.fecha_asignacion,
    c.mtr_assignment_source,

    e.mtr_last_event_at,
    e.mtr_last_event_type,
    e.mtr_last_ingreso_at,
    e.mtr_last_salida_at,
    e.mtr_ingresos_total,
    e.mtr_salidas_total,
    e.mtr_asignaciones_total,
    e.mtr_devoluciones_total,
    e.mtr_cambios_equipo_real_total,
    e.mtr_movimientos_internos_total,

    j.jira_events_total,
    j.jira_open_count,
    j.jira_created_count,
    j.jira_reserved_count,
    j.jira_assigned_count,
    j.jira_days_open_max,
    j.jira_last_event_ts,
    j.jira_last_open_event_ts,
    j.jira_issue_key_top,
    j.jira_issue_keys_open,
    j.jira_summary_top,
    j.jira_status_name_top,
    j.jira_status_category_name_top,
    j.jira_board_bucket_top,
    j.jira_estado_equipo_top,
    j.jira_project_key_top,
    j.jira_project_name_top,
    j.jira_reporter_display_name_top,
    j.jira_board_buckets_open
  from universe u
  left join inventory i on i.id_equipo = u.id_equipo
  left join mtr_current c on c.id_equipo = u.id_equipo
  left join mtr_events e on e.id_equipo = u.id_equipo
  left join jira j on j.id_equipo = u.id_equipo
),

classified as (
  select
    *,
    coalesce(in_inventario, false) or coalesce(in_mtr_actual, false) or coalesce(in_mtr_eventos, false) as in_mtr,
    case
      when upper(coalesce(mtr_estado_equipo, '')) like '%ASIGN%' then 'ASIGNADO'
      when nullif(trim(coalesce(persona_asignada, '')), '') is not null then 'ASIGNADO'
      when upper(coalesce(mtr_estado_equipo, '')) like '%DISP%' then 'DISPONIBLE'
      when upper(coalesce(mtr_estado_equipo, '')) like '%STAND%' then 'STAND_BY'
      when upper(coalesce(mtr_estado_equipo, '')) like '%BAJA%' then 'BAJA'
      when upper(coalesce(mtr_last_event_type, '')) = 'SALIDA' then 'BAJA'
      when upper(coalesce(mtr_last_event_type, '')) = 'DEVOLUCION' then 'STAND_BY'
      when upper(coalesce(mtr_last_event_type, '')) = 'ASIGNACION' then 'ASIGNADO'
      when upper(coalesce(mtr_last_event_type, '')) = 'INGRESO' then 'DISPONIBLE'
      else null
    end as mtr_estado_operativo,
    case
      when upper(coalesce(mtr_estado_equipo, '')) like '%ASIGN%' then 'ASIGNADO'
      when nullif(trim(coalesce(persona_asignada, '')), '') is not null then 'ASIGNADO'
      when upper(coalesce(mtr_estado_equipo, '')) like '%DISP%' then 'DISPONIBLE'
      when upper(coalesce(mtr_estado_equipo, '')) like '%STAND%' then 'DISPONIBLE'
      when upper(coalesce(mtr_estado_equipo, '')) like '%BAJA%' then 'BAJA'
      when upper(coalesce(mtr_last_event_type, '')) = 'SALIDA' then 'BAJA'
      when upper(coalesce(mtr_last_event_type, '')) = 'DEVOLUCION' then 'DISPONIBLE'
      when upper(coalesce(mtr_last_event_type, '')) = 'ASIGNACION' then 'ASIGNADO'
      when upper(coalesce(mtr_last_event_type, '')) = 'INGRESO' then 'DISPONIBLE'
      else null
    end as mtr_estado_workflow_proxy
  from joined
),

final as (
  select
    id_equipo,
    in_inventario,
    in_mtr_actual,
    in_mtr_eventos,
    in_jira,
    in_mtr,
    marca,
    modelo,
    coalesce(fecha_compra, mtr_fecha_compra) as fecha_compra,
    inventario_estado,
    mtr_estado_equipo,
    mtr_estado_operativo,
    mtr_estado_workflow_proxy,
    cliente_actual,
    persona_actual,
    persona_asignada,
    mtr_cliente,
    localizacion,
    ciudad_comuna,
    fecha_asignacion,
    mtr_assignment_source,
    condicion,
    sistema_operativo,
    mtr_last_event_at,
    mtr_last_event_type,
    mtr_last_ingreso_at,
    mtr_last_salida_at,
    coalesce(mtr_ingresos_total, 0) as mtr_ingresos_total,
    coalesce(mtr_salidas_total, 0) as mtr_salidas_total,
    coalesce(mtr_asignaciones_total, 0) as mtr_asignaciones_total,
    coalesce(mtr_devoluciones_total, 0) as mtr_devoluciones_total,
    coalesce(mtr_cambios_equipo_real_total, 0) as mtr_cambios_equipo_real_total,
    coalesce(mtr_movimientos_internos_total, 0) as mtr_movimientos_internos_total,
    coalesce(jira_events_total, 0) as jira_events_total,
    coalesce(jira_open_count, 0) as jira_open_count,
    coalesce(jira_created_count, 0) as jira_created_count,
    coalesce(jira_reserved_count, 0) as jira_reserved_count,
    coalesce(jira_assigned_count, 0) as jira_assigned_count,
    jira_days_open_max,
    jira_last_event_ts,
    jira_last_open_event_ts,
    jira_issue_key_top,
    jira_issue_keys_open,
    jira_summary_top,
    jira_status_name_top,
    jira_status_category_name_top,
    jira_board_bucket_top,
    jira_estado_equipo_top,
    jira_project_key_top,
    jira_project_name_top,
    jira_reporter_display_name_top,
    jira_board_buckets_open,
    (
      coalesce(in_jira, false)
      and not coalesce(in_mtr, false)
    ) as flag_jira_sin_match_mtr,
    (
      coalesce(in_mtr, false)
      and not coalesce(in_jira, false)
    ) as flag_mtr_sin_match_jira,
    (
      upper(coalesce(jira_estado_equipo_top, '')) = 'RESERVADO'
      and upper(coalesce(mtr_estado_operativo, '')) = 'ASIGNADO'
    ) as flag_reservado_jira_asignado_mtr,
    (
      upper(coalesce(jira_estado_equipo_top, '')) = 'ASIGNADO'
      and upper(coalesce(mtr_estado_operativo, '')) in ('DISPONIBLE', 'STAND_BY')
    ) as flag_asignado_jira_disponible_mtr,
    (
      upper(coalesce(jira_estado_equipo_top, '')) = 'CREADO'
      and mtr_last_ingreso_at is null
    ) as flag_creado_jira_sin_ingreso_mtr,
    (
      upper(coalesce(jira_estado_equipo_top, '')) = 'ASIGNADO'
      and coalesce(mtr_estado_workflow_proxy, 'SIN_ESTADO') <> 'ASIGNADO'
    )
    or (
      upper(coalesce(jira_estado_equipo_top, '')) = 'RESERVADO'
      and upper(coalesce(mtr_estado_workflow_proxy, '')) = 'ASIGNADO'
    ) as flag_estado_distinto,
    (
      (
        upper(coalesce(jira_estado_equipo_top, '')) = 'ASIGNADO'
        and coalesce(mtr_estado_workflow_proxy, 'SIN_ESTADO') <> 'ASIGNADO'
      )
      or (
        upper(coalesce(jira_estado_equipo_top, '')) = 'RESERVADO'
        and upper(coalesce(mtr_estado_workflow_proxy, '')) = 'ASIGNADO'
      )
      or (
        coalesce(in_jira, false)
        and not coalesce(in_mtr, false)
      )
      or (
        upper(coalesce(jira_estado_equipo_top, '')) = 'CREADO'
        and mtr_last_ingreso_at is null
      )
    ) as flag_inconsistencia_mtr_jira,
    (
      (
        upper(coalesce(jira_estado_equipo_top, '')) = 'ASIGNADO'
        and coalesce(mtr_estado_workflow_proxy, 'SIN_ESTADO') <> 'ASIGNADO'
      )
      or (
        coalesce(in_mtr, false)
        and upper(coalesce(mtr_estado_workflow_proxy, '')) = 'ASIGNADO'
        and upper(coalesce(jira_estado_equipo_top, 'SIN_ESTADO')) not in ('ASIGNADO', 'RESERVADO')
      )
    ) as flag_asignado_sin_respaldo_cruzado,
    (
      upper(coalesce(jira_estado_equipo_top, '')) = 'RESERVADO'
      and not (
        upper(coalesce(jira_estado_equipo_top, '')) = 'RESERVADO'
        and upper(coalesce(mtr_estado_operativo, '')) = 'ASIGNADO'
      )
    ) as flag_reserva_jira_pendiente,
    case
      when (
        upper(coalesce(jira_estado_equipo_top, '')) = 'RESERVADO'
        and upper(coalesce(mtr_estado_operativo, '')) = 'ASIGNADO'
      ) then 'RESERVADO_JIRA_ASIGNADO_MTR'
      when (
        upper(coalesce(jira_estado_equipo_top, '')) = 'ASIGNADO'
        and upper(coalesce(mtr_estado_operativo, '')) in ('DISPONIBLE', 'STAND_BY')
      ) then 'ASIGNADO_JIRA_DISPONIBLE_MTR'
      when (
        upper(coalesce(jira_estado_equipo_top, '')) = 'CREADO'
        and mtr_last_ingreso_at is null
      ) then 'CREADO_JIRA_SIN_INGRESO_MTR'
      when (
        coalesce(in_jira, false)
        and not coalesce(in_mtr, false)
      ) then 'JIRA_SIN_MATCH_MTR'
      when (
        coalesce(in_mtr, false)
        and not coalesce(in_jira, false)
      ) then 'MTR_SIN_MATCH_JIRA'
      when (
        (
          upper(coalesce(jira_estado_equipo_top, '')) = 'ASIGNADO'
          and coalesce(mtr_estado_workflow_proxy, 'SIN_ESTADO') <> 'ASIGNADO'
        )
        or (
          upper(coalesce(jira_estado_equipo_top, '')) = 'RESERVADO'
          and upper(coalesce(mtr_estado_workflow_proxy, '')) = 'ASIGNADO'
        )
      ) then 'ESTADO_DISTINTO'
      when coalesce(in_jira, false) and coalesce(in_mtr, false) then 'CONCILIADO'
      when coalesce(in_jira, false) then 'JIRA_SOLO'
      when coalesce(in_mtr, false) then 'MTR_SOLO'
      else 'SIN_FUENTE'
    end as conciliacion_estado,
    case
      when coalesce(in_jira, false) and coalesce(in_mtr, false) then 'CONCILIADO'
      when coalesce(in_jira, false) then 'JIRA'
      when coalesce(in_mtr, false) then 'MTR'
      else 'SIN_FUENTE'
    end as origen_principal,
    case
      when coalesce(in_jira, false) and coalesce(in_mtr, false)
        then 'MTR conserva verdad operativa; Jira aporta workflow administrativo.'
      when coalesce(in_jira, false)
        then 'Equipo visible solo en Jira/EQUIPAMIENTO; aún sin respaldo operativo MTR.'
      when coalesce(in_mtr, false)
        then 'Equipo visible solo en MTR; falta trazabilidad administrativa Jira.'
      else 'Sin datos suficientes.'
    end as conciliacion_resumen,
    current_timestamp as _loaded_at
  from classified
)

select * from final
