import pandas as pd
from pathlib import Path

BASE = Path("/Users/bea/Desktop/Catastro/dbt_catastro")
XLSX = BASE / "seeds" / "Reparados.xlsx"
OUT  = BASE / "seeds" / "reparaciones_raw.csv"

df = pd.read_excel(XLSX, sheet_name=0, header=None)

# Fila 2 (index=1) trae los headers reales en tu excel
headers = df.iloc[1].tolist()
data = df.iloc[2:].copy()
data.columns = headers

data.columns = [str(c).strip() for c in data.columns]

rename_map = {
    "SKU": "sku",
    "N° Serie": "serial",
    "Usuario": "usuario",
    "Problema Detectado": "problema_detectado",
    "Reparación Realizada": "reparacion_realizada",
    "Reparación Realizada ": "reparacion_realizada",
    "Encargado de Reparación": "encargado",
    "Fecha de Reparación": "fecha_reparacion",
    "Comentario": "comentario",
}
data = data.rename(columns={k.strip(): v for k, v in rename_map.items()})

keep = ["sku","serial","usuario","problema_detectado","reparacion_realizada","encargado","fecha_reparacion","comentario"]
for c in keep:
    if c not in data.columns:
        data[c] = None

def nonempty(x) -> bool:
    if x is None:
        return False
    s = str(x).strip()
    return s != "" and s.lower() != "nan"

mask = (
    data["problema_detectado"].apply(nonempty)
    | data["reparacion_realizada"].apply(nonempty)
    | data["encargado"].apply(nonempty)
    | data["fecha_reparacion"].notna()
    | data["comentario"].apply(nonempty)
)

out = data.loc[mask, keep].copy()

# sku como entero si se puede
out["sku"] = pd.to_numeric(out["sku"], errors="coerce").astype("Int64")

OUT.parent.mkdir(parents=True, exist_ok=True)
out.to_csv(OUT, index=False, encoding="utf-8")

print(f"OK -> {OUT}")
print("rows:", len(out))
print(out.head(8).to_string(index=False))
