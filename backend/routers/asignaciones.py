from datetime import date
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

try:
    from backend.db.engine import get_engine
except ImportError:
    from db.engine import get_engine

router = APIRouter(prefix="/estadisticas", tags=["estadisticas"])
engine = get_engine()

# Fuente de verdad (import CSV). Nombre con puntos => SIEMPRE entre comillas.
SRC = 'analytics."mtr_equipos_asignados.csv.from_MTR0602"'


@router.get("/asignaciones-detalle-mes")
def asignaciones_detalle_mes(
    mes: date,
    limit: int = Query(500, ge=1, le=2000),
):
    """
    Asignaciones por mes desde fuente de verdad (MTR0602).
    Campos clave:
      - persona: "Empleado Asignado"
      - cliente: "Cliente"
      - sku: "SKU" (int) -> id_equipo = 'SKU-'||sku para calzar con stg_equipos
      - fecha_asignacion: parse robusto desde "Fecha de Asignación" (text) con fallback "#1" (timestamp)
    Enrich:
      - sistema_operativo / condicion desde fuente, con fallback stg_equipos.
      - os_familia (mac/win)
      - es_nuevo
    """

    sql = rf"""
      with raw as (
        select
          nullif(trim("Empleado Asignado"), '') as persona,
          nullif(trim("Cliente"), '') as cliente_evento,
          "SKU"::int as sku_int,

          -- fecha (primaria): "Fecha de Asignación" viene como text (puede ser '' o formatos distintos)
          nullif(regexp_replace(trim("Fecha de Asignación"), '\s+', ' ', 'g'), '') as fecha_asig_txt,

          -- fallback: algunas filas tienen "Fecha de Asignación #1" como timestamp
          "Fecha de Asignación #1" as fecha_asig_ts,

          nullif(trim("Sistema Operativo"), '') as sistema_operativo_src,
          nullif(trim("Condición"), '') as condicion_src,

          nullif(trim("Marca"), '') as marca_src,
          nullif(trim("Modelo"), '') as modelo_src,
          nullif(trim("Nro Serie"), '') as nro_serie_src,
          nullif(trim("Estatus del Equipo"), '') as estatus_equipo_src

        from {SRC}
        where "SKU" is not null
      ),
      tokenized as (
        select
          *,
          substring(
            fecha_asig_txt
            from '([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}|[0-9]{1,2}-[0-9]{1,2}-[0-9]{4})'
          ) as fecha_asig_token
        from raw
      ),

      norm as (
        select
          persona,
          cliente_evento,
          sku_int,

          -- id_equipo normalizado para joins internos
          ('SKU-' || sku_int::text) as id_equipo,

          -- parse fecha_asignacion:
          case
            when fecha_asig_ts is not null then fecha_asig_ts::date
            when fecha_asig_token ~ '^\d{4}-\d{2}-\d{2}$'
                 and to_char(to_date(fecha_asig_token, 'YYYY-MM-DD'), 'YYYY-MM-DD') = fecha_asig_token
              then to_date(fecha_asig_token, 'YYYY-MM-DD')
            when fecha_asig_token ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                 and split_part(fecha_asig_token, '/', 2)::int > 12
                 and to_char(
                   to_date(
                     lpad(split_part(fecha_asig_token, '/', 1), 2, '0') || '/' ||
                     lpad(split_part(fecha_asig_token, '/', 2), 2, '0') || '/' ||
                     split_part(fecha_asig_token, '/', 3),
                     'MM/DD/YYYY'
                   ),
                   'MM/DD/YYYY'
                 ) = lpad(split_part(fecha_asig_token, '/', 1), 2, '0') || '/' ||
                     lpad(split_part(fecha_asig_token, '/', 2), 2, '0') || '/' ||
                     split_part(fecha_asig_token, '/', 3)
              then to_date(
                lpad(split_part(fecha_asig_token, '/', 1), 2, '0') || '/' ||
                lpad(split_part(fecha_asig_token, '/', 2), 2, '0') || '/' ||
                split_part(fecha_asig_token, '/', 3),
                'MM/DD/YYYY'
              )
            when fecha_asig_token ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                 and to_char(
                   to_date(
                     lpad(split_part(fecha_asig_token, '/', 1), 2, '0') || '/' ||
                     lpad(split_part(fecha_asig_token, '/', 2), 2, '0') || '/' ||
                     split_part(fecha_asig_token, '/', 3),
                     'DD/MM/YYYY'
                   ),
                   'DD/MM/YYYY'
                 ) = lpad(split_part(fecha_asig_token, '/', 1), 2, '0') || '/' ||
                     lpad(split_part(fecha_asig_token, '/', 2), 2, '0') || '/' ||
                     split_part(fecha_asig_token, '/', 3)
              then to_date(
                lpad(split_part(fecha_asig_token, '/', 1), 2, '0') || '/' ||
                lpad(split_part(fecha_asig_token, '/', 2), 2, '0') || '/' ||
                split_part(fecha_asig_token, '/', 3),
                'DD/MM/YYYY'
              )
            when fecha_asig_token ~ '^\d{1,2}-\d{1,2}-\d{4}$'
                 and to_char(
                   to_date(
                     lpad(split_part(fecha_asig_token, '-', 1), 2, '0') || '-' ||
                     lpad(split_part(fecha_asig_token, '-', 2), 2, '0') || '-' ||
                     split_part(fecha_asig_token, '-', 3),
                     'DD-MM-YYYY'
                   ),
                   'DD-MM-YYYY'
                 ) = lpad(split_part(fecha_asig_token, '-', 1), 2, '0') || '-' ||
                     lpad(split_part(fecha_asig_token, '-', 2), 2, '0') || '-' ||
                     split_part(fecha_asig_token, '-', 3)
              then to_date(
                lpad(split_part(fecha_asig_token, '-', 1), 2, '0') || '-' ||
                lpad(split_part(fecha_asig_token, '-', 2), 2, '0') || '-' ||
                split_part(fecha_asig_token, '-', 3),
                'DD-MM-YYYY'
              )
            else null
          end as fecha_asignacion,

          sistema_operativo_src,
          condicion_src,
          marca_src,
          modelo_src,
          nro_serie_src,
          estatus_equipo_src
        from tokenized
      ),

      fil as (
        select *
        from norm
        where date_trunc('month', fecha_asignacion)::date
              = date_trunc('month', cast(:mes as date))::date
      )

      select
        f.fecha_asignacion as fecha_evento,
        f.persona,
        f.cliente_evento,

        f.id_equipo as equipo_asignado_actual,
        f.sku_int as sku,

        -- preferimos la fuente, si viene vacía usamos stg_equipos
        coalesce(f.sistema_operativo_src, eq.sistema_operativo, '') as sistema_operativo,
        coalesce(f.condicion_src, eq.condicion, '') as condicion_equipo,

        -- enrich adicional
        coalesce(eq.marca, f.marca_src, '') as marca,
        coalesce(eq.modelo, f.modelo_src, '') as modelo,

        case
          when lower(coalesce(f.sistema_operativo_src, eq.sistema_operativo, '')) like '%mac%' then 'mac'
          when lower(coalesce(eq.marca, f.marca_src, '')) like '%apple%' then 'mac'
          when lower(coalesce(f.sistema_operativo_src, eq.sistema_operativo, '')) like '%windows%' then 'win'
          else ''
        end as os_familia,

        (lower(coalesce(f.condicion_src, eq.condicion, '')) like '%nuevo%') as es_nuevo,

        coalesce(f.estatus_equipo_src, '') as estatus_equipo

      from fil f
      left join analytics.stg_equipos eq
        on eq.id_equipo = regexp_replace(f.id_equipo, '^SKU-', '')
           or ('SKU-' || eq.id_equipo) = f.id_equipo
           or eq.id_equipo = f.id_equipo

      order by f.fecha_asignacion asc nulls last, f.persona asc, f.id_equipo asc
      limit :limit
    """

    try:
        with engine.connect() as c:
            rows = c.execute(text(sql), {"mes": mes, "limit": limit}).mappings().all()
        return {"mes": str(mes), "limit": limit, "count": len(rows), "data": rows}
    except SQLAlchemyError as e:
        return {"mes": str(mes), "limit": limit, "count": 0, "data": [], "error": "db_error", "detail": str(e)}
