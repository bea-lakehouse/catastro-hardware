from __future__ import annotations

import json
import os
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

from google.auth.transport.requests import AuthorizedSession
from google.oauth2.service_account import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def _load_credentials() -> Credentials:
    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    json_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()

    if raw_json:
        info = json.loads(raw_json)
        return Credentials.from_service_account_info(info, scopes=SCOPES)

    if json_file:
        return Credentials.from_service_account_file(json_file, scopes=SCOPES)

    raise RuntimeError(
        "Faltan credenciales Google. Define GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_FILE."
    )


def _authorized_session() -> AuthorizedSession:
    return AuthorizedSession(_load_credentials())


def get_spreadsheet_id() -> str:
    spreadsheet_id = os.getenv("MTR_GOOGLE_SPREADSHEET_ID", "").strip()
    if not spreadsheet_id:
        raise RuntimeError("Falta MTR_GOOGLE_SPREADSHEET_ID.")
    return spreadsheet_id


def get_configured_ranges() -> dict[str, str]:
    raw = os.getenv("MTR_GOOGLE_SHEET_RANGES", "").strip()
    if not raw:
        return {
            "equipos_asignados": "Equipos Asignados!A:ZZ",
            "equipos_disponibles": "Equipos disponibles!A:ZZ",
            "ingresos": "Ingresos!A:ZZ",
            "salidas": "Salidas!A:ZZ",
        }

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("MTR_GOOGLE_SHEET_RANGES debe ser JSON válido.") from exc

    if not isinstance(parsed, Mapping) or not parsed:
        raise RuntimeError("MTR_GOOGLE_SHEET_RANGES debe ser un objeto JSON no vacío.")

    result: dict[str, str] = {}
    for key, value in parsed.items():
        name = str(key).strip()
        sheet_range = str(value).strip()
        if name and sheet_range:
            result[name] = sheet_range

    if not result:
        raise RuntimeError("MTR_GOOGLE_SHEET_RANGES no contiene rangos utilizables.")
    return result


def fetch_sheet_range(spreadsheet_id: str, sheet_range: str) -> dict[str, Any]:
    session = _authorized_session()
    encoded_spreadsheet_id = quote(spreadsheet_id, safe="")
    encoded_range = quote(sheet_range, safe="!:'(),")
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{encoded_spreadsheet_id}"
        f"/values/{encoded_range}"
    )
    response = session.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def rows_from_values(values: list[list[Any]]) -> list[dict[str, Any]]:
    if not values:
        return []

    headers = [str(v).strip() or f"column_{idx + 1}" for idx, v in enumerate(values[0])]
    rows: list[dict[str, Any]] = []
    for row in values[1:]:
        item: dict[str, Any] = {}
        for idx, header in enumerate(headers):
            cell = row[idx] if idx < len(row) else None
            item[header] = cell
        rows.append(item)
    return rows
