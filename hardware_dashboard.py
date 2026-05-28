import datetime as dt
import os
from typing import Optional

import altair as alt
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
import difflib
from pathlib import Path
from data_access.mart_alertas import get_mart_alertas_acciones 
from sqlalchemy import create_engine, text

import io
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm


from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from ml.anomaly import aplicar_ml_v2, preparar_scatter_ml  

from hardware_client import (
    get_equipos_hw,
    get_historia_hw,
    get_estado_actual_hw,
)

DATABASE_URL = os.getenv(
    "TI_OPS_DATABASE_URL",
    "postgresql://usuario:password@localhost:5432/ti_ops",
)

engine_main = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

engine_inv = engine_main
engine_mtr = engine_main

@st.cache_data(ttl=300)
def load_acciones():
    return get_mart_alertas_acciones(engine_main, limit=5000)

df_acciones = load_acciones()


# ===========================================================
#                CONFIGURACIÓN GENERAL STREAMLIT
# ===========================================================
st.set_page_config(
    page_title="Catastro Hardware",
    page_icon="💻",
    layout="wide",
)

def generar_pdf_equipo(info_row: pd.Series,
                       df_hist: pd.DataFrame,
                       fila_alerta: pd.Series | None = None) -> io.BytesIO:
    """
    Genera un PDF simple con la info del equipo y devuelve un buffer BytesIO.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 2 * cm

    # --------- Título ---------
    c.setFont("Helvetica-Bold", 16)
    c.drawString(2 * cm, y, "Informe de activo – Hardware & Compras MTR")
    y -= 1.2 * cm

    c.setFont("Helvetica", 10)
    c.drawString(2 * cm, y, f"Fecha informe: {pd.Timestamp.today().date()}")
    y -= 0.6 * cm

    # --------- Ficha del equipo ---------
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2 * cm, y, "Datos del equipo")
    y -= 0.7 * cm
    c.setFont("Helvetica", 10)

    lineas_equipo = [
        f"SKU: {info_row.get('sku', '')}",
        f"Nro serie: {info_row.get('nro_serie', '')}",
        f"Asset tag: {info_row.get('asset_tag', '')}",
        f"Tipo equipo: {info_row.get('tipo_equipo', '')}",
        f"Marca / Modelo: {info_row.get('marca', '')} {info_row.get('modelo', '')}",
        f"CPU: {info_row.get('cpu', '')}",
        f"RAM: {info_row.get('ram_gb', '')}",
        f"Almacenamiento: {info_row.get('almacenamiento', '')}",
    ]
    for linea in lineas_equipo:
        c.drawString(2 * cm, y, linea)
        y -= 0.5 * cm

    y -= 0.4 * cm  # pequeño espacio

    # --------- Estado actual / alertas ---------
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2 * cm, y, "Estado actual / Alertas")
    y -= 0.7 * cm
    c.setFont("Helvetica", 10)

    lineas_estado = [
        f"Persona actual: {info_row.get('persona_actual', '')}",
        f"Cliente actual: {info_row.get('cliente_actual', '')}",
        f"Ubicación: {info_row.get('ciudad_actual', '')} - {info_row.get('pais_actual', '')}",
    ]

    for linea in lineas_estado:
        c.drawString(2 * cm, y, linea)
        y -= 0.5 * cm

    if fila_alerta is not None and not fila_alerta.empty:
        y -= 0.3 * cm
        c.drawString(2 * cm, y, f"Renovación: {fila_alerta.get('alerta_renovacion', '')}")
        y -= 0.5 * cm
        c.drawString(2 * cm, y, f"Historial: {fila_alerta.get('alerta_historial', '')}")
        y -= 0.5 * cm
        c.drawString(2 * cm, y, f"Asignación: {fila_alerta.get('alerta_asignacion', '')}")
        y -= 0.5 * cm
        c.drawString(2 * cm, y, f"ML v2: {fila_alerta.get('alerta_ml_v2', '')}")
        y -= 0.5 * cm
        c.drawString(
            2 * cm,
            y,
            f"Nivel riesgo: {fila_alerta.get('nivel_riesgo', '')} "
            f"(score: {fila_alerta.get('riesgo_total', '')})",
        )
        y -= 0.7 * cm

    # --------- Resumen de historia ---------
    if not df_hist.empty:
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2 * cm, y, "Resumen de historia")
        y -= 0.7 * cm
        c.setFont("Helvetica", 10)

        f_ini = pd.to_datetime(df_hist["fecha_evento"]).min().date()
        f_fin = pd.to_datetime(df_hist["fecha_evento"]).max().date()
        dias_rango = (f_fin - f_ini).days

        c.drawString(2 * cm, y, f"Rango de fechas: {f_ini} → {f_fin} ({dias_rango} días)")
        y -= 0.5 * cm
        c.drawString(2 * cm, y, f"N° eventos en historia: {len(df_hist)}")
        y -= 0.7 * cm

        # Últimos 5 eventos
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2 * cm, y, "Últimos eventos")
        y -= 0.6 * cm
        c.setFont("Helvetica", 9)

        ultimos = df_hist.sort_values("fecha_evento").tail(5)
        for _, r in ultimos.iterrows():
            linea = (
                f"{str(r.get('fecha_evento',''))[:10]}  |  "
                f"{str(r.get('tipo_evento',''))}  |  "
                f"{str(r.get('cliente','') or r.get('cliente_actual',''))}  |  "
                f"{str(r.get('persona','') or r.get('persona_actual',''))}"
            )
            c.drawString(2 * cm, y, linea)
            y -= 0.45 * cm
            if y < 2 * cm:  # salto de página si se acaba el espacio
                c.showPage()
                y = height - 2 * cm
                c.setFont("Helvetica", 9)

    # --------- Pie ---------
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(
        2 * cm,
        1.5 * cm,
        "Fuente: Dashboard Hardware & Compras MTR – Datos inventario_equipos + historia_hw",
    )

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer

def render_grafico_marca_home_style(df_tab, titulo="Cantidad por marca"):
    """
    Gráfico de barras horizontal por marca con el mismo estilo 'chart-card'
    que usamos en Home.
    """
    st.markdown(
        "<div class='chart-card'>"
        f"<div class='chart-title'><span class='icon'>📊</span>{titulo}</div>",
        unsafe_allow_html=True,
    )

    if "marca" in df_tab.columns:
        df_marca = (
            df_tab.groupby("marca")
            .size()
            .reset_index(name="equipos")
            .sort_values("equipos", ascending=False)
        )

        if not df_marca.empty:
            chart_marca = (
                alt.Chart(df_marca)
                .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                .encode(
                    x=alt.X("equipos:Q", title="Equipos"),
                    y=alt.Y("marca:N", sort="-x", title=""),
                    tooltip=["marca:N", "equipos:Q"],
                    color=alt.value("#2563eb"),
                )
                .properties(height=260)
                .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                .configure_view(strokeWidth=0)
            )
            st.altair_chart(chart_marca, use_container_width=True)
        else:
            st.info("No hay datos de marcas para mostrar.")
    else:
        st.info("La tabla no tiene columna 'marca'.")

    st.markdown("</div>", unsafe_allow_html=True)


# ===========================================================
#                           CSS GLOBAL
# ===========================================================
st.markdown(
    """
<style>

body, .stApp {
    background-color: #2a2a2a !important;
    color: #f5f5f5 !important;
}

/* Títulos */
h1, h2, h3, h4, h5, h6 {
    color: #ffffff !important;
}

/* Inputs */
input, textarea, select {
    background-color: #3a3a3a !important;
    color: #ffffff !important;
    border: 1px solid #555 !important;
    border-radius: 8px !important;
}

input::placeholder {
    color: #b5b5b5 !important;
}

/* 🔹 Labels de inputs (SKU, Número de Serie, Nombre, etc.) */
div[data-testid="stTextInput"] > label {
    color: #e5e7eb !important;      /* más claro */
    font-weight: 600 !important;    /* un poco más grueso */
    font-size: 0.9rem !important;
}

/* Selectboxes */
.stSelectbox > div > div {
    background-color: #3a3a3a !important;
    color: #ffffff !important;
}

/* Expander */
.streamlit-expanderHeader {
    background-color: #333 !important;
    color: white !important;
}

/* Tabs */
.stTabs [data-baseweb="tab"] {
    background-color: #353535 !important;
    color: #f5f5f5 !important;
}

.stTabs [data-baseweb="tab"][aria-selected="true"] {
    background-color: #4a4a4a !important;
    color: #ffffff !important;
    border-bottom: 3px solid #ff5252 !important;
}

/* KPI cards */
.kpi-card {
    padding:0.9rem 1.1rem;
    border-radius:0.9rem;
    border:1px solid #374151;
    background:#111827;
    box-shadow:0 4px 10px rgba(0,0,0,0.35);
    margin-bottom:0.6rem;
}

.kpi-title {
    font-size:0.8rem;
    color:#d1d5db;
    text-transform:uppercase;
    letter-spacing:0.06em;
}

.kpi-value {
    font-size:1.8rem;
    font-weight:700;
    color:#f9fafb;
}

.kpi-sub {
    font-size:0.8rem;
    color:#9ca3af;
}

/* Etiquetas de sección */
.section-label {
    font-size:0.9rem;
    color:#e5e7eb;
    text-transform:uppercase;
    letter-spacing:0.08em;
}

/* Tarjetas de gráfico estilo "panel" */
.chart-card {
    background:#f9fafb;
    border-radius:14px;
    border:1px solid #e5e7eb;
    padding:0.9rem 1.1rem 0.4rem 1.1rem;
    box-shadow:0 2px 6px rgba(15,23,42,0.18);
    margin-bottom:1.1rem;
}

.chart-title {
    font-size:0.85rem;
    font-weight:600;
    color:#111827;
    margin-bottom:0.4rem;
    display:flex;
    align-items:center;
    gap:0.35rem;
}

.chart-title span.icon {
    font-size:1rem;
}

/* Timeline chips (historia) */
.timeline-chip {
    display:inline-block;
    color:#ffffff;
    padding:0.15rem 0.7rem;
    border-radius:999px;
    font-size:0.7rem;
    font-weight:500;
}

.timeline-title {
    font-size:1rem;
    font-weight:600;
    margin:1rem 0 0.5rem 0;
    color:#e5e7eb;
}

.timeline-gap-alert {
    background:#1f2937;
    border-radius:0.75rem;
    padding:0.75rem 1rem;
    font-size:0.85rem;
    color:#e5e7eb;
}

/* Métricas en verde */
[data-testid="stMetricValue"] {
    color: #22c55e !important;
    font-weight: 700 !important;
}

[data-testid="stMetricLabel"] {
    color: #e5e7eb !important;
}

body {
    background-color:#020617;
    color:#e5e7eb;
}
/* Botón Descargar PDF */
    div.stDownloadButton > button {
        background: #0ea5e9 !important;     /* celeste fijo */
        color: #020617 !important;          /* texto oscuro fijo */
        border-radius: 999px !important;
        border: 1px solid #38bdf8 !important;
        font-weight: 600 !important;
        padding: 0.45rem 1.5rem !important;
        font-size: 0.9rem !important;
    }
    div.stDownloadButton > button:hover,
    div.stDownloadButton > button:active,
    div.stDownloadButton > button:focus {
        background: #0ea5e9 !important;   /* NO CAMBIA */
        color: #020617 !important;        /* NO CAMBIA */
        border-color: #38bdf8 !important; /* NO CAMBIA */
        box-shadow: none !important;
    }

    /* Botón Buscar */
    button[kind="secondary"] {
        background: #0ea5e9 !important;  
        color: #020617 !important;
        border-radius: 10px !important;
        border: 1px solid #38bdf8 !important;
        font-weight: 600 !important;
    }
    button[kind="secondary"]:hover,
    button[kind="secondary"]:active,
    button[kind="secondary"]:focus {
        background: #0ea5e9 !important;  
        color: #020617 !important;
        border-color: #38bdf8 !important;
        box-shadow: none !important;
    }
    </style>
</style>
""",
    unsafe_allow_html=True,
)


# ===========================================================
#                       CONEXIONES A BD
# ===========================================================
DATABASE_URL = os.getenv(
    "TI_OPS_DATABASE_URL",
    "postgresql://usuario:password@localhost:5432/ti_ops",
)

engine_main = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

engine_inv = engine_main   # antes inventario_equipos
engine_mtr = engine_main   # ti_ops


# ===========================================================
#              FUNCIONES AUXILIARES (KPI, FORMATO)
# ===========================================================
def fmt_clp(valor):
    """Formatea número a CLP con puntos."""
    try:
        valor = float(valor)
        return f"$ {valor:,.0f}".replace(",", ".")
    except Exception:
        return "$ 0"


def kpi_card(titulo, valor, sub, color="#0ea5e9"):
    """KPI card moderna."""
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-title">{titulo}</div>
            <div class="kpi-value" style="color:{color}">{valor}</div>
            <div class="kpi-sub">{sub}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def resumen_gaps(df, threshold_dias=180):
    """Detecta períodos largos sin eventos."""
    if "fecha_evento" not in df.columns:
        return []

    fechas = pd.to_datetime(df["fecha_evento"], errors="coerce")
    df = df.copy()
    df["dias_sig"] = (fechas.shift(-1) - fechas).dt.days

    gaps = []
    for _, r in df.iterrows():
        d = r.get("dias_sig")
        if pd.notna(d) and d >= threshold_dias:
            gaps.append(
                f"{int(d)} días sin movimientos después de {str(r['fecha_evento'])[:10]}"
            )
    return gaps


# --- UMBRALES DE ROTACIÓN ---
UMBRAL_MOV_12M_ALTO = 3    # rotación reciente alta
UMBRAL_MOV_TOTAL_ALTO = 6  # rotación histórica alta
UMBRAL_DIAS_SIN_MOV_LARGO = 365 * 2  # 2 años sin movimientos

# -------------------------------------------------
# FOTOS DE EQUIPOS – AUTO-DETECTOR POR CARPETA
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

IMAGE_DIRS = [
    BASE_DIR,
    os.path.join(BASE_DIR, "assets"),
    os.path.join(BASE_DIR, "assets", "img"),
    os.path.join(BASE_DIR, "catastro"),
    os.path.join(BASE_DIR, "catastro", "assets"),
    os.path.join(BASE_DIR, "catastro", "assets", "img"),
]

VALID_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".PNG", ".JPG", ".JPEG", ".WEBP")


def _norm_text(s: str) -> str:
    """Normaliza texto para comparar nombres de archivos."""
    if s is None:
        return ""
    s = str(s).lower()
    for ch in [" ", "-", "_", ".", ",", "(", ")", "/"]:
        s = s.replace(ch, "")
    return "".join(c for c in s if c.isalnum())


@st.cache_data(show_spinner=False)
def _scan_image_files() -> dict:
    """Escanea las carpetas indicadas y sus subcarpetas."""
    images = {}

    for folder in IMAGE_DIRS:
        if not os.path.isdir(folder):
            continue

        for root, dirs, files in os.walk(folder):
            for fname in files:
                if fname.lower().endswith(VALID_IMAGE_EXTS):
                    stem, _ = os.path.splitext(fname)
                    key = _norm_text(stem)

                    if key not in images:
                        images[key] = os.path.join(root, fname)

    return images


def get_equipo_image_path(row: pd.Series) -> Optional[str]:
    """
    Encuentra la imagen del equipo usando coincidencia exacta, substring o fuzzy.
    """
    images = _scan_image_files()
    if not images:
        return None

    keys = list(images.keys())
    candidatos = _build_image_candidates(row)

    # 1) Match directo por substring
    for cand in candidatos:
        for key in keys:
            if cand and (cand in key or key in cand):
                return images[key]

    # 2) Fuzzy matching (difflib)
    for cand in candidatos:
        if not cand:
            continue
        matches = difflib.get_close_matches(cand, keys, n=1, cutoff=0.70)
        if matches:
            best = matches[0]
            return images[best]

    return None


def _build_image_candidates(row: pd.Series) -> list[str]:
    """
    Construye posibles claves de búsqueda a partir de la fila del equipo.
    Usamos: modelo, marca, tipo_equipo, cpu, sku y nro_serie.
    """
    candidatos: list[str] = []

    combos = [
        ("modelo",),
        ("marca",),
        ("tipo_equipo", "marca", "modelo"),
        ("marca", "modelo"),
        ("tipo_equipo", "modelo"),
        ("cpu",),
    ]

    # combos de texto (modelo, marca, etc.)
    for cols in combos:
        partes = []
        for c in cols:
            val = row.get(c)
            if isinstance(val, str) and val.strip():
                partes.append(val.strip())
        if partes:
            candidatos.append(" ".join(partes))

    # número de serie
    serie_val = row.get("nro_serie")
    if serie_val not in (None, ""):
        candidatos.append(str(serie_val))

    # SKU
    sku_val = row.get("sku")
    if sku_val not in (None, ""):
        candidatos.append(str(sku_val))

    # normalizar y quitar duplicados
    norm = [_norm_text(c) for c in candidatos if c]
    vistos = set()
    norm_uniq: list[str] = []
    for c in norm:
        if c and c not in vistos:
            vistos.add(c)
            norm_uniq.append(c)

    return norm_uniq


with st.expander("🔧 Debug imágenes (solo para pruebas)", expanded=False):
    imgs = _scan_image_files()
    st.write("Cantidad de imágenes detectadas:", len(imgs))
    st.write("Algunas claves:", list(imgs.keys())[:20])


# ===========================================================
#       CARGA DEL INVENTARIO COMBINADO (API + BASE LOCAL)
# ===========================================================
@st.cache_data(show_spinner="Cargando inventario combinado…")
def cargar_inventario_combinado() -> pd.DataFrame:
    frames = []

    # 1) API HW
    try:
        df_api = get_equipos_hw(anio_desde=2019, anio_hasta=2025, limit=5000)
        if df_api is not None and not df_api.empty:
            if "fecha_compra" in df_api.columns:
                df_api["fecha_compra"] = pd.to_datetime(
                    df_api["fecha_compra"], errors="coerce"
                )
            if "sku" in df_api.columns:
                df_api["sku"] = (
                    pd.to_numeric(df_api["sku"], errors="coerce").astype("Int64")
                )

            df_api["origen_inventario"] = "api_hw"
            frames.append(df_api)
    except Exception as e:
        print("Error cargando API HW:", e)

    # 2) BASE inventario_equipos
    try:
        query = """
            SELECT
                sku, nro_serie, asset_tag,
                tipo_equipo, marca, modelo,
                cpu, ram_gb, almacenamiento,
                estado, fecha_compra,
                cliente_actual, persona_actual,
                pais_actual, ciudad_actual,
                perfil_actual
            FROM activos.equipos
        """
        df_sql = pd.read_sql(query, engine_inv)

        if not df_sql.empty:
            df_sql["fecha_compra"] = pd.to_datetime(
                df_sql["fecha_compra"], errors="coerce"
            )
            df_sql["sku"] = (
                pd.to_numeric(df_sql["sku"], errors="coerce").astype("Int64")
            )
            df_sql["origen_inventario"] = "inventario_equipos"
            frames.append(df_sql)
    except Exception as e:
        print("Error base inventario_equipos:", e)

    if not frames:
        return pd.DataFrame()

    df_all = pd.concat(frames, ignore_index=True, sort=False)

    df_all["prioridad"] = df_all["origen_inventario"].map(
        {"inventario_equipos": 0, "api_hw": 1}
    ).fillna(2)

    df_all = df_all.sort_values(by=["sku", "nro_serie", "prioridad"])
    df_all = df_all.drop_duplicates(subset=["sku", "nro_serie"], keep="first")
    df_all = df_all.drop(columns=["prioridad"])

    return df_all


df_eq = cargar_inventario_combinado()


# ===========================================================
#             HISTORIA GLOBAL + ALERTAS TEMPRANAS
# ===========================================================
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler

# Umbrales para clasificación de historial
UMBRAL_MOV_12M_ALTO = 4          # movimientos en 12m para considerarlo "reciente alto"
UMBRAL_MOV_TOTAL_ALTO = 8        # movimientos totales altos
UMBRAL_DIAS_SIN_MOV_LARGO = 365  # días de rango muy largo (~1 año)


@st.cache_data(show_spinner="Cargando historia global…")
def cargar_historia_global() -> pd.DataFrame:
    """
    Carga toda la historia manual desde activos.historia_hw
    para poder calcular alertas a nivel inventario.
    """
    try:
        df = pd.read_sql(
            """
            SELECT
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
            FROM activos.historia_hw
            """,
            engine_mtr,
        )
        df["fecha_evento"] = pd.to_datetime(df["fecha_evento"], errors="coerce")
        return df
    except Exception as e:
        print("Error cargando historia global:", e)
        return pd.DataFrame()


def _vida_util_dias(row: pd.Series) -> int:
    """
    Vida útil aproximada en días según tipo/marca.
    - Apple / Mac: 4 años
    - Servidor: 5 años
    - Resto (Windows/PC): 3 años
    """
    marca = str(row.get("marca", "") or "").lower()
    tipo = str(row.get("tipo_equipo", "") or "").lower()

    if "server" in tipo or "servidor" in tipo:
        return 5 * 365
    if "apple" in marca or "mac" in marca or "macbook" in tipo:
        return 4 * 365
    return 3 * 365


def _features_historial(df_hist: pd.DataFrame) -> pd.DataFrame:
    """
    Construye features por SKU a partir de la historia:
      - movimientos_totales
      - movimientos_12m
      - primera_fecha / ultima_fecha
      - dias_rango
      - clientes_distintos
      - personas_distintas
    """
    if df_hist is None or df_hist.empty or "sku" not in df_hist.columns:
        return pd.DataFrame(
            columns=[
                "sku",
                "movimientos_totales",
                "movimientos_12m",
                "primera_fecha",
                "ultima_fecha",
                "dias_rango",
                "clientes_distintos",
                "personas_distintas",
            ]
        )

    df = df_hist.copy()
    df["fecha_evento"] = pd.to_datetime(df["fecha_evento"], errors="coerce")
    hoy = pd.Timestamp.today().normalize()
    hace_12m = hoy - pd.Timedelta(days=365)

    agg = (
        df.groupby("sku")
        .agg(
            movimientos_totales=("sku", "size"),
            movimientos_12m=(
                "fecha_evento",
                lambda s: ((s >= hace_12m) & s.notna()).sum(),
            ),
            primera_fecha=("fecha_evento", "min"),
            ultima_fecha=("fecha_evento", "max"),
            clientes_distintos=(
                "cliente",
                lambda s: s.astype(str).replace("", "<vacío>").nunique(),
            ),
            personas_distintas=(
                "persona",
                lambda s: s.astype(str).replace("", "<vacío>").nunique(),
            ),
        )
        .reset_index()
    )

    agg["dias_rango"] = (agg["ultima_fecha"] - agg["primera_fecha"]).dt.days
    return agg


# ------------------ CAPA SCORING SIMPLE ------------------- #
def _score_renovacion(texto: str) -> int:
    """Puntaje según estado de renovación."""
    if not isinstance(texto, str):
        return 0
    if "Renovación vencida" in texto:
        return 4
    if "Próximo a vencer" in texto:
        return 3
    if "Sin fecha de compra" in texto:
        return 1
    # 🟢 OK
    return 0


def _score_historial(texto: str) -> int:
    """Puntaje según estado del historial de movimientos."""
    if not isinstance(texto, str):
        return 0

    if texto.startswith("🔴"):
        return 4
    if texto.startswith("🟠"):
        return 3
    if texto.startswith("🔶"):
        return 2
    if texto.startswith("🟡"):
        return 1
    # 🟢 Normal
    return 0


def _score_asignacion(texto: str) -> int:
    """Puntaje según estado de asignación."""
    if not isinstance(texto, str):
        return 0
    if "Sin asignación" in texto:
        return 3
    return 0


def _score_ml(texto: str) -> int:
    """Puntaje según alerta ML simple (IQR)."""
    if not isinstance(texto, str):
        return 0
    if texto.startswith("🔴"):
        return 3
    return 0


def _nivel_riesgo(score_total: int) -> str:
    """Traduce score acumulado en nivel de riesgo."""
    if score_total >= 10:
        return "Alta"
    if score_total >= 4:
        return "Media"
    return "Baja"


def clasificar_alerta_historial(row: pd.Series) -> str:
    """
    Devuelve un string con el estado del historial:
    - 🔴 Rotación reciente alta
    - 🟠 Rotación histórica alta
    - 🟠 Historia muy antigua
    - 🟡 Sin historia
    - 🟢 Normal
    """
    mov_tot = row.get("movimientos_totales", 0)
    mov_12m = row.get("movimientos_12m", 0)
    # Acepta ambos nombres de columna
    dias_rango = row.get("dias_rango", row.get("dias_rango_hist", 0))

    if pd.isna(mov_tot) or mov_tot == 0:
        return "🟡 Sin historia"

    if mov_12m is not None and mov_12m >= UMBRAL_MOV_12M_ALTO:
        return f"🔴 Rotación reciente alta ({int(mov_12m)} mov. 12m)"

    if mov_tot is not None and mov_tot >= UMBRAL_MOV_TOTAL_ALTO:
        return f"🟠 Rotación histórica alta ({int(mov_tot)} mov. totales)"

    if dias_rango is not None and dias_rango >= UMBRAL_DIAS_SIN_MOV_LARGO:
        return f"🟠 Historia muy antigua ({int(dias_rango)} días de rango)"

    return "🟢 Normal"


def _umbral_outlier_movimientos(series: pd.Series) -> Optional[float]:
    """
    Umbral de outliers usando IQR. Devuelve None si no se puede calcular.
    """
    s = series.dropna()
    if s.empty:
        return None

    q1 = s.quantile(0.25)
    q3 = s.quantile(0.75)
    iqr = q3 - q1
    if iqr <= 0:
        return None

    return q3 + 1.5 * iqr


# ------------------ ML v2: Isolation Forest + LOF ------------------- #
def aplicar_ml_outliers(df_alertas: pd.DataFrame) -> pd.DataFrame:
    """
    Añade detección de outliers usando:
      - Isolation Forest
      - LOF (Local Outlier Factor)

    Crea columnas:
      - ml_iso, ml_lof, ml_score
      - alerta_ml_v2  (🟢 / 🟠 / 🔴)
    """
    if df_alertas is None or df_alertas.empty:
        return df_alertas

    df = df_alertas.copy()

    cols_feats = [
        "movimientos_totales",
        "movimientos_12m",
        "dias_rango_hist",
        "clientes_distintos",
        "personas_distintas",
        "dias_desde_compra",
    ]

    for c in cols_feats:
        if c not in df.columns:
            df[c] = 0

    X = df[cols_feats].fillna(0)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Isolation Forest
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42,
    )
    iso_labels = iso.fit_predict(X_scaled)  # -1 = outlier
    df["ml_iso"] = (iso_labels == -1).astype(int)

    # LOF
    lof = LocalOutlierFactor(
        n_neighbors=20,
        contamination=0.05,
    )
    lof_labels = lof.fit_predict(X_scaled)  # -1 = outlier
    df["ml_lof"] = (lof_labels == -1).astype(int)

    df["ml_score"] = df["ml_iso"] + df["ml_lof"]

    def _etiqueta(score: int) -> str:
        if score == 2:
            return "🔴 Anómalo (ML v2)"
        if score == 1:
            return "🟠 Sospechoso (ML v2)"
        return "🟢 Normal"

    df["alerta_ml_v2"] = df["ml_score"].apply(_etiqueta)

    return df



def calcular_alertas(
    df_eq: pd.DataFrame,
    df_hist: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """
    Calcula alertas por equipo usando ML v2:
      - alerta_renovacion
      - alerta_historial  (usando clasificar_alerta_historial)
      - alerta_asignacion
      - alerta_ml  (← viene de IsolationForest + LOF)
      + CAPA 4: score_* , riesgo_total, nivel_riesgo
    """
    if df_eq is None or df_eq.empty:
        return pd.DataFrame()

    df_base = df_eq.copy()

    # Normalizar fecha_compra
    if "fecha_compra" in df_base.columns:
        df_base["fecha_compra"] = pd.to_datetime(
            df_base["fecha_compra"], errors="coerce"
        )

    # ---------- FEATURES DE HISTORIAL ----------
    if df_hist is None or df_hist.empty:
        feats = pd.DataFrame()
    else:
        feats = _features_historial(df_hist)

    if (
        "sku" in df_base.columns
        and not feats.empty
        and "sku" in feats.columns
    ):
        df_merge = df_base.merge(feats, on="sku", how="left")
    else:
        df_merge = df_base.copy()
        df_merge["movimientos_totales"] = 0
        df_merge["movimientos_12m"] = 0
        df_merge["dias_rango"] = pd.NA
        df_merge["clientes_distintos"] = pd.NA
        df_merge["personas_distintas"] = pd.NA

    df_merge["movimientos_totales"] = (
        df_merge["movimientos_totales"].fillna(0).astype(int)
    )
    df_merge["movimientos_12m"] = (
        df_merge["movimientos_12m"].fillna(0).astype(int)
    )

    hoy = pd.Timestamp.today().normalize()

    alert_rows = []

    for _, r in df_merge.iterrows():
        sku = r.get("sku")
        nro_serie = r.get("nro_serie")
        marca = r.get("marca")
        modelo = r.get("modelo")
        persona_actual = r.get("persona_actual")
        cliente_actual = r.get("cliente_actual")
        pais_actual = r.get("pais_actual")
        fecha_compra = r.get("fecha_compra")

        # Valores de historial ya calculados por _features_historial
        mov_tot = int(r.get("movimientos_totales", 0) or 0)
        mov_12m = int(r.get("movimientos_12m", 0) or 0)
        dias_rango = r.get("dias_rango")

        # ---------- RENOVACIÓN ----------
        vida_dias = _vida_util_dias(r)
        if pd.notna(fecha_compra):
            dias_desde_compra = (hoy - fecha_compra.normalize()).days
        else:
            dias_desde_compra = None

        if dias_desde_compra is None:
            alerta_renov = "⚠️ Sin fecha de compra"
        elif dias_desde_compra > vida_dias:
            alerta_renov = "🔴 Renovación vencida"
        elif dias_desde_compra > vida_dias * 0.85:
            alerta_renov = "🔶 Próximo a vencer"
        else:
            alerta_renov = "🟢 OK"

        # ---------- HISTORIAL ----------
        r_tmp = r.copy()
        r_tmp["dias_rango_hist"] = dias_rango
        alerta_hist = clasificar_alerta_historial(r_tmp)

        # ---------- ASIGNACIÓN ----------
        persona_str = str(persona_actual or "").strip()
        if persona_str in ("", "Sin asignar", "None"):
            alerta_asig = "🔴 Sin asignación"
        else:
            alerta_asig = "🟢 Asignado"

        # placeholder, luego lo reemplazamos por ML v2
        alerta_ml = "🟢 Normal"

        alert_rows.append(
            {
                "sku": sku,
                "nro_serie": nro_serie,
                "marca": marca,
                "modelo": modelo,
                "persona_actual": persona_actual,
                "cliente_actual": cliente_actual,
                "pais_actual": pais_actual,
                "fecha_compra": fecha_compra,
                "dias_desde_compra": dias_desde_compra,
                "movimientos_totales": mov_tot,
                "movimientos_12m": mov_12m,
                "dias_rango_hist": dias_rango,
                "alerta_renovacion": alerta_renov,
                "alerta_historial": alerta_hist,
                "alerta_asignacion": alerta_asig,
                "alerta_ml": alerta_ml,  # se sobrescribe con ML v2
            }
        )

    df_alertas = pd.DataFrame(alert_rows)

    # Si realmente no quedó nada, devolvemos vacío
    if df_alertas.empty:
        return df_alertas

    # ---------- APLICAR ML v2 (Isolation Forest + LOF) ----------
    df_alertas = aplicar_ml_outliers(df_alertas)  # añade ml_iso, ml_lof, ml_score, alerta_ml_v2

    # Usamos SOLO la alerta ML v2 como alerta principal
    df_alertas["alerta_ml"] = df_alertas["alerta_ml_v2"]

    # ---------- CAPA 4: SCORES Y NIVEL DE RIESGO ----------
    df_alertas["score_renovacion"] = df_alertas["alerta_renovacion"].apply(
        _score_renovacion
    )
    df_alertas["score_historial"] = df_alertas["alerta_historial"].apply(
        _score_historial
    )
    df_alertas["score_asignacion"] = df_alertas["alerta_asignacion"].apply(
        _score_asignacion
    )
    df_alertas["score_ml"] = df_alertas["alerta_ml"].apply(_score_ml)

    df_alertas["riesgo_total"] = (
        df_alertas["score_renovacion"]
        + df_alertas["score_historial"]
        + df_alertas["score_asignacion"]
        + df_alertas["score_ml"]
    )

    df_alertas["nivel_riesgo"] = df_alertas["riesgo_total"].apply(_nivel_riesgo)

    return df_alertas

    
# =========================================================*****
# SECCIÓN: ALERTAS TEMPRANAS Y NIVEL DE RIESGO (DATOS)
# =========================================================
df_hist_all = cargar_historia_global()
df_alertas = calcular_alertas(df_eq, df_hist_all)
df_alertas = aplicar_ml_outliers(df_alertas) 

if df_alertas is not None and not df_alertas.empty:
    df_alertas = aplicar_ml_v2(df_alertas)
    
    
# ===========================================================
#                      TÍTULO + TABS
# ===========================================================
st.title("💻 Dashboard Hardware & Compras 2022–2025")

tab_home, tab_nuevo, tab_2022, tab_2023, tab_2024, tab_2025, tab_hist, tab_compras, tab_ventas, tab_alertas, tab_finanzas = st.tabs(
    [
        "🏠 Home",
        "➕ Nuevo activo",
        "Inventario 2022",
        "Inventario 2023",
        "Inventario 2024",
        "Inventario 2025",
        "Historia por activo",
        "Compras 2025",
        "Ventas 2025",
        "⚠️ Alertas tempranas",
        "📊 Finanzas",
    ]
)


# ===========================================================
#                      HOME PRINCIPAL
# ===========================================================
with tab_home:
    st.markdown(
        "<div class='section-label'>Resumen general del inventario</div>",
        unsafe_allow_html=True,
    )

    if df_eq is None or df_eq.empty:
        st.info("No se pudo cargar el inventario aún.")
    else:
        df_home = df_eq.copy()

        # ---------------- KPIs principales ----------------
        total_eq = len(df_home)
        vigentes = (
            df_home["estado"].astype(str).str.lower().ne("baja").sum()
            if "estado" in df_home.columns
            else 0
        )

        if "persona_actual" in df_home.columns:
            personas_con = (
                df_home["persona_actual"]
                .astype(str)
                .str.strip()
                .replace("", pd.NA)
                .dropna()
                .nunique()
            )
        else:
            personas_con = 0

        clientes = (
            df_home["cliente_actual"].nunique()
            if "cliente_actual" in df_home.columns
            else 0
        )

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total equipos", total_eq)
        c2.metric("Equipos vigentes", vigentes)
        c3.metric("Personas con equipo", personas_con)
        c4.metric("Clientes distintos", clientes)

        st.markdown("")  # pequeño espacio

        # =============== PREPARACIÓN DE DATOS PARA GRÁFICOS ============
        # Año de compra
        if "fecha_compra" in df_home.columns:
            df_home["anio_compra"] = df_home["fecha_compra"].dt.year

        # Plataforma (marca => Mac / Windows / Otros)
        df_plat = df_home.copy()

        def _map_plataforma(marca: str) -> str:
            if not isinstance(marca, str):
                return "Otros"
            m = marca.lower().strip()
            if "apple" in m or "mac" in m:
                return "Mac"
            if any(x in m for x in ["dell", "hp", "lenovo", "asus", "acer", "msi"]):
                return "Windows/PC"
            return "Otros"

        df_plat["plataforma"] = df_plat.get("marca", "").apply(_map_plataforma)
        df_plat_agg = (
            df_plat.groupby("plataforma")
            .size()
            .reset_index(name="equipos")
            .sort_values("equipos", ascending=False)
        )

        # Tipo de equipo
        if "tipo_equipo" in df_home.columns:
            df_tipo = (
                df_home.groupby("tipo_equipo")
                .size()
                .reset_index(name="equipos")
                .sort_values("equipos", ascending=False)
            )
        else:
            df_tipo = pd.DataFrame(columns=["tipo_equipo", "equipos"])

        # Evolución por año (area)
        if "anio_compra" in df_home.columns:
            df_evo = (
                df_home.groupby("anio_compra")
                .size()
                .reset_index(name="equipos")
                .sort_values("anio_compra")
            )
        else:
            df_evo = pd.DataFrame(columns=["anio_compra", "equipos"])

        # Marcas principales
        if "marca" in df_home.columns:
            df_marca = (
                df_home.groupby("marca")
                .size()
                .reset_index(name="equipos")
                .sort_values("equipos", ascending=False)
            )
            df_marca_top = df_marca.head(6)
        else:
            df_marca_top = pd.DataFrame(columns=["marca", "equipos"])

        # ======================= FILA 1: PLATAFORMA + DONUT + TIPO EQ ==================
        col_plataforma, col_donut, col_tipo = st.columns([1.1, 2, 2])

        # ---- Plataforma (Mac / Win / Otros) con métricas verticales ----
        with col_plataforma:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>💻</span>Plataforma (marca)</div>",
                unsafe_allow_html=True,
            )

            for plat in ["Mac", "Windows/PC", "Otros"]:
                fila = df_plat_agg[df_plat_agg["plataforma"] == plat]
                cantidad = int(fila["equipos"].iloc[0]) if not fila.empty else 0
                share = cantidad / total_eq * 100 if total_eq > 0 else 0
                st.metric(plat, cantidad, f"{share:.1f}%")

            st.markdown("</div>", unsafe_allow_html=True)

        # ---- Donut share de plataforma ----
        with col_donut:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>📊</span>Mix de plataforma</div>",
                unsafe_allow_html=True,
            )

            if not df_plat_agg.empty:
                donut = (
                    alt.Chart(df_plat_agg)
                    .mark_arc(innerRadius=60, cornerRadius=8, stroke="white")
                    .encode(
                        theta="equipos:Q",
                        color=alt.Color(
                            "plataforma:N",
                            scale=alt.Scale(
                                range=["#fb923c", "#3b82f6", "#a855f7"]
                            ),
                        ),
                        tooltip=["plataforma:N", "equipos:Q"],
                    )
                    .properties(height=260)
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(donut, use_container_width=True)
            else:
                st.info("Sin datos de plataforma.")

            st.markdown("</div>", unsafe_allow_html=True)

        # ---- Tipo de equipo (barras) ----
        with col_tipo:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>🧩</span>Tipo de equipo</div>",
                unsafe_allow_html=True,
            )

            if not df_tipo.empty:
                chart_tipo = (
                    alt.Chart(df_tipo)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("tipo_equipo:N", sort="-y", title=""),
                        y=alt.Y("equipos:Q", title="Equipos"),
                        tooltip=["tipo_equipo:N", "equipos:Q"],
                        color=alt.value("#2563eb"),
                    )
                    .properties(height=260)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_tipo, use_container_width=True)
            else:
                st.info("Sin datos de tipo de equipo.")

            st.markdown("</div>", unsafe_allow_html=True)

        # ======================= FILA 2: EVOLUCIÓN + MARCAS ============================
        st.markdown(
            "<div class='section-label'>Evolución y mix de marcas</div>",
            unsafe_allow_html=True,
        )

        col_evo, col_marcas = st.columns(2)

        # ---- Evolución de compras (área) ----
        with col_evo:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>📈</span>Evolución de compras</div>",
                unsafe_allow_html=True,
            )

            if not df_evo.empty:
                area = (
                    alt.Chart(df_evo)
                    .mark_area(
                        line={"color": "#2563eb", "strokeWidth": 2},
                        color="rgba(37,99,235,0.25)",
                    )
                    .encode(
                        x=alt.X("anio_compra:O", title="Año"),
                        y=alt.Y("equipos:Q", title="Equipos comprados"),
                        tooltip=["anio_compra:O", "equipos:Q"],
                    )
                    .properties(height=260)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(area, use_container_width=True)
            else:
                st.info("Sin datos de año de compra.")

            st.markdown("</div>", unsafe_allow_html=True)

        # ---- Marcas principales (barras horizontales) ----
        with col_marcas:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>🏷️</span>Marcas principales</div>",
                unsafe_allow_html=True,
            )

            if not df_marca_top.empty:
                bar_marcas = (
                    alt.Chart(df_marca_top)
                    .mark_bar(cornerRadiusTopRight=4, cornerRadiusBottomRight=4)
                    .encode(
                        y=alt.Y("marca:N", sort="-x", title=""),
                        x=alt.X("equipos:Q", title="Equipos"),
                        tooltip=["marca:N", "equipos:Q"],
                        color=alt.value("#fb923c"),
                    )
                    .properties(height=260)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(bar_marcas, use_container_width=True)
            else:
                st.info("Sin datos de marcas.")

            st.markdown("</div>", unsafe_allow_html=True)

        # ======================= MINI PANEL POR PESTAÑA (PAÍSES) ============================
        st.markdown(
            "<div class='section-label'>Resumen por pestaña — foco en países</div>",
            unsafe_allow_html=True,
        )

        # ---- Inventario total por país (todas las pestañas de inventario) ----
        if "pais_actual" in df_home.columns:
            df_pais_total = (
                df_home.groupby("pais_actual")
                .size()
                .reset_index(name="equipos")
                .sort_values("equipos", ascending=False)
                .head(8)
            )
        else:
            df_pais_total = pd.DataFrame(columns=["pais_actual", "equipos"])

        # ---- Inventario por año (para las pestañas 2022–2025) ----
        if "anio_compra" in df_home.columns and "pais_actual" in df_home.columns:
            df_inv_2025 = df_home[df_home["anio_compra"] == 2025]
            df_inv_2024 = df_home[df_home["anio_compra"] == 2024]
            df_inv_2023 = df_home[df_home["anio_compra"] == 2023]
            df_inv_2022 = df_home[df_home["anio_compra"] == 2022]

            def agg_pais(df):
                return (
                    df.groupby("pais_actual")
                    .size()
                    .reset_index(name="equipos")
                    .sort_values("equipos", ascending=False)
                    .head(8)
                )

            df_pais_2025 = (
                agg_pais(df_inv_2025)
                if not df_inv_2025.empty
                else pd.DataFrame(columns=["pais_actual", "equipos"])
            )
            df_pais_2024 = (
                agg_pais(df_inv_2024)
                if not df_inv_2024.empty
                else pd.DataFrame(columns=["pais_actual", "equipos"])
            )
            df_pais_2023 = (
                agg_pais(df_inv_2023)
                if not df_inv_2023.empty
                else pd.DataFrame(columns=["pais_actual", "equipos"])
            )
            df_pais_2022 = (
                agg_pais(df_inv_2022)
                if not df_inv_2022.empty
                else pd.DataFrame(columns=["pais_actual", "equipos"])
            )
        else:
            df_pais_2025 = df_pais_2024 = df_pais_2023 = df_pais_2022 = pd.DataFrame(
                columns=["pais_actual", "equipos"]
            )

        # ---- Equipos vigentes por país (resumen de “estado actual”) ----
        if "estado" in df_home.columns and "pais_actual" in df_home.columns:
            mask_vig = df_home["estado"].astype(str).str.lower().ne("baja")
            df_vig = df_home[mask_vig]
            if not df_vig.empty:
                df_pais_vig = (
                    df_vig.groupby("pais_actual")
                    .size()
                    .reset_index(name="equipos")
                    .sort_values("equipos", ascending=False)
                    .head(8)
                )
            else:
                df_pais_vig = pd.DataFrame(columns=["pais_actual", "equipos"])
        else:
            df_pais_vig = pd.DataFrame(columns=["pais_actual", "equipos"])

        # ======================= FILA 1: TOTAL + 2025 + 2024 ============================
        col_p1, col_p2, col_p3 = st.columns(3)

        # Inventario total por país
        with col_p1:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>🌎</span>Inventario total por país</div>",
                unsafe_allow_html=True,
            )
            if not df_pais_total.empty:
                chart_pais_total = (
                    alt.Chart(df_pais_total)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("pais_actual:N", sort="-x", title=""),
                        tooltip=["pais_actual:N", "equipos:Q"],
                        color=alt.value("#fb923c"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_pais_total, use_container_width=True)
            else:
                st.info("Sin datos de país en el inventario.")
            st.markdown("</div>", unsafe_allow_html=True)

        # Inventario 2025 por país
        with col_p2:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>📅</span>Inventario 2025 por país</div>",
                unsafe_allow_html=True,
            )
            if not df_pais_2025.empty:
                chart_pais_2025 = (
                    alt.Chart(df_pais_2025)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("pais_actual:N", sort="-x", title=""),
                        tooltip=["pais_actual:N", "equipos:Q"],
                        color=alt.value("#3b82f6"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_pais_2025, use_container_width=True)
            else:
                st.info("No hay equipos comprados en 2025 con país definido.")
            st.markdown("</div>", unsafe_allow_html=True)

        # Inventario 2024 por país
        with col_p3:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>📆</span>Inventario 2024 por país</div>",
                unsafe_allow_html=True,
            )
            if not df_pais_2024.empty:
                chart_pais_2024 = (
                    alt.Chart(df_pais_2024)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("pais_actual:N", sort="-x", title=""),
                        tooltip=["pais_actual:N", "equipos:Q"],
                        color=alt.value("#22c55e"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_pais_2024, use_container_width=True)
            else:
                st.info("No hay equipos comprados en 2024 con país definido.")
            st.markdown("</div>", unsafe_allow_html=True)

        # ======================= FILA 2: 2023 + 2022 + VIGENTES ============================
        col_p4, col_p5, col_p6 = st.columns(3)

        # Inventario 2023 por país
        with col_p4:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>📊</span>Inventario 2023 por país</div>",
                unsafe_allow_html=True,
            )
            if not df_pais_2023.empty:
                chart_pais_2023 = (
                    alt.Chart(df_pais_2023)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("pais_actual:N", sort="-x", title=""),
                        tooltip=["pais_actual:N", "equipos:Q"],
                        color=alt.value("#a855f7"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_pais_2023, use_container_width=True)
            else:
                st.info("No hay equipos comprados en 2023 con país definido.")
            st.markdown("</div>", unsafe_allow_html=True)

        # Inventario 2022 por país
        with col_p5:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>🗓️</span>Inventario 2022 por país</div>",
                unsafe_allow_html=True,
            )
            if not df_pais_2022.empty:
                chart_pais_2022 = (
                    alt.Chart(df_pais_2022)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("pais_actual:N", sort="-x", title=""),
                        tooltip=["pais_actual:N", "equipos:Q"],
                        color=alt.value("#f97316"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_pais_2022, use_container_width=True)
            else:
                st.info("No hay equipos comprados en 2022 con país definido.")
            st.markdown("</div>", unsafe_allow_html=True)

        # Equipos vigentes por país (estado ≠ baja)
        with col_p6:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>✅</span>Equipos vigentes por país</div>",
                unsafe_allow_html=True,
            )
            if not df_pais_vig.empty:
                chart_pais_vig = (
                    alt.Chart(df_pais_vig)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos vigentes"),
                        y=alt.Y("pais_actual:N", sort="-x", title=""),
                        tooltip=["pais_actual:N", "equipos:Q"],
                        color=alt.value("#16a34a"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_pais_vig, use_container_width=True)
            else:
                st.info("No hay equipos vigentes con país definido.")
            st.markdown("</div>", unsafe_allow_html=True)

        # ================== EVOLUCIÓN EN EL TIEMPO (A TRAVÉS DE LOS AÑOS) ==================
        st.markdown(
            "<div class='section-label'>Evolución por año — tipos de equipo y perfiles</div>",
            unsafe_allow_html=True,
        )

        col_t1, col_t2 = st.columns(2)

        # Evolución tipos de equipo por año (stacked)
        with col_t1:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>📈</span>Tipos de equipo por año</div>",
                unsafe_allow_html=True,
            )
            if "anio_compra" in df_home.columns and "tipo_equipo" in df_home.columns:
                df_tipo_year = (
                    df_home.dropna(subset=["anio_compra", "tipo_equipo"])
                    .groupby(["anio_compra", "tipo_equipo"])
                    .size()
                    .reset_index(name="equipos")
                )

                if not df_tipo_year.empty:
                    chart_tipo_year = (
                        alt.Chart(df_tipo_year)
                        .mark_area()
                        .encode(
                            x=alt.X("anio_compra:O", title="Año"),
                            y=alt.Y("equipos:Q", title="Equipos"),
                            color=alt.Color("tipo_equipo:N", title="Tipo"),
                            tooltip=["anio_compra:O", "tipo_equipo:N", "equipos:Q"],
                        )
                        .properties(height=260)
                        .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                        .configure_view(strokeWidth=0)
                    )
                    st.altair_chart(chart_tipo_year, use_container_width=True)
                else:
                    st.info("Sin datos de tipos de equipo por año.")
            else:
                st.info("No hay columnas anio_compra / tipo_equipo para esta vista.")
            st.markdown("</div>", unsafe_allow_html=True)

        # Evolución perfiles por año (stacked)
        with col_t2:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>📊</span>Perfiles por año (Top 8)</div>",
                unsafe_allow_html=True,
            )
            if "anio_compra" in df_home.columns and "perfil_actual" in df_home.columns:
                # Base limpia
                df_perfil_base = df_home.dropna(
                    subset=["anio_compra", "perfil_actual"]
                ).copy()

                if not df_perfil_base.empty:
                    # 1) Top N perfiles más demandados en todos los años
                    top_n = 8
                    totales_perfil = (
                        df_perfil_base.groupby("perfil_actual")
                        .size()
                        .reset_index(name="equipos")
                        .sort_values("equipos", ascending=False)
                    )
                    perfiles_top = totales_perfil["perfil_actual"].head(top_n).tolist()

                    # 2) Agrupar el resto como "Otros"
                    df_perfil_base["perfil_clean"] = df_perfil_base[
                        "perfil_actual"
                    ].where(
                        df_perfil_base["perfil_actual"].isin(perfiles_top),
                        other="Otros",
                    )

                    # 3) Agregar por año + perfil_clean
                    df_perfil_year = (
                        df_perfil_base.groupby(["anio_compra", "perfil_clean"])
                        .size()
                        .reset_index(name="equipos")
                    )

                    chart_perfil_year = (
                        alt.Chart(df_perfil_year)
                        .mark_area()
                        .encode(
                            x=alt.X("anio_compra:O", title="Año"),
                            y=alt.Y("equipos:Q", title="Equipos"),
                            color=alt.Color(
                                "perfil_clean:N",
                                title="Perfil",
                                sort=perfiles_top + ["Otros"],
                            ),
                            tooltip=["anio_compra:O", "perfil_clean:N", "equipos:Q"],
                        )
                        .properties(height=260)
                        .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                        .configure_view(strokeWidth=0)
                    )
                    st.altair_chart(chart_perfil_year, use_container_width=True)
                else:
                    st.info("Sin datos de perfiles por año.")
            else:
                st.info("No hay columnas anio_compra / perfil_actual para esta vista.")
            st.markdown("</div>", unsafe_allow_html=True)


# ===========================================================
#      FUNCIÓN: PESTAÑA INVENTARIO POR AÑO (2022–2025)
# ===========================================================
def pestaña_por_anio(df_eq: pd.DataFrame, anio: int) -> None:
    """
    Pestaña de inventario para un año específico.
    Usa el mismo estilo de KPIs + gráfico 'chart-card' que la pestaña Home.
    """
    st.markdown(f"## Inventario {anio}")

    # ---- Base con anio_compra ----
    df_inv_base = df_eq.copy()
    if "anio_compra" not in df_inv_base.columns and "fecha_compra" in df_inv_base.columns:
        df_inv_base["anio_compra"] = df_inv_base["fecha_compra"].dt.year

    df_inv_anio = df_inv_base[df_inv_base["anio_compra"] == anio].copy()
    if df_inv_anio.empty:
        st.info("Sin equipos para este año.")
        return

    # ---- KPIs del año ----
    total_eq_anio = len(df_inv_anio)
    vigentes_anio = (
        df_inv_anio["estado"].astype(str).str.lower().ne("baja").sum()
        if "estado" in df_inv_anio.columns
        else total_eq_anio
    )
    clientes_anio = (
        df_inv_anio["cliente_actual"].nunique()
        if "cliente_actual" in df_inv_anio.columns
        else 0
    )
    paises_anio = (
        df_inv_anio["pais_actual"].nunique()
        if "pais_actual" in df_inv_anio.columns
        else 0
    )

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total equipos", total_eq_anio)
    c2.metric("Equipos vigentes", vigentes_anio)
    c3.metric("Clientes distintos", clientes_anio)
    c4.metric("Países", paises_anio)

    # ================== FILTROS ==================
    with st.expander("🔍 Filtros", expanded=False):
        col1, col2, col3, col4 = st.columns(4)
        df_f = df_inv_anio.copy()

        if "cliente_actual" in df_f.columns:
            opts = sorted(df_f["cliente_actual"].dropna().unique())
            elegido = col1.multiselect(
                "Cliente", opts, default=[], key=f"inv_cliente_{anio}"
            )
            if elegido:
                df_f = df_f[df_f["cliente_actual"].isin(elegido)]

        if "pais_actual" in df_f.columns:
            opts = sorted(df_f["pais_actual"].dropna().unique())
            elegido = col2.multiselect(
                "País", opts, default=[], key=f"inv_pais_{anio}"
            )
            if elegido:
                df_f = df_f[df_f["pais_actual"].isin(elegido)]

        if "marca" in df_f.columns:
            opts = sorted(df_f["marca"].dropna().unique())
            elegido = col3.multiselect(
                "Marca", opts, default=[], key=f"inv_marca_{anio}"
            )
            if elegido:
                df_f = df_f[df_f["marca"].isin(elegido)]

        if "estado" in df_f.columns:
            opts = sorted(df_f["estado"].dropna().unique())
            elegido = col4.multiselect(
                "Estado", opts, default=[], key=f"inv_estado_{anio}"
            )
            if elegido:
                df_f = df_f[df_f["estado"].isin(elegido)]

    # si después de filtrar no hay nada
    if df_f.empty:
        st.warning("No hay equipos después de aplicar los filtros.")
        return

    # ================== GRÁFICOS ESTILO HOME ==================
    st.markdown(
        "<div class='section-label'>Gráficos del inventario filtrado</div>",
        unsafe_allow_html=True,
    )

    # Fila 1: Marca + País
    g1, g2 = st.columns(2)

    with g1:
        render_grafico_marca_home_style(
            df_f,
            titulo=f"Cantidad por marca {anio}",
        )

    with g2:
        st.markdown(
            "<div class='chart-card'>"
            f"<div class='chart-title'><span class='icon'>🌎</span>Equipos por país {anio}</div>",
            unsafe_allow_html=True,
        )

        if "pais_actual" in df_f.columns:
            df_pais = (
                df_f.groupby("pais_actual")
                .size()
                .reset_index(name="equipos")
                .sort_values("equipos", ascending=False)
            )

            if not df_pais.empty:
                chart_pais = (
                    alt.Chart(df_pais)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("pais_actual:N", sort="-x", title=""),
                        tooltip=["pais_actual:N", "equipos:Q"],
                        color=alt.value("#fb923c"),
                    )
                    .properties(height=260)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_pais, use_container_width=True)
            else:
                st.info("Sin datos de país para este año/filtrado.")
        else:
            st.info("Esta vista no tiene columna 'pais_actual'.")

        st.markdown("</div>", unsafe_allow_html=True)

    # Fila 2: Perfiles (si existen)
    if "perfil_actual" in df_f.columns:
        st.markdown(
            "<div class='chart-card'>"
            f"<div class='chart-title'><span class='icon'>👥</span>Perfiles más usados {anio}</div>",
            unsafe_allow_html=True,
        )

        df_perfil = (
            df_f.groupby("perfil_actual")
            .size()
            .reset_index(name="equipos")
            .sort_values("equipos", ascending=False)
            .head(10)
        )

        if not df_perfil.empty:
            chart_perfil = (
                alt.Chart(df_perfil)
                .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                .encode(
                    x=alt.X("equipos:Q", title="Equipos"),
                    y=alt.Y("perfil_actual:N", sort="-x", title=""),
                    tooltip=["perfil_actual:N", "equipos:Q"],
                    color=alt.value("#a855f7"),
                )
                .properties(height=260)
                .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                .configure_view(strokeWidth=0)
            )
            st.altair_chart(chart_perfil, use_container_width=True)
        else:
            st.info("Sin datos de perfiles para este año/filtrado.")

        st.markdown("</div>", unsafe_allow_html=True)

    # -------- Tabla detalle --------
    st.markdown("### 📋 Detalle de equipos")

    columnas = [
        c
        for c in [
            "sku",
            "nro_serie",
            "asset_tag",
            "tipo_equipo",
            "marca",
            "modelo",
            "cpu",
            "ram_gb",
            "almacenamiento",
            "estado",
            "fecha_compra",
            "cliente_actual",
            "persona_actual",
            "pais_actual",
            "ciudad_actual",
            "perfil_actual",
        ]
        if c in df_f.columns
    ]

    st.dataframe(
        df_f[columnas].sort_values("fecha_compra"), use_container_width=True
    )

    # -------- Vista rápida --------
    st.markdown("### 🖼️ Vista rápida del equipo")

    df_prev = df_f.copy()
    df_prev["label"] = df_prev.apply(
        lambda r: f"{r.get('sku','')} — {r.get('marca','')} {r.get('modelo','')} — {r.get('persona_actual','')}",
        axis=1,
    )

    opcion = st.selectbox(
        "Selecciona un equipo:",
        df_prev["label"].tolist(),
        key=f"preview_inventario_{anio}",
    )

    fila = df_prev[df_prev["label"] == opcion].iloc[0]

    cA, cB = st.columns([1.5, 1])

    with cA:
        st.markdown(
            f"""
            **SKU:** {fila.get('sku','')}  
            **Serie:** {fila.get('nro_serie','')}  
            **Asset:** {fila.get('asset_tag','')}  
            **Equipo:** {fila.get('tipo_equipo','')} {fila.get('marca','')} {fila.get('modelo','')}  
            **CPU:** {fila.get('cpu','')}  
            **RAM:** {fila.get('ram_gb','')}  
            **Almacenamiento:** {fila.get('almacenamiento','')}  
            **Persona:** {fila.get('persona_actual','')}  
            **Cliente:** {fila.get('cliente_actual','')}  
            **Ubicación:** {fila.get('ciudad_actual','')} - {fila.get('pais_actual','')}
            """
        )

    with cB:
        
        BASE_DIR = Path(__file__).resolve().parent
        
    img_path = BASE_DIR / "assets" / "balloon.png"   # <-- tu imagen en el repo

    if img_path.exists():
        st.image(str(img_path), use_container_width=True)
    else:
        st.warning(f"No encontré la imagen: {img_path}")


# ===========================================================
#              TABS DE INVENTARIO POR AÑO
# ===========================================================
with tab_2022:
    pestaña_por_anio(df_eq, 2022)

with tab_2023:
    pestaña_por_anio(df_eq, 2023)

with tab_2024:
    pestaña_por_anio(df_eq, 2024)

with tab_2025:
    pestaña_por_anio(df_eq, 2025)

# ===========================================================
#                TAB ALERTAS TEMPRANAS
# ===========================================================
with tab_alertas:
    st.markdown(
        "<div class='section-label'>Alertas tempranas y nivel de riesgo</div>",
        unsafe_allow_html=True,
    )

    # Si por alguna razón no hay alertas
    if df_alertas is None or df_alertas.empty:
        st.info("No se encontraron alertas para los equipos actuales.")
    else:
        # Asegurar que riesgo_total sea numérico (por si viene como object)
        df_alertas["riesgo_total"] = pd.to_numeric(
            df_alertas.get("riesgo_total", 0), errors="coerce"
        ).fillna(0).astype(int)

        # =====================================================
        # 1. KPIs principales de alertas
        # =====================================================
        
        
        col_a1, col_a2, col_a3, col_a4 = st.columns(4)

        col_a1.metric(
            "Renovación vencida",
            int((df_alertas["alerta_renovacion"] == "🔴 Renovación vencida").sum()),
        )

        col_a2.metric(
            "Próximo a vencer",
            int((df_alertas["alerta_renovacion"] == "🔶 Próximo a vencer").sum()),
        )

        col_a3.metric(
            "Sin asignación",
            int((df_alertas["alerta_asignacion"] == "🔴 Sin asignación").sum()),
        )

        col_a4.metric(
            "Rotación anómala",
            int(
                df_alertas["alerta_historial"]
                .fillna("")
                .str.startswith("🔴 Rotación")
                .sum()
            ),
        )

        # =====================================================
        # 2. Resumen visual (gráficos)
        # =====================================================
        st.markdown(
            "<div class='section-label'>Resumen visual de alertas</div>",
            unsafe_allow_html=True,
        )

        col_g1, col_g2 = st.columns(2)

        # ----- Gráfico: estados de renovación -----
        df_estado_ren = (
        df_alertas["alerta_renovacion"]
        .fillna("Sin dato")
        .value_counts()
        .reset_index(name="equipos")  # la columna de conteo se llama 'equipos'
        .rename(columns={"index": "estado"})
        )


        with col_g1:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>⌛</span>Estado de renovación</div>",
                unsafe_allow_html=True,
            )

            if not df_estado_ren.empty:
                chart_ren = (
                    alt.Chart(df_estado_ren)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("estado:N", sort="-x", title=""),
                        tooltip=["estado:N", "equipos:Q"],
                        color=alt.value("#f97316"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_ren, use_container_width=True)
            else:
                st.info("Sin datos de estados de renovación.")

            st.markdown("</div>", unsafe_allow_html=True)

        # ----- Gráfico: distribución ML v2 -----
        # usamos alerta_ml_v2 si existe; si no, caemos a alerta_ml clásica
        col_ml_field = "alerta_ml_v2" if "alerta_ml_v2" in df_alertas.columns else "alerta_ml"

        df_ml = (
            df_alertas[col_ml_field]
            .fillna("Sin dato")
            .value_counts()
            .reset_index(name="equipos")
            .rename(columns={"index": "estado"})
            )

            

        with col_g2:
            st.markdown(
                "<div class='chart-card'>"
                "<div class='chart-title'><span class='icon'>🤖</span>Detección automática (ML v2)</div>",
                unsafe_allow_html=True,
            )

            if not df_ml.empty:
                chart_ml = (
                    alt.Chart(df_ml)
                    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
                    .encode(
                        x=alt.X("equipos:Q", title="Equipos"),
                        y=alt.Y("estado:N", sort="-x", title=""),
                        tooltip=["estado:N", "equipos:Q"],
                        color=alt.value("#22c55e"),
                    )
                    .properties(height=220)
                    .configure_axis(labelColor="#4b5563", titleColor="#4b5563")
                    .configure_view(strokeWidth=0)
                )
                st.altair_chart(chart_ml, use_container_width=True)
            else:
                st.info("Sin datos para la detección automática.")

            st.markdown("</div>", unsafe_allow_html=True)

        # =====================================================
        # 3. Ranking top riesgo_total
        # =====================================================
        st.markdown("### 🔥 Ranking de equipos con mayor riesgo")

        df_top = df_alertas.sort_values("riesgo_total", ascending=False).head(20)

        st.dataframe(
            df_top[
                [
                    "sku",
                    "nro_serie",
                    "marca",
                    "modelo",
                    "persona_actual",
                    "cliente_actual",
                    "alerta_renovacion",
                    "alerta_historial",
                    "alerta_asignacion",
                    col_ml_field,
                    "nivel_riesgo",
                    "riesgo_total",
                ]
            ],
            use_container_width=True,
        )

        # =====================================================
        # 4. Equipos con alertas activas (vista detallada)
        # =====================================================
        st.markdown(
            "<div class='section-label'>Equipos con alertas activas</div>",
            unsafe_allow_html=True,
        )

        mask_relev = (
            df_alertas["alerta_renovacion"].isin(
                [
                    "🔴 Renovación vencida",
                    "🔶 Próximo a vencer",
                    "⚠️ Sin fecha de compra",
                ]
            )
            | (df_alertas["alerta_asignacion"] == "🔴 Sin asignación")
            | df_alertas["alerta_historial"].fillna("").str.startswith("🔴")
            | df_alertas["alerta_historial"].fillna("").str.startswith("🟠")
            | df_alertas[col_ml_field].fillna("").str.startswith("🔴")
        )

        df_alertas_relev = df_alertas[mask_relev].copy()

        if df_alertas_relev.empty:
            st.info("Actualmente no hay equipos con alertas rojas o amarillas.")
        else:
            st.dataframe(
                df_alertas_relev[
                    [
                        "sku",
                        "nro_serie",
                        "marca",
                        "modelo",
                        "persona_actual",
                        "cliente_actual",
                        "pais_actual",
                        "alerta_renovacion",
                        "alerta_asignacion",
                        "alerta_historial",
                        col_ml_field,
                        "nivel_riesgo",
                        "riesgo_total",
                        "movimientos_totales",
                        "movimientos_12m",
                    ]
                ].sort_values(
                    ["nivel_riesgo", "riesgo_total"], ascending=[False, False]
                ),
                use_container_width=True,
            )

        # =====================================================
        # 5. Solo outliers ML v2
        # =====================================================
        st.markdown("### 🤖 Equipos con comportamiento inusual (ML v2)")

        df_outliers = df_alertas[
            df_alertas[col_ml_field].fillna("").str.startswith("🔴")
        ].copy()

        if df_outliers.empty:
            st.info("No se detectaron outliers de movimientos según el modelo ML v2.")
        else:
            st.dataframe(
                df_outliers[
                    [
                        "sku",
                        "nro_serie",
                        "marca",
                        "modelo",
                        "persona_actual",
                        "cliente_actual",
                        "movimientos_totales",
                        "movimientos_12m",
                        "dias_rango_hist",
                        "alerta_historial",
                        col_ml_field,
                        "nivel_riesgo",
                        "riesgo_total",
                    ]
                ].sort_values("movimientos_totales", ascending=False),
                use_container_width=True,
            )


        # =====================================================
        # 6. Mapa ML (PCA 2D)
        # =====================================================
        st.markdown("### 🧠 Mapa ML de equipos (proyección 2D)")

        # Features numéricas para el mapa
        cols_pca = [
            "movimientos_totales",
            "movimientos_12m",
            "dias_rango_hist",
            "clientes_distintos",
            "personas_distintas",
            "dias_desde_compra",
            "riesgo_total",
        ]
        for c in cols_pca:
            if c not in df_alertas.columns:
                df_alertas[c] = 0

        X = df_alertas[cols_pca].fillna(0)

        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        pca = PCA(n_components=2, random_state=42)
        comp = pca.fit_transform(X_scaled)

        df_pca = df_alertas.copy()
        df_pca["pca1"] = comp[:, 0]
        df_pca["pca2"] = comp[:, 1]

        chart_pca = (
            alt.Chart(df_pca)
            .mark_circle(opacity=0.7)
            .encode(
                x=alt.X("pca1:Q", title="Componente 1 (PCA)"),
                y=alt.Y("pca2:Q", title="Componente 2 (PCA)"),
                tooltip=[
                    "sku",
                    "nro_serie",
                    "marca",
                    "modelo",
                    "persona_actual",
                    "cliente_actual",
                    "movimientos_totales",
                    "movimientos_12m",
                    "riesgo_total",
                    col_ml_field,
                ],
                color=alt.Color(
                    f"{col_ml_field}:N",
                    title="ML v2",
                    legend=alt.Legend(orient="right"),
                ),
                size=alt.Size("riesgo_total:Q", legend=None),
            )
            .properties(height=360)
            .configure_axis(labelColor="#d1d5db", titleColor="#d1d5db")
            .configure_view(strokeWidth=0)
        )

        st.altair_chart(chart_pca, use_container_width=True)

st.subheader("🧠 Acciones recomendadas (dbt)")
st.caption(f"Filas: {len(df_acciones)}")
st.dataframe(df_acciones, use_container_width=True)


# ===========================================================
#                    HISTORIA POR ACTIVO
# ===========================================================
with tab_hist:
    st.subheader("🕘 Historia completa de un equipo")

    st.markdown(
        "<div style='color:#e5e7eb;font-size:0.9rem;margin-bottom:0.25rem;'>"
        "Busca por <strong>SKU</strong>, <strong>Número de Serie</strong> o <strong>Nombre</strong>"
        "</div>",
        unsafe_allow_html=True,
    )

    # Usamos un form para que la interacción quede mejor encapsulada
    with st.form("historia_form"):
        col_sku, col_serie, col_nombre = st.columns([1, 1, 1.5])

        with col_sku:
            sku_in = st.text_input("SKU", placeholder="Ej: 314", key="hist_sku")

        with col_serie:
            serie_in = st.text_input("Número de Serie", key="hist_serie")

        with col_nombre:
            nombre_in = st.text_input(
                "Nombre (persona actual)",
                placeholder="Ej: Beatriz Herrera",
                key="hist_nombre",
            )

        buscar = st.form_submit_button("🔍 Buscar")

    # 🔴 TODO lo que sigue va DENTRO de este if
    if buscar:
        sku_int = None

        # --- Validación básica ---
        if not (sku_in or serie_in or nombre_in):
            st.warning("Ingresa al menos un criterio (SKU, número de serie o nombre).")
        else:
            # --- SKU numérico ---
            if sku_in.strip():
                try:
                    sku_int = int(float(sku_in.strip()))
                except Exception:
                    st.error("El SKU debe ser numérico.")
                    sku_int = None

            # --- Búsqueda por nombre si no hay SKU ni serie ---
            if not sku_int and not serie_in and nombre_in.strip():
                mask = df_eq["persona_actual"].astype(str).str.contains(
                    nombre_in.strip(), case=False, na=False
                )
                df_nom = df_eq[mask].copy()

                if df_nom.empty:
                    st.warning("No se encontraron equipos para ese nombre.")
                    st.stop()

                df_nom = df_nom.sort_values("fecha_compra").drop_duplicates(
                    subset=["sku", "nro_serie"], keep="last"
                )

                skus = df_nom["sku"].dropna().astype("Int64").tolist()

                if len(skus) > 1:
                    st.warning("Hay más de un equipo asignado a ese nombre.")
                    st.dataframe(
                        df_nom[
                            ["sku", "nro_serie", "persona_actual", "cliente_actual"]
                        ],
                        use_container_width=True,
                    )
                    st.stop()

                if not skus:
                    st.warning("No se pudo determinar un SKU único para ese nombre.")
                    st.stop()

                sku_int = int(skus[0])
                st.info(f"Buscando por nombre → usando SKU **{sku_int}**")

            serie_val = serie_in or None

            if not (sku_int or serie_val):
                st.warning("Debes ingresar SKU, número de serie o nombre.")
                st.stop()

            # ===================================================
            #   CARGA DE HISTORIA (API + tabla manual ti_ops)
            # ===================================================
            with st.spinner("Cargando historia del activo…"):
                # 1) Historia oficial de la API
                df_hist = get_historia_hw(
                    sku=sku_int, nro_serie=serie_val, asset_tag=None
                )

                # Estado actual desde la API
                try:
                    df_estado = get_estado_actual_hw(
                        sku=sku_int, nro_serie=serie_val, asset_tag=None
                    )
                except Exception:
                    df_estado = pd.DataFrame()

                # 2) Historia manual desde ti_ops.activos.historia_hw
                try:
                    from sqlalchemy import text

                    df_extra = pd.read_sql(
                        text(
                            """
                            SELECT
                                sku,
                                nro_serie,
                                asset_tag,
                                tipo_evento,
                                fecha_evento,
                                cliente,
                                ciudad,
                                persona,
                                rut AS rut_persona,
                                pais,
                                detalle
                            FROM activos.historia_hw
                            WHERE (:sku IS NULL OR sku = :sku)
                              AND (:nro_serie IS NULL OR nro_serie = :nro_serie)
                            """
                        ),
                        con=engine_mtr,
                        params={"sku": sku_int, "nro_serie": serie_val},
                    )
                except Exception:
                    df_extra = pd.DataFrame()

            # ---------------------------------------------------
            # 3) Unir historia API + manual
            # ---------------------------------------------------
            if df_hist is None:
                df_hist = pd.DataFrame()

            if df_extra is not None and not df_extra.empty:
                # Normalizar columnas y fechas
                if "fecha_evento" in df_extra.columns:
                    df_extra["fecha_evento"] = pd.to_datetime(
                        df_extra["fecha_evento"], errors="coerce"
                    )

                # Igualar columnas entre df_hist y df_extra
                for col in df_hist.columns:
                    if col not in df_extra.columns:
                        df_extra[col] = pd.NA
                for col in df_extra.columns:
                    if col not in df_hist.columns:
                        df_hist[col] = pd.NA

                if df_hist.empty:
                    df_hist = df_extra.copy()
                else:
                    df_extra = df_extra[df_hist.columns]
                    df_hist = pd.concat([df_hist, df_extra], ignore_index=True)

            # === Equipo sin historia, pero puede existir en inventario ===
            if df_hist is None or df_hist.empty:
                df_match = df_eq.copy()

                if sku_int is not None and "sku" in df_match.columns:
                    df_match = df_match[
                        df_match["sku"].astype("Int64") == int(sku_int)
                    ]

                if serie_val and "nro_serie" in df_match.columns:
                    df_match = df_match[
                        df_match["nro_serie"].astype(str) == str(serie_val)
                    ]

                if df_match.empty:
                    st.info("No existe historia para este equipo.")
                    st.stop()
                else:
                    info_row = df_match.iloc[0]

                    st.markdown(
                        "### 📋 Información básica del equipo (sin historia registrada)"
                    )
                    col1, col2 = st.columns([2, 1])

                    with col1:
                        st.markdown(
                            f"""
                            **SKU:** {info_row.get('sku','')}  
                            **Nro serie:** {info_row.get('nro_serie','')}  
                            **Asset tag:** {info_row.get('asset_tag','')}  

                            **Equipo:** {info_row.get('tipo_equipo','')} {info_row.get('marca','')} {info_row.get('modelo','')}  
                            **CPU:** {info_row.get('cpu','')}  
                            **RAM:** {info_row.get('ram_gb','')}  
                            **Almacenamiento:** {info_row.get('almacenamiento','')}  

                            **Persona actual:** {info_row.get('persona_actual','')}  
                            **Cliente actual:** {info_row.get('cliente_actual','')}  
                            **Ubicación:** {info_row.get('ciudad_actual','')} - {info_row.get('pais_actual','')}
                            """
                        )

                    with col2:
                        foto = get_equipo_image_path(info_row)
                        if foto:
                            st.image(foto, use_container_width=True)
                        else:
                            st.markdown(
                                "<div style='color:#9ca3af;font-size:0.8rem;text-align:right;'>Sin foto disponible</div>",
                                unsafe_allow_html=True,
                            )

                    st.warning(
                        "Este equipo existe en el inventario, pero todavía no tiene eventos de historia "
                        "registrados en la API ni en la tabla manual `activos.historia_hw`."
                    )
                    st.stop()

            # ===================================================
            # 4) Normalizar fecha y limpiar COMPRAS duplicadas
            # ===================================================
            # Si no hay fecha_evento pero sí fecha_compra, la usamos
            if (
                "fecha_evento" not in df_hist.columns
                and "fecha_compra" in df_hist.columns
            ):
                df_hist["fecha_evento"] = pd.to_datetime(
                    df_hist["fecha_compra"], errors="coerce"
                )
            else:
                df_hist["fecha_evento"] = pd.to_datetime(
                    df_hist["fecha_evento"], errors="coerce"
                )

            df_hist = df_hist.sort_values("fecha_evento")

            cols_necesarias = {"sku", "nro_serie", "tipo_evento", "fecha_evento"}
            if cols_necesarias.issubset(df_hist.columns):
                df_hist["tipo_evento"] = (
                    df_hist["tipo_evento"].astype(str).str.upper()
                )

                # Separar compras del resto
                mask_compra = df_hist["tipo_evento"] == "COMPRA"
                df_compra = df_hist[mask_compra].copy()
                df_otros = df_hist[~mask_compra].copy()

                if not df_compra.empty:
                    # Dejar solo la COMPRA más nueva por equipo
                    df_compra = (
                        df_compra.sort_values("fecha_evento")
                        .drop_duplicates(subset=["sku", "nro_serie"], keep="last")
                    )

                df_hist = pd.concat([df_compra, df_otros], ignore_index=True)

                # Quitar duplicados exactos
                df_hist = (
                    df_hist.drop_duplicates(
                        subset=[
                            "sku",
                            "nro_serie",
                            "tipo_evento",
                            "fecha_evento",
                        ],
                        keep="first",
                    )
                    .reset_index(drop=True)
                )

                df_hist["fecha_evento"] = pd.to_datetime(
                    df_hist["fecha_evento"], errors="coerce"
                )
                df_hist = df_hist.sort_values("fecha_evento")

            # ===================================================
            # 5) Resumen inicial y rango de fechas
            # ===================================================
            first = df_hist.iloc[0]
            last = df_hist.iloc[-1]
            f_ini = first["fecha_evento"].date()
            f_fin = last["fecha_evento"].date()

            st.markdown(
                f"""
                **SKU:** {first.get('sku','')}  
                **Nro serie:** {first.get('nro_serie','')}  
                **Asset tag:** {first.get('asset_tag','')}
                """
            )
            st.markdown(f"**Rango de fechas:** {f_ini} → {f_fin}")

            # Mezclamos con df_estado y df_eq para info final
            if isinstance(df_estado, pd.DataFrame) and not df_estado.empty:
                base_row = df_estado.iloc[0]
            else:
                base_row = last

            info_row = base_row.copy()

            try:
                sku_lookup = info_row.get("sku") or first.get("sku")
                serie_lookup = info_row.get("nro_serie") or first.get("nro_serie")

                if sku_lookup is not None and "sku" in df_eq.columns:
                    mask_match = df_eq["sku"].astype("Int64") == int(sku_lookup)
                    if pd.notna(serie_lookup) and "nro_serie" in df_eq.columns:
                        mask_match &= (
                            df_eq["nro_serie"].astype(str) == str(serie_lookup)
                        )

                    df_match = df_eq[mask_match]
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
                                col not in info_row
                                or pd.isna(info_row[col])
                                or str(info_row[col]).strip() == ""
                            ):
                                info_row[col] = inv[col]
            except Exception:
                pass

            cA, cB, cC = st.columns([2, 2, 1])

            with cA:
                st.markdown(
                    f"""
                    **SKU:** {info_row.get('sku','')}  
                    **Serie:** {info_row.get('nro_serie','')}  
                    **Asset:** {info_row.get('asset_tag','')}
                    """
                )

            with cB:
                st.markdown(
                    f"""
                    **Equipo:** {info_row.get('tipo_equipo','')} {info_row.get('marca','')} {info_row.get('modelo','')}  
                    **CPU:** {info_row.get('cpu','')}  
                    **RAM:** {info_row.get('ram_gb','')}  
                    **Almacenamiento:** {info_row.get('almacenamiento','')}
                    """
                )

            with cC:
                foto = get_equipo_image_path(info_row)
                if foto:
                    st.image(foto, use_container_width=True)
                else:
                    st.markdown(
                        "<div style='color:#9ca3af;font-size:0.8rem;text-align:right;'>Sin foto disponible</div>",
                        unsafe_allow_html=True,
                    )
                            # Buscar fila de alertas para este SKU (si existe)
        fila_alerta = None
        try:
            if "sku" in df_alertas.columns:
                sku_val = info_row.get("sku")
                if pd.notna(sku_val):
                    tmp = df_alertas[df_alertas["sku"] == sku_val]
                    if not tmp.empty:
                        fila_alerta = tmp.iloc[0]
        except Exception:
            fila_alerta = None

        # Generar PDF en memoria
        pdf_buffer = generar_pdf_equipo(
            info_row,
            df_hist,
            fila_alerta=fila_alerta,
        )

        st.download_button(
            label="📄 Descargar PDF del equipo",
            data=pdf_buffer,
            file_name=f"reporte_equipo_{info_row.get('sku','sin_sku')}.pdf",
            mime="application/pdf",
        )

        # Gaps largos
        gaps = resumen_gaps(df_hist)
        if gaps:
            st.markdown(
                "<div class='timeline-gap-alert'>"
                "🔍 <strong>Períodos largos sin movimientos:</strong><ul>"
                + "".join(f"<li>{g}</li>" for g in gaps)
                + "</ul></div>",
                unsafe_allow_html=True,
            )
    
        
    

            # ----------------- LÍNEA DE TIEMPO -----------------
            st.markdown(
                "<div class='timeline-title'>🕒 Línea de tiempo del equipo</div>",
                unsafe_allow_html=True,
            )

            fechas = pd.to_datetime(df_hist["fecha_evento"], errors="coerce")
            df_hist["dias_sig"] = (fechas.shift(-1) - fechas).dt.days

            for _, r in df_hist.iterrows():
                fecha = r.get("fecha_evento")
                fecha_str = str(fecha)[:10]
                tipo = (r.get("tipo_evento") or "").upper()

                if tipo == "COMPRA":
                    icon = "🛒"; badge = "#22c55e"
                elif tipo == "ASIGNACION":
                    icon = "👤"; badge = "#3b82f6"
                elif tipo == "ASIGNACION_ACTUAL":
                    icon = "⭐"; badge = "#facc15"
                elif tipo == "REPARACION":
                    icon = "🛠"; badge = "#f97316"
                else:
                    icon = "📌"; badge = "#6b7280"

                cliente = r.get("cliente", "") or r.get("cliente_actual", "") or ""
                ciudad = r.get("ciudad", "") or r.get("ciudad_actual", "") or ""
                detalle = r.get("detalle", "") or r.get("comentario", "") or ""

                d = r.get("dias_sig")
                dur = (
                    f"<div style='margin-top:0.35rem;font-size:0.75rem;color:#9ca3af;'>⏱ {int(d)} días hasta el siguiente evento</div>"
                    if pd.notna(d)
                    else ""
                )

                html = f"""
<div style="padding:1rem;background:#2d2d2d;border-radius:12px;margin-bottom:0.9rem;border:1px solid #3a3a3a;">
  <div style="color:#9ca3af;font-size:0.85rem;">{fecha_str}</div>
  <div style="margin-top:0.3rem;font-weight:600;font-size:1rem;color:white;">
    {icon}
    <span class="timeline-chip" style="background:{badge};">{tipo}</span>
  </div>
  <div style="margin-top:0.4rem;color:#e5e7eb;">{cliente} — {ciudad}</div>
  <div style="margin-top:0.3rem;font-size:0.9rem;color:#d1d5db;">{detalle}</div>
  {dur}
</div>
"""
                st.markdown(html, unsafe_allow_html=True)

            # ---------------- TABLA + EVENTOS AGRUPADOS ----------------
            st.markdown("### 📘 Historial (tabla)")
            st.dataframe(df_hist, use_container_width=True)

            if "tipo_evento" in df_hist.columns:
                st.markdown("### 📂 Eventos agrupados")
                for tipo in sorted(df_hist["tipo_evento"].dropna().unique()):
                    df_t = df_hist[df_hist["tipo_evento"] == tipo]
                    with st.expander(f"{tipo} ({len(df_t)})"):
                        st.dataframe(df_t, use_container_width=True)



# -----------------------------------------
# Meses en español (definido UNA sola vez)
# -----------------------------------------
MESES_ES = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
}

def render_kpis_mtr_2025():
    st.markdown(
        """
<style>
.mtr-kpi-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0.8rem 0 1.8rem 0;
}
.mtr-kpi-card {
    flex: 1;
    min-width: 200px;
    background: #020617;
    border-radius: 18px;
    padding: 1rem 1.4rem;
    border: 1px solid #1f2937;
    text-align: center;
}
.mtr-kpi-title {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-bottom: 0.35rem;
}
.mtr-kpi-value {
    font-size: 1.6rem;
    font-weight: 700;
    color: #22c55e;
}
</style>

<div class="mtr-kpi-row">
<div class="mtr-kpi-card">
<div class="mtr-kpi-title">Equipos</div>
<div class="mtr-kpi-value">71</div>
</div>
<div class="mtr-kpi-card">
<div class="mtr-kpi-title">Gasto Total Mac (sin IVA)</div>
<div class="mtr-kpi-value">$ 115.496.932</div>
</div>
<div class="mtr-kpi-card">
<div class="mtr-kpi-title">Gasto Total Multimarca (Win, sin IVA)</div>
<div class="mtr-kpi-value">$ 14.114.210</div>
</div>
<div class="mtr-kpi-card">
<div class="mtr-kpi-title">Gasto Total Mac (con IVA)</div>
<div class="mtr-kpi-value">$ 137.441.349</div>
</div>
<div class="mtr-kpi-card">
<div class="mtr-kpi-title">Gasto Total Multimarca (Win, con IVA)</div>
<div class="mtr-kpi-value">$ 16.795.910</div>
</div>
<div class="mtr-kpi-card">
<div class="mtr-kpi-title">Gasto Total con IVA</div>
<div class="mtr-kpi-value">$ 154.237.259</div>
</div>
</div>
        """,
        unsafe_allow_html=True,
    )
# ===========================================================
#       FINANZAS – CARGA Y NORMALIZACIÓN DE COMPRAS
# ===========================================================
@st.cache_data(show_spinner="Cargando compras de hardware…")
def cargar_compras_excel() -> pd.DataFrame:
    """Carga el archivo compras_2025.xlsx (hoja 'General')."""
    import os

    ruta = "compras_2025.xlsx"
    if not os.path.exists(ruta):
        print("No existe el archivo:", ruta)
        return pd.DataFrame()

    try:
        df = pd.read_excel(ruta, sheet_name="General")
    except Exception as e:
        print("Error cargando compras_2025.xlsx:", e)
        return pd.DataFrame()

    df.columns = df.columns.astype(str).str.strip()

    # Fecha / año / mes
    if "Fecha" in df.columns:
        df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")
        df["Año"] = df["Fecha"].dt.year
        df["Mes_num"] = df["Fecha"].dt.month
    else:
        df["Año"] = pd.NA
        df["Mes_num"] = pd.NA

    # Mes en texto si tienes MESES_ES definido
    try:
        df["Mes"] = df["Mes_num"].map(MESES_ES)
    except Exception:
        df["Mes"] = df["Mes_num"]

    # Normalizar números
    for col in ["Valor Inicial", "IVA", "Total"]:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(".", "", regex=False)
                .str.replace(",", ".", regex=False)
            )
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        else:
            df[col] = 0.0

    return df


@st.cache_data(show_spinner="Cargando compras MTR…")
def cargar_compras_mtr():
    query_anual = "SELECT * FROM activos.vw_compras_anual_mtr ORDER BY anio"
    query_mensual = "SELECT * FROM activos.vw_compras_mensual_generica"

    df_a = pd.read_sql(query_anual, engine_mtr)
    df_m = pd.read_sql(query_mensual, engine_mtr)

    df_a.columns = df_a.columns.str.lower()
    df_m.columns = df_m.columns.str.lower()

    return df_a, df_m


# ===========================================================
#               PESTAÑA COMPRAS MTR (MULTI-AÑO)
# ===========================================================
with tab_compras:
    st.subheader("🧾 Compras MTR 2022–2025")

    df_ca, df_m = cargar_compras_mtr()

    if df_m.empty or df_ca.empty:
        st.info("No hay datos de compras para mostrar.")
    else:
        # --------- Tabs por año ----------
        años = sorted(df_ca["anio"].dropna().astype(int).unique())
        pestañas = st.tabs([f"{año}" for año in años])

        # Columna para ordenar meses
        col_mes_orden = None
        for c in ["mes_orden", "mes_num"]:
            if c in df_m.columns:
                col_mes_orden = c
                break

        # --------- Loop por año ----------
        for i, año in enumerate(años):
            with pestañas[i]:
                st.markdown(f"## Año {año}")

                # 👉 SOLO para 2025 muestro los KPIs de compras
                if año == 2025:
                    render_kpis_mtr_2025()

                st.markdown("### 📅 Detalle mensual")

                df_m_año = df_m[df_m["anio"] == año].copy()
                if df_m_año.empty:
                    st.info("Sin datos para este año.")
                    continue

                # Ordenar meses y ELIMINAR DUPLICADOS POR MES
                if col_mes_orden is not None and col_mes_orden in df_m_año.columns:
                    df_m_año = (
                        df_m_año.sort_values(col_mes_orden)
                        .drop_duplicates(subset=[col_mes_orden], keep="first")
                    )

                # ---- Loop por mes ----
                for _, r in df_m_año.iterrows():
                    # Mes en español
                    mes_num = None
                    if "mes_num" in r.index and pd.notna(r["mes_num"]):
                        try:
                            mes_num = int(r["mes_num"])
                        except Exception:
                            mes_num = None

                    mes_raw = r.get("mes_display") or r.get("mes") or ""
                    if mes_num is not None and mes_num in MESES_ES:
                        mes_texto = MESES_ES[mes_num]
                    else:
                        mes_texto = str(mes_raw)

                    titulo_mes = f"{mes_texto} {año}"

                    # Números
                    cant = int(r.get("cantidad_total_equipos", 0))

                    mac_s = float(r.get("gasto_mac", 0))
                    win_s = float(r.get("gasto_windows", 0))
                    mac_c = float(r.get("gasto_mac_con_iva", 0))
                    win_c = float(r.get("gasto_win_con_iva", 0))

                    total_s = mac_s + win_s
                    total_c = mac_c + win_c
                    pct_mac = mac_s / total_s * 100 if total_s > 0 else 0
                    pct_win = win_s / total_s * 100 if total_s > 0 else 0

                    html = f"""
<div style="background:#2d2d2d;border-radius:15px;border:1px solid #3b3b3b;padding:1.4rem;margin-bottom:1.2rem;">
<div style="font-size:0.75rem;color:#9ca3af;">MES</div>
<div style="font-size:1.4rem;font-weight:700;color:white;">{titulo_mes}</div>

<div style="margin-top:0.35rem;font-size:1rem;color:#e5e7eb;">
        Equipos comprados: <strong>{cant}</strong>
</div>

<hr style="border:0.5px solid #3b3b3b;margin:1rem 0;">

<div style="display:flex;justify-content:space-between;gap:1.5rem;">

<div>
<div style="font-size:0.8rem;color:#9ca3af;">Mac</div>
<div style="font-size:1rem;color:white;">{fmt_clp(mac_s)}</div>
<div style="font-size:0.75rem;color:#9ca3af;">Con IVA</div>
<div style="font-size:1rem;color:#ef4444;">{fmt_clp(mac_c)}</div>
<div style="margin-top:0.25rem;font-size:0.75rem;color:#9ca3af;">
            Participación: {pct_mac:.1f}%
</div>
</div>

<div>
<div style="font-size:0.8rem;color:#9ca3af;">Windows</div>
<div style="font-size:1rem;color:white;">{fmt_clp(win_s)}</div>
<div style="font-size:0.75rem;color:#9ca3af;">Con IVA</div>
<div style="font-size:1rem;color:#ef4444;">{fmt_clp(win_c)}</div>
<div style="margin-top:0.25rem;font-size:0.75rem;color:#9ca3af;">
            Participación: {pct_win:.1f}%
</div>
</div>

<div>
<div style="font-size:0.8rem;color:#9ca3af;">Total</div>
<div style="font-size:1.2rem;color:white;">{fmt_clp(total_s)}</div>
<div style="font-size:0.75rem;color:#9ca3af;">Con IVA</div>
<div style="font-size:1.2rem;color:#ef4444;">{fmt_clp(total_c)}</div>
</div>

</div>
</div>
"""
                    st.markdown(html, unsafe_allow_html=True)

# ===========================================================
#               PESTAÑA COMPRAS MTR (MULTI-AÑO)
# ===========================================================
with tab_compras:
    st.subheader("🧾 Compras MTR 2022–2025")

    @st.cache_data(show_spinner="Cargando compras MTR…")
    def cargar_compras_mtr():
        query_anual = "SELECT * FROM activos.vw_compras_anual_mtr ORDER BY anio"
        query_mensual = "SELECT * FROM activos.vw_compras_mensual_generica"

        df_a = pd.read_sql(query_anual, engine_mtr)
        df_m = pd.read_sql(query_mensual, engine_mtr)

        df_a.columns = df_a.columns.str.lower()
        df_m.columns = df_m.columns.str.lower()

        return df_a, df_m

    df_ca, df_m = cargar_compras_mtr()

    if df_m.empty or df_ca.empty:
        st.info("No hay datos de compras para mostrar.")
    else:
        # --------- Tabs por año ----------
        años = sorted(df_ca["anio"].dropna().astype(int).unique())
        pestañas = st.tabs([f"{año}" for año in años])

        # Columna para ordenar meses
        col_mes_orden = None
        for c in ["mes_orden", "mes_num"]:
            if c in df_m.columns:
                col_mes_orden = c
                break

        # --------- Loop por año ----------
        for i, año in enumerate(años):
            with pestañas[i]:
                st.markdown(f"## Año {año}")

                # 👉 SOLO para 2025 muestro los KPIs de compras
                if año == 2025:
                    render_kpis_mtr_2025()

                st.markdown("### 📅 Detalle mensual")

                df_m_año = df_m[df_m["anio"] == año].copy()
                if df_m_año.empty:
                    st.info("Sin datos para este año.")
                    continue

                # Ordenar meses y ELIMINAR DUPLICADOS POR MES
                if col_mes_orden is not None and col_mes_orden in df_m_año.columns:
                    df_m_año = (
                        df_m_año.sort_values(col_mes_orden)
                        .drop_duplicates(subset=[col_mes_orden], keep="first")
                    )

                # ---- Loop por mes ----
                for _, r in df_m_año.iterrows():
                    # Mes en español
                    mes_num = None
                    if "mes_num" in r.index and pd.notna(r["mes_num"]):
                        try:
                            mes_num = int(r["mes_num"])
                        except Exception:
                            mes_num = None

                    mes_raw = r.get("mes_display") or r.get("mes") or ""
                    if mes_num is not None and mes_num in MESES_ES:
                        mes_texto = MESES_ES[mes_num]
                    else:
                        mes_texto = str(mes_raw)

                    titulo_mes = f"{mes_texto} {año}"

                    # Números
                    cant = int(r.get("cantidad_total_equipos", 0))

                    mac_s = float(r.get("gasto_mac", 0))
                    win_s = float(r.get("gasto_windows", 0))
                    mac_c = float(r.get("gasto_mac_con_iva", 0))
                    win_c = float(r.get("gasto_win_con_iva", 0))

                    total_s = mac_s + win_s
                    total_c = mac_c + win_c
                    pct_mac = mac_s / total_s * 100 if total_s > 0 else 0
                    pct_win = win_s / total_s * 100 if total_s > 0 else 0

                    # Tarjeta HTML mensual (lo que ya tenías)
                    html = f"""
<div style="background:#2d2d2d;border-radius:15px;border:1px solid #3b3b3b;padding:1.4rem;margin-bottom:1.2rem;">
<div style="font-size:0.75rem;color:#9ca3af;">MES</div>
<div style="font-size:1.4rem;font-weight:700;color:white;">{titulo_mes}</div>

<div style="margin-top:0.35rem;font-size:1rem;color:#e5e7eb;">
        Equipos comprados: <strong>{cant}</strong>
</div>

<hr style="border:0.5px solid #3b3b3b;margin:1rem 0;">

<div style="display:flex;justify-content:space-between;gap:1.5rem;">

<div>
<div style="font-size:0.8rem;color:#9ca3af;">Mac</div>
<div style="font-size:1rem;color:white;">{fmt_clp(mac_s)}</div>
<div style="font-size:0.75rem;color:#9ca3af;">Con IVA</div>
<div style="font-size:1rem;color:#ef4444;">{fmt_clp(mac_c)}</div>
<div style="margin-top:0.25rem;font-size:0.75rem;color:#9ca3af;">
            Participación: {pct_mac:.1f}%
</div>
</div>

<div>
<div style="font-size:0.8rem;color:#9ca3af;">Windows</div>
<div style="font-size:1rem;color:white;">{fmt_clp(win_s)}</div>
<div style="font-size:0.75rem;color:#9ca3af;">Con IVA</div>
<div style="font-size:1rem;color:#ef4444;">{fmt_clp(win_c)}</div>
<div style="margin-top:0.25rem;font-size:0.75rem;color:#9ca3af;">
            Participación: {pct_win:.1f}%
</div>
</div>

<div>
<div style="font-size:0.8rem;color:#9ca3af;">Total</div>
<div style="font-size:1.2rem;color:white;">{fmt_clp(total_s)}</div>
<div style="font-size:0.75rem;color:#9ca3af;">Con IVA</div>
<div style="font-size:1.2rem;color:#ef4444;">{fmt_clp(total_c)}</div>
</div>

</div>
</div>
"""
                    st.markdown(html, unsafe_allow_html=True)


# -------------------------------------------------
# Pestaña: Nuevo activo (insertar en inventario_equipos.activos.equipos)
# -------------------------------------------------
with tab_nuevo:
    st.subheader("➕ Registrar nuevo activo")

    st.markdown(
        "Completa los datos del equipo. Se guardará en la tabla "
        "`activos.equipos` de `inventario_equipos`."
    )

    with st.form("form_nuevo_equipo"):
        col_1, col_2 = st.columns(2)

        with col_1:
            sku_str = st.text_input("SKU *", placeholder="Ej: 345")
            nro_serie = st.text_input("Número de serie *")
            asset_tag = st.text_input("Asset tag", placeholder="Opcional")
            tipo_equipo = st.text_input("Tipo de equipo", placeholder="Ej: Ordenador")
            marca = st.text_input("Marca", placeholder="Ej: Apple, Dell, Lenovo…")
            modelo = st.text_input("Modelo", placeholder="Ej: MacBook Pro A2141")
            cpu = st.text_input("CPU", placeholder="Ej: M1 Pro, i7, i5…")
            ram_gb_str = st.text_input("RAM (GB)", placeholder="Ej: 16")

        with col_2:
            almacenamiento = st.text_input(
                "Almacenamiento", placeholder="Ej: 512 GB, 1 TB"
            )
            estado = st.selectbox(
                "Estado",
                options=["Vigente", "Baja", "En reparación", "Stock"],
                index=0,
            )
            fecha_compra = st.date_input("Fecha de compra", value=dt.date.today())
            cliente_actual = st.text_input(
                "Cliente actual", placeholder="Ej: acidLabs / interno"
            )
            persona_actual = st.text_input(
                "Persona actual", placeholder="Ej: Beatriz Herrera"
            )
            pais_actual = st.text_input("País", placeholder="Ej: Chile")
            ciudad_actual = st.text_input("Ciudad", placeholder="Ej: Santiago")
            perfil_actual = st.text_input(
                "Perfil / área", placeholder="Ej: Team Core, Marketing…"
            )

        submitted = st.form_submit_button("Guardar activo")

    if submitted:
        errores = []

        try:
            sku_val = int(sku_str.strip())
        except Exception:
            errores.append("El SKU debe ser un número válido.")
            sku_val = None

        if not nro_serie.strip():
            errores.append("El número de serie es obligatorio.")

        ram_gb_val = None
        if ram_gb_str.strip():
            try:
                ram_gb_val = float(ram_gb_str.replace(",", "."))
            except Exception:
                errores.append("La RAM debe ser un número (en GB).")

        if errores:
            for e in errores:
                st.error(e)
        else:
            try:
                with engine_inv.begin() as conn:
                    sql_ins = text(
                        """
                        INSERT INTO activos.equipos (
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
                        )
                        VALUES (
                            :sku,
                            :nro_serie,
                            :asset_tag,
                            :tipo_equipo,
                            :marca,
                            :modelo,
                            :cpu,
                            :ram_gb,
                            :almacenamiento,
                            :estado,
                            :fecha_compra,
                            :cliente_actual,
                            :persona_actual,
                            :pais_actual,
                            :ciudad_actual,
                            :perfil_actual
                        )
                        """
                    )

                    conn.execute(
                        sql_ins,
                        {
                            "sku": sku_val,
                            "nro_serie": nro_serie.strip(),
                            "asset_tag": asset_tag.strip() or None,
                            "tipo_equipo": tipo_equipo.strip() or None,
                            "marca": marca.strip() or None,
                            "modelo": modelo.strip() or None,
                            "cpu": cpu.strip() or None,
                            "ram_gb": ram_gb_val,
                            "almacenamiento": almacenamiento.strip() or None,
                            "estado": estado,
                            "fecha_compra": fecha_compra,
                            "cliente_actual": cliente_actual.strip() or None,
                            "persona_actual": persona_actual.strip() or None,
                            "pais_actual": pais_actual.strip() or None,
                            "ciudad_actual": ciudad_actual.strip() or None,
                            "perfil_actual": perfil_actual.strip() or None,
                        },
                    )

                # Limpiar cache del inventario combinado
                try:
                    cargar_inventario_combinado.clear()
                except Exception:
                    pass

                st.success(
                    f"✅ Activo guardado correctamente con SKU {sku_val}. "
                    "Ahora aparecerá en las pestañas de Inventario."
                )
            except Exception as e:
                st.error(f"⛔ Error al guardar el activo en la base de datos: {e}")




# ============================================================
# 💰 TAB — VENTAS 2025
# ============================================================
with tab_ventas:
    st.subheader("💰 Ventas 2025 — marzo a diciembre (con IVA)")

    # ===========================
    # CONSTANTES DE VENTAS 2025
    # ===========================
    VENTAS_TOTAL_2025 = 17_948_675   # CLP, con IVA
    TOTAL_EQUIPOS_VENDIDOS_2025 = 91
    APPLE_VENDIDOS_2025 = 55  # Macs
    WINDOWS_VENDIDOS_2025 = 39  # Dell + HP + Lenovo

    # Distribución por mes
    data_ventas = [
        {"mes_cod": "2025-03", "mes_label": "Marzo 2025",
         "monto": 1_000_101, "equipos": 5, "apple": 3,
         "dell": 2, "hp": 0, "lenovo": 0, "asus": 0},

        {"mes_cod": "2025-04", "mes_label": "Abril 2025",
         "monto": 1_400_141, "equipos": 7, "apple": 4,
         "dell": 2, "hp": 0, "lenovo": 1, "asus": 0},

        {"mes_cod": "2025-05", "mes_label": "Mayo 2025",
         "monto": 1_600_161, "equipos": 8, "apple": 5,
         "dell": 1, "hp": 0, "lenovo": 2, "asus": 0},

        {"mes_cod": "2025-06", "mes_label": "Junio 2025",
         "monto": 1_600_161, "equipos": 8, "apple": 5,
         "dell": 2, "hp": 0, "lenovo": 1, "asus": 0},

        {"mes_cod": "2025-07", "mes_label": "Julio 2025",
         "monto": 2_000_202, "equipos": 10, "apple": 6,
         "dell": 2, "hp": 0, "lenovo": 2, "asus": 0},

        {"mes_cod": "2025-08", "mes_label": "Agosto 2025",
         "monto": 2_400_242, "equipos": 12, "apple": 8,
         "dell": 2, "hp": 0, "lenovo": 2, "asus": 0},

        {"mes_cod": "2025-09", "mes_label": "Septiembre 2025",
         "monto": 2_200_222, "equipos": 11, "apple": 7,
         "dell": 2, "hp": 0, "lenovo": 2, "asus": 0},

        {"mes_cod": "2025-10", "mes_label": "Octubre 2025",
         "monto": 2_200_222, "equipos": 11, "apple": 7,
         "dell": 1, "hp": 2, "lenovo": 1, "asus": 0},

        {"mes_cod": "2025-11", "mes_label": "Noviembre 2025",
         "monto": 2_200_223, "equipos": 12, "apple": 8,
         "dell": 1, "hp": 1, "lenovo": 2, "asus": 0},

        {"mes_cod": "2025-12", "mes_label": "Diciembre 2025",
         "monto": 790_000, "equipos": 5, "apple": 1,
         "dell": 2, "hp": 0, "lenovo": 0, "asus": 2},
    ]

    df_ventas_mensual = pd.DataFrame(data_ventas)

    # Asegurar columna 'asus'
    if "asus" not in df_ventas_mensual.columns:
        df_ventas_mensual["asus"] = 0
    df_ventas_mensual["asus"] = df_ventas_mensual["asus"].fillna(0).astype(int)

    # Cálculos adicionales
    df_ventas_mensual["windows"] = (
        df_ventas_mensual["dell"].fillna(0)
        + df_ventas_mensual["hp"].fillna(0)
        + df_ventas_mensual["lenovo"].fillna(0)
        + df_ventas_mensual["asus"]
    )
    df_ventas_mensual["pct_monto"] = (
        df_ventas_mensual["monto"] / VENTAS_TOTAL_2025 * 100
    )
    df_ventas_mensual["pct_equipos_mes"] = (
        df_ventas_mensual["equipos"] / TOTAL_EQUIPOS_VENDIDOS_2025 * 100
    )

    # Totales por marca
    TOTAL_APPLE_VENDIDOS_2025 = int(df_ventas_mensual["apple"].sum())
    TOTAL_WIN_VENDIDOS_2025 = int(df_ventas_mensual["windows"].sum())

    pct_apple_total = TOTAL_APPLE_VENDIDOS_2025 / TOTAL_EQUIPOS_VENDIDOS_2025 * 100
    pct_win_total = TOTAL_WIN_VENDIDOS_2025 / TOTAL_EQUIPOS_VENDIDOS_2025 * 100

    # ===========================
    # KPIs de ventas 2025 (estilo dark cards)
    # ===========================
    st.markdown(
        """
<style>
.ventas-kpi-row {
    display:flex;
    flex-wrap:wrap;
    gap:1rem;
    margin:0.8rem 0 1.8rem 0;
}
.ventas-kpi-card {
    flex:1;
    min-width:220px;
    background:#020617;
    border-radius:18px;
    padding:1rem 1.4rem;
    border:1px solid #1f2937;
    text-align:center;
}
.ventas-kpi-title {
    font-size:0.85rem;
    color:#9ca3af;
    margin-bottom:0.35rem;
}
.ventas-kpi-value {
    font-size:1.6rem;
    font-weight:700;
    color:#22c55e;
}
</style>
<div class="ventas-kpi-row">
<div class="ventas-kpi-card">
<div class="ventas-kpi-title">Ventas totales 2025 (con IVA)</div>
<div class="ventas-kpi-value">""" + fmt_clp(VENTAS_TOTAL_2025) + """</div>
</div>
<div class="ventas-kpi-card">
<div class="ventas-kpi-title">Equipos vendidos 2025</div>
<div class="ventas-kpi-value">""" + str(TOTAL_EQUIPOS_VENDIDOS_2025) + """</div>
</div>
<div class="ventas-kpi-card">
<div class="ventas-kpi-title">Apple vendidos 2025</div>
<div class="ventas-kpi-value">""" + str(TOTAL_APPLE_VENDIDOS_2025) + """</div>
</div>
<div class="ventas-kpi-card">
<div class="ventas-kpi-title">Windows vendidos 2025</div>
<div class="ventas-kpi-value">""" + str(TOTAL_WIN_VENDIDOS_2025) + """</div>
  </div>
</div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        f"""
        <div style="font-size:0.9rem; color:#9ca3af; margin-bottom:1.2rem;">
          Distribución por marca (año completo):<br>
          <strong>Apple:</strong> {TOTAL_APPLE_VENDIDOS_2025} equipos ({pct_apple_total:.1f}%)<br>
          <strong>Windows (Dell + HP + Lenovo + Asus):</strong> {TOTAL_WIN_VENDIDOS_2025} equipos ({pct_win_total:.1f}%)
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("### 🗓️ Ventas por mes (monto, equipos y marcas)")

    # ===========================
    # Tarjetas mensuales (dark, como Compras MTR)
    # ===========================
    for _, row in df_ventas_mensual.iterrows():
        mes_label = row["mes_label"]
        monto = row["monto"]
        equipos_mes = int(row["equipos"])
        apple = int(row["apple"])
        dell = int(row["dell"])
        hp = int(row["hp"])
        lenovo = int(row["lenovo"])
        asus = int(row["asus"])
        win_mes = int(row["windows"])
        pct_monto = float(row["pct_monto"])
        pct_equipos_mes = float(row["pct_equipos_mes"])

        html_ventas = f"""
<div style="background:#1f2933;border-radius:16px;border:1px solid #4b5563;
            padding:1.4rem;margin-bottom:1.1rem;">
<div style="font-size:0.75rem;color:#9ca3af;text-transform:uppercase;">Mes de venta</div>
<div style="font-size:1.3rem;font-weight:700;color:#f9fafb;">{mes_label}</div>

<div style="margin-top:0.5rem;font-size:0.95rem;color:#e5e7eb;">
    Monto vendido (con IVA):
<strong>{fmt_clp(monto)}</strong>
<span style="font-size:0.8rem;color:#9ca3af;">
      &nbsp;({pct_monto:.1f}% del total anual)
</span>
</div>

<div style="margin-top:0.3rem;font-size:0.95rem;color:#e5e7eb;">
    Equipos vendidos este mes:
<strong>{equipos_mes}</strong>
<span style="font-size:0.8rem;color:#9ca3af;">
      &nbsp;({pct_equipos_mes:.1f}% de los {TOTAL_EQUIPOS_VENDIDOS_2025} equipos)
</span>
</div>

<hr style="border:0.5px solid #374151;margin:0.9rem 0;">

<div style="display:flex;justify-content:space-between;gap:2rem;font-size:0.9rem;color:#d1d5db;flex-wrap:wrap;">

<div>
<div style="font-size:0.8rem;text-transform:uppercase;color:#60a5fa;">Apple</div>
<div>Equipos Apple: <strong>{apple}</strong></div>
</div>

<div>
<div style="font-size:0.8rem;text-transform:uppercase;color:#f97373;">
        Windows (Dell / HP / Lenovo / Asus)
</div>
<div>Total Windows: <strong>{win_mes}</strong></div>
<div style="font-size:0.82rem;color:#9ca3af;margin-top:0.2rem;">
        Dell: {dell} &nbsp;|&nbsp; HP: {hp} &nbsp;|&nbsp; Lenovo: {lenovo} &nbsp;|&nbsp; Asus: {asus}
</div>
</div>

</div>
</div>
        """
        st.markdown(html_ventas, unsafe_allow_html=True)

# =======================================================
#                 TAB FINANZAS – COMPRAS
# =======================================================
with tab_finanzas:
    st.subheader("📊 Finanzas – Compras de hardware")

    df_compras = cargar_compras_excel()

    if df_compras.empty:
        st.info(
            "No se pudieron cargar compras desde **compras_2025.xlsx** "
            "(hoja 'General'). Verifica que el archivo exista en la raíz del proyecto."
        )
    else:
        # -------------------- Filtros --------------------
        col_f1, col_f2, col_f3 = st.columns([1, 1, 2])

        with col_f1:
            años = sorted(
                [int(a) for a in df_compras["Año"].dropna().unique()]
            ) or [2025]
            año_sel = st.selectbox("Año", años, index=len(años) - 1)

        with col_f2:
            tipos = (
                ["Todos"]
                + sorted(
                    df_compras["Tipo de Equipo"]
                    .dropna()
                    .astype(str)
                    .unique()
                    .tolist()
                )
                if "Tipo de Equipo" in df_compras.columns
                else ["Todos"]
            )
            tipo_sel = st.selectbox("Tipo de equipo", tipos)

        with col_f3:
            texto_busqueda = st.text_input(
                "Buscar en detalle / SKU / serie (opcional)"
            ).strip()

        mask = df_compras["Año"] == año_sel

        if tipo_sel != "Todos" and "Tipo de Equipo" in df_compras.columns:
            mask &= df_compras["Tipo de Equipo"] == tipo_sel

        if texto_busqueda:
            texto_lower = texto_busqueda.lower()
            cols_busqueda = []
            for c in ["Detalle", "SKU", "Serie"]:
                if c in df_compras.columns:
                    cols_busqueda.append(
                        df_compras[c].astype(str).str.lower().str.contains(
                            texto_lower, na=False
                        )
                    )
            if cols_busqueda:
                mask_busq = cols_busqueda[0]
                for extra in cols_busqueda[1:]:
                    mask_busq |= extra
                mask &= mask_busq

        df_filtrado = df_compras[mask].copy()

        if df_filtrado.empty:
            st.warning("No hay compras que coincidan con los filtros seleccionados.")
            st.stop()

        # -------------------- KPIs ejecutivos --------------------
        total_gasto = df_filtrado["Total"].sum()
        total_mac = (
            df_filtrado[df_filtrado.get("Tipo de Equipo", "") == "Macbook"]["Total"].sum()
            if "Tipo de Equipo" in df_filtrado.columns
            else 0.0
        )
        total_multi = (
            df_filtrado[df_filtrado.get("Tipo de Equipo", "") == "Multimarca"]["Total"].sum()
            if "Tipo de Equipo" in df_filtrado.columns
            else 0.0
        )
        cant_equipos = len(df_filtrado)
        iva_total = df_filtrado["IVA"].sum()
        costo_prom = df_filtrado["Total"].mean() if cant_equipos > 0 else 0.0

        k1, k2, k3, k4, k5, k6 = st.columns(6)

        k1.metric("💰 Gasto total", f"$ {total_gasto:,.0f}")
        k2.metric("🍎 Macbooks", f"$ {total_mac:,.0f}")
        k3.metric("🖥️ Multimarca", f"$ {total_multi:,.0f}")
        k4.metric("📦 Cantidad equipos", int(cant_equipos))
        k5.metric("🧾 IVA total", f"$ {iva_total:,.0f}")
        k6.metric("💳 Costo promedio", f"$ {costo_prom:,.0f}")

        st.markdown("---")

        # -------------------- Gráficos principales --------------------
        col_g1, col_g2 = st.columns(2)

        # Gasto mensual
        with col_g1:
            st.markdown("##### 📈 Gasto mensual")

            if "Mes" in df_filtrado.columns:
                df_mes = (
                    df_filtrado.groupby("Mes")["Total"]
                    .sum()
                    .reset_index()
                    .sort_values("Mes")
                )

                chart_mes = (
                    alt.Chart(df_mes)
                    .mark_line(point=True)
                    .encode(
                        x=alt.X("Mes:N", title="Mes"),
                        y=alt.Y("Total:Q", title="Total gastado"),
                        tooltip=["Mes", "Total"],
                    )
                    .properties(height=260)
                )
                st.altair_chart(chart_mes, use_container_width=True)
            else:
                st.info("No se pudo construir el gráfico mensual (falta columna 'Mes').")

        # Distribución por tipo de equipo
        with col_g2:
            st.markdown("##### 📊 Mac vs Multimarca")

            if "Tipo de Equipo" in df_filtrado.columns:
                df_tipo = (
                    df_filtrado.groupby("Tipo de Equipo")["Total"]
                    .sum()
                    .reset_index()
                )
                chart_tipo = (
                    alt.Chart(df_tipo)
                    .mark_bar()
                    .encode(
                        x=alt.X("Tipo de Equipo:N", title="Tipo"),
                        y=alt.Y("Total:Q", title="Total gastado"),
                        tooltip=["Tipo de Equipo", "Total"],
                        color="Tipo de Equipo:N",
                    )
                    .properties(height=260)
                )
                st.altair_chart(chart_tipo, use_container_width=True)
            else:
                st.info(
                    "No se pudo construir el gráfico por tipo (falta columna 'Tipo de Equipo')."
                )

        st.markdown("---")

        # -------------------- Tabla de compras filtradas --------------------
        st.markdown("### 📋 Detalle de compras (filtradas)")

        st.dataframe(
            df_filtrado[
                [
                    c
                    for c in [
                        "Fecha",
                        "Tipo de Equipo",
                        "Detalle",
                        "Serie",
                        "SKU",
                        "Valor Inicial",
                        "IVA",
                        "Total",
                    ]
                    if c in df_filtrado.columns
                ]
            ].sort_values("Fecha"),
            use_container_width=True,
        )

        csv_filtrado = df_filtrado.to_csv(index=False).encode("utf-8")
        st.download_button(
            "📁 Descargar compras filtradas (CSV)",
            data=csv_filtrado,
            file_name=f"compras_{año_sel}_filtrado.csv",
            mime="text/csv",
        )

        st.markdown("---")

        # ==============================
        # Auditoría básica contra df_eq
        # ==============================
        st.markdown("### 🔍 Auditoría de compras vs inventario")

        df_aud = df_compras.copy()

        col_sku = None
        for c in df_aud.columns:
            if str(c).strip().lower() == "sku":
                col_sku = c
                break

        if col_sku is None:
            st.warning(
                "No se encontró una columna **SKU** en el Excel, "
                "no se puede hacer la auditoría contra el inventario."
            )
        elif "sku" not in df_eq.columns:
            st.warning(
                "El dataframe de inventario (**df_eq**) no tiene columna `sku`, "
                "no se puede cruzar con las compras."
            )
        else:
            df_aud["sku_str"] = df_aud[col_sku].astype(str)
            df_aud["sku_num"] = (
                df_aud["sku_str"]
                .str.extract(r"(\d+)", expand=False)
                .astype("Int64")
            )

            sku_inv = df_eq["sku"].astype("Int64")

            mask_faltantes = df_aud["sku_num"].notna() & ~df_aud["sku_num"].isin(sku_inv)
            df_faltantes = df_aud[mask_faltantes].copy()

            if df_faltantes.empty:
                st.success("✅ Todas las compras tienen un SKU presente en el inventario.")
            else:
                st.error(
                    f"⚠️ Hay {len(df_faltantes)} compras cuyo SKU **no aparece** "
                    "en el inventario actual."
                )
                st.dataframe(
                    df_faltantes[
                        ["Fecha", col_sku, "Detalle", "Valor Inicial", "IVA", "Total"]
                    ],
                    use_container_width=True,
                )
