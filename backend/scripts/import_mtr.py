# backend/scripts/import_mtr.py

import os
import argparse
import hashlib
from typing import List, Dict, Any, Optional

import pandas as pd
from sqlalchemy import create_engine, text

# URL a BD ti_ops desde variable de entorno (con default local para desarrollo)
ENGINE_URL = os.getenv(
    "TI_OPS_DATABASE_URL",
    "postgresql://usuario:password@localhost:5432/ti_ops",
)

engine = create_engine(
    ENGINE_URL,
    future=True,
)


def normalize_sku(value) -> Optional[int]:
    """
    Normaliza el SKU desde el Excel:
    - Si viene como 314.0 → 314
    - Si viene vacío → None
    """
    if pd.isna(value):
        return None
    try:
        f = float(value)
        if f.is_integer():
            return int(f)
        return int(f)  # si quieres redondear igual
    except Exception:
        try:
            return int(str(value).strip())
        except Exception:
            return None


def normalize_str(value) -> Optional[str]:
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s or None


def normalize_fecha(value):
    """
    Devuelve un objeto datetime.date o None.
    """
    if pd.isna(value):
        return None
    try:
        raw = str(value).strip()
        if not raw or raw.lower() in {"none", "nan"}:
            return None
        ts = pd.to_datetime(raw, errors="coerce", dayfirst=True)
        if pd.isna(ts):
            ts = pd.to_datetime(raw, errors="coerce", dayfirst=False)
        if pd.isna(ts):
            return None
        return ts.date()
    except Exception:
        return None


def generar_asset_tag(sku: Optional[int], nro_serie: Optional[str]) -> str:
    """
    Genera un asset_tag determinístico si no tienes uno en el MTR.
    Usa md5(sku|nro_serie) como string hex.
    """
    base = f"{sku or ''}|{nro_serie or ''}"
    return hashlib.md5(base.encode("utf-8")).hexdigest()


def cargar_equipos_desde_mtr(path_excel: str) -> List[Dict[str, Any]]:
    """
    Lee la hoja 'Equipos Asignados' del MTR y devuelve una lista de dicts
    listos para insertar en activos.equipos.
    """
    print(f"📥 Leyendo Excel: {path_excel}")
    df = pd.read_excel(path_excel, sheet_name="Equipos Asignados")

    registros: List[Dict[str, Any]] = []

    for _, row in df.iterrows():
        sku = normalize_sku(row.get("SKU"))
        nro_serie = normalize_str(row.get("Nro Serie"))

        # Si no hay ni SKU ni nro_serie, no nos sirve como equipo
        if sku is None and not nro_serie:
            continue

        tipo_equipo = normalize_str(row.get("Tipo"))
        marca = normalize_str(row.get("Marca"))
        modelo = normalize_str(row.get("Modelo"))
        cpu = normalize_str(row.get("CPU"))
        perfil_actual = normalize_str(row.get("Perfil"))
        cliente_actual = normalize_str(row.get("Cliente"))
        persona_actual = normalize_str(row.get("Empleado Asignado"))
        pais_actual = normalize_str(row.get("Localización"))  # ej. "Colombia"
        ciudad_actual = normalize_str(row.get("Ciudad/Comuna"))
        estado = normalize_str(row.get("Estatus del Equipo"))
        fecha_compra = normalize_fecha(row.get("Fecha de Compra"))

        asset_tag = generar_asset_tag(sku, nro_serie)

        reg = {
            "asset_tag": asset_tag,
            "sku": sku,
            "nro_serie": nro_serie,
            "fecha_compra": fecha_compra,
            "estado": estado,
            "tipo_equipo": tipo_equipo,
            "marca": marca,
            "modelo": modelo,
            "cpu": cpu,
            "cliente_actual": cliente_actual,
            "persona_actual": persona_actual,
            "pais_actual": pais_actual,
            "ciudad_actual": ciudad_actual,
            "perfil_actual": perfil_actual,
        }
        registros.append(reg)

    print(f"✅ Registros construidos desde MTR: {len(registros)}")
    return registros


UPSERT_SQL = """
INSERT INTO activos.equipos (
    asset_tag,
    sku,
    nro_serie,
    fecha_compra,
    estado,
    tipo_equipo,
    marca,
    modelo,
    cpu,
    cliente_actual,
    persona_actual,
    pais_actual,
    ciudad_actual,
    perfil_actual
)
VALUES (
    :asset_tag,
    :sku,
    :nro_serie,
    :fecha_compra,
    :estado,
    :tipo_equipo,
    :marca,
    :modelo,
    :cpu,
    :cliente_actual,
    :persona_actual,
    :pais_actual,
    :ciudad_actual,
    :perfil_actual
)
ON CONFLICT (sku, nro_serie)
DO UPDATE SET
    asset_tag       = EXCLUDED.asset_tag,
    fecha_compra    = EXCLUDED.fecha_compra,
    estado          = EXCLUDED.estado,
    tipo_equipo     = EXCLUDED.tipo_equipo,
    marca           = EXCLUDED.marca,
    modelo          = EXCLUDED.modelo,
    cpu             = EXCLUDED.cpu,
    cliente_actual  = EXCLUDED.cliente_actual,
    persona_actual  = EXCLUDED.persona_actual,
    pais_actual     = EXCLUDED.pais_actual,
    ciudad_actual   = EXCLUDED.ciudad_actual,
    perfil_actual   = EXCLUDED.perfil_actual;
"""


def upsert_equipos(registros: List[Dict[str, Any]], database_url: str = DATABASE_URL):
    """
    Inserta/actualiza todos los registros en activos.equipos usando UPSERT.
    Necesita que exista un índice único en (sku, nro_serie), por ejemplo:
        ALTER TABLE activos.equipos
        ADD CONSTRAINT equipos_sku_nro_serie_uk UNIQUE (sku, nro_serie);
    """
    if not registros:
        print("⚠️ No hay registros para insertar.")
        return

    engine = create_engine(database_url, pool_pre_ping=True)

    print(f"🗄 Conectando a la base: {database_url}")
    with engine.begin() as conn:
        conn.execute(text(UPSERT_SQL), registros)
    print(f"✅ UPSERT completado para {len(registros)} registros.")


def main():
    parser = argparse.ArgumentParser(
        description="Importa la hoja 'Equipos Asignados' del MTR a activos.equipos"
    )
    parser.add_argument(
        "--file",
        "-f",
        default="MTR.xlsx",
        help="Ruta al archivo MTR.xlsx (por defecto: ./MTR.xlsx)",
    )
    parser.add_argument(
        "--db",
        default=DATABASE_URL,
        help="DATABASE_URL para conectar a Postgres",
    )

    args = parser.parse_args()

    excel_path = args.file
    if not os.path.exists(excel_path):
        raise SystemExit(f"❌ No se encontró el archivo: {excel_path}")

    registros = cargar_equipos_desde_mtr(excel_path)
    upsert_equipos(registros, database_url=args.db)


if __name__ == "__main__":
    main()
