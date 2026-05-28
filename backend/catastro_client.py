# catastro_client.py
from __future__ import annotations

import math
from typing import Dict, List

import requests
import pandas as pd

API_BASE_URL = "http://localhost:8000"


def _get(path: str, params: dict | None = None) -> dict | list:
    url = f"{API_BASE_URL}{path}"
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


# ========= helpers comunes ==========

def norm_name(s: str) -> str:
    return " ".join(str(s).strip().lower().split())


# ========= wrappers equivalentes a tus funciones SQL ==========

def get_equipos_normalizados(tabla: str) -> pd.DataFrame:
    """
    Reemplaza a la función original que leía de Postgres.
    Llama a /catastro/equipos_normalizados.
    """
    data = _get("/catastro/equipos_normalizados", params={"tabla": tabla})
    return pd.DataFrame(data)


def get_resumen_equipo(tabla: str, clave_equipo: str, incluir_extra: bool = False) -> Dict:
    data = _get(
        "/catastro/resumen_equipo",
        params={
            "tabla": tabla,
            "clave_equipo": clave_equipo,
            "incluir_extra": incluir_extra,
        },
    )
    return data


def get_detalle_equipo(tabla: str, clave_equipo: str, por_renovar: bool = False) -> pd.DataFrame:
    data = _get(
        "/catastro/detalle_equipo",
        params={
            "tabla": tabla,
            "clave_equipo": clave_equipo,
            "por_renovar": por_renovar,
        },
    )
    return pd.DataFrame(data)


def get_team_sin_equipo() -> pd.DataFrame:
    data = _get("/catastro/team_sin_equipo")
    return pd.DataFrame(data)


def get_clientes_empresa() -> List[str]:
    data = _get("/catastro/clientes_empresa")
    return list(data)


def get_plan_2026() -> Dict:
    return _get("/catastro/plan_2026")
