# ⚠️ ARCHIVO LEGACY / RESPALDO
# Este dashboard usa la BD antigua `inventario_equipos`.
# El dashboard oficial en producción es `hardware_dashboard.py` apuntando a `ti_ops`.

import datetime as dt
import os
from typing import Optional

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from sqlalchemy import create_engine

from hardware_client import (
    get_equipos_hw,
    get_historia_hw,
    get_estado_actual_hw,
)


# -------------------------------------------------
# Configuración básica de la página
# -------------------------------------------------
st.set_page_config(
    page_title="Dashboard Hardware & Compras MTR",
    layout="wide",
    page_icon="💻",
)

# -------------------------------------------------
# Estilos generales (KPI cards, timeline, etc.)
# -------------------------------------------------
st.markdown(
    """
<style>
body {
    background-color:#f5f5f7;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}

/* KPI cards */
.kpi-card {
    padding:0.9rem 1.1rem;
    border-radius:0.9rem;
    border:1px solid #e5e7eb;
    background:#ffffff;
    box-shadow:0 4px 10px rgba(15,23,42,0.03);
    margin-bottom:0.6rem;
}
.kpi-label {
    font-size:0.75rem;
    color:#6b7280;
    text-transform:uppercase;
    letter-spacing:0.06em;
}
.kpi-value {
    font-size:1.5rem;
    font-weight:600;
    color:#0f172a;
}
.kpi-footer {
    font-size:0.75rem;
    color:#9ca3af;
}

/* Chips */
.timeline-chip {
    display:inline-block;
    color:#ffffff;
    padding:0.15rem 0.7rem;
    border-radius:999px;
    font-size:0.7rem;
    font-weight:500;
}

/* Timeline */
.timeline-title {
    display:flex;
    align-items:center;
    gap:0.35rem;
    font-size:1.05rem;
    font-weight:600;
    margin-top:1.5rem;
    margin-bottom:0.75rem;
    color:#0f172a;
}
.timeline-title-icon {
    font-size:1.25rem;
}
.timeline-date {
    font-size:0.9rem;
    color:#6b7280;
}
.timeline-gap-alert {
    background:#e0f2fe;
    border-radius:0.75rem;
    padding:0.75rem 1rem;
    font-size:0.85rem;
    color:#0f172a;
}
.timeline-gap-alert ul {
    margin-top:0.3rem;
}

/* Notita de “no hay capex” */
.info-box {
    background:#e5edff;
    border-radius:0.9rem;
    padding:0.9rem 1rem;
    font-size:0.9rem;
    color:#111827;
}

/* Subtítulos pequeños con ícono */
.section-label {
    font-size:0.85rem;
    color:#6b7280;
    text-transform:uppercase;
    letter-spacing:0.08em;
}

/* Sección de compras */
.compras-kpi-title {
    font-size:0.75rem;
    text-transform:uppercase;
    color:#6b7280;
}
</style>
""",
    unsafe_allow_html=True,
)

# -------------------------------------------------
# Helpers generales
# -------------------------------------------------
def kpi_card(label: str, value, footer: str = "", color: str = "#0f766e"):
    """Tarjeta KPI pequeña."""
    st.markdown(
        f"""
        <div class="kpi-card">
          <div class="kpi-label">{label}</div>
          <div class="kpi-value" style="color:{color};">{value}</div>
          <div class="kpi-footer">{footer}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def fmt_clp(x) -> str:
    """Formatear montos CLP."""
    try:
        return "$" + f"{float(x):,.0f}".replace(",", ".")
    except Exception:
        return "$0"


def resumen_gaps(df_hist: pd.DataFrame, threshold_dias: int = 180):
    """Devuelve lista de textos con gaps largos entre eventos."""
    mensajes = []
    if df_hist is None or df_hist.empty:
        return mensajes

    if "fecha_evento" in df_hist.columns:
        fechas = pd.to_datetime(df_hist["fecha_evento"], errors="coerce")
    else:
        fechas = pd.to_datetime(df_hist["fecha_compra"], errors="coerce")

    diffs = (fechas.shift(-1) - fechas).dt.days

    for i, dias in enumerate(diffs[:-1]):
        if pd.isna(dias):
            continue
        try:
            f1 = fechas.iloc[i].date()
            f2 = fechas.iloc[i + 1].date()
        except Exception:
            continue
        if dias >= threshold_dias:
            mensajes.append(
                f"Gap de **{int(dias)} días** entre {f1} y {f2}."
            )
    return mensajes


# -------------------------------------------------
# FOTOS DE EQUIPOS (por modelo / SKU)
# -------------------------------------------------
IMAGE_DIR = os.path.dirname(os.path.abspath(__file__))

# Claves: texto que debe aparecer en (tipo_equipo + marca + modelo).lower()
# Valores: nombre base del archivo de imagen (sin extensión)
IMAGE_MAP_MODEL: dict[str, str] = {
    # ---------- APPLE ----------
    # Ordenador Apple Macbook Pro - Model A3401  (CPU: M4 Pro)
    "model a3401": "M4 Pro",
    "macbook pro m4": "M4 Pro",

    # Macbook Pro A2141 (varias formas posibles de que aparezca el modelo)
    "macbook pro a2141": "MacbookPro A2141",
    "macbook pro 16 a2141": "MacbookPro A2141",
    "model a2141": "MacbookPro A2141",
    "a2141": "MacbookPro A2141",

    # otros modelos Apple
    "macbook pro m3": "M3 Pro",
    "macbook pro m2": "M2 Pro",
    "macbook pro m1 pro": "M1 Pro",
    "macbook air m1": "M1",

    # ---------- ASUS ----------
    # Equipo: Ordenador Asus ZenBook 14 UX435E
    "asus zenbook 14": "Asus Zenbook 14",
    "zenbook 14 ux435e": "Asus Zenbook 14",

    # ---------- LENOVO ----------
    "ideapad s540-13iml": "Lenovo Ideapad S540-13IML",
    "lenovo ideapad s540-13iml": "Lenovo Ideapad S540-13IML",

    "thinkpad t14": "Lenovo Thinkpad T14",
    "lenovo thinkpad t14": "Lenovo Thinkpad T14",

    "thinkpad t480": "Lenovo Think Pad  T480",
    "lenovo thinkpad t480": "Lenovo Think Pad  T480",

    "thinkpad t490": "Lenovo Think Pad  T490",
    "lenovo thinkpad t490": "Lenovo Think Pad  T490",

    "thinkpad 470s": "Lenovo Think Pad 470s",
    "lenovo thinkpad 470s": "Lenovo Think Pad 470s",

    "x1 carbon gen 11": "Lenovo ThinkPad X1 Carbon Gen 11",
    "lenovo thinkpad x1 carbon": "Lenovo ThinkPad X1 Carbon Gen 11",

    "y40-80": "Lenovo Y40-80",
    "lenovo y40-80": "Lenovo Y40-80",

    # ---------- DELL ----------
    "latitude 5420": "Dell Latitude 5420",
    "dell latitude 5420": "Dell Latitude 5420",
    "dell latitude": "Dell Latitude",

    "vostro 5402": "Dell Vostro  5402",  # ojo con el doble espacio del archivo
    "dell vostro 5402": "Dell Vostro  5402",

    # ---------- HP ----------
    "elitebook 830 g5": "Hp Elitebook 830 G5",
    "hp elitebook 830 g5": "Hp Elitebook 830 G5",

    "elitebook 840 g8": "Hp Elitebook 840 G8",
    "hp elitebook 840 g8": "Hp Elitebook 840 G8",

    "elitebook 840 g10": "Hp Elitebook 840 G10",
    "hp elitebook 840 g10": "Hp Elitebook 840 G10",

    # HP Elitebook 840 G11
    "elitebook 840 g11": "Hp Elitebook 840 G11",
    "hp elitebook 840 g11": "Hp Elitebook 840 G11",

    "pavilion 14-dv2002la": "Hp Pavilion Model 14-dv2002la",
    "hp pavilion 14-dv2002la": "Hp Pavilion Model 14-dv2002la",
}

# Mapeo explícito por SKU → nombre base de archivo
IMAGE_MAP_SKU: dict[int, str] = {
    # Asus Zenbook 14 (SKU 215 en tu captura)
    215: "Asus Zenbook 14",

    # Lenovo Ideapad S540-13IML (ejemplo de tu captura, SKU 232)
    232: "Lenovo Ideapad S540-13IML",

    # Macbook Pro M4 Pro (SKU 490 en tu ejemplo)
    490: "M4 Pro",
    230: "MacbookPro A2141",

}


def _find_image_file(basename: str) -> Optional[str]:
    """
    Busca archivo de imagen probando extensiones comunes en la misma carpeta.
    """
    for ext in (".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"):
        candidate = os.path.join(IMAGE_DIR, basename + ext)
        if os.path.exists(candidate):
            return candidate
    return None


def get_equipo_image_path(row: pd.Series) -> Optional[str]:
    """
    Intenta encontrar la ruta de la imagen según información del equipo.
      1) Por modelo / marca / tipo_equipo (substring en minúsculas)
      2) Por SKU (acepta int, str, etc.)
    Devuelve la ruta completa o None si no encuentra nada.
    """
    # --- 1) Buscar por texto (modelo/marca/tipo_equipo) ---
    textos: list[str] = []
    for col in ("tipo_equipo", "marca", "modelo"):
        val = row.get(col)
        if isinstance(val, str) and val.strip():
            textos.append(val.strip().lower())

    full_text = " ".join(textos)

    if full_text:
        for key, basename in IMAGE_MAP_MODEL.items():
            if key in full_text:
                img_path = _find_image_file(basename)
                if img_path:
                    return img_path

    # --- 2) Fallback por SKU ---
    sku_val = row.get("sku")
    sku_int: Optional[int] = None

    if sku_val is not None:
        try:
            sku_int = int(str(sku_val).strip())
        except Exception:
            sku_int = None

    if sku_int is not None and sku_int in IMAGE_MAP_SKU:
        basename = IMAGE_MAP_SKU[sku_int]
        img_path = _find_image_file(basename)
        if img_path:
            return img_path

    # Nada encontrado
    return None


# -------------------------------------------------
# Datos base: INVENTARIO (BD inventario_equipos vía API)
# -------------------------------------------------
@st.cache_data(show_spinner="Cargando equipos desde la API …")
def cargar_equipos() -> pd.DataFrame:
    # Traemos equipos desde 2019 para incluir Mac viejos como tu A2141 (2021)
    df = get_equipos_hw(anio_desde=2019, anio_hasta=2025, limit=5000)

    # Normalizar tipos
    if "fecha_compra" in df.columns:
        df["fecha_compra"] = pd.to_datetime(df["fecha_compra"], errors="coerce")

    if "sku" in df.columns:
        df["sku"] = pd.to_numeric(df["sku"], errors="coerce").astype("Int64")

    return df


df_eq = cargar_equipos()

# -------------------------------------------------
# Datos base: COMPRAS (BD ti_ops, vistas MTR)
# -------------------------------------------------
engine_mtr = create_engine("postgresql://usuario:password@localhost:5432/ti_ops")

MESES_EN_ES = {
    "January": "Enero",
    "February": "Febrero",
    "March": "Marzo",
    "April": "Abril",
    "May": "Mayo",
    "June": "Junio",
    "July": "Julio",
    "August": "Agosto",
    "September": "Septiembre",
    "October": "Octubre",
    "November": "Noviembre",
    "December": "Diciembre",
}


def mes_a_espanol(texto: str) -> str:
    s = str(texto)
    for en, es in MESES_EN_ES.items():
        if en in s:
            s = s.replace(en, es)
    return s


@st.cache_data(show_spinner="Cargando compras anuales MTR …")
def cargar_compras_mtr():
    sql_anual = """
        SELECT *
        FROM activos.vw_compras_anual_mtr
        ORDER BY anio
    """

    sql_mensual = """
        SELECT *
        FROM activos.vw_compras_mensual_generica
    """

    df_anual = pd.read_sql(sql_anual, engine_mtr)
    df_mensual = pd.read_sql(sql_mensual, engine_mtr)

    # Normalizamos nombres de columnas a minúsculas
    df_anual.columns = df_anual.columns.str.lower()
    df_mensual.columns = df_mensual.columns.str.lower()

    # Ordenamos en pandas según lo que exista
    sort_cols = []
    if "anio" in df_mensual.columns:
        sort_cols.append("anio")

    if "mes_num" in df_mensual.columns:
        sort_cols.append("mes_num")
    elif "mes" in df_mensual.columns:
        sort_cols.append("mes")
    elif "mes_orden" in df_mensual.columns:
        sort_cols.append("mes_orden")

    if sort_cols:
        df_mensual = df_mensual.sort_values(sort_cols)

    return df_anual, df_mensual


# -------------------------------------------------
# HEADER GENERAL
# -------------------------------------------------
st.title("💻 Dashboard Hardware & Compras MTR 2022–2025")

# -------------------------------------------------
# Tabs principales
# -------------------------------------------------
tab_home, tab_2022, tab_2023, tab_2024, tab_2025, tab_hist, tab_compras = st.tabs(
    [
        "🏠 Home",
        "Inventario 2022",
        "Inventario 2023",
        "Inventario 2024",
        "Inventario 2025",
        "Historia por activo",
        "Compras (MTR)",
    ]
)
# -------------------------------------------------
# Helper: contenido para pestañas por año (INVENTARIO)
# -------------------------------------------------
# -------------------------------------------------
# Contenido pestañas de INVENTARIO 2022–2025
# -------------------------------------------------
with tab_2022:
    pestaña_por_anio(df_eq, 2022)

with tab_2023:
    pestaña_por_anio(df_eq, 2023)

with tab_2024:
    pestaña_por_anio(df_eq, 2024)

with tab_2025:
    pestaña_por_anio(df_eq, 2025)

# -------------------------------------------------
# Pestaña: Historia por activo
# -------------------------------------------------
with tab_hist:
    st.subheader("Historia completa de un equipo")

    # Inputs más pequeños + búsqueda por nombre
    col_sku, col_serie, col_nombre = st.columns([1, 1, 1.5])
    with col_sku:
        sku_busq = st.text_input("SKU", value="", placeholder="Ej: 314")
    with col_serie:
        serie_busq = st.text_input("Número de serie", value="")
    with col_nombre:
        nombre_busq = st.text_input(
            "Nombre (persona actual)", value="", placeholder="Ej: Beatriz Herrera"
        )

    buscar = st.button("Buscar historia")

    if buscar:
        # Resolver búsqueda por nombre si no viene SKU ni serie
        sku_int: Optional[int] = None

        if not (sku_busq or serie_busq or nombre_busq):
            st.warning("Ingresa al menos un criterio (SKU, número de serie o nombre).")
            st.stop()

        # Si hay SKU, lo intentamos convertir
        if sku_busq.strip():
            try:
                sku_int = int(float(sku_busq.strip()))
            except ValueError:
                st.error("El SKU debe ser un número (ej: 314).")
                st.stop()

        # Si no hay SKU ni serie, pero sí nombre → buscamos en df_eq
        if not sku_int and not serie_busq and nombre_busq.strip():
            if "persona_actual" not in df_eq.columns:
                st.error("El inventario no tiene columna 'persona_actual' para buscar.")
                st.stop()

            mask = df_eq["persona_actual"].astype(str).str.contains(
                nombre_busq.strip(), case=False, na=False
            )
            df_nom = df_eq[mask].copy()

            if df_nom.empty:
                st.warning(
                    "No se encontraron equipos para ese nombre en el inventario."
                )
                st.stop()

            # Dejar una sola fila por equipo (sku + nro_serie)
            if "sku" in df_nom.columns and "nro_serie" in df_nom.columns:
                sort_col = "fecha_compra" if "fecha_compra" in df_nom.columns else None
                if sort_col:
                    df_nom = (
                        df_nom.sort_values(sort_col)
                        .drop_duplicates(subset=["sku", "nro_serie"], keep="last")
                    )
                else:
                    df_nom = df_nom.drop_duplicates(
                        subset=["sku", "nro_serie"], keep="last"
                    )

            skus_encontrados = (
                df_nom["sku"].dropna().astype("Int64").drop_duplicates().tolist()
            )

            if len(skus_encontrados) > 1:
                st.warning(
                    "Hay más de un equipo para ese nombre. "
                    "Revisa la tabla y busca por SKU específico."
                )
                st.dataframe(
                    df_nom[["sku", "nro_serie", "persona_actual", "cliente_actual"]],
                    use_container_width=True,
                )
                st.stop()

            if not skus_encontrados:
                st.warning(
                    "No se pudo determinar un SKU único para ese nombre. "
                    "Intenta buscar por SKU directamente."
                )
                st.stop()

            sku_int = int(skus_encontrados[0])
            st.info(f"Buscando equipo por nombre → se usará SKU **{sku_int}**.")

        # Convertir serie a None si viene vacía
        serie_val = serie_busq or None

        if not (sku_int or serie_val):
            st.warning("Debes indicar al menos un SKU, número de serie o nombre.")
            st.stop()

        with st.spinner("Buscando historia del activo…"):
            # Historia
            df_hist = get_historia_hw(
                sku=sku_int,
                nro_serie=serie_val,
                asset_tag=None,
            )

            # Estado actual
            try:
                df_estado = get_estado_actual_hw(
                    sku=sku_int,
                    nro_serie=serie_val,
                    asset_tag=None,
                )
            except Exception:
                df_estado = pd.DataFrame()

        if df_hist is None or df_hist.empty:
            st.info("Upps !!! no hay historia para este equipo.")
            st.stop()

        # Normalizar fechas y ordenar
        if "fecha_evento" in df_hist.columns:
            df_hist["fecha_evento"] = pd.to_datetime(
                df_hist["fecha_evento"], errors="coerce"
            )
            df_hist = df_hist.sort_values("fecha_evento")
        elif "fecha_compra" in df_hist.columns:
            df_hist["fecha_compra"] = pd.to_datetime(
                df_hist["fecha_compra"], errors="coerce"
            )
            df_hist = df_hist.sort_values("fecha_compra")

        first = df_hist.iloc[0]
        last = df_hist.iloc[-1]

        st.markdown(
            f"**SKU:** {first.get('sku','')}  |  "
            f"**Nro serie:** {first.get('nro_serie','')}  |  "
            f"**Asset tag:** {first.get('asset_tag','')}"
        )

        if "fecha_evento" in df_hist.columns:
            f_ini = first["fecha_evento"].date()
            f_fin = last["fecha_evento"].date()
        else:
            f_ini = first.get("fecha_compra")
            f_fin = last.get("fecha_compra")
            if isinstance(f_ini, pd.Timestamp):
                f_ini = f_ini.date()
            if isinstance(f_fin, pd.Timestamp):
                f_fin = f_fin.date()

        st.markdown(
            f"**Primera fecha registrada:** {f_ini} → "
            f"**Última fecha registrada:** {f_fin}"
        )

        # -----------------------------
        # Resumen del equipo (enriquecido con inventario)
        # -----------------------------
        if isinstance(df_estado, pd.DataFrame) and not df_estado.empty:
            base_row = df_estado.iloc[0]
        else:
            base_row = last

        info_row = base_row.copy()

        try:
            sku_lookup = info_row.get("sku") or first.get("sku")
            serie_lookup = info_row.get("nro_serie") or first.get("nro_serie")

            if sku_lookup is not None and "sku" in df_eq.columns:
                mask_inv = df_eq["sku"].astype("Int64") == int(sku_lookup)

                if "nro_serie" in df_eq.columns and pd.notna(serie_lookup):
                    mask_inv &= (
                        df_eq["nro_serie"].astype(str) == str(serie_lookup)
                    )

                df_match = df_eq[mask_inv]

                if not df_match.empty:
                    inv = df_match.iloc[0]
                    for col in [
                        "tipo_equipo",
                        "marca",
                        "modelo",
                        "cpu",
                        "ram_gb",
                        "almacenamiento",
                    ]:
                        if col in inv and (
                            col not in info_row.index
                            or pd.isna(info_row.get(col))
                            or str(info_row.get(col)).strip() == ""
                        ):
                            info_row[col] = inv[col]
        except Exception:
            pass

        col_a, col_b, col_c = st.columns([2, 2, 1])

        with col_a:
            st.markdown(
                f"**SKU:** {info_row.get('sku','')}  \n"
                f"**Nro serie:** {info_row.get('nro_serie','')}  \n"
                f"**Asset tag:** {info_row.get('asset_tag','')}"
            )
        with col_b:
            st.markdown(
                f"**Equipo:** {info_row.get('tipo_equipo','')} "
                f"{info_row.get('marca','')} {info_row.get('modelo','')}  \n"
                f"**CPU:** {info_row.get('cpu','')}  \n"
                f"**RAM:** {info_row.get('ram_gb','')}  \n"
                f"**Almacenamiento:** {info_row.get('almacenamiento','')}"
            )
        with col_c:
            foto_path = get_equipo_image_path(info_row)
            if foto_path:
                st.image(foto_path, use_container_width=True)
            else:
                st.markdown(
                    "<div style='font-size:0.8rem; color:#9ca3af; text-align:right;'>"
                    "Sin foto disponible</div>",
                    unsafe_allow_html=True,
                )

        # -----------------------------
        # Gaps largos sin movimientos
        # -----------------------------
        gaps = resumen_gaps(df_hist, threshold_dias=180)
        if gaps:
            st.markdown(
                "<div class='timeline-gap-alert'>"
                "🔍 <strong>Se detectaron períodos largos sin movimientos:</strong>"
                "<ul>"
                + "".join(f"<li>{g}</li>" for g in gaps)
                + "</ul></div>",
                unsafe_allow_html=True,
            )

        # -----------------------------
        # Línea de tiempo
        # -----------------------------
        st.markdown(
            '<div class="timeline-title">'
            '<span class="timeline-title-icon">🕒</span>'
            "<span>Línea de tiempo del equipo</span>"
            "</div>",
            unsafe_allow_html=True,
        )

        # calcular días hasta siguiente evento
        if "fecha_evento" in df_hist.columns:
            fechas = pd.to_datetime(df_hist["fecha_evento"], errors="coerce")
        else:
            fechas = pd.to_datetime(df_hist["fecha_compra"], errors="coerce")

        df_hist["dias_hasta_siguiente"] = (fechas.shift(-1) - fechas).dt.days

        for _, row in df_hist.iterrows():
            fecha_val = row.get("fecha_evento") or row.get("fecha_compra")
            fecha_str = str(fecha_val)[:10]

            tipo_evt = (row.get("tipo_evento") or "").upper()

            # ícono + color
            if tipo_evt == "COMPRA":
                icono, badge = "🛒", "#22c55e"
            elif tipo_evt == "ASIGNACION":
                icono, badge = "👤", "#3b82f6"
            elif tipo_evt == "ASIGNACION_ACTUAL":
                icono, badge = "⭐", "#facc15"
            elif tipo_evt == "REPARACION":
                icono, badge = "🛠", "#f97316"
            else:
                icono, badge = "📌", "#6b7280"

            cliente = row.get("cliente", "") or ""
            ciudad = row.get("ciudad", "") or ""
            detalle = row.get("detalle", "") or ""

            dias_sig = row.get("dias_hasta_siguiente")
            if pd.notna(dias_sig):
                duracion_html = (
                    "<div style='margin-top:0.25rem; "
                    "font-size:0.8rem; color:#6b7280;'>"
                    f"⏱ {int(dias_sig)} días hasta el siguiente evento</div>"
                )
            else:
                duracion_html = ""

            html = f"""
<div style="padding:1rem; background:#fafafa; border-radius:10px; margin-bottom:1rem; border:1px solid #e5e7eb;">
  <div style="font-size:0.9rem; color:#6b7280;">{fecha_str}</div>
  <div style="margin-top:0.2rem; font-weight:600;">
    {icono}
    <span class="timeline-chip" style="background:{badge};">{tipo_evt}</span>
  </div>
  <div style="margin-top:0.35rem; color:#334155;">
    {cliente} - {ciudad}
  </div>
  <div style="margin-top:0.3rem; font-size:0.9rem; color:#334155;">
    {detalle}
  </div>
  {duracion_html}
</div>
"""
            st.markdown(html, unsafe_allow_html=True)

        # -----------------------------
        # Tabla detallada + por tipo
        # -----------------------------
        st.markdown("### Historial del equipo (detalle)")
        st.dataframe(df_hist, use_container_width=True)

        if "tipo_evento" in df_hist.columns:
            st.markdown("### Eventos por tipo")
            for tipo_evt in sorted(df_hist["tipo_evento"].dropna().unique()):
                df_tipo = df_hist[df_hist["tipo_evento"] == tipo_evt]
                with st.expander(f"{tipo_evt} ({len(df_tipo)})"):
                    st.dataframe(df_tipo, use_container_width=True)

# -------------------------------------------------
# Pestaña: Compras MTR (multi-año)
# -------------------------------------------------
with tab_compras:
    st.subheader("🛒 Compras MTR — Multi-año")

    try:
        df_compras_anual, df_compras_mensual = cargar_compras_mtr()
    except Exception as e:
        st.warning(
            "No fue posible cargar las vistas `vw_compras_anual_mtr` o "
            "`vw_compras_mensual_generica`. Revisa la BD `ti_ops`."
        )
        st.error(f"Detalle del error: {e}")
        st.stop()

    if df_compras_anual.empty or df_compras_mensual.empty:
        st.warning(
            "No fue posible cargar las vistas `vw_compras_anual_mtr` o "
            "`vw_compras_mensual_generica` (no devuelven filas). "
            "Revisa la BD `ti_ops`."
        )
        st.stop()

    # Normalizar nombres
    df_ca = df_compras_anual.copy()
    df_ca.columns = df_ca.columns.str.lower()

    df_m_mes = df_compras_mensual.copy()
    df_m_mes.columns = df_m_mes.columns.str.lower()

    col_anio = "anio"
    col_cant = "cantidad_total_equipos"
    col_mac = "gasto_mac"
    col_win = "gasto_windows"
    col_mac_iva = "gasto_mac_con_iva"
    col_win_iva = "gasto_win_con_iva"

    # Asegurar tipos
    if col_anio in df_ca.columns:
        df_ca[col_anio] = pd.to_numeric(df_ca[col_anio], errors="coerce").astype(
            "Int64"
        )

    for col in [col_cant, col_mac, col_win, col_mac_iva, col_win_iva]:
        if col in df_ca.columns:
            df_ca[col] = df_ca[col].fillna(0).astype(float)

    # En mensual aseguramos anio y mes_num
    if "anio" in df_m_mes.columns:
        df_m_mes["anio"] = pd.to_numeric(
            df_m_mes["anio"], errors="coerce"
        ).astype("Int64")

    mes_num_col = None
    if "mes_num" in df_m_mes.columns:
        mes_num_col = "mes_num"
    elif "mes" in df_m_mes.columns:
        mes_num_col = "mes"
    elif "mes_orden" in df_m_mes.columns:
        mes_num_col = "mes_orden"

    if mes_num_col:
        df_m_mes[mes_num_col] = (
            pd.to_numeric(df_m_mes[mes_num_col], errors="coerce")
            .fillna(0)
            .astype(int)
        )

    # -----------------------------
    # Sub-pestañas por año (sin duplicados)
    # -----------------------------
    years_series = df_ca[col_anio].dropna()

    try:
        years_series = years_series.astype(int)
    except Exception:
        years_series = pd.to_numeric(years_series, errors="coerce").dropna().astype(int)

    years = sorted(set(years_series.tolist()))

    labels = ["Resumen multi-año"] + [str(y) for y in years]
    tabs_year = st.tabs(labels)

    tab_multi = tabs_year[0]
    year_tab_map = {year: tabs_year[i + 1] for i, year in enumerate(years)}

    # ========= pestaña MULTI-AÑO =========
    with tab_multi:
        st.markdown("### Resumen multi-año")

        total_equipos = int(df_ca[col_cant].sum())
        total_mac_sin = float(df_ca[col_mac].sum())
        total_win_sin = float(df_ca[col_win].sum())
        total_mac_con = float(df_ca[col_mac_iva].sum())
        total_win_con = float(df_ca[col_win_iva].sum())
        total_con = total_mac_con + total_win_con

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            kpi_card("Equipos comprados (multi-año)", total_equipos, "", "#0f766e")
        with col2:
            kpi_card(
                "Gasto MAC sin IVA",
                fmt_clp(total_mac_sin),
                "Sumatoria años",
                "#2563eb",
            )
        with col3:
            kpi_card(
                "Gasto Windows sin IVA",
                fmt_clp(total_win_sin),
                "Sumatoria años",
                "#7c3aed",
            )
        with col4:
            kpi_card(
                "Gasto total con IVA",
                fmt_clp(total_con),
                "MAC + Windows",
                "#b91c1c",
            )

        st.markdown("#### Totales por año")
        st.dataframe(
            df_ca[[col_anio, col_cant, col_mac, col_win, col_mac_iva, col_win_iva]],
            use_container_width=True,
        )

    # ========= pestañas por AÑO =========
    for year, tab in year_tab_map.items():
        with tab:
            st.markdown(f"### Compras año {year}")

            df_anio = df_ca[df_ca[col_anio] == year].copy()
            df_m_anio = df_m_mes[df_m_mes["anio"] == year].copy()

            # KPIs por año
            if not df_anio.empty:
                row_a = df_anio.iloc[0]
                anio_equipos = int(row_a.get(col_cant, 0))
                anio_mac_sin = float(row_a.get(col_mac, 0))
                anio_win_sin = float(row_a.get(col_win, 0))
                anio_mac_con = float(row_a.get(col_mac_iva, 0))
                anio_win_con = float(row_a.get(col_win_iva, 0))
                anio_con = anio_mac_con + anio_win_con

                c1, c2, c3, c4 = st.columns(4)
                c1.metric(f"Equipos comprados {year}", anio_equipos)
                c2.metric("MAC (sin IVA)", fmt_clp(anio_mac_sin))
                c3.metric("Windows (sin IVA)", fmt_clp(anio_win_sin))
                c4.metric("Total (con IVA)", fmt_clp(anio_con))
            else:
                st.info("No hay registro anual para este año.")

            st.markdown("### 🗓️ Detalle mensual de compras (MTR)")

            if df_m_anio.empty:
                st.info("No hay detalle mensual para este año.")
                continue

            if mes_num_col:
                df_m_anio = df_m_anio.sort_values(mes_num_col)

            df_cards = df_m_anio[
                df_m_anio.get("cantidad_total_equipos", 0) > 0
            ].copy()

            for _, row in df_cards.iterrows():
                mes_label = row.get("mes_display") or row.get("mes") or ""
                mes_label = mes_a_espanol(mes_label)

                cant = int(row.get("cantidad_total_equipos", 0))

                mac_sin = float(row.get("gasto_mac", 0.0))
                win_sin = float(row.get("gasto_windows", 0.0))
                mac_con = float(row.get("gasto_mac_con_iva", 0.0))
                win_con = float(row.get("gasto_win_con_iva", 0.0))

                total_sin = mac_sin + win_sin
                total_con_mes = mac_con + win_con

                mac_pct = (mac_sin / total_sin * 100) if total_sin > 0 else 0
                win_pct = (win_sin / total_sin * 100) if total_sin > 0 else 0

                html_code = f"""
        <div style="
            border:1px solid #e3e6ec;
            border-radius:16px;
            padding:1.5rem;
            margin-bottom:1rem;
            background-color:#fafbff;
            width:900px;
            font-family:Inter, -apple-system, system-ui, sans-serif;
        ">

          <div style="font-size:0.75rem; text-transform:uppercase; color:#6b7280;">
            MES
          </div>
          <div style="font-size:1.3rem; font-weight:700; color:#111827;">
            {mes_label} {year}
          </div>

          <div style="margin-top:0.3rem; font-size:0.95rem; color:#374151;">
            Equipos comprados: <strong>{cant}</strong>
          </div>

          <hr style="margin:1rem 0; border:0.5px solid #e5e7eb;">

          <div style="display:flex; justify-content:space-between;">

            <!-- MAC -->
            <div>
              <div style="font-size:0.75rem; color:#6b7280;">MAC</div>
              <div style="font-size:0.85rem; color:#6b7280;">Sin IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#111827;">
                {fmt_clp(mac_sin)}
              </div>
              <div style="margin-top:0.25rem; font-size:0.85rem; color:#6b7280;">Con IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#b00020;">
                {fmt_clp(mac_con)}
              </div>
              <div style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">
                Participación: <strong>{mac_pct:.1f}%</strong>
              </div>
            </div>

            <!-- WINDOWS -->
            <div>
              <div style="font-size:0.75rem; color:#6b7280;">Windows</div>
              <div style="font-size:0.85rem; color:#6b7280;">Sin IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#111827;">
                {fmt_clp(win_sin)}
              </div>
              <div style="margin-top:0.25rem; font-size:0.85rem; color:#6b7280;">Con IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#b00020;">
                {fmt_clp(win_con)}
              </div>
              <div style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">
                Participación: <strong>{win_pct:.1f}%</strong>
              </div>
            </div>

            <!-- TOTALES -->
            <div>
              <div style="font-size:0.75rem; color:#6b7280;">Total mes</div>
              <div style="font-size:0.85rem; color:#6b7280;">Sin IVA</div>
              <div style="font-size:1.1rem; font-weight:700; color:#0b3a53;">
                {fmt_clp(total_sin)}
              </div>
              <div style="margin-top:0.25rem; font-size:0.85rem; color:#6b7280;">Con IVA</div>
              <div style="font-size:1.1rem; font-weight:700; color:#b00020;">
                {fmt_clp(total_con_mes)}
              </div>
            </div>

          </div>

        </div>
        """

                components.html(html_code, height=260)


##############  version 2.0.00
import datetime as dt
import os
from typing import Optional

import altair as alt
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from sqlalchemy import create_engine

from hardware_client import (
    get_equipos_hw,
    get_historia_hw,
    get_estado_actual_hw,
)

# -------------------------------------------------
# Configuración básica de la página
# -------------------------------------------------
st.set_page_config(
    page_title="Dashboard Hardware & Compras MTR",
    layout="wide",
    page_icon="💻",
)

# -------------------------------------------------
# CONEXIONES A BBDD
# -------------------------------------------------
# Base con catastro detallado de equipos
engine_inv = create_engine(
    "postgresql://usuario:password@localhost:5432/inventario_equipos"
)

# Base con vistas MTR (compras, etc.)
engine_mtr = create_engine("postgresql://usuario:password@localhost:5432/ti_ops")

# -------------------------------------------------
# Estilos generales (KPI cards, timeline, etc.)
# -------------------------------------------------
st.markdown(
    """
<style>
body {
    background-color:#f5f5f7;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}

/* KPI cards */
.kpi-card {
    padding:0.9rem 1.1rem;
    border-radius:0.9rem;
    border:1px solid #e5e7eb;
    background:#ffffff;
    box-shadow:0 4px 10px rgba(15,23,42,0.03);
    margin-bottom:0.6rem;
}
.kpi-label {
    font-size:0.75rem;
    color:#6b7280;
    text-transform:uppercase;
    letter-spacing:0.06em;
}
.kpi-value {
    font-size:1.5rem;
    font-weight:600;
    color:#0f172a;
}
.kpi-footer {
    font-size:0.75rem;
    color:#9ca3af;
}

/* Chips */
.timeline-chip {
    display:inline-block;
    color:#ffffff;
    padding:0.15rem 0.7rem;
    border-radius:999px;
    font-size:0.7rem;
    font-weight:500;
}

/* Timeline */
.timeline-title {
    display:flex;
    align-items:center;
    gap:0.35rem;
    font-size:1.05rem;
    font-weight:600;
    margin-top:1.5rem;
    margin-bottom:0.75rem;
    color:#0f172a;
}
.timeline-title-icon {
    font-size:1.25rem;
}
.timeline-date {
    font-size:0.9rem;
    color:#6b7280;
}
.timeline-gap-alert {
    background:#e0f2fe;
    border-radius:0.75rem;
    padding:0.75rem 1rem;
    font-size:0.85rem;
    color:#0f172a;
}
.timeline-gap-alert ul {
    margin-top:0.3rem;
}

/* Notita de “no hay capex” */
.info-box {
    background:#e5edff;
    border-radius:0.9rem;
    padding:0.9rem 1rem;
    font-size:0.9rem;
    color:#111827;
}

/* Subtítulos pequeños con ícono */
.section-label {
    font-size:0.85rem;
    color:#6b7280;
    text-transform:uppercase;
    letter-spacing:0.08em;
}

/* Sección de compras */
.compras-kpi-title {
    font-size:0.75rem;
    text-transform:uppercase;
    color:#6b7280;
}

/* ==== Paneles tipo dashboard (Home) ==== */
.panel-card {
    background:#ffffff;
    border-radius:0.9rem;
    border:1px solid #e5e7eb;
    box-shadow:0 8px 18px rgba(15,23,42,0.06);
    padding:0.9rem 1rem 0.6rem 1rem;
    margin-bottom:0.4rem;
}
.panel-title {
    font-size:0.8rem;
    text-transform:uppercase;
    letter-spacing:0.08em;
    color:#ef4444; /* rojo estilo plantilla */
    margin-bottom:0.15rem;
}
.panel-subtitle {
    font-size:0.75rem;
    color:#6b7280;
    margin-bottom:0.35rem;
}
.panel-main-row {
    display:flex;
    align-items:baseline;
    gap:0.35rem;
}
.panel-main-value {
    font-size:1.4rem;
    font-weight:700;
    color:#111827;
}
.panel-main-label {
    font-size:0.8rem;
    color:#6b7280;
}
.panel-helper {
    font-size:0.7rem;
    color:#9ca3af;
    margin-top:0.15rem;
}
</style>
""",
    unsafe_allow_html=True,
)

# -------------------------------------------------
# Helpers generales
# -------------------------------------------------
def kpi_card(label: str, value, footer: str = "", color: str = "#0f766e"):
    """Tarjeta KPI pequeña."""
    st.markdown(
        f"""
        <div class="kpi-card">
          <div class="kpi-label">{label}</div>
          <div class="kpi-value" style="color:{color};">{value}</div>
          <div class="kpi-footer">{footer}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def panel_card(
    title: str,
    subtitle: str,
    main_value: str,
    main_label: str = "",
    helper_text: str = "",
):
    """
    Tarjeta estilo panel del Home (similar a la plantilla que mostraste).
    El gráfico se dibuja aparte debajo, en la misma columna.
    """
    st.markdown(
        f"""
        <div class="panel-card">
          <div class="panel-title">{title}</div>
          <div class="panel-subtitle">{subtitle}</div>
          <div class="panel-main-row">
            <div class="panel-main-value">{main_value}</div>
            <div class="panel-main-label">{main_label}</div>
          </div>
          <div class="panel-helper">{helper_text}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def fmt_clp(x) -> str:
    """Formatear montos CLP."""
    try:
        return "$" + f"{float(x):,.0f}".replace(",", ".")
    except Exception:
        return "$0"


def resumen_gaps(df_hist: pd.DataFrame, threshold_dias: int = 180):
    """Devuelve lista de textos con gaps largos entre eventos."""
    mensajes = []
    if df_hist is None or df_hist.empty:
        return mensajes

    if "fecha_evento" in df_hist.columns:
        fechas = pd.to_datetime(df_hist["fecha_evento"], errors="coerce")
    else:
        fechas = pd.to_datetime(df_hist["fecha_compra"], errors="coerce")

    diffs = (fechas.shift(-1) - fechas).dt.days

    for i, dias in enumerate(diffs[:-1]):
        if pd.isna(dias):
            continue
        try:
            f1 = fechas.iloc[i].date()
            f2 = fechas.iloc[i + 1].date()
        except Exception:
            continue
        if dias >= threshold_dias:
            mensajes.append(
                f"Gap de **{int(dias)} días** entre {f1} y {f2}."
            )
    return mensajes

# -------------------------------------------------
# FOTOS DE EQUIPOS – AUTO-DETECTOR (REEMPLAZADO)
# -------------------------------------------------
import os
from typing import Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Carpetas donde buscar imágenes
IMAGE_DIRS = [
    BASE_DIR,
    os.path.join(BASE_DIR, "catastro"),
    os.path.join(BASE_DIR, "imagenes"),
    os.path.join(BASE_DIR, "img"),
]

EXTS = (".png", ".jpg", ".jpeg", ".webp", ".PNG", ".JPG", ".JPEG", ".WEBP")


def _normalize(s: str) -> str:
    """Normaliza texto para comparar nombres de archivos."""
    return (
        str(s)
        .lower()
        .replace(" ", "")
        .replace("-", "")
        .replace("_", "")
        .replace(".", "")
    )


def _find_image_file_auto(patterns: list[str]) -> Optional[str]:
    """Busca una imagen que contenga alguno de los patrones normalizados."""
    if not patterns:
        return None

    patterns = [_normalize(p) for p in patterns if p]

    for folder in IMAGE_DIRS:
        try:
            for fname in os.listdir(folder):
                fname_norm = _normalize(fname)
                if any(p in fname_norm for p in patterns):
                    if any(fname.lower().endswith(ext) for ext in EXTS):
                        return os.path.join(folder, fname)
        except FileNotFoundError:
            continue

    return None


def get_equipo_image_path(row) -> Optional[str]:
    """
    Sistema automático de detección de imágenes:
    - Usa tipo_equipo, marca, modelo y SKU
    - Detecta coincidencias por substring flexible
    - No requiere mapeo
    """
    patrones = []

    # Modelo, marca, tipo_equipo
    for col in ("tipo_equipo", "marca", "modelo"):
        val = row.get(col)
        if isinstance(val, str) and val.strip():
            patrones.append(val.strip())

    # Versión compacta
    if patrones:
        patrones.append("".join(_normalize(p) for p in patrones))

    # SKU
    sku = row.get("sku")
    try:
        patrones.append(str(int(sku)))
    except:
        pass

    return _find_image_file_auto(patrones)



def get_equipo_image_path(row) -> Optional[str]:
    """
    Sistema automático de detección de imágenes:
    - Usa tipo_equipo, marca, modelo y SKU
    - Detecta coincidencias por substring flexible
    - No requiere mapear modelos ni SKUs
    - Encuentra imágenes aunque el archivo tenga nombres raros
    """
    patrones = []

    # Modelo / marca / tipo_equipo
    for col in ("tipo_equipo", "marca", "modelo"):
        val = row.get(col)
        if isinstance(val, str) and val.strip():
            patrones.append(val.strip())

    # Versión compactada (ej: "macbookprom1pro")
    if patrones:
        patrones.append("".join(_normalize(p) for p in patrones))

    # SKU
    sku = row.get("sku")
    try:
        patrones.append(str(int(sku)))
    except:
        pass

    # Buscar en todas las carpetas
    return _find_image_file_auto(patrones)



def get_equipo_image_path(row: pd.Series) -> Optional[str]:
    """
    Busca la foto correcta mediante:
    - modelo / marca / tipo_equipo
    - nombre del archivo que contenga parte del modelo
    - SKU en el nombre del archivo
    - coincidencia flexible total
    """

    patrones = []

    # --- 1) Añadir modelo / marca / tipo_equipo ---
    for col in ("tipo_equipo", "marca", "modelo"):
        val = row.get(col)
        if isinstance(val, str) and val.strip():
            patrones.append(val.strip())

    # Versión compacta del conjunto de textos
    if patrones:
        patrones.append("".join(_normalize(p) for p in patrones))

    # --- 2) Añadir SKU ---
    sku = row.get("sku")
    try:
        sku_int = int(sku)
        patrones.append(str(sku_int))
    except:
        pass

    # --- 3) Buscar en todas las carpetas ---
    img = _find_image_file_auto(patrones)
    return img


def get_equipo_image_path(row: pd.Series) -> Optional[str]:
    """
    Intenta encontrar la ruta de la imagen según información del equipo.
      1) Por modelo / marca / tipo_equipo (substring en minúsculas)
      2) Por SKU (acepta int, str, etc.)
    """
    textos: list[str] = []
    for col in ("tipo_equipo", "marca", "modelo"):
        val = row.get(col)
        if isinstance(val, str) and val.strip():
            textos.append(val.strip().lower())

    full_text = " ".join(textos)

    # 1) Coincidencia por modelo/marca
    if full_text:
        for key, basename in IMAGE_MAP_MODEL.items():
            if key in full_text:
                img_path = _find_image_file(basename)
                if img_path:
                    return img_path

    # 2) Fallback por SKU
    sku_val = row.get("sku")
    sku_int: Optional[int] = None
    if sku_val is not None:
        try:
            sku_int = int(str(sku_val).strip())
        except Exception:
            sku_int = None

    if sku_int is not None and sku_int in IMAGE_MAP_SKU:
        basename = IMAGE_MAP_SKU[sku_int]
        img_path = _find_image_file(basename)
        if img_path:
            return img_path

    return None

def get_equipo_image_path(row: pd.Series) -> Optional[str]:
    """
    Intenta encontrar la ruta de la imagen según información del equipo.
      1) Por modelo / marca / tipo_equipo (substring en minúsculas)
      2) Por SKU (acepta int, str, etc.)
    """
    textos: list[str] = []
    for col in ("tipo_equipo", "marca", "modelo"):
        val = row.get(col)
        if isinstance(val, str) and val.strip():
            textos.append(val.strip().lower())

    full_text = " ".join(textos)

    if full_text:
        for key, basename in IMAGE_MAP_MODEL.items():
            if key in full_text:
                img_path = _find_image_file(basename)
                if img_path:
                    return img_path

    # Fallback por SKU
    sku_val = row.get("sku")
    sku_int: Optional[int] = None
    if sku_val is not None:
        try:
            sku_int = int(str(sku_val).strip())
        except Exception:
            sku_int = None

    if sku_int is not None and sku_int in IMAGE_MAP_SKU:
        basename = IMAGE_MAP_SKU[sku_int]
        img_path = _find_image_file(basename)
        if img_path:
            return img_path

    return None


# -------------------------------------------------
# INVENTARIO COMBINADO (API + inventario_equipos)
# -------------------------------------------------
@st.cache_data(show_spinner="Cargando equipos (API + inventario)…")
def cargar_inventario_combinado() -> pd.DataFrame:
    frames = []

    # 1) Desde la API /hw/equipos (normalmente ti_ops)
    try:
        df_api = get_equipos_hw(anio_desde=2019, anio_hasta=2025, limit=5000)
        if df_api is not None and not df_api.empty:
            if "fecha_compra" in df_api.columns:
                df_api["fecha_compra"] = pd.to_datetime(
                    df_api["fecha_compra"], errors="coerce"
                )
            if "sku" in df_api.columns:
                df_api["sku"] = pd.to_numeric(df_api["sku"], errors="coerce").astype(
                    "Int64"
                )
            df_api["origen_inventario"] = "api_hw"
            frames.append(df_api)
    except Exception as e:
        print("[HOME] Error cargando equipos desde API:", e)

    # 2) Desde la base inventario_equipos.activos.equipos
    try:
        sql = """
            SELECT
                sku,
                nro_serie,
                asset_tag,
                tipo_equipo,
                marca,
                modelo,
                cpu,
                ram_gb,
                almacenamiento,
                estado,
                fecha_compra,
                cliente_actual,
                persona_actual,
                pais_actual,
                ciudad_actual,
                perfil_actual
            FROM activos.equipos
        """
        df_sql = pd.read_sql(sql, engine_inv)

        if df_sql is not None and not df_sql.empty:
            df_sql["fecha_compra"] = pd.to_datetime(
                df_sql["fecha_compra"], errors="coerce"
            )
            df_sql["sku"] = pd.to_numeric(df_sql["sku"], errors="coerce").astype(
                "Int64"
            )
            df_sql["origen_inventario"] = "inventario_equipos"
            frames.append(df_sql)
    except Exception as e:
        print("[HOME] Error leyendo activos.equipos en inventario_equipos:", e)

    if not frames:
        return pd.DataFrame()

    df_all = pd.concat(frames, ignore_index=True, sort=False)

    # Deduplicar por (sku, nro_serie), dando prioridad a inventario_equipos
    if "sku" in df_all.columns:
        df_all["prioridad"] = df_all["origen_inventario"].map(
            {"inventario_equipos": 0, "api_hw": 1}
        ).fillna(2)

        df_all = df_all.sort_values(
            by=["sku", "nro_serie", "prioridad"], ascending=[True, True, True]
        )
        df_all = df_all.drop_duplicates(subset=["sku", "nro_serie"], keep="first")
        df_all = df_all.drop(columns=["prioridad"])

    return df_all


# df maestro que usan Home e Inventario 20XX
df_eq = cargar_inventario_combinado()

# -------------------------------------------------
# Datos base: COMPRAS (BD ti_ops, vistas MTR)
# -------------------------------------------------
MESES_EN_ES = {
    "January": "Enero",
    "February": "Febrero",
    "March": "Marzo",
    "April": "Abril",
    "May": "Mayo",
    "June": "Junio",
    "July": "Julio",
    "August": "Agosto",
    "September": "Septiembre",
    "October": "Octubre",
    "November": "Noviembre",
    "December": "Diciembre",
}


def mes_a_espanol(texto: str) -> str:
    s = str(texto)
    for en, es in MESES_EN_ES.items():
        if en in s:
            s = s.replace(en, es)
    return s


@st.cache_data(show_spinner="Cargando compras anuales MTR …")
def cargar_compras_mtr():
    sql_anual = """
        SELECT *
        FROM activos.vw_compras_anual_mtr
        ORDER BY anio
    """

    sql_mensual = """
        SELECT *
        FROM activos.vw_compras_mensual_generica
    """

    df_anual = pd.read_sql(sql_anual, engine_mtr)
    df_mensual = pd.read_sql(sql_mensual, engine_mtr)

    df_anual.columns = df_anual.columns.str.lower()
    df_mensual.columns = df_mensual.columns.str.lower()

    sort_cols = []
    if "anio" in df_mensual.columns:
        sort_cols.append("anio")
    if "mes_num" in df_mensual.columns:
        sort_cols.append("mes_num")
    elif "mes" in df_mensual.columns:
        sort_cols.append("mes")
    elif "mes_orden" in df_mensual.columns:
        sort_cols.append("mes_orden")

    if sort_cols:
        df_mensual = df_mensual.sort_values(sort_cols)

    return df_anual, df_mensual


# -------------------------------------------------
# HEADER GENERAL
# -------------------------------------------------
st.title("💻 Dashboard Hardware & Compras MTR 2022–2025")

# -------------------------------------------------
# Tabs principales (incluye Home)
# -------------------------------------------------
tab_home, tab_2022, tab_2023, tab_2024, tab_2025, tab_hist, tab_compras = st.tabs(
    [
        "🏠 Home",
        "Inventario 2022",
        "Inventario 2023",
        "Inventario 2024",
        "Inventario 2025",
        "Historia por activo",
        "Compras (MTR)",
    ]
)

# -------------------------------------------------
# HOME DASHBOARD — estilo tablero
# -------------------------------------------------
# -------------------------------------------------
    # ---- Vista rápida con foto ----
st.markdown("#### Vista rápida de un equipo (con foto)")

if "sku" in df_filt.columns:
        df_preview = df_filt.copy()
        df_preview["label"] = df_preview.apply(
            lambda r: f"{r.get('sku','')} - {r.get('marca','')} {r.get('modelo','')} - {r.get('persona_actual','')}",
            axis=1,
        )

        opcion = st.selectbox(
            "Selecciona un equipo para ver su foto:",
            options=df_preview["label"].tolist(),
            key=f"preview_{anio}",      # <<< también clave única
        )

        row_sel = df_preview[df_preview["label"] == opcion].iloc[0]

        col_a, col_b = st.columns([1.5, 1])
        with col_a:
            st.markdown(
                f"**SKU:** {row_sel.get('sku','')}  \n"
                f"**Nro serie:** {row_sel.get('nro_serie','')}  \n"
                f"**Asset tag:** {row_sel.get('asset_tag','')}  \n"
                f"**Equipo:** {row_sel.get('tipo_equipo','')} "
                f"{row_sel.get('marca','')} {row_sel.get('modelo','')}  \n"
                f"**CPU:** {row_sel.get('cpu','')}  \n"
                f"**RAM:** {row_sel.get('ram_gb','')}  \n"
                f"**Almacenamiento:** {row_sel.get('almacenamiento','')}  \n"
                f"**Persona actual:** {row_sel.get('persona_actual','')}  \n"
                f"**Cliente actual:** {row_sel.get('cliente_actual','')}  \n"
                f"**Ubicación:** {row_sel.get('ciudad_actual','')} - {row_sel.get('pais_actual','')}"
            )
        with col_b:
            foto_path = get_equipo_image_path(row_sel)
            if foto_path:
                st.image(foto_path, use_container_width=True)
            else:
                st.markdown(
                    "<div style='font-size:0.8rem; color:#9ca3af; text-align:right;'>"
                    "Sin foto disponible</div>",
                    unsafe_allow_html=True,
                )

    # ---- Capex (placeholder) ----
    st.markdown("#### Capex anual (si está disponible)")
    st.markdown(
        "<div class='info-box'>Aún no hay datos de <code>costo_compra</code> para calcular capex.</div>",
        unsafe_allow_html=True,
    )


    # ---- Vista rápida con foto ----
    st.markdown("#### Vista rápida de un equipo (con foto)")

    if "sku" in df_filt.columns:
        df_preview = df_filt.copy()
        df_preview["label"] = df_preview.apply(
            lambda r: f"{r.get('sku','')} - {r.get('marca','')} {r.get('modelo','')} - {r.get('persona_actual','')}",
            axis=1,
        )

        opcion = st.selectbox(
            "Selecciona un equipo para ver su foto:",
            options=df_preview["label"].tolist(),
        )

        row_sel = df_preview[df_preview["label"] == opcion].iloc[0]

        col_a, col_b = st.columns([1.5, 1])
        with col_a:
            st.markdown(
                f"**SKU:** {row_sel.get('sku','')}  \n"
                f"**Nro serie:** {row_sel.get('nro_serie','')}  \n"
                f"**Asset tag:** {row_sel.get('asset_tag','')}  \n"
                f"**Equipo:** {row_sel.get('tipo_equipo','')} "
                f"{row_sel.get('marca','')} {row_sel.get('modelo','')}  \n"
                f"**CPU:** {row_sel.get('cpu','')}  \n"
                f"**RAM:** {row_sel.get('ram_gb','')}  \n"
                f"**Almacenamiento:** {row_sel.get('almacenamiento','')}  \n"
                f"**Persona actual:** {row_sel.get('persona_actual','')}  \n"
                f"**Cliente actual:** {row_sel.get('cliente_actual','')}  \n"
                f"**Ubicación:** {row_sel.get('ciudad_actual','')} - {row_sel.get('pais_actual','')}"
            )
        with col_b:
            foto_path = get_equipo_image_path(row_sel)
            if foto_path:
                st.image(foto_path, use_container_width=True)
            else:
                st.markdown(
                    "<div style='font-size:0.8rem; color:#9ca3af; text-align:right;'>"
                    "Sin foto disponible</div>",
                    unsafe_allow_html=True,
                )

    # ---- Capex (placeholder) ----
    st.markdown("#### Capex anual (si está disponible)")
    st.markdown(
        "<div class='info-box'>Aún no hay datos de <code>costo_compra</code> para calcular capex.</div>",
        unsafe_allow_html=True,
    )


# -------------------------------------------------
# Contenido pestañas de INVENTARIO 2022–2025
# -------------------------------------------------
with tab_2022:
    pestaña_por_anio(df_eq, 2022)

with tab_2023:
    pestaña_por_anio(df_eq, 2023)

with tab_2024:
    pestaña_por_anio(df_eq, 2024)

with tab_2025:
    pestaña_por_anio(df_eq, 2025)

# -------------------------------------------------
# Pestaña: Historia por activo
# -------------------------------------------------
with tab_hist:
    st.subheader("Historia completa de un equipo")

    col_sku, col_serie, col_nombre = st.columns([1, 1, 1.5])
    with col_sku:
        sku_busq = st.text_input("SKU", value="", placeholder="Ej: 314")
    with col_serie:
        serie_busq = st.text_input("Número de serie", value="")
    with col_nombre:
        nombre_busq = st.text_input(
            "Nombre (persona actual)", value="", placeholder="Ej: Beatriz Herrera"
        )

    buscar = st.button("Buscar historia")

    if buscar:
        sku_int: Optional[int] = None

        if not (sku_busq or serie_busq or nombre_busq):
            st.warning("Ingresa al menos un criterio (SKU, número de serie o nombre).")
            st.stop()

        if sku_busq.strip():
            try:
                sku_int = int(float(sku_busq.strip()))
            except ValueError:
                st.error("El SKU debe ser un número (ej: 314).")
                st.stop()

        if not sku_int and not serie_busq and nombre_busq.strip():
            if "persona_actual" not in df_eq.columns:
                st.error("El inventario no tiene columna 'persona_actual' para buscar.")
                st.stop()

            mask = df_eq["persona_actual"].astype(str).str.contains(
                nombre_busq.strip(), case=False, na=False
            )
            df_nom = df_eq[mask].copy()

            if df_nom.empty:
                st.warning(
                    "No se encontraron equipos para ese nombre en el inventario."
                )
                st.stop()

            if "sku" in df_nom.columns and "nro_serie" in df_nom.columns:
                sort_col = "fecha_compra" if "fecha_compra" in df_nom.columns else None
                if sort_col:
                    df_nom = (
                        df_nom.sort_values(sort_col)
                        .drop_duplicates(subset=["sku", "nro_serie"], keep="last")
                    )
                else:
                    df_nom = df_nom.drop_duplicates(
                        subset=["sku", "nro_serie"], keep="last"
                    )

            skus_encontrados = (
                df_nom["sku"].dropna().astype("Int64").drop_duplicates().tolist()
            )

            if len(skus_encontrados) > 1:
                st.warning(
                    "Hay más de un equipo para ese nombre. "
                    "Revisa la tabla y busca por SKU específico."
                )
                st.dataframe(
                    df_nom[["sku", "nro_serie", "persona_actual", "cliente_actual"]],
                    use_container_width=True,
                )
                st.stop()

            if not skus_encontrados:
                st.warning(
                    "No se pudo determinar un SKU único para ese nombre. "
                    "Intenta buscar por SKU directamente."
                )
                st.stop()

            sku_int = int(skus_encontrados[0])
            st.info(f"Buscando equipo por nombre → se usará SKU **{sku_int}**.")

        serie_val = serie_busq or None

        if not (sku_int or serie_val):
            st.warning("Debes indicar al menos un SKU, número de serie o nombre.")
            st.stop()

        with st.spinner("Buscando historia del activo…"):
            df_hist = get_historia_hw(
                sku=sku_int,
                nro_serie=serie_val,
                asset_tag=None,
            )
            try:
                df_estado = get_estado_actual_hw(
                    sku=sku_int,
                    nro_serie=serie_val,
                    asset_tag=None,
                )
            except Exception:
                df_estado = pd.DataFrame()

        if df_hist is None or df_hist.empty:
            st.info("Upps !!! no hay historia para este equipo.")
            st.stop()

        if "fecha_evento" in df_hist.columns:
            df_hist["fecha_evento"] = pd.to_datetime(
                df_hist["fecha_evento"], errors="coerce"
            )
            df_hist = df_hist.sort_values("fecha_evento")
        elif "fecha_compra" in df_hist.columns:
            df_hist["fecha_compra"] = pd.to_datetime(
                df_hist["fecha_compra"], errors="coerce"
            )
            df_hist = df_hist.sort_values("fecha_compra")

        first = df_hist.iloc[0]
        last = df_hist.iloc[-1]

        st.markdown(
            f"**SKU:** {first.get('sku','')}  |  "
            f"**Nro serie:** {first.get('nro_serie','')}  |  "
            f"**Asset tag:** {first.get('asset_tag','')}"
        )

        if "fecha_evento" in df_hist.columns:
            f_ini = first["fecha_evento"].date()
            f_fin = last["fecha_evento"].date()
        else:
            f_ini = first.get("fecha_compra")
            f_fin = last.get("fecha_compra")
            if isinstance(f_ini, pd.Timestamp):
                f_ini = f_ini.date()
            if isinstance(f_fin, pd.Timestamp):
                f_fin = f_fin.date()

        st.markdown(
            f"**Primera fecha registrada:** {f_ini} → "
            f"**Última fecha registrada:** {f_fin}"
        )

        # Resumen enriquecido con inventario
        if isinstance(df_estado, pd.DataFrame) and not df_estado.empty:
            base_row = df_estado.iloc[0]
        else:
            base_row = last

        info_row = base_row.copy()

        try:
            sku_lookup = info_row.get("sku") or first.get("sku")
            serie_lookup = info_row.get("nro_serie") or first.get("nro_serie")

            if sku_lookup is not None and "sku" in df_eq.columns:
                mask_inv = df_eq["sku"].astype("Int64") == int(sku_lookup)
                if "nro_serie" in df_eq.columns and pd.notna(serie_lookup):
                    mask_inv &= df_eq["nro_serie"].astype(str) == str(serie_lookup)

                df_match = df_eq[mask_inv]
                if not df_match.empty:
                    inv = df_match.iloc[0]
                    for col in [
                        "tipo_equipo",
                        "marca",
                        "modelo",
                        "cpu",
                        "ram_gb",
                        "almacenamiento",
                    ]:
                        if col in inv and (
                            col not in info_row.index
                            or pd.isna(info_row.get(col))
                            or str(info_row.get(col)).strip() == ""
                        ):
                            info_row[col] = inv[col]
        except Exception:
            pass

        col_a, col_b, col_c = st.columns([2, 2, 1])

        with col_a:
            st.markdown(
                f"**SKU:** {info_row.get('sku','')}  \n"
                f"**Nro serie:** {info_row.get('nro_serie','')}  \n"
                f"**Asset tag:** {info_row.get('asset_tag','')}"
            )
        with col_b:
            st.markdown(
                f"**Equipo:** {info_row.get('tipo_equipo','')} "
                f"{info_row.get('marca','')} {info_row.get('modelo','')}  \n"
                f"**CPU:** {info_row.get('cpu','')}  \n"
                f"**RAM:** {info_row.get('ram_gb','')}  \n"
                f"**Almacenamiento:** {info_row.get('almacenamiento','')}"
            )
        with col_c:
            foto_path = get_equipo_image_path(info_row)
            if foto_path:
                st.image(foto_path, use_container_width=True)
            else:
                st.markdown(
                    "<div style='font-size:0.8rem; color:#9ca3af; text-align:right;'>"
                    "Sin foto disponible</div>",
                    unsafe_allow_html=True,
                )

        # Gaps largos
        gaps = resumen_gaps(df_hist, threshold_dias=180)
        if gaps:
            st.markdown(
                "<div class='timeline-gap-alert'>"
                "🔍 <strong>Se detectaron períodos largos sin movimientos:</strong>"
                "<ul>"
                + "".join(f"<li>{g}</li>" for g in gaps)
                + "</ul></div>",
                unsafe_allow_html=True,
            )

        # Línea de tiempo
        st.markdown(
            '<div class="timeline-title">'
            '<span class="timeline-title-icon">🕒</span>'
            "<span>Línea de tiempo del equipo</span>"
            "</div>",
            unsafe_allow_html=True,
        )

        if "fecha_evento" in df_hist.columns:
            fechas = pd.to_datetime(df_hist["fecha_evento"], errors="coerce")
        else:
            fechas = pd.to_datetime(df_hist["fecha_compra"], errors="coerce")

        df_hist["dias_hasta_siguiente"] = (fechas.shift(-1) - fechas).dt.days

        for _, row in df_hist.iterrows():
            fecha_val = row.get("fecha_evento") or row.get("fecha_compra")
            fecha_str = str(fecha_val)[:10]
            tipo_evt = (row.get("tipo_evento") or "").upper()

            if tipo_evt == "COMPRA":
                icono, badge = "🛒", "#22c55e"
            elif tipo_evt == "ASIGNACION":
                icono, badge = "👤", "#3b82f6"
            elif tipo_evt == "ASIGNACION_ACTUAL":
                icono, badge = "⭐", "#facc15"
            elif tipo_evt == "REPARACION":
                icono, badge = "🛠", "#f97316"
            else:
                icono, badge = "📌", "#6b7280"

            cliente = row.get("cliente", "") or ""
            ciudad = row.get("ciudad", "") or ""
            detalle = row.get("detalle", "") or ""

            dias_sig = row.get("dias_hasta_siguiente")
            if pd.notna(dias_sig):
                duracion_html = (
                    "<div style='margin-top:0.25rem; "
                    "font-size:0.8rem; color:#6b7280;'>"
                    f"⏱ {int(dias_sig)} días hasta el siguiente evento</div>"
                )
            else:
                duracion_html = ""

            html = f"""
<div style="padding:1rem; background:#fafafa; border-radius:10px; margin-bottom:1rem; border:1px solid #e5e7eb;">
  <div style="font-size:0.9rem; color:#6b7280;">{fecha_str}</div>
  <div style="margin-top:0.2rem; font-weight:600;">
    {icono}
    <span class="timeline-chip" style="background:{badge};">{tipo_evt}</span>
  </div>
  <div style="margin-top:0.35rem; color:#334155;">
    {cliente} - {ciudad}
  </div>
  <div style="margin-top:0.3rem; font-size:0.9rem; color:#334155;">
    {detalle}
  </div>
  {duracion_html}
</div>
"""
            st.markdown(html, unsafe_allow_html=True)

        st.markdown("### Historial del equipo (detalle)")
        st.dataframe(df_hist, use_container_width=True)

        if "tipo_evento" in df_hist.columns:
            st.markdown("### Eventos por tipo")
            for tipo_evt in sorted(df_hist["tipo_evento"].dropna().unique()):
                df_tipo = df_hist[df_hist["tipo_evento"] == tipo_evt]
                with st.expander(f"{tipo_evt} ({len(df_tipo)})"):
                    st.dataframe(df_tipo, use_container_width=True)

# -------------------------------------------------
# Pestaña: Compras MTR (multi-año)
# -------------------------------------------------
with tab_compras:
    st.subheader("🛒 Compras MTR — Multi-año")

    try:
        df_compras_anual, df_compras_mensual = cargar_compras_mtr()
    except Exception as e:
        st.warning(
            "No fue posible cargar las vistas `vw_compras_anual_mtr` o "
            "`vw_compras_mensual_generica`. Revisa la BD `ti_ops`."
        )
        st.error(f"Detalle del error: {e}")
        st.stop()

    if df_compras_anual.empty or df_compras_mensual.empty:
        st.warning(
            "No fue posible cargar las vistas `vw_compras_anual_mtr` o "
            "`vw_compras_mensual_generica` (no devuelven filas). "
            "Revisa la BD `ti_ops`."
        )
        st.stop()

    df_ca = df_compras_anual.copy()
    df_ca.columns = df_ca.columns.str.lower()

    df_m_mes = df_compras_mensual.copy()
    df_m_mes.columns = df_m_mes.columns.str.lower()

    col_anio = "anio"
    col_cant = "cantidad_total_equipos"
    col_mac = "gasto_mac"
    col_win = "gasto_windows"
    col_mac_iva = "gasto_mac_con_iva"
    col_win_iva = "gasto_win_con_iva"

    if col_anio in df_ca.columns:
        df_ca[col_anio] = pd.to_numeric(df_ca[col_anio], errors="coerce").astype(
            "Int64"
        )

    for col in [col_cant, col_mac, col_win, col_mac_iva, col_win_iva]:
        if col in df_ca.columns:
            df_ca[col] = df_ca[col].fillna(0).astype(float)

    if "anio" in df_m_mes.columns:
        df_m_mes["anio"] = pd.to_numeric(
            df_m_mes["anio"], errors="coerce"
        ).astype("Int64")

    mes_num_col = None
    if "mes_num" in df_m_mes.columns:
        mes_num_col = "mes_num"
    elif "mes" in df_m_mes.columns:
        mes_num_col = "mes"
    elif "mes_orden" in df_m_mes.columns:
        mes_num_col = "mes_orden"

    if mes_num_col:
        df_m_mes[mes_num_col] = (
            pd.to_numeric(df_m_mes[mes_num_col], errors="coerce")
            .fillna(0)
            .astype(int)
        )

    years_series = df_ca[col_anio].dropna()
    years_series = pd.to_numeric(years_series, errors="coerce").dropna().astype(int)
    years = sorted(set(years_series.tolist()))

    labels = ["Resumen multi-año"] + [str(y) for y in years]
    tabs_year = st.tabs(labels)

    tab_multi = tabs_year[0]
    year_tab_map = {year: tabs_year[i + 1] for i, year in enumerate(years)}

    with tab_multi:
        st.markdown("### Resumen multi-año")

        total_equipos = int(df_ca[col_cant].sum())
        total_mac_sin = float(df_ca[col_mac].sum())
        total_win_sin = float(df_ca[col_win].sum())
        total_mac_con = float(df_ca[col_mac_iva].sum())
        total_win_con = float(df_ca[col_win_iva].sum())
        total_con = total_mac_con + total_win_con

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            kpi_card("Equipos comprados (multi-año)", total_equipos, "", "#0f766e")
        with col2:
            kpi_card(
                "Gasto MAC sin IVA",
                fmt_clp(total_mac_sin),
                "Sumatoria años",
                "#2563eb",
            )
        with col3:
            kpi_card(
                "Gasto Windows sin IVA",
                fmt_clp(total_win_sin),
                "Sumatoria años",
                "#7c3aed",
            )
        with col4:
            kpi_card(
                "Gasto total con IVA",
                fmt_clp(total_con),
                "MAC + Windows",
                "#b91c1c",
            )

        st.markdown("#### Totales por año")
        st.dataframe(
            df_ca[[col_anio, col_cant, col_mac, col_win, col_mac_iva, col_win_iva]],
            use_container_width=True,
        )

    for year, tab in year_tab_map.items():
        with tab:
            st.markdown(f"### Compras año {year}")

            df_anio = df_ca[df_ca[col_anio] == year].copy()
            df_m_anio = df_m_mes[df_m_mes["anio"] == year].copy()

            if not df_anio.empty:
                row_a = df_anio.iloc[0]
                anio_equipos = int(row_a.get(col_cant, 0))
                anio_mac_sin = float(row_a.get(col_mac, 0))
                anio_win_sin = float(row_a.get(col_win, 0))
                anio_mac_con = float(row_a.get(col_mac_iva, 0))
                anio_win_con = float(row_a.get(col_win_iva, 0))
                anio_con = anio_mac_con + anio_win_con

                c1, c2, c3, c4 = st.columns(4)
                c1.metric(f"Equipos comprados {year}", anio_equipos)
                c2.metric("MAC (sin IVA)", fmt_clp(anio_mac_sin))
                c3.metric("Windows (sin IVA)", fmt_clp(anio_win_sin))
                c4.metric("Total (con IVA)", fmt_clp(anio_con))
            else:
                st.info("No hay registro anual para este año.")

            st.markdown("### 🗓️ Detalle mensual de compras (MTR)")

            if df_m_anio.empty:
                st.info("No hay detalle mensual para este año.")
                continue

            if mes_num_col:
                df_m_anio = df_m_anio.sort_values(mes_num_col)

            df_cards = df_m_anio[
                df_m_anio.get("cantidad_total_equipos", 0) > 0
            ].copy()

            for _, row in df_cards.iterrows():
                mes_label = row.get("mes_display") or row.get("mes") or ""
                mes_label = mes_a_espanol(mes_label)

                cant = int(row.get("cantidad_total_equipos", 0))

                mac_sin = float(row.get("gasto_mac", 0.0))
                win_sin = float(row.get("gasto_windows", 0.0))
                mac_con = float(row.get("gasto_mac_con_iva", 0.0))
                win_con = float(row.get("gasto_win_con_iva", 0.0))

                total_sin = mac_sin + win_sin
                total_con_mes = mac_con + win_con

                mac_pct = (mac_sin / total_sin * 100) if total_sin > 0 else 0
                win_pct = (win_sin / total_sin * 100) if total_sin > 0 else 0

                html_code = f"""
        <div style="
            border:1px solid #e3e6ec;
            border-radius:16px;
            padding:1.5rem;
            margin-bottom:1rem;
            background-color:#fafbff;
            width:900px;
            font-family:Inter, -apple-system, system-ui, sans-serif;
        ">

          <div style="font-size:0.75rem; text-transform:uppercase; color:#6b7280;">
            MES
          </div>
          <div style="font-size:1.3rem; font-weight:700; color:#111827;">
            {mes_label} {year}
          </div>

          <div style="margin-top:0.3rem; font-size:0.95rem; color:#374151;">
            Equipos comprados: <strong>{cant}</strong>
          </div>

          <hr style="margin:1rem 0; border:0.5px solid #e5e7eb;">

          <div style="display:flex; justify-content:space-between;">

            <div>
              <div style="font-size:0.75rem; color:#6b7280;">MAC</div>
              <div style="font-size:0.85rem; color:#6b7280;">Sin IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#111827;">
                {fmt_clp(mac_sin)}
              </div>
              <div style="margin-top:0.25rem; font-size:0.85rem; color:#6b7280;">Con IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#b00020;">
                {fmt_clp(mac_con)}
              </div>
              <div style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">
                Participación: <strong>{mac_pct:.1f}%</strong>
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem; color:#6b7280;">Windows</div>
              <div style="font-size:0.85rem; color:#6b7280;">Sin IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#111827;">
                {fmt_clp(win_sin)}
              </div>
              <div style="margin-top:0.25rem; font-size:0.85rem; color:#6b7280;">Con IVA</div>
              <div style="font-size:1.05rem; font-weight:600; color:#b00020;">
                {fmt_clp(win_con)}
              </div>
              <div style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">
                Participación: <strong>{win_pct:.1f}%</strong>
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem; color:#6b7280;">Total mes</div>
              <div style="font-size:0.85rem; color:#6b7280;">Sin IVA</div>
              <div style="font-size:1.1rem; font-weight:700; color:#0b3a53;">
                {fmt_clp(total_sin)}
              </div>
              <div style="margin-top:0.25rem; font-size:0.85rem; color:#6b7280;">Con IVA</div>
              <div style="font-size:1.1rem; font-weight:700; color:#b00020;">
                {fmt_clp(total_con_mes)}
              </div>
            </div>

          </div>

        </div>
        """
                components.html(html_code, height=260)
