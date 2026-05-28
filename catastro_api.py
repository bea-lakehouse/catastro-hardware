import streamlit as st
import pandas as pd
import math
import html as _html
from pathlib import Path


(
    get_equipos_normalizados,
    get_resumen_equipo,
    get_detalle_equipo,
    get_team_sin_equipo,
    get_clientes_empresa,
    get_plan_2026,
    norm_name,
)

# ===========================
# CONFIGURACIÓN DE LA PÁGINA
# ===========================
st.set_page_config(
    page_title="Catastro Hardware",
    page_icon="💻",
    layout="wide",
)
st.markdown(
    """
    <style>
    .stApp {
        background-color: #f3f4f6;  /* gris clarito */
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ===========================
# LISTAS DE PERSONAS ESPECIALES
# ===========================
PERSONAS_RENOVAR = [
    "Alberto Ceballos Dagne Dayanara",
    "Gonthier Salinas Natalia Valentina",
    "Andonie Ramos Mauricio Jose",
    "Aroca Guerrero Juan Carlos",
    "Garcia Verdugo Matias Nicolas",
    "Varela Diaz Pralad",
    "Medina Marrufo Nairin Del Valle",
    "Alvarez Mora Diego Ivan",
    "Sanchez Mancilla Alejandro Marcelo",
    "Muñoz Solari Emilio Jose",
    "Arias Prieto Gabriel Alonzo",
    "Ojeda Carvajal Francisco",
    "Rojas Fuentes Sebastian Andres",
    "Arce Cifuentes Francesca Andrea",
    "Diaz Rodriguez David Sebastian",
    "Ravelo Gonzalez Oraisa Caridad",
    "Briceño Gonzalez Paula Andrea",
    "Bueno Belgica",
]

PERSONAS_SIN_EQUIPO = [
    "Barzola Facundo Agustin",
    "paula.mususu@acidlabs.com",
    "Sequeira Maria Florencia",
    "Luzza Luciana Romina",
    "Chadarevian Juan Martin",
    "Santa Lucia Alejandro Dario",
    "Ayala Meneses Roberto Carlos",
    "Beltran Christiny Benjamin",
    "Boyanovsky Bazan Ian",
    "Giordano Mateo",
    "Lopez Jorgelina Natalia",
    "antonella.coluccini@acidlabs.com",
    "Ibarra Maximiliano Alberto",
    "Santos Sanabria Daniel",
    "Muñoz Juarez Arie",
    "maximiliano.stumpf@acidlabs.com",
    "Diaz Mariano Gabriel",
    "Bertacchini Patricio",
    "Cervan Leandro Matias",
    "Brito Velez Mauricio Alejandro",
    "carolina.spiridione@acidlabs.com",
    "Reyes Cedeño Ellen Mariana",
    "Campuzano Juan Nicola",
    "Curti Sabrina Paola",
    "Martino Miguel Alejandro",
    "Pra Adolfo  (renuncia)",
    "Herrera Pugliesi Sofia Martina",
    "Alvarez Acosta Analia Veronica",
    "Rodriguez Almarales Aliana Del Carmen",
    "Gonzalez Carmona Franco Jose",
    "Hasenbank Clayton Patrick",
    "Gil Contreras Yohanny Geraldine",
    "Valera Sanchez Ana Vanessa",
    "Medina Maria Paula",
    "Huizzi Urdaneta Daniel Alejandro",
    "Agüero Ignacio Jose",
    "Zillo Federico",
    "Butron Natalia Elizabeth",
    "Fornasar Daniela",
    "Gonzalez Rivero Emily Margarita",
    "Paula Mususu",
    "Maximiliano Stumpf",
    "Carolina Spiridione",
    "Antonella Coluccini",
]

# ===========================
# CSS TARJETAS + CHIP EQUIPO
# ===========================
CARD_CSS = """
<style>
.card-container {
    background-color: #ffffff;
    border-radius: 14px;
    padding: 14px 16px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 6px rgba(15,23,42,0.06);
    margin-bottom: 12px;
    border-top: 3px solid #22c55e; /* color por defecto (verde) */
}

/* variantes de color para los KPIs */
.card-green {
    border-top: 3px solid #22c55e;
}
.card-blue {
    border-top: 3px solid #3b82f6;
}
.card-orange {
    border-top: 3px solid #f97316;
}
.card-purple {
    border-top: 3px solid #a855f7;
}
.card-pink {
    border-top: 3px solid #ec4899;
}

.card-title {
    font-size: 0.70rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #6b7280;
    margin-bottom: 2px;
}
.card-value {
    font-size: 1.6rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 2px;
}
.card-subtitle {
    font-size: 0.8rem;
    color: #9ca3af;
}
.equipo-header {
    font-size: 1.0rem;
    font-weight: 600;
    color: #111827;
    margin: 12px 0 4px 2px;
}
.equipo-chip {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background-color: #eef2ff;
    color: #3730a3;
    font-size: 0.80rem;
    font-weight: 600;
}
</style>
"""

STATUS_CSS = """
<style>
.status-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0.5rem 0 1.5rem 0;
}
.status-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: #374151;
}
.status-color {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    box-sizing: border-box;
}
.status-ok {
    background-color: #ffffff;
}
.status-renovar {
    background-color: #facc15;
}
.status-sin-equipo {
    background-color: #fecaca;
}
</style>
"""

MAP_TABLE_CSS = """
<style>
.map-wrapper {
    overflow-x: auto;
}
.map-table {
    border-collapse: collapse;
    width: 100%;
    min-width: 1400px;
}
.map-table th,
.map-table td {
    border: 1px solid #e5e7eb;
    padding: 6px 8px;
    font-size: 0.80rem;
    white-space: nowrap;
}
.map-table th {
    background-color: #f9fafb;
    font-weight: 600;
    text-align: left;
}
.cell-asignado {
    background-color: #ffffff;
}
.cell-renovar {
    background-color: #facc15;
}
.cell-sin-equipo {
    background-color: #fecaca;
}
</style>
"""

# Inyectar CSS global
st.markdown(CARD_CSS, unsafe_allow_html=True)
st.markdown(STATUS_CSS, unsafe_allow_html=True)
st.markdown(MAP_TABLE_CSS, unsafe_allow_html=True)

# ===========================
# COMPONENTES DE UI
# ===========================
def tarjeta(titulo, valor, subtitulo: str = "", color: str = "green"):
    """
    color: 'green', 'blue', 'orange', 'purple', 'pink'
    """
    color_class = f"card-{color}"
    html = f"""
    <div class="card-container {color_class}">
        <div class="card-title">{titulo}</div>
        <div class="card-value">{valor}</div>
        <div class="card-subtitle">{subtitulo}</div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)
    

def kpi_card(title, value, subtitle="", col=None):
    if col is None:
        col = st.container()
    with col:
        st.markdown(
            f"""
            <div class='kpi-card'>
                <div class='kpi-title'>{title}</div>
                <div class='kpi-value'>{value}</div>
                <div class='kpi-subtitle'>{subtitle}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

# ===========================
# HELPERS COMUNES
# ===========================
def _norm_name(s: str) -> str:
    """Normaliza nombre para comparar (minúsculas, sin dobles espacios)."""
    return " ".join(str(s).strip().lower().split())

# =========================================================
# CARGA DE EXCEL PARA MAPA
# =========================================================
@st.cache_data
def load_detalle_excel():
    """
    Carga la hoja 'Detalle' (pestaña 6) del archivo catastro.xlsx.
    Intenta por nombre (Detalle/detalle/DETALLE) y, si no la encuentra,
    usa la hoja en posición 5 (índice 5).
    """
    try:
        xls = pd.ExcelFile("catastro.xlsx")
    except Exception as e:
        st.error(f"No se pudo abrir el archivo 'catastro.xlsx': {e}")
        return pd.DataFrame()

    posibles_nombres = ["Detalle", "detalle", "DETALLE"]

    for nombre in posibles_nombres:
        if nombre in xls.sheet_names:
            return pd.read_excel(xls, sheet_name=nombre)

    if len(xls.sheet_names) >= 6:
        try:
            return pd.read_excel(xls, sheet_name=5)
        except Exception as e:
            st.error(f"No se pudo leer la hoja en posición 6: {e}")
            return pd.DataFrame()

    st.error(
        "No se encontró una hoja llamada 'Detalle' ni existe una sexta hoja "
        "en 'catastro.xlsx'. Revisa el archivo."
    )
    return pd.DataFrame()


@st.cache_data
def load_detalle_matriz():
    """
    Carga la hoja Detalle y construye la matriz (personas por área):
    - Solo columnas que tienen datos.
    - Se queda con las primeras 16 columnas con información.
    - Elimina filas de leyenda ('Renovar', 'Sin Equipo').
    - Rellena NaN con cadena vacía.
    """
    df = load_detalle_excel()
    if df.empty:
        return df

    cols = [c for c in df.columns if not df[c].isna().all()]
    cols = cols[:16]
    df = df[cols].copy()

    first_col = df.columns[0]
    mask_leyenda = df[first_col].astype(str).str.strip().str.upper().isin(
        ["RENOVAR", "SIN EQUIPO"]
    )
    df = df[~mask_leyenda]

    df = df.fillna("")
    return df
from pathlib import Path

@st.cache_data
def load_detalle_excel():
    """
    Carga la hoja 'Detalle' desde catastro.xlsx
    ubicado en la misma carpeta del script.
    """
    # carpeta donde está catastro_api.py
    base_path = Path(__file__).resolve().parent
    file_path = base_path / "catastro.xlsx"

    if not file_path.exists():
        st.error(f"No se encontró el archivo: {file_path}")
        return pd.DataFrame()

    try:
        xls = pd.ExcelFile(file_path)
    except Exception as e:
        st.error(f"No se pudo abrir el archivo '{file_path.name}': {e}")
        return pd.DataFrame()

    # Nombres posibles de la hoja
    posibles_nombres = ["Detalle", "detalle", "DETALLE"]

    for nombre in posibles_nombres:
        if nombre in xls.sheet_names:
            return pd.read_excel(xls, sheet_name=nombre)

    # Fallback: hoja 6 (índice 5)
    if len(xls.sheet_names) >= 6:
        try:
            return pd.read_excel(xls, sheet_name=5)
        except Exception as e:
            st.error(f"No se pudo leer la hoja en índice 5: {e}")
            return pd.DataFrame()

    st.error(
        "No se encontró hoja 'Detalle' ni hoja en índice 5 en catastro.xlsx"
    )
    return pd.DataFrame()

# =========================================================
# UTILIDADES SQL
# =========================================================
#@st.cache_data
#def get_equipos_normalizados(tabla: str):
    """
    Devuelve:
      - clave_equipo: UPPER(TRIM(nombre_equipo))
      - nombre_equipo_mostrado
      - modelo_cpu_main

    Si la tabla NO existe, devuelve un DataFrame vacío.
    Para 'equipos_renovar' elimina filas basura tipo 37 / 53 / 90, etc.
    """
    with engine.connect() as conn:
        exists_query = text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = :tbl
            ) AS existe;
            """
        )
        exists_row = conn.execute(exists_query, {"tbl": tabla}).mappings().first()
        if not exists_row or not exists_row["existe"]:
            return pd.DataFrame(
                columns=["clave_equipo", "nombre_equipo_mostrado", "modelo_cpu_main"]
            )

        query = f"""
            SELECT
                UPPER(TRIM(nombre_equipo)) AS clave_equipo,
                MIN(nombre_equipo)        AS nombre_equipo_mostrado,
                MAX(modelo_cpu)           AS modelo_cpu_main
            FROM {tabla}
            GROUP BY UPPER(TRIM(nombre_equipo))
            ORDER BY MIN(nombre_equipo);
        """
        df = pd.read_sql(query, conn)

    if tabla == "equipos_renovar":
        df["nombre_equipo_mostrado"] = df["nombre_equipo_mostrado"].astype(str).str.strip()

        mask_numerico = pd.to_numeric(
            df["nombre_equipo_mostrado"], errors="coerce"
        ).notna()

        basura = {"37", "53", "90", "21"}
        mask_basura = df["nombre_equipo_mostrado"].isin(basura)

        df = df[~(mask_numerico | mask_basura)]

    return df


#@st.cache_data
#def get_resumen_equipo(tabla: str, clave_equipo: str, incluir_extra: bool = False):
    """
    Resumen para la tabla indicada.
    Si incluir_extra=True y tabla='equipos_renovar', también calcula años_uso_promedio.
    """
    extra_cols = ""
    if incluir_extra and tabla == "equipos_renovar":
        extra_cols = ", AVG(anios_uso)::numeric(10,2) AS anios_uso_promedio"

    query = text(
        f"""
        SELECT
            COUNT(*) AS total_equipos,

            SUM(
                CASE
                    WHEN cliente IS NOT NULL
                         AND upper(trim(cliente)) = 'ALV'
                    THEN 1 ELSE 0
                END
            ) AS total_corporativos,

            SUM(
                CASE
                    WHEN pais = 'Chile'
                    THEN 1 ELSE 0
                END
            ) AS total_chile,

            SUM(
                CASE
                    WHEN pais = 'Chile'
                         AND ciudad IS NOT NULL
                         AND ciudad NOT ILIKE '%santiago%'
                    THEN 1 ELSE 0
                END
            ) AS total_region,

            SUM(
                CASE
                    WHEN pais = 'Argentina'
                    THEN 1 ELSE 0
                END
            ) AS total_argentina,

            SUM(
                CASE
                    WHEN pais IS NOT NULL
                         AND pais NOT IN ('Chile','Argentina')
                    THEN 1 ELSE 0
                END
            ) AS total_otros_paises,

            SUM(
                CASE
                    WHEN perfil IS NOT NULL
                         AND trim(perfil) <> ''
                    THEN 1 ELSE 0
                END
            ) AS total_tecnicos

            {extra_cols}
        FROM {tabla}
        WHERE UPPER(TRIM(nombre_equipo)) = :clave;
        """
    )

    with engine.connect() as conn:
        row = conn.execute(query, {"clave": clave_equipo}).mappings().first()

    if row is None or row["total_equipos"] is None:
        base = {
            "total_equipos": 0,
            "total_corporativos": 0,
            "total_chile": 0,
            "total_region": 0,
            "total_argentina": 0,
            "total_otros_paises": 0,
            "total_tecnicos": 0,
        }
        if incluir_extra and tabla == "equipos_renovar":
            base["anios_uso_promedio"] = 0
        return base

    return dict(row)


#@st.cache_data
#def get_detalle_equipo(tabla: str, clave_equipo: str, por_renovar: bool = False):
    """
    Detalle por equipo para la tabla indicada.
    Si por_renovar=True, incluye anios_uso y clasificacion_finanzas.
    """
    if por_renovar:
        query = text(
            f"""
            SELECT
                nombre_persona,
                cliente,
                pais,
                ciudad,
                perfil,
                modelo_cpu,
                anios_uso,
                clasificacion_finanzas
            FROM {tabla}
            WHERE UPPER(TRIM(nombre_equipo)) = :clave
            ORDER BY pais, cliente;
            """
        )
    else:
        query = text(
            f"""
            SELECT
                nombre_persona,
                cliente,
                pais,
                ciudad,
                perfil,
                modelo_cpu
            FROM {tabla}
            WHERE UPPER(TRIM(nombre_equipo)) = :clave
            ORDER BY pais, cliente;
            """
        )

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"clave": clave_equipo})
    return df


#@st.cache_data
#def get_team_sin_equipo():
    """
    Devuelve el listado del team corporativo sin equipo:
      nombre_persona, rol, area, pais, observaciones
    """
    with engine.connect() as conn:
        exists_query = text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'team_sin_equipo'
            ) AS existe;
            """
        )
        exists_row = conn.execute(exists_query).mappings().first()
        if not exists_row or not exists_row["existe"]:
            return pd.DataFrame(
                columns=["nombre_persona", "rol", "area", "pais", "observaciones"]
            )

        df = pd.read_sql(
            """
            SELECT nombre_persona, rol, area, pais, observaciones
            FROM team_sin_equipo
            ORDER BY pais, area, nombre_persona;
            """,
            conn,
        )
    return df


#@st.cache_data
#def get_clientes_empresa():
    """
    Devuelve la lista de todos los clientes de la empresa
    (según la tabla 'equipos'), ordenados alfabéticamente.
    """
    with engine.connect() as conn:
        df = pd.read_sql(
            """
            SELECT DISTINCT cliente
            FROM equipos
            WHERE cliente IS NOT NULL
              AND trim(cliente) <> ''
            ORDER BY cliente;
            """,
            conn,
        )
    return df["cliente"].tolist()


#@st.cache_data
#def get_personas_estado():
    """
    Devuelve dict: nombre_normalizado -> estado
    usando las tablas de Postgres que se cargan con el script:
      - team_sin_equipo  -> SIN_EQUIPO
      - equipos_renovar  -> RENOVAR
      - equipos          -> TIENE
    Prioridad: SIN_EQUIPO > RENOVAR > TIENE
    """
    estados = {}
    with engine.connect() as conn:
        try:
            df_sin = pd.read_sql("SELECT nombre_persona FROM team_sin_equipo", conn)
        except Exception:
            df_sin = pd.DataFrame(columns=["nombre_persona"])

        try:
            df_ren = pd.read_sql("SELECT nombre_persona FROM equipos_renovar", conn)
        except Exception:
            df_ren = pd.DataFrame(columns=["nombre_persona"])

        try:
            df_vig = pd.read_sql("SELECT nombre_persona FROM equipos", conn)
        except Exception:
            df_vig = pd.DataFrame(columns=["nombre_persona"])

    for n in df_sin["nombre_persona"].dropna():
        estados[_norm_name(n)] = "SIN_EQUIPO"

    for n in df_ren["nombre_persona"].dropna():
        estados.setdefault(_norm_name(n), "RENOVAR")

    for n in df_vig["nombre_persona"].dropna():
        estados.setdefault(_norm_name(n), "TIENE")

    return estados

#@st.cache_data
#def get_plan_2026():
    """
    Calcula los componentes del modelo 2026:
      - backlog_sin_equipo  (team_sin_equipo)
      - backlog_renovar     (equipos_renovar)
      - reemplazos_2026     (equipos que cumplen >=4 años al 31-12-2026)
      - demanda_organica    (promedio 2023–2025 de compras/asignaciones)
    """
    with engine.connect() as conn:
        # 1) backlog sin equipo
        df_sin = pd.read_sql(
            "SELECT COUNT(*) AS backlog_sin_equipo FROM team_sin_equipo;",
            conn,
        )
        backlog_sin_equipo = int(df_sin["backlog_sin_equipo"].iloc[0])

        # 2) backlog por renovar
        df_ren = pd.read_sql(
            "SELECT COUNT(*) AS backlog_renovar FROM equipos_renovar;",
            conn,
        )
        backlog_renovar = int(df_ren["backlog_renovar"].iloc[0])

        # 3) reemplazos por antigüedad en 2026 (>=4 años)
        df_rep = pd.read_sql(
            """
            SELECT COUNT(*) AS reemplazos_2026
            FROM equipos
            WHERE fecha_compra IS NOT NULL
              AND EXTRACT(YEAR FROM AGE('2026-12-31'::date, fecha_compra)) >= 4;
            """,
            conn,
        )
        reemplazos_2026 = int(df_rep["reemplazos_2026"].iloc[0])

        # 4) demanda orgánica = promedio 2023–2025 de equipos asignados
        df_dem = pd.read_sql(
            """
            SELECT
                ROUND(AVG(equipos_asignados))::int AS demanda_organica
            FROM (
                SELECT
                    EXTRACT(YEAR FROM fecha_compra)::int AS anio,
                    COUNT(*) AS equipos_asignados
                FROM equipos
                WHERE fecha_compra IS NOT NULL
                GROUP BY EXTRACT(YEAR FROM fecha_compra)
            ) t
            WHERE anio BETWEEN 2023 AND 2025;
            """,
            conn,
        )
        demanda_organica = int(df_dem["demanda_organica"].iloc[0])

    # Escenarios
    total_conservador = (
        backlog_sin_equipo
        + backlog_renovar
        + reemplazos_2026
        + demanda_organica
    )

    total_gradual = (
        backlog_sin_equipo
        + int(round(backlog_renovar / 2))  # mitad del backlog en 2026
        + reemplazos_2026
        + demanda_organica
    )

    return {
        "backlog_sin_equipo": backlog_sin_equipo,
        "backlog_renovar": backlog_renovar,
        "reemplazos_2026": reemplazos_2026,
        "demanda_organica": demanda_organica,
        "total_conservador": total_conservador,
        "total_gradual": total_gradual,
    }

# =========================================================
# MAPA HTML (usa listas fijas PERSONAS_*)
# =========================================================
def get_estados_fijos():
    estados = {}
    for n in PERSONAS_SIN_EQUIPO:
        estados[norm_name(n)] = "SIN_EQUIPO"
    for n in PERSONAS_RENOVAR:
        estados.setdefault(norm_name(n), "RENOVAR")
    return estados


def build_mapa_html(df: pd.DataFrame, estados: dict) -> str:
    ths = "".join(f"<th>{_html.escape(str(c))}</th>" for c in df.columns)

    filas_html = []
    for _, row in df.iterrows():
        celdas = []
        for val in row:
            texto = str(val).strip()
            if not texto or texto.lower() == "none":
                celdas.append("<td></td>")
                continue

            estado = estados.get(_norm_name(texto), "TIENE")
            if estado == "SIN_EQUIPO":
                css = "cell-sin-equipo"
            elif estado == "RENOVAR":
                css = "cell-renovar"
            else:
                css = "cell-asignado"

            celdas.append(f'<td class="{css}">{_html.escape(texto)}</td>')
        filas_html.append("<tr>" + "".join(celdas) + "</tr>")

    tabla_html = f"""
    <div class="map-wrapper">
      <table class="map-table">
        <thead><tr>{ths}</tr></thead>
        <tbody>
          {''.join(filas_html)}
        </tbody>
      </table>
    </div>
    """
    return tabla_html

# =========================================================
# HELPER: FORMATO PARA SELECT DE POR RENOVAR
# =========================================================
def fmt_equipo_ren(opt):
    """Texto del selectbox: Nombre — CPU (sin mostrar 'nan')."""
    nombre = str(opt.get("nombre_equipo_mostrado", "")).strip()
    cpu_raw = opt.get("modelo_cpu_main")

    cpu = ""
    if isinstance(cpu_raw, str):
        cpu_str = cpu_raw.strip()
        if cpu_str and cpu_str.lower() != "nan":
            cpu = cpu_str
    elif isinstance(cpu_raw, (int, float)) and not math.isnan(cpu_raw):
        cpu = str(cpu_raw)

    if cpu:
        return f"{nombre} — {cpu}"
    return nombre

# ===========================
# DASHBOARD — UI
# ===========================
st.title("Catastro Hardware")

tab_vig, tab_ren, tab_mov, tab_team, tab_resumen, tab_plan_2026, tab_mapa = st.tabs(
    [
        "Equipos Asignados - Vigentes",
        "Equipos Asignados - Por Renovar",
        "Móviles Asignados",
        "Team corporativo sin equipo",
        "Resumen General",
        "Plan de compras 2026",
        "Mapa visual de dotación",
    ]
)


# =========================================================
# TAB 1: EQUIPOS VIGENTES
# =========================================================
with tab_vig:
    col_titulo, col_resumen = st.columns([2, 3])

    with col_titulo:
        st.markdown(
            "<p style='color:#dc2626; font-size:1.1rem; font-weight:600; "
            "margin-top:0.2rem; margin-bottom:1rem;'>"
            "Equipos Asignados - Vigentes"
            "</p>",
            unsafe_allow_html=True,
        )

    with col_resumen:
        st.markdown(
            """
            <div style="text-align:right; margin-top:0.2rem;">
                <span class="equipo-chip">Mac obsoletos: 37</span>
                <span class="equipo-chip">Multimarca obsoletos: 53</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    df_equipos_vig = get_equipos_normalizados("equipos")

    if df_equipos_vig.empty:
        st.warning("⚠️ No hay datos en la tabla 'equipos'.")
    else:
        opciones_vig = df_equipos_vig.to_dict(orient="records")

        def fmt_equipo_vig(opt):
            cpu = (opt.get("modelo_cpu_main") or "").strip()
            if cpu and cpu.lower() != "nan":
                return f"{opt['nombre_equipo_mostrado']} — {cpu}"
            return opt["nombre_equipo_mostrado"]

        equipo_opt_vig = st.selectbox(
            "Selecciona el equipo",
            opciones_vig,
            format_func=fmt_equipo_vig,
            key="select_equipo_vig_tab1",
        )

        clave_equipo_vig = equipo_opt_vig["clave_equipo"]
        nombre_equipo_vig = equipo_opt_vig["nombre_equipo_mostrado"]
        cpu_main_vig = (equipo_opt_vig.get("modelo_cpu_main") or "").strip()
        if cpu_main_vig.lower() == "nan":
            cpu_main_vig = ""

        resumen_vig = get_resumen_equipo(
            "equipos", clave_equipo_vig, incluir_extra=False
        )

        chip_label_vig = (
            f"{nombre_equipo_vig} — {cpu_main_vig}"
            if cpu_main_vig
            else nombre_equipo_vig
        )

        st.markdown(
            f"""
            <div class="equipo-header">
                <span class="equipo-chip">{chip_label_vig}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )
        c1, c2, c3, c4, c5, c6, c7 = st.columns(7)

        with c1:
            tarjeta("Total equipos", resumen_vig["total_equipos"], "Unidades", color="green")
        with c2:
            tarjeta("Corporativos (ALV)", resumen_vig["total_corporativos"], "", color="blue")
        with c3:
            tarjeta("Técnicos", resumen_vig["total_tecnicos"], "", color="orange")
        with c4:
            tarjeta("En Chile", resumen_vig["total_chile"], "", color="purple")
        with c5:
            tarjeta("Regiones de Chile", resumen_vig["total_region"], "", color="pink")
        with c6:
            tarjeta("En Argentina", resumen_vig["total_argentina"], "", color="blue")
        with c7:
            tarjeta("Otros países", resumen_vig["total_otros_paises"], "", color="orange")


        df_detalle_vig = get_detalle_equipo(
            "equipos", clave_equipo_vig, por_renovar=False
        )

        st.markdown("### Detalle de equipos")

        if df_detalle_vig.empty:
            st.info("No hay registros para este equipo.")
        else:
            df_detalle_vig = df_detalle_vig.copy()

            todos_clientes = get_clientes_empresa()
            clientes_opciones_vig = ["Todos"] + todos_clientes

            cliente_sel_vig = st.selectbox(
                "Filtrar por cliente",
                clientes_opciones_vig,
                key="filtro_cliente_vig_tab1",
            )

            if cliente_sel_vig != "Todos":
                df_filtrado_vig = df_detalle_vig[
                    df_detalle_vig["cliente"]
                    .astype(str)
                    .str.strip()
                    .eq(cliente_sel_vig)
                ]
            else:
                df_filtrado_vig = df_detalle_vig.copy()

            total_filtrado = len(df_filtrado_vig)
            corp_filtrado = (
                df_filtrado_vig["cliente"]
                .astype(str)
                .str.strip()
                .str.upper()
                .eq("ALV")
                .sum()
            )
            tec_filtrado = (
                df_filtrado_vig["perfil"]
                .astype(str)
                .str.strip()
                .ne("")
                .sum()
            )

            filtro_label = (
                f"Cliente = {cliente_sel_vig}"
                if cliente_sel_vig != "Todos"
                else "Todos los clientes"
            )

            st.markdown(
                f"""
                <div style="margin: 0.5rem 0 0.15rem 0;">
                    <span class="equipo-chip">Filtro aplicado: {filtro_label}</span>
                </div>
                """,
                unsafe_allow_html=True,
            )

            st.markdown("### Resumen filtrado")

            c1_res, c2_res, c3_res = st.columns(3)
            with c1_res:
                tarjeta(
                    "Total equipos (filtrado)",
                    int(total_filtrado),
                    f"Cliente: {cliente_sel_vig}",
                )
            with c2_res:
                tarjeta(
                    "Corporativos (ALV)",
                    int(corp_filtrado),
                    "Según filtro",
                )
            with c3_res:
                tarjeta(
                    "Técnicos",
                    int(tec_filtrado),
                    "Según filtro",
                )

            df_mostrar = df_filtrado_vig.copy()
            df_mostrar["cliente"] = df_mostrar["cliente"].fillna("Sin cliente")
            st.dataframe(df_mostrar, use_container_width=True)

# =========================================================
# TAB 2: EQUIPOS POR RENOVAR
# =========================================================
with tab_ren:
    # --- Título + chips a la derecha (sin centrar toda la página) ---
    col_titulo, col_resumen = st.columns([2, 3])

    with col_titulo:
        st.markdown(
            """
            <p style='color:#dc2626; font-size:1.1rem; font-weight:600;
            margin-top:0.2rem; margin-bottom:1rem;'>
            Equipos Asignados - Por Renovar
            </p>
            """,
            unsafe_allow_html=True,
        )

    with col_resumen:
        st.markdown(
            """
            <div style="text-align:right; margin-top:0.2rem;">
                <span class="equipo-chip">Mac obsoletos: 37</span>
                <span class="equipo-chip">Multimarca obsoletos: 53</span>
                <span class="equipo-chip">Equipos por renovar: 90</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # --------- lógica de la pestaña 2 (sin columnas externas) ---------
    df_equipos_ren = get_equipos_normalizados("equipos_renovar")

    if df_equipos_ren.empty:
        st.info("No hay datos en 'equipos_renovar'.")
    else:
        df_equipos_ren = df_equipos_ren.copy()
        df_equipos_ren["tipo_sistema"] = df_equipos_ren[
            "nombre_equipo_mostrado"
        ].apply(
            lambda x: "Mac (Apple)"
            if str(x).strip().lower().startswith("apple")
            else "Windows/Otros"
        )

        tipo_sel = st.radio(
            "Filtrar por tipo de equipo",
            ["Todos", "Mac (Apple)", "Windows/Otros"],
            horizontal=True,
            key="filtro_tipo_equipo_ren",
        )

        if tipo_sel != "Todos":
            df_equipos_ren_filtrado = df_equipos_ren[
                df_equipos_ren["tipo_sistema"] == tipo_sel
            ]
        else:
            df_equipos_ren_filtrado = df_equipos_ren

        if df_equipos_ren_filtrado.empty:
            st.info("No hay equipos por renovar para ese filtro.")
        else:
            opciones_ren = df_equipos_ren_filtrado.to_dict(orient="records")

            equipo_opt_ren = st.selectbox(
                "Selecciona el equipo por renovar",
                opciones_ren,
                format_func=fmt_equipo_ren,  # la función que ya tienes
                key="select_equipo_ren_tab",
            )

            clave_equipo_ren = equipo_opt_ren["clave_equipo"]
            nombre_equipo_ren = equipo_opt_ren["nombre_equipo_mostrado"]

            cpu_main_ren = equipo_opt_ren.get("modelo_cpu_main")
            if isinstance(cpu_main_ren, str) and cpu_main_ren.lower() == "nan":
                cpu_main_ren = ""

            resumen_ren = get_resumen_equipo(
                "equipos_renovar", clave_equipo_ren, incluir_extra=True
            )

            chip_label_ren = (
                f"{nombre_equipo_ren} — {cpu_main_ren}"
                if cpu_main_ren
                else nombre_equipo_ren
            )

            st.markdown(
                f"""
                <div class="equipo-header">
                    <span class="equipo-chip">{chip_label_ren}</span>
                </div>
                """,
                unsafe_allow_html=True,
            )

            c1, c2, c3, c4, c5, c6, c7 = st.columns(7)
            with c1:
                tarjeta(
                    "Total equipos",
                    resumen_ren["total_equipos"],
                    "Unidades de este modelo (por renovar)",
                )
            with c2:
                tarjeta(
                    "Corporativos (ALV)",
                    resumen_ren["total_corporativos"],
                    "Cliente = 'ALV'",
                )
            with c3:
                tarjeta(
                    "Técnicos",
                    resumen_ren["total_tecnicos"],
                    "Filas con Perfil (col 19)",
                )
            with c4:
                tarjeta(
                    "En Chile",
                    resumen_ren["total_chile"],
                    "Localización: Chile",
                )
            with c5:
                tarjeta(
                    "Regiones de Chile",
                    resumen_ren["total_region"],
                    "Chile ≠ Santiago",
                )
            with c6:
                tarjeta(
                    "En Argentina",
                    resumen_ren["total_argentina"],
                    "Localización: Argentina",
                )
            with c7:
                tarjeta(
                    "Otros países",
                    resumen_ren["total_otros_paises"],
                    "Colombia, etc.",
                )

            tarjeta(
                "Años de uso promedio",
                resumen_ren.get("anios_uso_promedio", 0),
                "Promedio del modelo (por renovar)",
            )

            st.markdown("### Detalle de equipos por renovar")

            df_detalle_ren = get_detalle_equipo(
                "equipos_renovar", clave_equipo_ren, por_renovar=True
            )

            if df_detalle_ren.empty:
                st.info("No hay registros para este modelo.")
            else:
                df_detalle_ren = df_detalle_ren.copy()
                df_detalle_ren["cliente_mostrar"] = df_detalle_ren[
                    "cliente"
                ].fillna("Sin cliente")

                # Todos depreciados en rojo
                df_detalle_ren["clasificacion_finanzas"] = "Depreciado"

                clientes_opciones_ren = ["Todos"] + sorted(
                    df_detalle_ren["cliente_mostrar"].unique().tolist()
                )

                cliente_sel_ren = st.selectbox(
                    "Filtrar por cliente (por renovar)",
                    clientes_opciones_ren,
                    key="filtro_cliente_ren_tab",
                )

                if cliente_sel_ren != "Todos":
                    df_filtrado_ren = df_detalle_ren[
                        df_detalle_ren["cliente_mostrar"] == cliente_sel_ren
                    ]
                else:
                    df_filtrado_ren = df_detalle_ren

                styler = df_filtrado_ren.style.applymap(
                    lambda v: "color:#b91c1c; font-weight:600;"
                    if v == "Depreciado"
                    else "",
                    subset=["clasificacion_finanzas"],
                )

                st.dataframe(styler, use_container_width=True)


# =========================================================
# TAB 3: MÓVILES ASIGNADOS
# =========================================================
with tab_mov:
    st.markdown(
        "<p style='color:#dc2626; font-size:1.1rem; font-weight:600; "
        "margin-top:0.2rem; margin-bottom:2rem;'>"
        "Móviles Asignados"
        "</p>",
        unsafe_allow_html=True,
    )

    df_moviles = get_equipos_normalizados("moviles")
    if df_moviles.empty:
        st.info(
            "No hay datos en la tabla 'moviles'. "
            "Verifica que la hoja de móviles esté cargada con cargar_catastro.py."
        )
    else:
        opciones_mov = df_moviles.to_dict(orient="records")

        def fmt_movil(opt):
            cpu = (opt.get("modelo_cpu_main") or "").strip()
            if cpu and cpu.lower() != "nan":
                return f"{opt['nombre_equipo_mostrado']} — {cpu}"
            return opt["nombre_equipo_mostrado"]

        movil_opt = st.selectbox(
            "Selecciona el móvil asignado",
            opciones_mov,
            format_func=fmt_movil,
            key="select_movil_tab3",
        )

        clave_movil = movil_opt["clave_equipo"]
        nombre_movil = movil_opt["nombre_equipo_mostrado"]
        cpu_movil = (movil_opt.get("modelo_cpu_main") or "").strip()
        if cpu_movil.lower() == "nan":
            cpu_movil = ""

        resumen_mov = get_resumen_equipo("moviles", clave_movil, incluir_extra=False)

        chip_label_mov = (
            f"{nombre_movil} — {cpu_movil}" if cpu_movil else nombre_movil
        )

        st.markdown(
            f"""
            <div class="equipo-header">
                <span class="equipo-chip">{chip_label_mov}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

        c1, c2, c3, c4, c5, c6, c7 = st.columns(7)
        with c1:
            tarjeta(
                "Total móviles",
                resumen_mov["total_equipos"],
                "Unidades de este modelo",
            )
        with c2:
            tarjeta(
                "Corporativos (ALV)",
                resumen_mov["total_corporativos"],
                "Cliente = 'ALV'",
            )
        with c3:
            tarjeta(
                "Técnicos",
                resumen_mov["total_tecnicos"],
                "Filas con Perfil (col 19)",
            )
        with c4:
            tarjeta(
                "En Chile",
                resumen_mov["total_chile"],
                "Localización: Chile",
            )
        with c5:
            tarjeta(
                "Regiones de Chile",
                resumen_mov["total_region"],
                "Chile ≠ Santiago",
            )
        with c6:
            tarjeta(
                "En Argentina",
                resumen_mov["total_argentina"],
                "Localización: Argentina",
            )
        with c7:
            tarjeta(
                "Otros países",
                resumen_mov["total_otros_paises"],
                "Perú, Colombia, etc.",
            )

        st.markdown(
            "### Detalle de móviles asignados "
            "(persona, cliente, país, ciudad, perfil, modelo/CPU)"
        )

        df_detalle_mov = get_detalle_equipo("moviles", clave_movil, por_renovar=False)

        if df_detalle_mov.empty:
            st.info("No hay registros para este modelo de móvil.")
        else:
            df_detalle_mov = df_detalle_mov.copy()
            df_detalle_mov["cliente_mostrar"] = df_detalle_mov["cliente"].fillna(
                "Sin cliente"
            )
            clientes_opciones_mov = ["Todos"] + sorted(
                df_detalle_mov["cliente_mostrar"].unique().tolist()
            )
            cliente_sel_mov = st.selectbox(
                "Filtrar por cliente (móviles)",
                clientes_opciones_mov,
                key="filtro_cliente_mov_tab3",
            )

            if cliente_sel_mov != "Todos":
                df_filtrado_mov = df_detalle_mov[
                    df_detalle_mov["cliente_mostrar"] == cliente_sel_mov
                ].drop(columns=["cliente_mostrar"])
            else:
                df_filtrado_mov = df_detalle_mov.drop(columns=["cliente_mostrar"])

            st.dataframe(df_filtrado_mov, use_container_width=True)

# =========================================================
# TAB 4: TEAM CORPORATIVO SIN EQUIPO
# =========================================================
with tab_team:
    st.markdown(
        "<p style='color:#dc2626; font-size:1.1rem; font-weight:600; "
        "margin-top:0.2rem; margin-bottom:2rem;'>"
        "Team corporativo sin equipo"
        "</p>",
        unsafe_allow_html=True,
    )

    df_team = get_team_sin_equipo()
    if df_team.empty:
        st.info(
            "No hay datos en la tabla 'team_sin_equipo'. "
            "Verifica que la hoja de team corporativo esté cargada."
        )
    else:
        total_personas = len(df_team)
        total_chile = (df_team["pais"].astype(str).str.strip() == "Chile").sum()
        total_fuera_chile = total_personas - total_chile
        total_paises = df_team["pais"].dropna().astype(str).nunique()
        total_areas = df_team["area"].dropna().astype(str).nunique()

        c1, c2, c3, c4 = st.columns(4)
        with c1:
            tarjeta("Total personas", total_personas, "Team corporativo sin equipo")
        with c2:
            tarjeta("En Chile", int(total_chile), "Localización: Chile")
        with c3:
            tarjeta("Fuera de Chile", int(total_fuera_chile), "Otros países")
        with c4:
            tarjeta(
                "Áreas / Países",
                f"{total_areas} / {total_paises}",
                "Áreas y países distintos",
            )

        st.markdown("### Detalle de team corporativo sin equipo")

        df_team = df_team.copy()
        df_team["pais_mostrar"] = df_team["pais"].fillna("Sin país")
        paises_opciones = ["Todos"] + sorted(df_team["pais_mostrar"].unique().tolist())
        pais_sel = st.selectbox(
            "Filtrar por país", paises_opciones, key="filtro_pais_team_tab4"
        )

        if pais_sel != "Todos":
            df_filtrado_team = df_team[df_team["pais_mostrar"] == pais_sel].drop(
                columns=["pais_mostrar"]
            )
        else:
            df_filtrado_team = df_team.drop(columns=["pais_mostrar"])

        st.dataframe(df_filtrado_team, use_container_width=True)

# =========================================================
# TAB 5: RESUMEN GENERAL
# =========================================================
with tab_resumen:
    st.markdown(
        "<p style='color:#dc2626; font-size:1.2rem; font-weight:700; "
        "margin-top:0.2rem; margin-bottom:1rem;'>"
        "Resumen General de Equipos"
        "</p>",
        unsafe_allow_html=True,
    )

    st.subheader("Resumen de Equipos por Renovar")

    df_resumen_1 = pd.DataFrame(
        {
            "Indicador": [
                "Computadores Mac Obsoletos",
                "Computadores Multimarca Obsoletos",
                "Total de Equipos Analizados para Renovación",
            ],
            "Cantidad": [37, 53, 90],
        }
    )
    st.table(df_resumen_1)

    st.markdown("---")

    st.subheader("Distribución de Equipos por Renovar")

    df_resumen_2 = pd.DataFrame(
        {
            "Indicador": [
                "Computadores asignados por renovar – Team Corporativo",
                "Computadores asignados por renovar – Team Staffing",
                "Equipos Obsoletos / Reemplazo",
            ],
            "Cantidad": [21,64, 85],
        }
    )
    st.table(df_resumen_2)

    st.markdown("---")

    st.subheader("Necesidades de Equipamiento - Corporativo & Staffing")

    df_resumen_3 = pd.DataFrame(
        {
            "Indicador": [
                "Team corporativo sin computador asignado",
                "Team corporativo con computador asignados por renovar",
                "Team Staffing con computador asignados por renovar",
                "Total Equipos a Adquirir",
            ],
            "Cantidad": [46, 21, 64, 131],
        }
    )
    st.table(df_resumen_3)

# =========================================================
# TAB 6: MAPA VISUAL DE DOTACIÓN
# =========================================================
with tab_mapa:
    st.markdown(
        "<p style='color:#dc2626; font-size:1.1rem; font-weight:600; "
        "margin-top:0.2rem; margin-bottom:0.75rem;'>"
        "Mapa visual de dotación"
        "</p>",
        unsafe_allow_html=True,
    )

    legend_html = """
    <div class="status-legend">
        <div class="status-item">
            <div class="status-color status-ok"></div>
            <span>Celda en blanco: <strong>tiene equipo asignado</strong></span>
        </div>
        <div class="status-item">
            <div class="status-color status-renovar"></div>
            <span>Celda color amarillo: <strong>necesita renovar</strong></span>
        </div>
        <div class="status-item">
            <div class="status-color status-sin-equipo"></div>
            <span>Celda color rojo medio: <strong>está sin equipo</strong></span>
        </div>
    </div>
    """
    st.markdown(legend_html, unsafe_allow_html=True)

    df_mapa = load_detalle_matriz()

    if df_mapa.empty:
        st.info("No se pudo cargar la hoja 'Detalle' desde `catastro.xlsx`.")
    else:
        estados = get_estados_fijos()
        html_mapa = build_mapa_html(df_mapa, estados)

        st.markdown("#### Detalle de dotación (colores fijos según listas)")
        st.markdown(html_mapa, unsafe_allow_html=True)

# =========================================================
# TAB 6 (nueva): PLAN DE COMPRAS 2026
# =========================================================
with tab_plan_2026:
    st.markdown(
        """
        <p style='color:#dc2626; font-size:1.2rem; font-weight:700;
        margin-top:0.2rem; margin-bottom:1rem;'>
        Plan de compras 2026 – Modelo predictivo
        </p>
        """,
        unsafe_allow_html=True,
    )

    datos_2026 = get_plan_2026()

    backlog_sin_equipo = datos_2026["backlog_sin_equipo"]
    backlog_renovar = datos_2026["backlog_renovar"]
    reemplazos_2026 = datos_2026["reemplazos_2026"]
    demanda_organica = datos_2026["demanda_organica"]
    total_conservador = datos_2026["total_conservador"]
    total_gradual = datos_2026["total_gradual"]

    st.markdown("### Componentes del modelo 2026")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        tarjeta(
        "Backlog sin equipo",
        backlog_sin_equipo,
        "Personas sin computador asignado",
        color="orange",
    )
    with c2:
        tarjeta(
        "Backlog por renovar",
        backlog_renovar,
        "Equipos obsoletos (equipos_renovar)",
        color="blue",
    )
    with c3:
        tarjeta(
        "Reemplazos por antigüedad",
        reemplazos_2026,
        "Equipos con ≥4 años en 2026",
        color="purple",
    )
    with c4:
        tarjeta(
        "Demanda orgánica estimada",
        demanda_organica,
        "Promedio compras 2023–2025",
        color="green",
    )

    st.markdown("---")
    st.markdown("### Escenarios de compra 2026")

    col_a, col_b = st.columns(2)

    with col_a:
        tarjeta(
            "Escenario conservador",
            total_conservador,
            "Resuelve 100% backlog + renovaciones + crecimiento",
        )

    with col_b:
        tarjeta(
            "Escenario gradual",
            total_gradual,
            "Renueva backlog en 2 años (50% en 2026)",
        )

    # ==========================
    # Nota explicativa del modelo
    # ==========================
    explicacion_html = f"""
    <div style="margin-top:1.2rem; font-size:0.9rem; color:#4b5563;">
      <strong>¿Por qué el modelo da este resultado?</strong>
      <p style="margin-top:0.5rem;">
        El número de equipos recomendados para 2026 se construye sumando cuatro componentes:
      </p>
      <ul>
        <li>
          <strong>Backlog sin equipo ({backlog_sin_equipo})</strong>: personas que hoy no tienen
          computador asignado (tabla <code>team_sin_equipo</code>).
        </li>
        <li>
          <strong>Backlog por renovar ({backlog_renovar})</strong>: equipos marcados como obsoletos
          o por renovar (tabla <code>equipos_renovar</code>).
        </li>
        <li>
          <strong>Reemplazos 2026 por antigüedad ({reemplazos_2026})</strong>: equipos vigentes que al
          31-12-2026 cumplen 4 o más años de uso y deberían ser renovados
          (tabla <code>equipos</code>, usando <code>fecha_compra</code>).
        </li>
        <li>
          <strong>Demanda orgánica ({demanda_organica})</strong>: crecimiento esperado de dotación,
          estimado como el promedio de equipos asignados entre 2023 y 2025.
        </li>
      </ul>
      <p style="margin-top:0.5rem;">
        En el <strong>escenario conservador</strong> se considera el 100% del backlog por renovar
        en 2026, por lo que la fórmula es:
      </p>
      <p style="margin:0.25rem 0 0.5rem 0;">
        <code>
        Total conservador = {backlog_sin_equipo} (sin equipo)
        + {backlog_renovar} (por renovar)
        + {reemplazos_2026} (reemplazos por antigüedad)
        + {demanda_organica} (demanda orgánica)
        = {total_conservador}
        </code>
      </p>
      <p>
        En el <strong>escenario gradual</strong> se renueva solo la mitad del backlog por renovar
        en 2026 y la otra mitad se difiere a 2027, por eso el total es menor:
      </p>
      <p style="margin:0.25rem 0;">
        <code>
        Total gradual = {backlog_sin_equipo}
        + (50% de {backlog_renovar})
        + {reemplazos_2026}
        + {demanda_organica}
        = {total_gradual}
        </code>
      </p>
      <p style="margin-top:0.5rem;">
        Estos valores se calculan directamente desde la base
        <code>inventario_equipos</code>, por lo que el modelo se actualiza en cuanto
        cambian las tablas de equipos y dotación.
      </p>
    </div>
    """

    st.markdown(explicacion_html, unsafe_allow_html=True)
