set -euo pipefail

# === CONFIG ===
XLSX="${1:?uso: mtr_sync_from_xlsx.sh <ruta.xlsx> <YYYY-MM-01>}"
MES="${2:?uso: mtr_sync_from_xlsx.sh <ruta.xlsx> <YYYY-MM-01>}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ti_ops}"
DB_USER="${DB_USER:-bea}"

# === OUTPUT ===
OUT_DIR="/tmp/mtr_sync_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT_DIR"
CSV_ING="$OUT_DIR/ingresos_norm.csv"
CSV_SAL="$OUT_DIR/salidas_norm.csv"

echo "== XLSX=$XLSX"
echo "== MES=$MES"
echo "== OUT_DIR=$OUT_DIR"

python3 - <<'PY' "$XLSX" "$CSV_ING" "$CSV_SAL"
import sys, re
import pandas as pd
import datetime as dt

xlsx = sys.argv[1]
csv_ing = sys.argv[2]
csv_sal = sys.argv[3]

def norm_sku(x):
    if pd.isna(x):
        return None
    s = str(x).strip()
    if not s or s.lower() == "nan":
        return None
    m = re.search(r"(\d+)", s)
    if not m:
        return None
    return f"SKU-{m.group(1)}"

def load_sheet(sheet_name: str):
    df = pd.read_excel(xlsx, sheet_name=sheet_name, header=[0,1], skiprows=[2])
    df.columns = [f"{a}__{b}".strip("_") for a,b in df.columns.to_list()]
    return df

def pick_col(df, contains_any):
    for c in df.columns:
        lc = c.lower()
        if any(k in lc for k in contains_any):
            return c
    return None

def pick_col_persona(df):
    bad_tokens = ['mail','correo','email']
    prefer = ['colaborador','empleado','asignado','persona','nombre']
    for c in df.columns:
        lc = c.lower()
        if any(t in lc for t in bad_tokens):
            continue
        if not any(t in lc for t in prefer):
            continue
        ser = df[c]
        vals = ser.dropna().head(200)
        if len(vals) == 0:
            continue
        uniq = set(str(x).strip().lower() for x in vals.unique().tolist())
        if uniq.issubset({'true','false','0','1','1.0','0.0','si','no'}):
            continue
        return c
    return None

def parse_mixed_date(series: pd.Series) -> pd.Series:
    raw = series.astype("string").str.strip()
    raw = raw.where(raw.notna(), None)

    # Preferimos locale Chile para fechas ambiguas y luego caemos a parseo general.
    dt_dayfirst = pd.to_datetime(raw, errors="coerce", dayfirst=True)
    dt_monthfirst = pd.to_datetime(raw, errors="coerce", dayfirst=False)
    dt = dt_dayfirst.fillna(dt_monthfirst)
    return dt.dt.date

def build_norm(df, kind: str):
    c_persona = pick_col_persona(df)
    c_fecha   = pick_col(df, ["fecha de ingreso", "fecha ingreso", "fecha de salida", "fecha salida", "fecha"])
    c_cliente = pick_col(df, ["general__cliente", "cliente"])
    c_sku     = pick_col(df, ["entrega equipo computacional__sku", "__sku"])
    c_mm      = pick_col(df, ["marca / modelo", "marca", "modelo"])

    print(f"[{kind}] persona={c_persona} fecha={c_fecha} cliente={c_cliente} sku={c_sku} mm={c_mm}")

    if not c_persona or not c_fecha:
        raise SystemExit(f"No pude detectar columnas clave en {kind}: persona={c_persona} fecha={c_fecha}")

    out = pd.DataFrame()
    out["persona"] = df[c_persona].astype("string").str.strip()
    out["fecha_evento"] = parse_mixed_date(df[c_fecha])

    if c_cliente:
        out["cliente"] = df[c_cliente].astype("string").str.strip()
    else:
        out["cliente"] = None

    if c_sku:
        out["id_equipo"] = df[c_sku].apply(norm_sku)
    else:
        out["id_equipo"] = None

    if c_mm:
        out["marca_modelo"] = df[c_mm].astype("string").str.strip()
    else:
        out["marca_modelo"] = None

    def mk_det(row):
        def s(x):
            return "" if pd.isna(x) else str(x).strip()
        cli = s(row.get("cliente"))
        mm  = s(row.get("marca_modelo"))
        if cli and mm:
            return f"{cli} | True | {mm}"
        if cli:
            return f"{cli} | True"
        return None

    out["detalle"] = out.apply(mk_det, axis=1)

    out = out.dropna(subset=["fecha_evento"])
    out = out[(out["fecha_evento"] >= dt.date(2020,1,1)) & (out["fecha_evento"] <= dt.date(2035,1,1))]

    for c in ["persona","cliente","id_equipo","marca_modelo","detalle"]:
        if c in out.columns:
            out[c] = out[c].astype("string")
            out[c] = out[c].where(out[c].notna(), None)

    return out[["fecha_evento","persona","id_equipo","detalle"]]

df_ing = load_sheet("Ingresos")
out_ing = build_norm(df_ing, "Ingresos")

try:
    df_sal = load_sheet("Salidas")
    out_sal = build_norm(df_sal, "Salidas")
except Exception as e:
    print("[Salidas] no disponible o error leyendo sheet:", e)
    out_sal = pd.DataFrame(columns=["fecha_evento","persona","id_equipo","detalle"])

out_ing.to_csv(csv_ing, index=False)
out_sal.to_csv(csv_sal, index=False)

print("OK: CSVs generados")
print(" -", csv_ing, "rows=", len(out_ing))
print(" -", csv_sal, "rows=", len(out_sal))
PY

echo
echo "== preview ingresos =="
head -n 5 "$CSV_ING" || true
echo
echo "== preview salidas =="
head -n 5 "$CSV_SAL" || true

echo
echo "== load a tablas físicas analytics.mtr_*_xlsx (mes $MES) =="

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL
\\set ON_ERROR_STOP on

create table if not exists analytics.mtr_ingresos_xlsx (
  fecha_evento date not null,
  persona text,
  id_equipo text,
  detalle text
);

create table if not exists analytics.mtr_salidas_xlsx (
  fecha_evento date not null,
  persona text,
  id_equipo text,
  detalle text
);

begin;

create temp table tmp_mtr_ing (
  fecha_evento date,
  persona text,
  id_equipo text,
  detalle text
) on commit drop;

create temp table tmp_mtr_sal (
  fecha_evento date,
  persona text,
  id_equipo text,
  detalle text
) on commit drop;

\\copy tmp_mtr_ing (fecha_evento,persona,id_equipo,detalle) from '$CSV_ING' with (format csv, header true)
\\copy tmp_mtr_sal (fecha_evento,persona,id_equipo,detalle) from '$CSV_SAL' with (format csv, header true)

delete from analytics.mtr_ingresos_xlsx
where fecha_evento >= date '$MES'
  and fecha_evento < (date '$MES' + interval '1 month');

delete from analytics.mtr_salidas_xlsx
where fecha_evento >= date '$MES'
  and fecha_evento < (date '$MES' + interval '1 month');

insert into analytics.mtr_ingresos_xlsx (fecha_evento,persona,id_equipo,detalle)
select fecha_evento, persona, id_equipo, detalle
from tmp_mtr_ing
where fecha_evento >= date '$MES'
  and fecha_evento < (date '$MES' + interval '1 month');

insert into analytics.mtr_salidas_xlsx (fecha_evento,persona,id_equipo,detalle)
select fecha_evento, persona, id_equipo, detalle
from tmp_mtr_sal
where fecha_evento >= date '$MES'
  and fecha_evento < (date '$MES' + interval '1 month');

commit;

select 'ingresos_xlsx_mes' as k, count(*)::int as n
from analytics.mtr_ingresos_xlsx
where fecha_evento >= date '$MES'
  and fecha_evento < (date '$MES' + interval '1 month')
union all
select 'salidas_xlsx_mes' as k, count(*)::int as n
from analytics.mtr_salidas_xlsx
where fecha_evento >= date '$MES'
  and fecha_evento < (date '$MES' + interval '1 month');
SQL

echo
echo "== listo: ahora puedes apuntar el endpoint a analytics.mtr_*_xlsx cuando existan filas =="
echo "OK"
