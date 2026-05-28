from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict

from sqlalchemy import text

try:
    from backend.db.engine import engine
    from backend.data_access.audit import get_audit_log
    from backend.data_access.operacion import get_operacion_alertas
    from backend.routers.home import home_dashboard
except ImportError:
    from db.engine import engine
    from data_access.audit import get_audit_log
    from data_access.operacion import get_operacion_alertas
    from routers.home import home_dashboard


ROOT_DIR = Path(__file__).resolve().parents[2]
DDL_FILES = [
    ROOT_DIR / "backend" / "sql" / "003_create_ops_case_tracking.sql",
    ROOT_DIR / "backend" / "sql" / "004_create_ops_case_tracking_events.sql",
]
_TABLES_READY = False


TRACKING_STATUSES = {"PENDIENTE", "EN_REVISION", "RESUELTO", "ESCALADO", "DESCARTADO"}
TRACKING_VALIDATIONS = {"MANUAL", "VALIDADO_CRUCE", "REABIERTO"}


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _ensure_tables() -> None:
    global _TABLES_READY
    if _TABLES_READY:
        return
    with engine.begin() as conn:
        for path in DDL_FILES:
            conn.execute(text(path.read_text()))
    _TABLES_READY = True


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().lower().split())


def numeric(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def infer_owner(kind: str, source: str, title: str | None = None, summary: str | None = None, action: str | None = None) -> str:
    haystack = normalize_text(" ".join(filter(None, [source, title, summary, action])))
    if kind == "auditoria":
        return "Gobierno de dato"
    if kind == "conciliacion":
        return "Mesa de conciliación"
    if kind == "renovacion":
        return "Planeación y renovación"
    if kind == "salida" or any(word in haystack for word in ("baja", "obsole", "salida")):
        return "Lifecycle y bajas"
    if any(word in haystack for word in ("recuper", "resguardo", "devolucion")):
        return "Logística y recuperación"
    if any(word in haystack for word in ("defect", "desperfect", "repar")):
        return "Soporte y taller"
    if kind == "jira" or any(word in haystack for word in ("jira", "issue", "ticket")):
        return "Mesa Jira"
    if kind == "asignacion" or any(word in haystack for word in ("asign", "owner", "sin asignacion")):
        return "Operación TI / asignaciones"
    return "Operación TI"


def concrete_suggested_action(kind: str, source: str, title: str | None = None, summary: str | None = None, action: str | None = None) -> str:
    haystack = normalize_text(" ".join(filter(None, [source, title, summary, action])))
    if kind == "conciliacion":
        return "Corregir el estado maestro en Jira o MTR, dejar el cruce conciliado y validar evidencia cruzada antes del siguiente corte."
    if kind == "jira":
        if "reserv" in haystack:
            return "Actualizar o cerrar el issue Jira de reserva y dejar el bucket alineado con la realidad operativa."
        if "recuper" in haystack:
            return "Cerrar el pendiente Jira de recuperación solo después de confirmar retorno físico o resguardo regularizado."
        return "Cerrar o corregir el issue Jira y alinear bucket, estado y responsable con la operación visible."
    if kind == "asignacion":
        return "Asignar owner visible o reasignar el equipo en Activos, dejando respaldo cruzado en Jira si aplica."
    if kind == "renovacion":
        return "Programar renovación, confirmar reemplazo y dejar fecha de salida del equipo actual antes del siguiente ciclo."
    if kind == "salida":
        return "Ejecutar salida o baja formal, retirar el equipo del parque visible y cerrar su workflow administrativo asociado."
    if kind == "auditoria":
        return "Validar el cambio formal, confirmar trazabilidad y revisar si también requiere ajuste en operación o en Jira."
    if any(word in haystack for word in ("defect", "desperfect", "repar")):
        return "Validar la falla, definir reparación o baja y actualizar el estado operativo para evitar lecturas falsas."
    if any(word in haystack for word in ("recuper", "resguardo")):
        return "Recuperar físicamente el equipo o regularizar su resguardo, dejando el flujo administrativo alineado."
    return action.strip() if isinstance(action, str) and action.strip() else "Tomar el caso, validar evidencia y regularizarlo en la fuente operativa correspondiente."


def infer_severity_from_rank(rank: Any) -> str:
    normalized = numeric(rank or 9999)
    if normalized <= 10:
        return "CRITICA"
    if normalized <= 35:
        return "ALTA"
    if normalized <= 80:
        return "MEDIA"
    return "BAJA"


def severity_rank(value: str) -> int:
    upper = str(value or "").upper()
    if upper == "CRITICA":
        return 0
    if upper == "ALTA":
        return 1
    if upper == "MEDIA":
        return 2
    return 3


def build_client_directory(dashboard: dict[str, Any]) -> dict[str, str]:
    directory: dict[str, str] = {}
    for row in (dashboard.get("action_today") or {}).get("rows", []) or []:
        if row.get("id_equipo") and row.get("cliente"):
            directory[str(row["id_equipo"])] = str(row["cliente"])
    for row in (dashboard.get("planning") or {}).get("bolsa_acciones", []) or []:
        if row.get("id_equipo") and row.get("cliente") and str(row["id_equipo"]) not in directory:
            directory[str(row["id_equipo"])] = str(row["cliente"])
    for row in (((dashboard.get("integrations") or {}).get("jira") or {}).get("top_inconsistencias", []) or []):
        if row.get("id_equipo") and row.get("cliente") and str(row["id_equipo"]) not in directory:
            directory[str(row["id_equipo"])] = str(row["cliente"])
    return directory


def client_label(id_equipo: str, client_hint: Any, directory: dict[str, str]) -> str:
    return str(client_hint or directory.get(id_equipo) or "SIN_CLIENTE")


def build_action_cases(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for row in rows or []:
        action = str(row.get("accion_recomendada") or "Revisar")
        category = (
            "asignacion" if action == "Asignar o reasignar" else
            "renovacion" if action == "Renovar" else
            "salida" if action == "Salida / recambio" else
            "jira" if action == "Revisar Jira" else
            "alerta"
        )
        source = "Jira / Command Center" if action == "Revisar Jira" else "Command Center"
        summary = row.get("alertas_resumen") or row.get("priority_final_motivo") or "Caso priorizado para revisión hoy."
        cases.append({
            "case_key": f"action-{row.get('id_equipo')}-{action}",
            "case_type": category,
            "source_module": "home",
            "source_ref": str(row.get("id_equipo") or ""),
            "id_equipo": str(row.get("id_equipo") or ""),
            "cliente": str(row.get("cliente") or "SIN_CLIENTE"),
            "severity": "ALTA" if action == "Revisar Jira" else infer_severity_from_rank(row.get("priority_final_rank")),
            "source": source,
            "title": action,
            "summary": str(summary),
            "suggested_action": concrete_suggested_action(category, source, action, str(summary), action),
            "owner_sugerido": infer_owner(category, source, action, str(summary), action),
            "freshness": f"Prioridad {numeric(row.get('priority_final_rank'))}",
            "age_days": None,
            "status": row.get("estado_operativo"),
            "links": [
                {"href": f"/equipos/{row.get('id_equipo')}", "label": "Ficha"},
                {"href": f"/activos?q={row.get('id_equipo')}", "label": "Activos"},
            ],
        })
    return cases


def build_planning_cases(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for row in (rows or [])[:10]:
        action = str(row.get("accion") or "Revisar")
        category = "renovacion" if "renov" in normalize_text(action) else "salida" if "salida" in normalize_text(action) else "alerta"
        summary = row.get("motivo") or "Acción sugerida desde la bolsa corta de planeación."
        cases.append({
            "case_key": f"planning-{row.get('id_equipo')}-{action}",
            "case_type": category,
            "source_module": "planeacion",
            "source_ref": str(row.get("id_equipo") or ""),
            "id_equipo": str(row.get("id_equipo") or ""),
            "cliente": str(row.get("cliente") or "SIN_CLIENTE"),
            "severity": infer_severity_from_rank(row.get("priority_final_rank")),
            "source": "Planeación",
            "title": action,
            "summary": str(summary),
            "suggested_action": concrete_suggested_action(category, "PLANEACION", action, str(summary), action),
            "owner_sugerido": infer_owner(category, "PLANEACION", action, str(summary), action),
            "freshness": f"Prioridad {numeric(row.get('priority_final_rank'))}",
            "age_days": None,
            "status": None,
            "links": [
                {"href": "/planeacion-compra", "label": "Planeación"},
                {"href": f"/equipos/{row.get('id_equipo')}", "label": "Ficha"},
            ],
        })
    return cases


def build_mismatch_cases(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for row in (rows or [])[:8]:
        summary = f"Jira {row.get('jira_estado') or '—'} · MTR {row.get('mtr_estado') or '—'} · Estado {row.get('conciliacion_estado') or '—'}"
        cases.append({
            "case_key": f"mismatch-{row.get('id_equipo')}",
            "case_type": "conciliacion",
            "source_module": "integrations",
            "source_ref": str(row.get("id_equipo") or ""),
            "id_equipo": str(row.get("id_equipo") or ""),
            "cliente": str(row.get("cliente") or "SIN_CLIENTE"),
            "severity": "CRITICA",
            "source": "MTR/Jira",
            "title": "Brecha de conciliación",
            "summary": summary,
            "suggested_action": concrete_suggested_action("conciliacion", "MTR/JIRA", "Brecha de conciliación", summary, "Corregir conciliación"),
            "owner_sugerido": infer_owner("conciliacion", "MTR/JIRA", "Brecha de conciliación", summary, "Corregir conciliación"),
            "freshness": "Cruce administrativo vs operativo",
            "age_days": None,
            "status": row.get("conciliacion_estado"),
            "links": [
                {"href": f"/operacion?q={row.get('id_equipo')}", "label": "Operación"},
                {"href": f"/activos?q={row.get('id_equipo')}", "label": "Activos"},
            ],
        })
    return cases


def build_operacion_cases(rows: list[dict[str, Any]], client_directory: dict[str, str]) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for row in rows or []:
        kind = "conciliacion" if "inconsistencia" in normalize_text(row.get("tipo_alerta")) else "alerta"
        title = row.get("titulo") or row.get("tipo_alerta") or "Alerta operativa"
        summary = row.get("descripcion") or row.get("evidencia") or "Brecha operativa visible."
        source = str(row.get("origen") or "Operación")
        cases.append({
            "case_key": str(row.get("alert_id") or f"operacion-{row.get('id_equipo')}-{title}"),
            "case_type": kind,
            "source_module": "operacion",
            "source_ref": str(row.get("alert_id") or row.get("id_equipo") or ""),
            "id_equipo": str(row.get("id_equipo") or ""),
            "cliente": client_label(str(row.get("id_equipo") or ""), None, client_directory),
            "severity": str(row.get("criticidad") or "MEDIA").upper(),
            "source": source,
            "title": str(title),
            "summary": str(summary),
            "suggested_action": concrete_suggested_action(kind, source, str(title), str(summary), row.get("accion_sugerida")),
            "owner_sugerido": infer_owner(kind, source, str(title), str(summary), row.get("accion_sugerida")),
            "freshness": f"Detectada {str(row.get('fecha_detectada') or '')[:10]}" if row.get("fecha_detectada") else "Alerta abierta",
            "age_days": row.get("dias_abierta"),
            "status": row.get("confianza_dato"),
            "links": [
                {"href": f"/operacion?q={row.get('id_equipo')}", "label": "Operación"},
                {"href": f"/equipos/{row.get('id_equipo')}", "label": "Ficha"},
                {"href": f"/auditoria?q={row.get('id_equipo')}", "label": "Auditoría"},
            ],
        })
    return cases


def build_audit_cases(rows: list[dict[str, Any]], client_directory: dict[str, str]) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for row in rows or []:
        title = row.get("tipo_cambio") or "Cambio auditado"
        summary = f"{row.get('campo_modificado') or 'Campo'}: {row.get('valor_anterior') or '—'} → {row.get('valor_nuevo') or '—'}"
        source = f"Auditoría / {row.get('origen') or 'Sin origen'}"
        cases.append({
            "case_key": str(row.get("audit_id") or f"audit-{row.get('id_equipo')}-{title}"),
            "case_type": "auditoria",
            "source_module": "auditoria",
            "source_ref": str(row.get("audit_id") or row.get("id_equipo") or ""),
            "id_equipo": str(row.get("id_equipo") or ""),
            "cliente": client_label(str(row.get("id_equipo") or ""), None, client_directory),
            "severity": str(row.get("criticidad") or "MEDIA").upper(),
            "source": source,
            "title": str(title),
            "summary": summary,
            "suggested_action": concrete_suggested_action("auditoria", str(row.get("origen") or "AUDITORIA"), str(title), str(row.get("campo_modificado") or ""), "Validar cambio formal"),
            "owner_sugerido": infer_owner("auditoria", str(row.get("origen") or "AUDITORIA"), str(title), str(row.get("campo_modificado") or ""), "Validar cambio formal"),
            "freshness": f"Cambio {str(row.get('fecha_cambio') or '')[:10]}" if row.get("fecha_cambio") else "Cambio formal",
            "age_days": None,
            "status": row.get("confianza"),
            "links": [
                {"href": f"/auditoria?q={row.get('id_equipo')}", "label": "Auditoría"},
                {"href": f"/equipos/{row.get('id_equipo')}#auditoria", "label": "Ficha"},
            ],
        })
    return cases


def dedupe_cases(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    output: list[dict[str, Any]] = []
    for row in rows:
        key = f"{row.get('id_equipo')}::{row.get('case_type')}::{row.get('title')}"
        if key in seen:
            continue
        seen.add(key)
        output.append(row)
    return output


def sort_cases(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            severity_rank(str(row.get("severity") or "BAJA")),
            -(numeric(row.get("age_days")) if row.get("age_days") is not None else -1),
            str(row.get("id_equipo") or ""),
        ),
    )


def _base_cases() -> list[dict[str, Any]]:
    dashboard = home_dashboard()
    operacion = get_operacion_alertas(estado_alerta="ABIERTA", limit=80)
    auditoria = get_audit_log(criticidad="CRITICA", limit=30)
    client_directory = build_client_directory(dashboard)

    merged = dedupe_cases(
        build_operacion_cases(operacion.get("rows", []), client_directory)
        + build_mismatch_cases((((dashboard.get("integrations") or {}).get("jira") or {}).get("top_inconsistencias", [])) or [])
        + build_action_cases((((dashboard.get("action_today") or {}).get("rows", [])) or []))
        + build_planning_cases((((dashboard.get("planning") or {}).get("bolsa_acciones", [])) or []))
        + build_audit_cases(auditoria.get("rows", []), client_directory)
    )
    return sort_cases(merged)


def _tracking_map() -> dict[str, dict[str, Any]]:
    _ensure_tables()
    sql = """
    select *
    from ops.case_tracking
    """
    with engine.connect() as conn:
        rows = conn.execute(text(sql)).mappings().all()
    return {str(row["case_key"]): dict(row) for row in rows}


def _tracking_rows() -> list[dict[str, Any]]:
    _ensure_tables()
    with engine.connect() as conn:
        rows = conn.execute(text("select * from ops.case_tracking order by updated_at desc")).mappings().all()
    return [dict(row) for row in rows]


def _insert_validation_event(
    conn: Any,
    *,
    case_id: int,
    before_payload: dict[str, Any],
    after_payload: dict[str, Any],
    comment: str,
) -> None:
    _insert_event(
        conn,
        case_id=case_id,
        event_type="validation",
        actor="Catastro validation",
        before_payload=before_payload,
        after_payload=after_payload,
        comment=comment,
    )


def _reconcile_tracking_validation(base_rows: list[dict[str, Any]]) -> None:
    active_case_keys = {str(row.get("case_key")) for row in base_rows if row.get("case_key")}
    tracked_rows = _tracking_rows()
    if not tracked_rows:
        return

    with engine.begin() as conn:
        for tracked in tracked_rows:
            case_id = tracked.get("case_id")
            case_key = str(tracked.get("case_key") or "")
            estado = str(tracked.get("estado_seguimiento") or "").upper()
            current_validation = str(tracked.get("validacion_cierre") or "").upper() or None
            if not case_id or estado not in {"RESUELTO", "DESCARTADO"}:
                continue

            if case_key in active_case_keys:
                if estado == "DESCARTADO" or current_validation in {"VALIDADO_CRUCE", "MANUAL"}:
                    updated = dict(
                        conn.execute(
                            text(
                                """
                                update ops.case_tracking
                                set
                                  validacion_cierre = 'REABIERTO',
                                  estado_seguimiento = 'EN_REVISION',
                                  is_active = true,
                                  closed_at = null,
                                  updated_at = now()
                                where case_id = :case_id
                                returning *
                                """
                            ),
                            {"case_id": case_id},
                        ).mappings().one()
                    )
                    _insert_validation_event(
                        conn,
                        case_id=int(case_id),
                        before_payload=tracked,
                        after_payload=updated,
                        comment=
                            "El caso reapareció o siguió visible en la fuente activa después de haberse cerrado o descartado; Catastro lo reabrió automáticamente."
                            if estado == "DESCARTADO" or current_validation == "MANUAL"
                            else "El caso reapareció en la fuente activa después de haberse marcado como resuelto.",
                    )
                continue

            if estado == "RESUELTO" and current_validation != "VALIDADO_CRUCE":
                updated = dict(
                    conn.execute(
                        text(
                            """
                            update ops.case_tracking
                            set
                              validacion_cierre = 'VALIDADO_CRUCE',
                              updated_at = now()
                            where case_id = :case_id
                            returning *
                            """
                        ),
                        {"case_id": case_id},
                    ).mappings().one()
                )
                _insert_validation_event(
                    conn,
                    case_id=int(case_id),
                    before_payload=tracked,
                    after_payload=updated,
                    comment="El caso dejó de aparecer en la fuente activa y quedó validado por cruce.",
                )


def _overlay_tracking(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tracking = _tracking_map()
    output: list[dict[str, Any]] = []
    for row in rows:
        tracked = tracking.get(str(row["case_key"])) or {}
        current_status = str(tracked.get("estado_seguimiento") or "PENDIENTE")
        owner_real = tracked.get("owner_real")
        owner_sugerido = tracked.get("owner_sugerido") or row.get("owner_sugerido")
        output.append({
            **row,
            "case_id": tracked.get("case_id"),
            "owner_sugerido": owner_sugerido,
            "owner_real": owner_real,
            "owner_display": owner_real or owner_sugerido,
            "estado_seguimiento": current_status,
            "comentario_operativo": tracked.get("comentario_operativo"),
            "fecha_toma": tracked.get("fecha_toma"),
            "tracking_updated_at": tracked.get("updated_at"),
            "validacion_cierre": tracked.get("validacion_cierre"),
            "resolucion_tipo": tracked.get("resolucion_tipo"),
        })
    return output


def _matches_filter(row: dict[str, Any], *, q: str | None = None, owner: str | None = None, cliente: str | None = None, severidad: str | None = None, fuente: str | None = None, estado: str | None = None) -> bool:
    haystack = normalize_text(" ".join([
        str(row.get("id_equipo") or ""),
        str(row.get("title") or ""),
        str(row.get("summary") or ""),
        str(row.get("owner_display") or ""),
        str(row.get("cliente") or ""),
    ]))
    if q and normalize_text(q) not in haystack:
        return False
    if owner and normalize_text(owner) not in normalize_text(row.get("owner_display")):
        return False
    if cliente and normalize_text(cliente) not in normalize_text(row.get("cliente")):
        return False
    if fuente and normalize_text(fuente) not in normalize_text(row.get("source")):
        return False
    if severidad and str(row.get("severity") or "").upper() != severidad.upper():
        return False
    if estado and str(row.get("estado_seguimiento") or "").upper() != estado.upper():
        return False
    return True


def _group_summary(rows: list[dict[str, Any]], key_name: str) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        label = str(row.get(key_name) or "SIN_DATO")
        item = grouped.setdefault(
            label,
            {
                "label": label,
                "count": 0,
                "criticals": 0,
                "pendientes": 0,
                "en_revision": 0,
                "escalados": 0,
                "resueltos": 0,
                "cierres_manuales": 0,
                "reabiertos": 0,
            },
        )
        item["count"] += 1
        if str(row.get("severity") or "").upper() == "CRITICA":
            item["criticals"] += 1
        tracking_status = str(row.get("estado_seguimiento") or "").upper()
        validation_status = str(row.get("validacion_cierre") or "").upper()
        if tracking_status == "PENDIENTE":
            item["pendientes"] += 1
        if tracking_status == "EN_REVISION":
            item["en_revision"] += 1
        if tracking_status == "ESCALADO":
            item["escalados"] += 1
        if tracking_status == "RESUELTO":
            item["resueltos"] += 1
        if validation_status == "MANUAL":
            item["cierres_manuales"] += 1
        if validation_status == "REABIERTO":
            item["reabiertos"] += 1
    return sorted(grouped.values(), key=lambda item: (-item["count"], -item["criticals"], item["label"]))[:8]


def _build_tracked_only_rows(tracked_rows: list[dict[str, Any]], active_case_keys: set[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for tracked in tracked_rows:
        case_key = str(tracked.get("case_key") or "")
        if not case_key or case_key in active_case_keys:
            continue
        estado = str(tracked.get("estado_seguimiento") or "").upper()
        if estado not in {"RESUELTO", "DESCARTADO"}:
            continue
        rows.append(
            {
                "case_id": tracked.get("case_id"),
                "case_key": case_key,
                "case_type": str(tracked.get("case_type") or "seguimiento"),
                "source_module": str(tracked.get("source_module") or "ejecucion"),
                "source_ref": tracked.get("source_ref"),
                "id_equipo": str(tracked.get("id_equipo") or "SIN_EQUIPO"),
                "cliente": str(tracked.get("cliente") or "SIN_CLIENTE"),
                "severity": str(tracked.get("severity") or "MEDIA"),
                "source": f"Tracking / {tracked.get('source_module') or 'ejecucion'}",
                "title": "Caso cerrado",
                "summary": str(tracked.get("comentario_operativo") or "Caso retirado de la fuente activa y conservado para validación de cierre."),
                "suggested_action": "Validar si este cierre ya quedó comprobado por cruce o si requiere reapertura manual.",
                "owner_sugerido": str(tracked.get("owner_sugerido") or "SIN_OWNER"),
                "owner_real": tracked.get("owner_real"),
                "owner_display": tracked.get("owner_real") or tracked.get("owner_sugerido") or "SIN_OWNER",
                "estado_seguimiento": estado,
                "comentario_operativo": tracked.get("comentario_operativo"),
                "fecha_toma": tracked.get("fecha_toma"),
                "tracking_updated_at": tracked.get("updated_at"),
                "validacion_cierre": tracked.get("validacion_cierre"),
                "resolucion_tipo": tracked.get("resolucion_tipo"),
                "freshness": f"Cerrado {str(tracked.get('closed_at') or tracked.get('updated_at') or '')[:10]}",
                "age_days": None,
                "status": tracked.get("validacion_cierre"),
                "links": [
                    {"href": f"/ejecucion/{case_key}", "label": "Bitácora"},
                    {"href": f"/equipos/{tracked.get('id_equipo')}", "label": "Ficha"},
                ],
            }
        )
    return rows


def get_execution_queue(
    *,
    q: str | None = None,
    owner: str | None = None,
    cliente: str | None = None,
    severidad: str | None = None,
    fuente: str | None = None,
    estado: str | None = None,
    limit: int = 60,
) -> Dict[str, Any]:
    base_rows = _base_cases()
    _reconcile_tracking_validation(base_rows)
    tracked_rows = _tracking_rows()
    active_case_keys = {str(row.get("case_key")) for row in base_rows if row.get("case_key")}
    base = _overlay_tracking(base_rows)
    if estado and estado.upper() in {"RESUELTO", "DESCARTADO"}:
        base = base + _build_tracked_only_rows(tracked_rows, active_case_keys)
    visible = [
        row for row in base
        if _matches_filter(row, q=q, owner=owner, cliente=cliente, severidad=severidad, fuente=fuente, estado=estado)
    ]
    rows = visible[: max(1, min(int(limit), 1000))]
    today = datetime.now().date()
    resolved_today = 0
    resolution_hours: list[float] = []
    for tracked in tracked_rows:
        closed_at = _as_datetime(tracked.get("closed_at"))
        opened_at = _as_datetime(tracked.get("fecha_toma")) or _as_datetime(tracked.get("opened_at"))
        if closed_at and closed_at.date() == today:
            resolved_today += 1
        if closed_at and opened_at and closed_at >= opened_at:
            resolution_hours.append(round((closed_at - opened_at).total_seconds() / 3600, 2))

    kpis = {
        "total": len(visible),
        "criticas": sum(1 for row in visible if str(row.get("severity") or "").upper() == "CRITICA"),
        "pendientes": sum(1 for row in visible if str(row.get("estado_seguimiento") or "").upper() == "PENDIENTE"),
        "en_revision": sum(1 for row in visible if str(row.get("estado_seguimiento") or "").upper() == "EN_REVISION"),
        "escalados": sum(1 for row in visible if str(row.get("estado_seguimiento") or "").upper() == "ESCALADO"),
        "sin_owner_real": sum(1 for row in visible if not row.get("owner_real")),
        "resueltos_manuales": sum(1 for row in tracked_rows if str(row.get("validacion_cierre") or "").upper() == "MANUAL"),
        "validados_cruce": sum(1 for row in tracked_rows if str(row.get("validacion_cierre") or "").upper() == "VALIDADO_CRUCE"),
        "reabiertos": sum(1 for row in tracked_rows if str(row.get("validacion_cierre") or "").upper() == "REABIERTO"),
        "cierre_pendiente_validacion": sum(1 for row in tracked_rows if str(row.get("estado_seguimiento") or "").upper() == "RESUELTO" and str(row.get("validacion_cierre") or "").upper() == "MANUAL"),
        "resueltos_hoy": resolved_today,
        "tiempo_medio_resolucion_horas": round(sum(resolution_hours) / len(resolution_hours), 2) if resolution_hours else None,
    }
    return {
        "filters": {
            "q": q,
            "owner": owner,
            "cliente": cliente,
            "severidad": severidad,
            "fuente": fuente,
            "estado": estado,
            "limit": limit,
        },
        "kpis": kpis,
        "owners": _group_summary(visible, "owner_display"),
        "clients": _group_summary([row for row in visible if row.get("cliente") and row.get("cliente") != "SIN_CLIENTE"], "cliente"),
        "sources": _group_summary(visible, "source"),
        "count": len(rows),
        "total_visible": len(visible),
        "rows": rows,
    }


def get_execution_kpis() -> Dict[str, Any]:
    return get_execution_queue(limit=200).get("kpis", {})


def get_case_detail(case_key: str) -> Dict[str, Any]:
    base_rows = _base_cases()
    _reconcile_tracking_validation(base_rows)
    tracked_rows = _tracking_rows()
    active_case_keys = {str(item.get("case_key")) for item in base_rows if item.get("case_key")}
    all_rows = _overlay_tracking(base_rows) + _build_tracked_only_rows(tracked_rows, active_case_keys)
    row = next((item for item in all_rows if str(item.get("case_key")) == case_key), None)
    _ensure_tables()
    with engine.connect() as conn:
        tracking = conn.execute(
            text("select * from ops.case_tracking where case_key = :case_key limit 1"),
            {"case_key": case_key},
        ).mappings().first()
        events = []
        if tracking:
            events = [
                dict(item)
                for item in conn.execute(
                    text("select * from ops.case_tracking_events where case_id = :case_id order by created_at desc"),
                    {"case_id": tracking["case_id"]},
                ).mappings().all()
            ]
    return {"case": row, "tracking": dict(tracking) if tracking else None, "events": events}


def _upsert_case_base(case: dict[str, Any]) -> dict[str, Any]:
    _ensure_tables()
    sql = """
    insert into ops.case_tracking (
      case_key, case_type, source_module, source_ref, id_equipo, cliente, severity, owner_sugerido, last_seen_at
    ) values (
      :case_key, :case_type, :source_module, :source_ref, :id_equipo, :cliente, :severity, :owner_sugerido, now()
    )
    on conflict (case_key) do update set
      case_type = excluded.case_type,
      source_module = excluded.source_module,
      source_ref = excluded.source_ref,
      id_equipo = excluded.id_equipo,
      cliente = excluded.cliente,
      severity = excluded.severity,
      owner_sugerido = excluded.owner_sugerido,
      last_seen_at = now(),
      updated_at = case when ops.case_tracking.updated_at is null then now() else ops.case_tracking.updated_at end
    returning *
    """
    params = {
        "case_key": case["case_key"],
        "case_type": case["case_type"],
        "source_module": case["source_module"],
        "source_ref": case.get("source_ref"),
        "id_equipo": case.get("id_equipo"),
        "cliente": case.get("cliente"),
        "severity": case.get("severity") or "MEDIA",
        "owner_sugerido": case.get("owner_sugerido"),
    }
    with engine.begin() as conn:
        row = conn.execute(text(sql), params).mappings().one()
    return dict(row)


def _insert_event(conn: Any, *, case_id: int, event_type: str, actor: str | None, before_payload: dict[str, Any] | None, after_payload: dict[str, Any] | None, comment: str | None) -> None:
    conn.execute(
        text(
            """
            insert into ops.case_tracking_events (
              case_id, event_type, actor, before_payload, after_payload, comment
            ) values (
              :case_id, :event_type, :actor, cast(:before_payload as jsonb), cast(:after_payload as jsonb), :comment
            )
            """
        ),
        {
            "case_id": case_id,
            "event_type": event_type,
            "actor": actor,
            "before_payload": json.dumps(before_payload or {}, default=_json_default),
            "after_payload": json.dumps(after_payload or {}, default=_json_default),
            "comment": comment,
        },
    )


def mutate_case_tracking(
    *,
    case: dict[str, Any],
    action: str,
    actor: str | None = None,
    owner_real: str | None = None,
    estado_seguimiento: str | None = None,
    comentario_operativo: str | None = None,
) -> Dict[str, Any]:
    base = _upsert_case_base(case)
    case_id = int(base["case_id"])
    with engine.begin() as conn:
        before = dict(
            conn.execute(
                text("select * from ops.case_tracking where case_id = :case_id"),
                {"case_id": case_id},
            ).mappings().one()
        )

        patch_sql = """
        update ops.case_tracking
        set
          owner_real = coalesce(:owner_real, owner_real),
          estado_seguimiento = coalesce(:estado_seguimiento, estado_seguimiento),
          comentario_operativo = coalesce(:comentario_operativo, comentario_operativo),
          validacion_cierre = case
            when :estado_seguimiento = 'RESUELTO' then 'MANUAL'
            when :estado_seguimiento in ('PENDIENTE', 'EN_REVISION', 'ESCALADO', 'DESCARTADO') then null
            else validacion_cierre
          end,
          resolucion_tipo = case
            when :estado_seguimiento = 'RESUELTO' then 'MANUAL'
            else resolucion_tipo
          end,
          fecha_toma = case when :set_taken then coalesce(fecha_toma, now()) else fecha_toma end,
          closed_at = case
            when :estado_seguimiento in ('RESUELTO', 'DESCARTADO') then coalesce(closed_at, now())
            when :estado_seguimiento in ('PENDIENTE', 'EN_REVISION', 'ESCALADO') then null
            else closed_at
          end,
          is_active = case when :estado_seguimiento in ('RESUELTO', 'DESCARTADO') then false else true end,
          updated_at = now()
        where case_id = :case_id
        returning *
        """

        normalized_status = (estado_seguimiento or "").upper() or None
        if normalized_status and normalized_status not in TRACKING_STATUSES:
            normalized_status = "PENDIENTE"
        normalized_comment = " ".join(str(comentario_operativo or "").split())
        if normalized_status in {"ESCALADO", "DESCARTADO"} and not normalized_comment:
            raise ValueError(f"Debes dejar un motivo operativo antes de marcar el caso como {normalized_status}.")
        if action in {"take", "assign"}:
            normalized_status = normalized_status or "EN_REVISION"
        if action == "take":
            owner_real = owner_real or before.get("owner_real") or before.get("owner_sugerido")
        if action == "assign":
            owner_real = owner_real or before.get("owner_real") or before.get("owner_sugerido")
        row = conn.execute(
            text(patch_sql),
            {
                "case_id": case_id,
                "owner_real": owner_real,
                "estado_seguimiento": normalized_status,
                "comentario_operativo": normalized_comment if normalized_comment else None,
                "set_taken": action in {"take", "assign"},
            },
        ).mappings().one()
        after = dict(row)
        _insert_event(
            conn,
            case_id=case_id,
            event_type=action,
            actor=actor,
            before_payload=before,
            after_payload=after,
            comment=normalized_comment,
        )
    return {"tracking": after, "case_id": case_id}
