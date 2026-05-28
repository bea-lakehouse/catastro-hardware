from __future__ import annotations

import os
import re
from typing import Any, Iterable

SKU_RE = re.compile(r"\bSKU-\d+\b", re.IGNORECASE)


def normalize_equipo_id(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    match = SKU_RE.search(text)
    if match:
        return match.group(0).upper()

    return text.upper()


def _candidate_texts(value: Any) -> Iterable[str]:
    if value is None:
        return

    if isinstance(value, str):
        text = value.strip()
        if text:
            yield text
        return

    if isinstance(value, dict):
        for key in ("value", "name", "key", "displayName", "title"):
            inner = value.get(key)
            if isinstance(inner, str) and inner.strip():
                yield inner.strip()

        for inner in value.values():
            yield from _candidate_texts(inner)
        return

    if isinstance(value, list):
        for item in value:
            yield from _candidate_texts(item)
        return

    text = str(value).strip()
    if text:
        yield text


def extract_equipo_id_from_fields(fields: dict[str, Any] | None) -> str | None:
    fields = fields or {}

    custom_key = os.getenv("JIRA_EQUIPO_CUSTOMFIELD", "").strip()
    if custom_key:
        for candidate in _candidate_texts(fields.get(custom_key)):
            equipo_id = normalize_equipo_id(candidate)
            if equipo_id:
                return equipo_id

    for raw_label in fields.get("labels") or []:
        if not isinstance(raw_label, str):
            continue
        if raw_label.lower().startswith("equipo:"):
            equipo_id = normalize_equipo_id(raw_label.split(":", 1)[1])
            if equipo_id:
                return equipo_id
        equipo_id = normalize_equipo_id(raw_label)
        if equipo_id and equipo_id.startswith("SKU-"):
            return equipo_id

    summary = fields.get("summary")
    equipo_id = normalize_equipo_id(summary)
    if equipo_id and equipo_id.startswith("SKU-"):
        return equipo_id

    for key, value in fields.items():
        if not str(key).startswith("customfield_"):
            continue
        for candidate in _candidate_texts(value):
            equipo_id = normalize_equipo_id(candidate)
            if equipo_id and equipo_id.startswith("SKU-"):
                return equipo_id

    return None


def extract_status_category(fields: dict[str, Any] | None) -> tuple[str | None, str | None, str | None]:
    status = (fields or {}).get("status") or {}
    category = status.get("statusCategory") or {}

    category_id = category.get("id")
    category_id_text = str(category_id).strip() if category_id is not None else None

    return (
        category_id_text or None,
        (category.get("key") or None),
        (category.get("name") or None),
    )


def normalize_board_bucket(
    status_name: str | None,
    status_category_key: str | None = None,
    status_category_name: str | None = None,
) -> str | None:
    status = (status_name or "").strip().lower()
    category_key = (status_category_key or "").strip().lower()
    category_name = (status_category_name or "").strip().lower()

    if any(token in status for token in ("creado", "created")):
        return "CREADO"
    if any(token in status for token in ("por recuperar", "recuperar", "recovery")):
        return "POR_RECUPERAR"
    if "liberar" in status:
        return "POR_RECUPERAR"
    if any(token in status for token in ("resguardo", "resguardado")):
        return "RESGUARDO"
    if any(token in status for token in ("desperfect", "defectuoso", "defectuosa", "repair", "reparacion")):
        return "DEFECTUOSO"
    if any(token in status for token in ("descontinuad", "obsoleto", "obsolete", "legacy")):
        return "OBSOLETO"
    if any(token in status for token in ("baja", "dado de baja", "decom", "retired")):
        return "BAJA"
    if any(token in status for token in ("reservado", "reserva")):
        return "RESERVADO"
    if any(token in status for token in ("asignado", "assigned", "entregado")):
        return "ASIGNADO"
    if any(token in status for token in ("disponible", "available", "stock")):
        return "DISPONIBLE"

    if category_key == "done" or category_name == "done":
        return "CERRADO"
    if category_key == "indeterminate":
        return "EN_PROGRESO"
    if category_key == "new":
        return "PENDIENTE"

    return None
