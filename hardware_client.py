import requests
import pandas as pd

API_URL = "http://localhost:8000"

# --------------------------
# Manejo seguro de requests
# --------------------------
def _get(path: str, params: dict | None = None):
    url = f"{API_URL}{path}"
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as e:
        print(f"[ERROR HTTP] {e} → {url}")
        return None
    except Exception as e:
        print(f"[ERROR REQUEST] {e} → {url}")
        return None


# --------------------------
# GET → /hw/equipos
# --------------------------
def get_equipos_hw(anio_desde=2022, anio_hasta=2025, limit=5000):
    params = {
        "anio_desde": anio_desde,
        "anio_hasta": anio_hasta,
        "limit": limit,
        "offset": 0,
    }
    data = _get("/hw/equipos", params)
    if not data:
        return pd.DataFrame()

    df = pd.DataFrame(data)

    # --- Normalización ---
    if "sku" in df.columns:
        df["sku"] = pd.to_numeric(df["sku"], errors="coerce").astype("Int64")

    return df


# --------------------------
# GET → /hw/historia
# --------------------------
def get_historia_hw(
    sku: int | None = None,
    nro_serie: str | None = None,
    asset_tag: str | None = None,
):
    params = {}

    if sku:
        params["sku"] = int(sku)

    if nro_serie:
        params["nro_serie"] = nro_serie.strip()

    if asset_tag:
        params["asset_tag"] = asset_tag.strip()

    data = _get("/hw/historia", params=params)
    if not data:
        return pd.DataFrame()

    df = pd.DataFrame(data)

    # Normalizar SKU
    if "sku" in df.columns:
        df["sku"] = pd.to_numeric(df["sku"], errors="coerce").astype("Int64")

    return df


# --------------------------
# GET → /hw/estado_actual
# --------------------------
def get_estado_actual_hw(
    sku: int | None = None,
    nro_serie: str | None = None,
    asset_tag: str | None = None,
):
    params = {}

    if sku:
        params["sku"] = int(sku)

    if nro_serie:
        params["nro_serie"] = nro_serie.strip()

    if asset_tag:
        params["asset_tag"] = asset_tag.strip()

    data = _get("/hw/estado_actual", params=params)
    if not data:
        return pd.DataFrame()

    df = pd.DataFrame(data)

    if "sku" in df.columns:
        df["sku"] = pd.to_numeric(df["sku"], errors="coerce").astype("Int64")

    return df
