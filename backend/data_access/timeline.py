from typing import Any, Dict, List

from sqlalchemy import text

try:
    from backend.db import engine  # type: ignore
except Exception:
    from db.engine import engine  # type: ignore

SQL_TIMELINE_MART = """
select
  row_number() over (order by t.fecha_evento desc)::text as id_evento,
  t.id_equipo::text as equipo_id,
  t.tipo_evento::text as tipo_evento,
  t.fecha_evento::timestamptz as fecha_evento,
  t.detalle::text as detalle_evento,
  null::text as usuario_evento,
  coalesce(nullif(trim(t.badge_tipo), ''), 'mtr')::text as origen_evento,
  t.detalle_titulo::text as detalle_titulo,
  t.detalle_subtitulo::text as detalle_subtitulo,
  t.badge_tipo::text as badge_tipo
from analytics.mart_timeline_eventos t
where t.id_equipo = :id_equipo
order by t.fecha_evento desc
limit :limit
"""
def _normalize_timeline_row(r: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normaliza para UI + agrega fallback derivado (por si alguna fila viene sin titulo/subtitulo/badge).
    """
    historia_id = r.get("historia_id") or r.get("id_evento") or r.get("id")
    equipo_id = r.get("equipo_id") or r.get("id_equipo") or r.get("idEquipo") or r.get("equipo")
    tipo_evento = r.get("tipo_evento") or r.get("tipo") or ""
    fecha_evento = r.get("fecha_evento") or r.get("fecha") or r.get("at")
    detalle_evento = r.get("detalle_evento") or r.get("detalle") or ""
    usuario_evento = r.get("usuario_evento") or r.get("usuario") or None
    origen = str((r or {}).get("origen_evento") or "mtr").strip().lower()

    out = dict(r)
    out.update(
        {
            "historia_id": historia_id,
            "equipo_id": str(equipo_id) if equipo_id is not None else None,
            "tipo_evento": tipo_evento,
            "fecha_evento": fecha_evento,
            "detalle_evento": detalle_evento,
            "usuario_evento": usuario_evento,
            "origen_evento": origen,
            "detalle_titulo": (r.get("detalle_titulo") or None),
            "detalle_subtitulo": (r.get("detalle_subtitulo") or None),
            "badge_tipo": (r.get("badge_tipo") or None),
        }
    )

    # Fallback UI derivado (barato)
    tt = (out.get("detalle_titulo") or "").strip()
    ts = (out.get("detalle_subtitulo") or "").strip()
    bt = (out.get("badge_tipo") or "").strip()

    tipo = str(out.get("tipo_evento") or "").strip().upper()

    # umbral "evento antiguo": >=365 días
    antiguo = False
    try:
        from datetime import date

        fe = out.get("fecha_evento")
        fe_date = fe.date() if hasattr(fe, "date") else None
        antiguo = bool(fe_date and (date.today() - fe_date).days >= 365)
    except Exception:
        antiguo = False

    if not tt:
        if tipo == "INGRESO":
            tt = "📦 Ingreso a inventario"
            ts = ts or "Alta inicial del equipo"
            bt = bt or "gris"
        elif tipo in ("SALIDA", "ASIGNACION", "ASIGNACION_ACTUAL"):
            if antiguo:
                tt = "⏰ Evento antiguo"
                ts = ts or "Impacta rotación"
                bt = bt or "tenue"
            else:
                tt = "🔁 Cambio de responsable"
                ts = ts or "Movimiento estándar"
                bt = bt or "naranja"
        else:
            tt = "👤 Movimiento"
            ts = ts or "Evento operativo"
            bt = bt or "gris"

    out["detalle_titulo"] = tt
    out["detalle_subtitulo"] = ts
    out["badge_tipo"] = bt

    return out


def _count_sources(rows: List[Dict[str, Any]]) -> Dict[str, int]:
    out = {"mtr": 0, "jira": 0, "otro": 0}
    for r in rows or []:
        o = str((r or {}).get("origen_evento") or "mtr").strip().lower()
        if o == "jira":
            out["jira"] += 1
        elif o == "mtr":
            out["mtr"] += 1
        else:
            out["otro"] += 1
    return out


def get_equipo_timeline(id_equipo: str, limit: int = 200) -> Dict[str, Any]:
    """
    Timeline robusto:
    - Lee SOLO analytics.mart_timeline_eventos (dbt)
    - Nunca devuelve 500 text/plain: siempre JSON estable
    - Jira entra por dbt snapshots para evitar cruces ambiguos issue_key/id_equipo
    """
    limit = max(1, min(int(limit), 1000))

    result: Dict[str, Any] = {
        "id_equipo": id_equipo,
        "limit": limit,
        "count": 0,
        "rows": [],
        "sources": {"mtr": 0, "jira": 0, "otro": 0},
    }

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text(SQL_TIMELINE_MART),
                {"id_equipo": id_equipo, "limit": limit},
            ).mappings().all()

        base_rows: List[Dict[str, Any]] = [_normalize_timeline_row(dict(r)) for r in (rows or [])]
        result["rows"] = base_rows
        result["count"] = len(base_rows)

        result["sources"] = _count_sources(result.get("rows", []))
        return result

    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
        return result
