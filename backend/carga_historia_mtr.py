# carga_historia_mtr.py
import os
from datetime import datetime

import pandas as pd
from sqlalchemy import create_engine, text

# ===========================================================
#  CONFIG DB  (ajusta si tu URL es distinta)
# ===========================================================
DATABASE_URL = os.getenv(
    "TI_OPS_DATABASE_URL",
    "postgresql://usuario:password@localhost:5432/ti_ops",
)
engine = create_engine(DATABASE_URL, future=True)

PATH_XLSX = "MTR.xlsx"   # nombre del archivo de entrada


# -----------------------------------------------------------
# Helpers
# -----------------------------------------------------------
def fmt_date(x):
    """Convierte cualquier cosa a date o None."""
    if pd.isna(x):
        return None
    if isinstance(x, (pd.Timestamp, datetime)):
        return x.date()
    try:
        return pd.to_datetime(x, dayfirst=True, errors="coerce").date()
    except Exception:
        return None


def row_to_events(row: pd.Series) -> list[dict]:
    """
    A partir de UNA fila de 'Equipos Asignados' genera
    varios eventos para activos.historia_hw
    """
    sku = row.get("SKU")
    serie = row.get("Nro Serie")
    cliente = row.get("Cliente")
    ciudad = row.get("Ciudad/Comuna")
    loc = row.get("Localización")
    rut = row.get("Rut")
    persona_actual = row.get("Empleado Asignado")

    # país = primer trozo de "Localización" antes del guión
    pais = None
    if isinstance(loc, str) and loc.strip():
        pais = loc.split("-")[0].strip()

    events: list[dict] = []

    # --------- EVENTO COMPRA ----------
    f_compra = fmt_date(row.get("Fecha de Compra"))
    if f_compra:
        events.append(
            dict(
                sku=int(sku) if pd.notna(sku) else None,
                nro_serie=str(serie) if pd.notna(serie) else None,
                asset_tag=None,
                tipo_evento="COMPRA",
                fecha_evento=f_compra,
                cliente=cliente,
                ciudad=ciudad,
                persona=None,
                rut=rut,
                pais=pais,
                detalle="Carga masiva MTR.xlsx — compra",
            )
        )

    # --------- ASIGNACIÓN ACTUAL ----------
    f_asig_actual = fmt_date(row.get("Fecha de Asignación"))
    if f_asig_actual and isinstance(persona_actual, str) and persona_actual.strip():
        events.append(
            dict(
                sku=int(sku) if pd.notna(sku) else None,
                nro_serie=str(serie) if pd.notna(serie) else None,
                asset_tag=None,
                tipo_evento="ASIGNACION_ACTUAL",
                fecha_evento=f_asig_actual,
                cliente=cliente,
                ciudad=ciudad,
                persona=persona_actual.strip(),
                rut=rut,
                pais=pais,
                detalle="Carga masiva MTR.xlsx — asignación actual",
            )
        )

    # --------- ASIGNACIONES HISTÓRICAS (#1..#8) ----------
    for n in range(1, 9):
        fecha_col = f"Fecha de Asignación #{n}"
        persona_col = f"Usado por #{n}"

        if fecha_col not in row.index or persona_col not in row.index:
            continue

        fecha = fmt_date(row.get(fecha_col))
        persona = row.get(persona_col)

        if fecha and isinstance(persona, str) and persona.strip():
            events.append(
                dict(
                    sku=int(sku) if pd.notna(sku) else None,
                    nro_serie=str(serie) if pd.notna(serie) else None,
                    asset_tag=None,
                    tipo_evento="ASIGNACION",
                    fecha_evento=fecha,
                    cliente=cliente,
                    ciudad=ciudad,
                    persona=persona.strip(),
                    rut=None,
                    pais=pais,
                    detalle=f"Carga masiva MTR.xlsx — asignación histórica #{n}",
                )
            )

    return events


# -----------------------------------------------------------
# MAIN
# -----------------------------------------------------------
def main():
    print("Leyendo Excel:", PATH_XLSX)
    df = pd.read_excel(PATH_XLSX, sheet_name="Equipos Asignados")

    # quedarnos sólo con filas que tengan SKU o Serie
    df = df[(df["SKU"].notna()) | (df["Nro Serie"].notna())].copy()

    all_events: list[dict] = []
    for _, row in df.iterrows():
        evs = row_to_events(row)
        all_events.extend(evs)

    events_df = pd.DataFrame(all_events)
    print(f"Eventos generados: {len(events_df)}")

    if events_df.empty:
        print("⚠️ No se generaron eventos. Revisa nombres de columnas.")
        return

    # -------- LIMPIEZA DE FECHA_EVENTO --------
    events_df["fecha_evento"] = pd.to_datetime(
        events_df["fecha_evento"], errors="coerce"
    )
    events_df["fecha_evento"] = events_df["fecha_evento"].dt.date

    # Filas sin fecha (NaT) -> las mostramos y las eliminamos
    mask_null = events_df["fecha_evento"].isna()
    n_null = mask_null.sum()
    if n_null > 0:
        print(
            f"⚠️ Filas sin fecha_evento: {n_null}, "
            "se eliminarán antes de insertar."
        )
        print(events_df[mask_null].head())

    # Nos quedamos solo con filas que SÍ tienen fecha
    events_df = events_df[~mask_null].copy()

    print("Eventos después de eliminar sin fecha:", len(events_df))
    print("Preview:")
    print(events_df.head())

    # ---- INSERTAR EN BD ----
    sku_unique = events_df["sku"].dropna().unique().tolist()
    serie_unique = events_df["nro_serie"].dropna().unique().tolist()

    with engine.begin() as conn:
        # Opcional: limpiar historia previa de esos equipos
        conn.execute(
            text(
                """
                DELETE FROM activos.historia_hw
                WHERE sku = ANY(:skus) OR nro_serie = ANY(:series)
                """
            ),
            {"skus": sku_unique, "series": serie_unique},
        )

        insert_sql = text(
            """
            INSERT INTO activos.historia_hw (
                sku,
                nro_serie,
                asset_tag,
                tipo_evento,
                fecha_evento,
                cliente,
                ciudad,
                persona,
                rut,
                pais,
                detalle
            )
            VALUES (
                :sku,
                :nro_serie,
                :asset_tag,
                :tipo_evento,
                :fecha_evento,
                :cliente,
                :ciudad,
                :persona,
                :rut,
                :pais,
                :detalle
            )
            """
        )

        conn.execute(insert_sql, events_df.to_dict(orient="records"))

    print("✅ Carga masiva terminada OK.")


if __name__ == "__main__":
    main()
