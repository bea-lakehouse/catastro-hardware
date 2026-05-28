create schema if not exists ops;

create table if not exists ops.case_tracking (
  case_id bigserial primary key,
  case_key text not null unique,
  case_type text not null,
  source_module text not null,
  source_ref text null,
  id_equipo text null,
  cliente text null,
  severity text not null default 'MEDIA',
  owner_sugerido text null,
  owner_real text null,
  estado_seguimiento text not null default 'PENDIENTE',
  fecha_toma timestamptz null,
  comentario_operativo text null,
  resolucion_tipo text null,
  validacion_cierre text null,
  is_active boolean not null default true,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null,
  last_seen_at timestamptz not null default now()
);

create index if not exists ix_case_tracking_estado
  on ops.case_tracking(estado_seguimiento, severity, updated_at desc);

create index if not exists ix_case_tracking_owner
  on ops.case_tracking(owner_real, owner_sugerido, updated_at desc);

create index if not exists ix_case_tracking_equipo
  on ops.case_tracking(id_equipo, updated_at desc);
