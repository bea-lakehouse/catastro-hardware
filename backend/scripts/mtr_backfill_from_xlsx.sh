set -euo pipefail

XLSX="${1:?uso: mtr_backfill_from_xlsx.sh <ruta.xlsx>}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ti_ops}"
DB_USER="${DB_USER:-bea}"

OUT_DIR="/tmp/mtr_backfill_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT_DIR"
CSV="$OUT_DIR/equipos_backfill_xlsx.csv"

echo "== XLSX=$XLSX"
echo "== OUT=$CSV"

python3 - <<'PY' "$XLSX" "$CSV"
import sys, re
import pandas as pd

xlsx = sys.argv[1]
out_csv = sys.argv[2]

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

def norm_sku(x):
    if pd.isna(x):
        return None
    s = str(x).strip()
    m = re.search(r"(\d+)", s)
    if not m:
        return None
    return f"SKU-{m.group(1)}"

def infer_os(modelo):
    if modelo is None:
        return None
    t = str(modelo).lower()
    if "mac" in t or "macbook" in t:
        return "MAC"
    return "WIN"

rows = []
for sheet in ["Ingresos","Salidas"]:
    try:
        df = load_sheet(sheet)
    except Exception:
        continue
    c_sku = pick_col(df, ["entrega equipo computacional__sku","__sku"])
    c_mm  = pick_col(df, ["marca / modelo","entrega equipo computacional__marca / modelo","marca","modelo"])
    if not c_sku or not c_mm:
        continue

    tmp = pd.DataFrame()
    tmp["id_equipo"] = df[c_sku].apply(norm_sku)
    tmp["modelo_txt"] = df[c_mm].astype("string").str.strip()
    tmp = tmp.dropna(subset=["id_equipo"])
    tmp["modelo_txt"] = tmp["modelo_txt"].where(tmp["modelo_txt"].notna(), None)
    tmp = tmp[tmp["modelo_txt"].notna()]

    tmp["mac_win"] = tmp["modelo_txt"].apply(infer_os)
    tmp["condicion"] = "Nuevo"
    rows.append(tmp[["id_equipo","modelo_txt","mac_win","condicion"]])

if rows:
    out = pd.concat(rows, ignore_index=True).drop_duplicates(subset=["id_equipo"], keep="last")
else:
    out = pd.DataFrame(columns=["id_equipo","modelo_txt","mac_win","condicion"])

out.to_csv(out_csv, index=False)
print("OK rows:", len(out))
PY

echo
echo "== preview backfill =="
head -n 10 "$CSV" || true

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL
\\set ON_ERROR_STOP on

create table if not exists analytics.equipos_backfill_xlsx (
  id_equipo text primary key,
  modelo_txt text,
  mac_win text,
  condicion text,
  updated_at timestamptz default now()
);

begin;

create temp table tmp_bf (
  id_equipo text,
  modelo_txt text,
  mac_win text,
  condicion text
) on commit drop;

\\copy tmp_bf (id_equipo,modelo_txt,mac_win,condicion) from '$CSV' with (format csv, header true)

insert into analytics.equipos_backfill_xlsx (id_equipo, modelo_txt, mac_win, condicion, updated_at)
select id_equipo, modelo_txt, mac_win, condicion, now()
from tmp_bf
on conflict (id_equipo) do update
set modelo_txt = excluded.modelo_txt,
    mac_win = excluded.mac_win,
    condicion = excluded.condicion,
    updated_at = now();

commit;


select 'equipos_backfill_xlsx' as k, count(*)::int as n
from analytics.equipos_backfill_xlsx;
SQL

echo "OK"
