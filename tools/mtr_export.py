from pathlib import Path
import pandas as pd
import re

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "MTR.xlsx"
OUT  = ROOT / "dbt_catastro" / "seeds"

if not XLSX.exists():
    raise SystemExit(f"No existe {XLSX}")

OUT.mkdir(parents=True, exist_ok=True)

# --- helpers ---
def slug(s: str) -> str:
    s = str(s).strip()
    s = s.lower()
    s = s.replace("á","a").replace("é","e").replace("í","i").replace("ó","o").replace("ú","u").replace("ñ","n")
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s

def clean_df(df: pd.DataFrame) -> pd.DataFrame:
    # elimina columnas Unnamed vacías y filas 100% vacías
    df = df.copy()
    df.columns = [slug(c) for c in df.columns]
    df = df.loc[:, [c for c in df.columns if not c.startswith("unnamed")]]
    df = df.dropna(how="all")
    return df

# Hojas que usas en dbt
SHEETS = {
    "Equipos Asignados": "mtr_equipos_asignados.csv",
    "Ingresos": "mtr_ingresos.csv",
    "Salidas": "mtr_salidas.csv",
    "Equipos disponibles": "mtr_equipos_disponibles.csv",
}

xl = pd.ExcelFile(XLSX)
missing = [s for s in SHEETS.keys() if s not in xl.sheet_names]
if missing:
    raise SystemExit(f"Faltan hojas en el MTR: {missing}. Hojas actuales: {xl.sheet_names}")

for sheet, fname in SHEETS.items():
    df = xl.parse(sheet)
    df = clean_df(df)
    out = OUT / fname
    df.to_csv(out, index=False)
    print(f"OK: {sheet} -> {out} ({len(df)} filas, {len(df.columns)} cols)")

print("\nListo. CSVs en dbt_catastro/seeds/")
