#!/usr/bin/env python3
import os
import shutil
import sys
from datetime import datetime, timezone
import re

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

MTR_XLSX = os.environ.get("MTR_XLSX", "/Users/bea/Desktop/Catastro/MTR_actualizado_diciembre.xlsx")
SHEET_NAME = os.environ.get("MTR_SHEET", "Equipos Asignados")
SNAP_DIR = os.environ.get("MTR_SNAP_DIR", "/Users/bea/Desktop/Catastro/snapshots")

PG_DSN = os.environ.get(
    "PG_DSN",
    "host=localhost port=5432 dbname=ti_ops user=bea password=<PASSWORD>"
)

RAW_TABLE = "raw.mtr_equipos_asignados"
RUNS_TABLE = "raw.mtr_ingestion_runs"

EXPECTED_COLS = [
    "tipo","marca","modelo","color","año","sistema_operativo","nro_serie","sku","propiedad",
    "pantalla","cpu","ram","capacidad_disco_duro","condición","fecha_de_compra",
    "fecha_de_mantenimiento","fecha_de_asignación","estatus_del_equipo","perfil","cliente",
    "empleado_asignado","rut","ámbito_laboral","localización","ciudadcomuna","monitor_asignado",
    "marca_1","nro_serie_1","accesorios_asignados","accesorios_1","accesorios_2","otros",
    "usado_por_1","fecha_de_asignación_1","usado_por_2","fecha_de_asignación_2","usado_por_3",
    "fecha_de_asignación_3","usado_por_4","fecha_de_asignación_4","usado_por_5","fecha_de_asignación_5",
    "usado_por_6","fecha_de_asignación_6","usado_por_7","fecha_de_asignación_7","usado_por_8",
    "fecha_de_asignación_8","column_52","column_49","column_50","column_51","column_52_2",
    "column_53","column_54","column_55","column_56","column_57",
]

TIMESTAMP_COLS = [
    "fecha_de_compra",
    "fecha_de_asignación_1",
    "fecha_de_asignación_4",
    "fecha_de_asignación_5",
    "fecha_de_asignación_6",
    "fecha_de_asignación_7",
]

def snapshot_file(src: str) -> tuple[str, datetime]:
    os.makedirs(SNAP_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = os.path.basename(src)
    dst = os.path.join(SNAP_DIR, f"{ts}__{base}")
    shutil.copy2(src, dst)
    mtime = datetime.fromtimestamp(os.path.getmtime(src), tz=timezone.utc)
    return dst, mtime

def norm(s: str) -> str:
    s = str(s).strip().lower()
    s = (
        s.replace("á","a").replace("é","e").replace("í","i")
         .replace("ó","o").replace("ú","u").replace("ñ","n")
    )
    s = re.sub(r"\s+", " ", s)
    return s

def detect_header_row(path: str, sheet: str, look_for=("sku", "nro_serie", "estatus")) -> int:
    # lee primeras 30 filas sin header y busca dónde están los headers
    raw = pd.read_excel(path, sheet_name=sheet, engine="openpyxl", header=None, nrows=30)
    for i in range(min(30, len(raw))):
        row = raw.iloc[i].tolist()
        joined = " | ".join([norm(x) for x in row if x is not None and str(x).strip() != ""])
        if not joined:
            continue
        hits = sum(1 for k in look_for if k in joined)
        if hits >= 1 and "sku" in joined:
            return i
    return 0  # fallback

def load_excel(path: str) -> pd.DataFrame:
    hdr = detect_header_row(path, SHEET_NAME)
    df = pd.read_excel(path, sheet_name=SHEET_NAME, engine="openpyxl", header=hdr)

    # normaliza nombres de columnas
    df.columns = [norm(c) for c in df.columns]

    # mapeo común de headers a tu esquema (ajustable)
    rename = {
        "sku": "sku",
        "nro serie": "nro_serie",
        "nro_serie": "nro_serie",
        "numero de serie": "nro_serie",
        "estatus del equipo": "estatus_del_equipo",
        "estado del equipo": "estatus_del_equipo",
        "empleado asignado": "empleado_asignado",
        "localizacion": "localización",
        "ciudadcomuna": "ciudadcomuna",
        "fecha de compra": "fecha_de_compra",
    }
    # aplica rename por claves exactas
    df = df.rename(columns={c: rename.get(c, c) for c in df.columns})

    # asegura columnas esperadas
    for c in EXPECTED_COLS:
        if c not in df.columns:
            df[c] = None
    df = df[EXPECTED_COLS]

    # parse timestamps
    for c in TIMESTAMP_COLS:
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce")

    # NaN/NaT -> None
    df = df.astype(object)
    df = df.where(pd.notnull(df), None)
    return df

def main() -> int:
    if not os.path.exists(MTR_XLSX):
        print(f"ERROR: no existe MTR_XLSX: {MTR_XLSX}", file=sys.stderr)
        return 2

    snap_path, source_mtime = snapshot_file(MTR_XLSX)
    df = load_excel(MTR_XLSX)
    rows_loaded = len(df)

    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = False
    run_id = None
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {RUNS_TABLE} (source_file, source_mtime, rows_loaded) "
                f"VALUES (%s, %s, %s) RETURNING run_id",
                (snap_path, source_mtime, rows_loaded),
            )
            run_id = cur.fetchone()[0]

            cur.execute(f"CREATE TEMP TABLE tmp_mtr (LIKE {RAW_TABLE} INCLUDING ALL) ON COMMIT DROP;")

            cols = list(df.columns)
            if rows_loaded > 0:
                values = [tuple(df.iloc[i][c] for c in cols) for i in range(rows_loaded)]
                execute_values(cur, f"INSERT INTO tmp_mtr ({','.join(cols)}) VALUES %s", values, page_size=1000)

            cur.execute(f"TRUNCATE TABLE {RAW_TABLE};")
            cur.execute(f"INSERT INTO {RAW_TABLE} SELECT * FROM tmp_mtr;")

            cur.execute(
                f"UPDATE {RUNS_TABLE} SET status='SUCCESS', finished_at=now() WHERE run_id=%s",
                (run_id,),
            )

        conn.commit()
        print(f"OK: loaded {rows_loaded} rows into {RAW_TABLE}. snapshot={snap_path} run_id={run_id}")
        return 0
    except Exception as e:
        conn.rollback()
        if run_id is not None:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {RUNS_TABLE} SET status='ERROR', finished_at=now(), error=%s WHERE run_id=%s",
                    (str(e), run_id),
                )
            conn.commit()
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        conn.close()

if __name__ == "__main__":
    raise SystemExit(main())


df_salidas = _apply_guardrails_mtr_salidas(df_salidas)
# --- Guard rails para RAW mtr_salidas (evita outliers tipo 2923) ---
import re
import pandas as pd
from datetime import date, timedelta

def _parse_fecha_robusta(series: pd.Series) -> pd.Series:
    """
    Parsea fechas mixtas (timestamp, ISO, dd/mm/yyyy, etc.) sin depender del datestyle.
    Retorna date (o NaT->NaN).
    """
    s = series.astype(str).str.strip()
    s = s.where(s.ne("") & s.ne("None") & s.ne("nan"), None)

    # 1) intento dayfirst=True (LatAm)
    dt1 = pd.to_datetime(s, errors="coerce", dayfirst=True, utc=False)
    # 2) fallback dayfirst=False (formato US)
    dt2 = pd.to_datetime(s, errors="coerce", dayfirst=False, utc=False)

    dt = dt1.fillna(dt2)
    return dt.dt.date

def _apply_guardrails_mtr_salidas(df_salidas: pd.DataFrame) -> pd.DataFrame:
    # Ajusta columnas si tu DF usa otros nombres
    COL_EQUIPO = "entrega_equipo_computacional"
    COL_FECHA  = "fecha_de_salida"

    if COL_EQUIPO not in df_salidas.columns or COL_FECHA not in df_salidas.columns:
        # Si no están, no hacemos nada (evita romper el script si cambian nombres)
        return df_salidas

    before = len(df_salidas)

    # 1) equipo no vacío
    df_salidas[COL_EQUIPO] = df_salidas[COL_EQUIPO].astype(str).str.strip()
    df_salidas.loc[df_salidas[COL_EQUIPO].isin(["", "None", "nan"]), COL_EQUIPO] = None

    # 2) sku válido: debe contener algún dígito (para que stg genere SKU-###)
    mask_sku_ok = df_salidas[COL_EQUIPO].fillna("").str.contains(r"\d+", regex=True)
    df_salidas = df_salidas[mask_sku_ok].copy()

    # 3) parse robusto de fecha + guard de futuro (> hoy+1)
    df_salidas["_fecha_parsed"] = _parse_fecha_robusta(df_salidas[COL_FECHA])

    hoy = date.today()
    max_ok = hoy + timedelta(days=1)

    mask_fecha_ok = df_salidas["_fecha_parsed"].notna() & (df_salidas["_fecha_parsed"] <= max_ok)
    df_bad = df_salidas.loc[~mask_fecha_ok, [COL_EQUIPO, COL_FECHA]].copy()

    df_salidas = df_salidas.loc[mask_fecha_ok].copy()
    df_salidas.drop(columns=["_fecha_parsed"], inplace=True, errors="ignore")

    after = len(df_salidas)
    dropped = before - after
    print(f"[mtr_salidas] rows before={before} after={after} dropped={dropped}")
    if len(df_bad):
        print("[mtr_salidas] dropped examples (bad date / future):")
        print(df_bad.head(10).to_string(index=False))

    return df_salidas
# --- fin guard rails ---

