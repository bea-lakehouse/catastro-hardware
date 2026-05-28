# backend/scripts/import_mtr_historia.py

import os
import argparse
from typing import List, Dict, Any, Optional

import pandas as pd
from sqlalchemy import create_engine, text

# Reutilizamos el mismo DATABASE_URL
ENGINE_URL = "postgresql://usuario:password@localhost:5432/ti_ops"

engine = create_engine(
    ENGINE_URL,
    future=True,
)

# ---- helpers básicos (mismos que en import_mtr.py) ----

def normalize_sku(value) -> Optional[int]:
    if pd.isna(value):
        return None
    try:
        f = float(value)
        if f.is_integer():
            return int(f)
        return int(f)
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
    if pd.isna(value):
        return None
    raw = str(value).strip()
    if not raw or raw.lower() in {"none", "nan"}:
        return None
    ts = pd.to_datetime(raw, errors="coerce", dayfirst=True)
    if pd.isna(ts):
        ts = pd.to_datetime(raw, errors="coerce", dayfirst=False)
    if pd.isna(ts):
        return None
    return ts.date()


def generar_asset_tag(sku: Optional[int], nro_serie: Optional[str]) -> str:
    base = f"{sku or ''}|{nro_serie or ''}"
    import hashlib
    return hashlib.md5(base.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------
# 1) Historia desde hoja "Equipos Asignados"
#    - Compra
#    - Asignaciones históricas ("Usado por #n" + "Fecha de Asignación #n")
#    - Asignación actual ("Empleado Asignado" + "Fecha de Asignación")
# --------------------------------------------------------------------

def eventos_desde_equipos_asignados(path_excel: str) -> List[Dict[str, Any]]:
    df = pd.read_excel(path_excel, sheet_name="Equipos Asignados")

    eventos: List[Dict[str, Any]] = []

    for _, row in df.iterrows():
        sku = normalize_sku(row.get("SKU"))
        nro_serie = normalize_str(row.get("Nro Serie")) or normalize_str(row.get("Nro. Serie"))

        if sku is None and not nro_serie:
            continue

        tipo_equipo = normalize_str(row.get("Tipo"))
        marca = normalize_str(row.get("Marca"))
        modelo = normalize_str(row.get("Modelo"))
        cpu = normalize_str(row.get("CPU"))
        perfil = normalize_str(row.get("Perfil"))
        cliente = normalize_str(row.get("Cliente"))
        persona_actual = normalize_str(row.get("Empleado Asignado"))
        pais = normalize_str(row.get("Localización"))
        ciudad = normalize_str(row.get("Ciudad/Comuna"))
        estado = normalize_str(row.get("Estatus del Equipo"))
        fecha_compra = normalize_fecha(row.get("Fecha de Compra"))
        fecha_asignacion_actual = normalize_fecha(row.get("Fecha de Asignación"))

        asset_tag = generar_asset_tag(sku, nro_serie)

        base_ctx = dict(
            sku=sku,
            nro_serie=nro_serie,
            asset_tag=asset_tag,
            cliente=cliente,
            perfil=perfil,
            pais=pais,
            ciudad=ciudad,
        )

        # --- evento: COMPRA ---
        if fecha_compra:
            eventos.append(
                dict(
                    **base_ctx,
                    fecha_evento=fecha_compra,
                    tipo_evento="COMPRA",
                    estado="Comprado",
                    persona=None,
                    detalle=f"Compra de {tipo_equipo or ''} {marca or ''} {modelo or ''}".strip(),
                    origen="Equipos Asignados",
                )
            )

        # --- eventos: USOS HISTÓRICOS #1..#8 ---
        for i in range(1, 9):
            col_user = f"Usado por #{i}"
            col_fecha = f"Fecha de Asignación #{i}"
            persona_i = normalize_str(row.get(col_user))
            fecha_i = normalize_fecha(row.get(col_fecha))

            if persona_i and fecha_i:
                eventos.append(
                    dict(
                        **base_ctx,
                        fecha_evento=fecha_i,
                        tipo_evento="ASIGNACION",
                        estado="Asignado",
                        persona=persona_i,
                        detalle=f"Asignación histórica #{i}",
                        origen="Equipos Asignados",
                    )
                )

        # --- evento: ASIGNACION ACTUAL ---
        if persona_actual and fecha_asignacion_actual:
            eventos.append(
                dict(
                    **base_ctx,
                    fecha_evento=fecha_asignacion_actual,
                    tipo_evento="ASIGNACION_ACTUAL",
                    estado=estado or "Asignado",
                    persona=persona_actual,
                    detalle="Asignación actual",
                    origen="Equipos Asignados",
                )
            )

    print(f"✅ Eventos desde 'Equipos Asignados': {len(eventos)}")
    return eventos


# --------------------------------------------------------------------
# 2) Historia desde hoja "Equipos Reparados"
#    - REPARACION: Problema Detectado + Reparación Realizada
# --------------------------------------------------------------------

def eventos_desde_reparaciones(path_excel: str) -> List[Dict[str, Any]]:
    # header=1 porque en la fila 0 están los títulos "Tipo / Marca / Modelo / ..."
    df = pd.read_excel(path_excel, sheet_name="Equipos Reparados", header=1)

    eventos: List[Dict[str, Any]] = []

    for _, row in df.iterrows():
        sku = normalize_sku(row.get("SKU"))
        nro_serie = normalize_str(row.get("N° Serie"))
        if sku is None and not nro_serie:
            continue

        problema = normalize_str(row.get("Problema Detectado"))
        reparacion = normalize_str(row.get("Reparación Realizada"))
        fecha_rep = normalize_fecha(row.get("Fecha de Reparación"))
        cliente = normalize_str(row.get("Cliente"))
        usuario = normalize_str(row.get("Usuario"))

        detalle = " / ".join([x for x in [problema, reparacion] if x])

        base_ctx = dict(
            sku=sku,
            nro_serie=nro_serie,
            asset_tag=generar_asset_tag(sku, nro_serie),
            cliente=cliente,
            perfil=None,
            pais=None,
            ciudad=None,
        )

        if fecha_rep or detalle:
            eventos.append(
                dict(
                    **base_ctx,
                    fecha_evento=fecha_rep or normalize_fecha(pd.Timestamp.today()),
                    tipo_evento="REPARACION",
                    estado="Reparado",
                    persona=usuario,
                    detalle=detalle or "Reparación registrada",
                    origen="Equipos Reparados",
                )
            )

    print(f"✅ Eventos desde 'Equipos Reparados': {len(eventos)}")
    return eventos


# --------------------------------------------------------------------
# Inserción en activos.equipos_historia
# --------------------------------------------------------------------

INSERT_SQL = """
INSERT INTO activos.equipos_historia (
    sku,
    nro_serie,
    asset_tag,
    fecha_evento,
    tipo_evento,
    estado,
    cliente,
    persona,
    perfil,
    pais,
    ciudad,
    detalle,
    origen
)
VALUES (
    :sku,
    :nro_serie,
    :asset_tag,
    :fecha_evento,
    :tipo_evento,
    :estado,
    :cliente,
    :persona,
    :perfil,
    :pais,
    :ciudad,
    :detalle,
    :origen
)
"""


def guardar_eventos_en_bd(eventos: List[Dict[str, Any]], database_url: str = DATABASE_URL):
    if not eventos:
        print("⚠️ No hay eventos para guardar.")
        return

    from sqlalchemy import create_engine

    engine = create_engine(database_url, pool_pre_ping=True)
    print(f"🗄 Conectando a {database_url}")

    with engine.begin() as conn:
        # Para simplificar: borramos y reconstruimos la historia completa
        conn.execute(text("TRUNCATE activos.equipos_historia"))
        conn.execute(text(INSERT_SQL), eventos)

    print(f"✅ Insertados {len(eventos)} eventos en activos.equipos_historia")


def main():
    parser = argparse.ArgumentParser(
        description="Construye la tabla activos.equipos_historia a partir del MTR.xlsx"
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
        help="DATABASE_URL para Postgres",
    )
    args = parser.parse_args()

    if not os.path.exists(args.file):
        raise SystemExit(f"❌ No se encontró el archivo {args.file}")

    eventos: List[Dict[str, Any]] = []
    eventos += eventos_desde_equipos_asignados(args.file)
    eventos += eventos_desde_reparaciones(args.file)

    print(f"📊 Total eventos construidos: {len(eventos)}")
    guardar_eventos_en_bd(eventos, database_url=args.db)


if __name__ == "__main__":
    main()
