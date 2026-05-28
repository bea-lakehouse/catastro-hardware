import pandas as pd
import re
from pathlib import Path

XLSX = Path("MTR_actualizado_diciembre.xlsx")
OUT_DIR = Path("data/raw_from_excel")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SHEET = "Equipos Asignados"

def norm_str(x):
    if pd.isna(x):
        return None
    s = str(x).strip()
    return s if s != "" else None

def mk_id_equipo(sku, nro_serie, asset_tag=None):
    sku = None if pd.isna(sku) else str(sku).strip()
    nro_serie = None if pd.isna(nro_serie) else str(nro_serie).strip()
    asset_tag = None if asset_tag is None or pd.isna(asset_tag) else str(asset_tag).strip()
    if sku and sku.lower() != "nan":
        sku_clean = re.sub(r"\.0$", "", sku)  # 443.0 -> 443
        return f"SKU-{sku_clean}"
    if nro_serie:
        return f"SER-{nro_serie}"
    if asset_tag:
        return f"AT-{asset_tag}"
    return None

def fix_date_value(v):
    """
    Normaliza fechas "raras" del Excel.
    Soporta:
      - datetime / Timestamp
      - 'dd/mm/yyyy'
      - 'dd/mmyyyy' (ej: '23/062024' -> '23/06/2024')
      - 'yyyy-mm-dd'
    Devuelve pd.Timestamp o None si no se puede parsear.
    """
    if v is None or pd.isna(v):
        return None

    # Si ya es fecha
    if isinstance(v, (pd.Timestamp, )):
        return v
    # pandas a veces usa datetime de python internamente
    try:
        import datetime as _dt
        if isinstance(v, (_dt.date, _dt.datetime)):
            return pd.to_datetime(v, errors="coerce")
    except Exception:
        pass

    s = str(v).strip()

    # Caso '23/062024' => dd/mmyyyy
    m = re.fullmatch(r"(\d{1,2})/(\d{2})(\d{4})", s)
    if m:
        d, mm, yyyy = m.group(1), m.group(2), m.group(3)
        s = f"{d}/{mm}/{yyyy}"

    # Caso '23062024' => ddmmyyyy (por si aparece sin slash)
    m2 = re.fullmatch(r"(\d{2})(\d{2})(\d{4})", s)
    if m2:
        d, mm, yyyy = m2.group(1), m2.group(2), m2.group(3)
        s = f"{d}/{mm}/{yyyy}"

    # Parse robusto, día primero
    ts = pd.to_datetime(s, errors="coerce", dayfirst=True)
    if pd.isna(ts):
        return None

    # Guard rail: años absurdos
    if ts.year < 1990 or ts.year > 2100:
        return None

    return ts

df = pd.read_excel(XLSX, sheet_name=SHEET)

base_cols = [
    "Tipo","Marca","Modelo","Color","Año","Sistema Operativo",
    "Nro Serie","SKU","Propiedad","Pantalla","CPU","Ram","Capacidad Disco Duro",
    "Condición","Fecha de Compra","Estatus del Equipo",
    "Empleado Asignado","Fecha de Asignación"
]
cols_present = [c for c in base_cols if c in df.columns]
df_base = df[cols_present].copy()

df_base["id_equipo"] = [
    mk_id_equipo(sku, ns) for sku, ns in zip(df_base.get("SKU"), df_base.get("Nro Serie"))
]
df_base = df_base[df_base["id_equipo"].notna()].copy()

# --- equipos_raw.csv ---
equipos = pd.DataFrame({
    "id_equipo": df_base["id_equipo"].astype(str),
    "tipo": df_base.get("Tipo"),
    "marca": df_base.get("Marca"),
    "modelo": df_base.get("Modelo"),
    "color": df_base.get("Color"),
    "anio": df_base.get("Año"),
    "sistema_operativo": df_base.get("Sistema Operativo"),
    "nro_serie": df_base.get("Nro Serie"),
    "sku": df_base.get("SKU"),
    "propiedad": df_base.get("Propiedad"),
    "pantalla": df_base.get("Pantalla"),
    "cpu": df_base.get("CPU"),
    "ram": df_base.get("Ram"),
    "capacidad_disco": df_base.get("Capacidad Disco Duro"),
    "condicion": df_base.get("Condición"),
    "fecha_compra": df_base.get("Fecha de Compra"),
    "estatus_equipo": df_base.get("Estatus del Equipo"),
    "origen": f"excel:{SHEET}",
})
equipos.to_csv(OUT_DIR / "equipos_raw.csv", index=False)

# --- historia_hw_raw.csv ---
hist_rows = []

def add_event(id_equipo, fecha, persona, tipo="ASIGNACION", detalle=None, origen=f"excel:{SHEET}"):
    persona = norm_str(persona)
    ts = fix_date_value(fecha)
    if not id_equipo or ts is None or not persona:
        return
    hist_rows.append({
        "id_equipo": id_equipo,
        "fecha_evento": ts,
        "tipo_evento": tipo,
        "detalle": detalle,
        "persona": persona,
        "origen": origen
    })

# Evento principal
if "Empleado Asignado" in df_base.columns and "Fecha de Asignación" in df_base.columns:
    for _, r in df_base.iterrows():
        add_event(
            r["id_equipo"],
            r.get("Fecha de Asignación"),
            r.get("Empleado Asignado"),
            detalle="Asignación (columna principal)"
        )

# Históricos #1..#8
for i in range(1, 9):
    c_user = f"Usado por #{i}"
    c_date = f"Fecha de Asignación #{i}"
    if c_user in df.columns and c_date in df.columns:
        for idx in df_base.index:
            id_eq = df_base.loc[idx, "id_equipo"]
            add_event(
                id_eq,
                df.loc[idx, c_date],
                df.loc[idx, c_user],
                detalle=f"Asignación histórico #{i}"
            )

hist = pd.DataFrame(hist_rows)
if not hist.empty:
    hist = hist.dropna(subset=["id_equipo","fecha_evento","tipo_evento"])
    hist = hist.sort_values(["id_equipo","fecha_evento"])
hist.to_csv(OUT_DIR / "historia_hw_raw.csv", index=False)

print("OK:")
print(" -", OUT_DIR / "equipos_raw.csv", "rows=", len(equipos))
print(" -", OUT_DIR / "historia_hw_raw.csv", "rows=", len(hist))
