import os

import pandas as pd
from sqlalchemy import create_engine, text

# Ruta al Excel de MTR (ajústala si está en otra carpeta)
MTR_PATH = "MTR.xlsx"

# URL a BD ti_ops desde variable de entorno (con default local)
ENGINE_URL = os.getenv(
    "TI_OPS_DATABASE_URL",
    "postgresql://usuario:password@localhost:5432/ti_ops",
)

engine = create_engine(
    ENGINE_URL,
    future=True,
)

def build_asset_tag(row: pd.Series) -> str:
    """
    Construye un identificador estable para el equipo.
    Priorizamos Nro Serie, luego SKU, luego Marca+Modelo+row_index.
    """
    serie = str(row.get("Nro Serie") or "").strip()
    sku = str(row.get("SKU") or "").strip()
    marca = str(row.get("Marca") or "").strip()
    modelo = str(row.get("Modelo") or "").strip()

    base = ""
    if serie:
        base = f"SERIE:{serie}"
    elif sku:
        base = f"SKU:{sku}"
    else:
        base = f"{marca}|{modelo}"

    # md5 para que sea compacto
    import hashlib
    return hashlib.md5(base.encode("utf-8")).hexdigest()


def main():
    # Leer hoja "Equipos Asignados"
    df = pd.read_excel(MTR_PATH, sheet_name="Equipos Asignados")

    # Filtramos filas vacías
    df = df[df["Tipo"].notna()].copy()

    # Construir DataFrame con columnas de activos.equipos
    out = pd.DataFrame()
    out["asset_tag"] = df.apply(build_asset_tag, axis=1)
    out["tipo_equipo"] = df["Tipo"].astype(str).str.strip()
    out["marca"] = df["Marca"].astype(str).str.strip()
    out["modelo"] = df["Modelo"].astype(str).str.strip()
    out["cpu"] = df["CPU"].astype(str).str.strip()
    out["ram_gb"] = pd.to_numeric(df["Ram"], errors="coerce")
    out["almacenamiento"] = df["Capacidad Disco Duro"].astype(str).str.strip()

    out["nro_serie"] = df["Nro Serie"].astype(str).str.strip()
    out["sku"] = df["SKU"].astype(str).str.strip()

    out["fecha_compra"] = pd.to_datetime(df["Fecha de Compra"], errors="coerce").dt.date
    out["estado"] = df["Estatus del Equipo"].fillna("vigente").astype(str).str.strip()

    out["cliente_actual"] = df["Cliente"].astype(str).str.strip()
    out["persona_actual"] = df["Empleado Asignado"].astype(str).str.strip()
    out["pais_actual"] = df["Localización"].astype(str).str.strip()
    out["ciudad_actual"] = df["Ciudad/Comuna"].astype(str).str.strip()
    out["perfil_actual"] = df["Perfil"].astype(str).str.strip()

    out["costo_compra"] = None
    out["moneda"] = "USD"
    out["fuente_registro"] = "MTR_Equipos_Asignados"

    # Quitar duplicados por asset_tag (nos quedamos con la última fila)
    out = out.sort_values("fecha_compra").drop_duplicates("asset_tag", keep="last")

    with engine.begin() as conn:
        # Opcional: si quieres que MTR sea la única verdad, borra todo antes:
        # conn.execute(text("TRUNCATE TABLE activos.equipos RESTART IDENTITY;"))

        # Hacemos UPSERT por asset_tag
        temp_table = "tmp_mtr_equipos"
        out.to_sql(temp_table, conn, schema="public", if_exists="replace", index=False)

        upsert_sql = """
        INSERT INTO activos.equipos (
            asset_tag, tipo_equipo, marca, modelo, cpu, ram_gb, almacenamiento,
            estado, fecha_compra, costo_compra, moneda,
            cliente_actual, persona_actual, pais_actual, ciudad_actual,
            perfil_actual, fuente_registro, sku, nro_serie
        )
        SELECT
            asset_tag,
            tipo_equipo,
            marca,
            modelo,
            cpu,
            ram_gb,
            almacenamiento,
            estado,
            fecha_compra,
            NULL::numeric(12,2) AS costo_compra,   -- <<< forzamos NUMERIC
            'USD' AS moneda,                       -- <<< fijo por ahora
            cliente_actual,
            persona_actual,
            pais_actual,
            ciudad_actual,
            perfil_actual,
            fuente_registro,
            sku,
            nro_serie
        FROM public.tmp_mtr_equipos t
        ON CONFLICT (asset_tag) DO UPDATE
        SET
            tipo_equipo     = EXCLUDED.tipo_equipo,
            marca           = EXCLUDED.marca,
            modelo          = EXCLUDED.modelo,
            cpu             = EXCLUDED.cpu,
            ram_gb          = EXCLUDED.ram_gb,
            almacenamiento  = EXCLUDED.almacenamiento,
            estado          = EXCLUDED.estado,
            fecha_compra    = EXCLUDED.fecha_compra,
            cliente_actual  = EXCLUDED.cliente_actual,
            persona_actual  = EXCLUDED.persona_actual,
            pais_actual     = EXCLUDED.pais_actual,
            ciudad_actual   = EXCLUDED.ciudad_actual,
            perfil_actual   = EXCLUDED.perfil_actual,
            fuente_registro = EXCLUDED.fuente_registro,
            sku             = EXCLUDED.sku,
            nro_serie       = EXCLUDED.nro_serie,
            actualizado_en  = now();
        """

        conn.execute(text(upsert_sql))
        conn.execute(text("DROP TABLE public.tmp_mtr_equipos;"))

    print(f"Actualizados {len(out)} equipos desde MTR.xlsx")


if __name__ == "__main__":
    main()
