from __future__ import annotations

from typing import Optional

import requests
import pandas as pd

API_BASE_URL = "http://localhost:8000"


def _get(path: str, params: dict | None = None) -> dict | list:
    url = f"{API_BASE_URL}{path}"
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_kpi_anual(anio_desde: int = 2022, anio_hasta: int = 2025) -> pd.DataFrame:
    """
    Devuelve DataFrame con KPIs anuales desde /hw/kpi/anual.
    """
    data = _get(
        "/hw/kpi/anual",
        params={"anio_desde": anio_desde, "anio_hasta": anio_hasta},
    )
    return pd.DataFrame(data)


def get_equipos_hw(
    anio_desde: int = 2022,
    anio_hasta: int = 2025,
    cliente: Optional[str] = None,
    pais: Optional[str] = None,
    estado: Optional[str] = None,
    tipo_equipo: Optional[str] = None,
    sku: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
) -> pd.DataFrame:
    """
    Devuelve DataFrame con equipos desde /hw/equipos.
    """
    params: dict = {
        "anio_desde": anio_desde,
        "anio_hasta": anio_hasta,
        "limit": limit,
        "offset": offset,
    }
    if cliente:
        params["cliente"] = cliente
    if pais:
        params["pais"] = pais
    if estado:
        params["estado"] = estado
    if tipo_equipo:
        params["tipo_equipo"] = tipo_equipo
    if sku:
        params["sku"] = sku

    data = _get("/hw/equipos", params=params)
    return pd.DataFrame(data)
