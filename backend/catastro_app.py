import streamlit as st
import pandas as pd
import requests

API_URL = "http://localhost:8000/equipos"

st.set_page_config(
    page_title="Catastro de Equipos",
    layout="wide",
)

# =========================
# ESTILO KPI (Activos style)
# =========================
st.markdown(
    """
    <style>
    .kpi-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .kpi-card {
        flex: 1 1 220px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
        box-shadow: 0 1px 2px rgba(15,23,42,0.06);
    }
    .kpi-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b7280;
        margin-bottom: 0.15rem;
    }
    .kpi-value {
        font-size: 1.6rem;
        font-weight: 600;
        color: #0f172a;
    }
    .kpi-sub {
        font-size: 0.8rem;
        color: #6b7280;
        margin-top: 0.15rem;
    }
    .kpi-pill {
        display: inline-block;
        padding: 0.1rem 0.5rem;
        border-radius: 999px;
        font-size: 0.7rem;
        background: #ecfdf3;
        color: #166534;
        margin-left: 0.25rem;
    }
    .kpi-total   { border-top: 3px solid #22c55e; }
    .kpi-persona { border-top: 3px solid #3b82f6; }
    .kpi-cliente { border-top: 3px solid #f97316; }
    .kpi-pais    { border-top: 3px solid #a855f7; }

    .kpi-tipo    { border-top: 3px solid #0ea5e9; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("📊 Catastro de Equipos")

st.markdown(
    "Consumiendo datos desde la **Catastro API** (`/equipos`). "
    "Usa los filtros de la izquierda para explorar."
)

# -----------------------
# Filtros en sidebar
# -----------------------
with st.sidebar:
    st.header("Filtros")
    cliente = st.text_input("Cliente (ej: ALV, Abastible, ACHS)", "")
    pais = st.text_input("País (ej: Chile, Argentina)", "")
    persona = st.text_input("Nombre persona contiene...", "")
    limit = st.number_input("Límite de registros", 1, 1000, 500)

    if st.button("Limpiar filtros"):
        cliente = ""
        pais = ""
        persona = ""

params = {
    "limit": limit,
    "offset": 0,
}

if cliente.strip():
    params["cliente"] = cliente.strip()

if pais.strip():
    params["pais"] = pais.strip()

if persona.strip():
    params["nombre_persona"] = persona.strip()

# -----------------------
# Llamada a la API
# -----------------------
@st.cache_data(show_spinner=True)
def cargar_equipos(params):
    resp = requests.get(API_URL, params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    return pd.DataFrame(data)

try:
    df = cargar_equipos(params)
except Exception as e:
    st.error(f"Error consultando la API: {e}")
    st.stop()

if df.empty:
    st.info("No se encontraron equipos con los filtros actuales.")
    st.stop()

# =========================
# KPIs ESTILO TARJETAS
# =========================

total_equipos = len(df)
total_personas = df["nombre_persona"].nunique()
total_clientes = df["cliente"].nunique()
total_paises = df["pais"].nunique()

st.markdown("### Indicadores generales")

kpi_html = f"""
<div class="kpi-row">
  <div class="kpi-card kpi-total">
    <div class="kpi-label">Total de equipos</div>
    <div class="kpi-value">{total_equipos:,}</div>
    <div class="kpi-sub">Registros vigentes en el catastro</div>
  </div>

  <div class="kpi-card kpi-persona">
    <div class="kpi-label">Personas distintas</div>
    <div class="kpi-value">{total_personas:,}</div>
    <div class="kpi-sub">Colaboradores con equipo asignado</div>
  </div>

  <div class="kpi-card kpi-cliente">
    <div class="kpi-label">Clientes</div>
    <div class="kpi-value">{total_clientes:,}</div>
    <div class="kpi-sub">Organizaciones atendidas</div>
  </div>

  <div class="kpi-card kpi-pais">
    <div class="kpi-label">Países</div>
    <div class="kpi-value">{total_paises:,}</div>
    <div class="kpi-sub">Cobertura geográfica</div>
  </div>
</div>
"""

st.markdown(kpi_html, unsafe_allow_html=True)

# -----------------------
# KPIs POR TIPO DE EQUIPO
# -----------------------
st.markdown("### KPIs por tipo de equipo")

tipo_counts = (
    df["tipo_equipo"]
    .fillna("Sin tipo")
    .value_counts()
)

cards_tipo = []
for tipo, count in tipo_counts.head(3).items():
    cards_tipo.append(
        f"""
        <div class="kpi-card kpi-tipo">
          <div class="kpi-label">Tipo de equipo</div>
          <div class="kpi-value">{count:,}
            <span class="kpi-pill">{tipo}</span>
          </div>
          <div class="kpi-sub">
            Participación: {round(count * 100 / total_equipos, 1)} %
          </div>
        </div>
        """
    )

tipos_html = "<div class='kpi-row'>" + "".join(cards_tipo) + "</div>"
st.markdown(tipos_html, unsafe_allow_html=True)

st.markdown("---")

# -----------------------
# Gráficos rápidos
# -----------------------
col_g1, col_g2 = st.columns(2)

with col_g1:
    st.subheader("Equipos por cliente (top 10)")
    top_clientes = (
        df["cliente"]
        .fillna("Sin cliente")
        .value_counts()
        .head(10)
    )
    st.bar_chart(top_clientes)

with col_g2:
    st.subheader("Equipos por país")
    por_pais = (
        df["pais"]
        .fillna("Sin país")
        .value_counts()
    )
    st.bar_chart(por_pais)

st.markdown("---")

# -----------------------
# Tabla detalle
# -----------------------
st.subheader("Detalle de equipos")

columnas = [
    "nombre_persona",
    "cliente",
    "pais",
    "ciudad",
    "perfil",
    "nombre_equipo",
    "modelo_cpu",
    "tipo_equipo",
    "fecha_compra",
]
columnas = [c for c in columnas if c in df.columns]

st.dataframe(
    df[columnas],
    width="stretch",
    hide_index=True,
)

