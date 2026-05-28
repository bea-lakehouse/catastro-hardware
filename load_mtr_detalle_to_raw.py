import os
import re
import pandas as pd
from sqlalchemy import create_engine

XLSX = os.environ.get("MTR_XLSX", "MTR_26_01_2026.xlsx")
DB_URL = os.environ.get("DATABASE_URL") or "postgresql+psycopg2://bea:<PASSWORD>@localhost:5432/ti_ops"

def norm_col(c: str) -> str:
    c = c.strip().lower()
    c = c.replace("á","a").replace("é","e").replace("í","i").replace("ó","o").replace("ú","u").replace("ñ","n")
    c = re.sub(r"\s+", "_", c)
    c = c.replace("__","_")
    return c

def load_sheet(path: str, sheet_name: str) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=sheet_name)
    df.columns = [norm_col(str(c)) for c in df.columns]
    return df

def ensure_bigint_sku(df: pd.DataFrame) -> pd.DataFrame:
    if "sku" in df.columns:
        df["sku"] = pd.to_numeric(df["sku"], errors="coerce").astype("Int64")
    return df

def main():
    path = os.path.join(os.getcwd(), XLSX)
    if not os.path.exists(path):
        raise SystemExit(f"No encuentro {path}. Ejecuta desde la carpeta Catastro o setea MTR_XLSX.")

    engine = create_engine(DB_URL)

    # Ajusta estos nombres EXACTOS de hoja si difieren en tu Excel
    SHEET_ASIG = os.environ.get("SHEET_ASIGNADOS", "equipos asignados")
    SHEET_DISP = os.environ.get("SHEET_DISPONIBLES", "equipos disponibles")

    asig = ensure_bigint_sku(load_sheet(path, SHEET_ASIG))
    disp = ensure_bigint_sku(load_sheet(path, SHEET_DISP))

    # Carga a raw (reemplaza completo cada vez: daily refresh)
    asig.to_sql("mtr_equipos_asignados_detalle", engine, schema="raw", if_exists="replace", index=False)
    disp.to_sql("mtr_equipos_disponibles", engine, schema="raw", if_exists="replace", index=False)

    print("OK: cargadas hojas a raw:")
    print(" - raw.mtr_equipos_asignados_detalle:", len(asig))
    print(" - raw.mtr_equipos_disponibles:", len(disp))

if __name__ == "__main__":
    main()
