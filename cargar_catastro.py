import pandas as pd
from sqlalchemy import create_engine

# ==========================================
# CONFIGURACIÓN BBDD
# ==========================================
ENGINE_URL = "postgresql://usuario:password@localhost:5432/ti_ops"

engine = create_engine(
    ENGINE_URL,
    future=True,
)

EXCEL_FILE = "catastro.xlsx"


def load_sheet_with_header(sheet_index: int):
    """
    Lee una hoja del Excel sin encabezado (header=None),
    busca la fila donde aparecen 'Tipo', 'Marca', 'Modelo'
    y usa esa fila como encabezado real.

    Devuelve df_data (solo filas de datos, con nombres de columnas correctos).
    """
    df_raw = pd.read_excel(EXCEL_FILE, sheet_name=sheet_index, header=None)

    print(f"\n==== Hoja índice {sheet_index} — vista rápida de las primeras filas ====")
    for i in range(min(8, len(df_raw))):
        print(f"Fila {i}: {list(df_raw.iloc[i].astype(str))}")

    # Buscar fila de encabezados reales
    header_row = None
    for idx, row in df_raw.iterrows():
        values = [str(x).strip() for x in row.tolist()]
        if "Tipo" in values and "Marca" in values and "Modelo" in values:
            header_row = idx
            break

    if header_row is None:
        raise RuntimeError(
            f"No se encontró una fila de encabezados con 'Tipo', 'Marca' y 'Modelo' "
            f"en la hoja {sheet_index}."
        )

    print(f"\nUsando la fila {header_row} como encabezado real de la hoja {sheet_index}.")

    header = [str(x).strip() for x in df_raw.iloc[header_row].tolist()]
    df_data = df_raw.iloc[header_row + 1 :].copy()
    df_data.columns = header

    print(f"\n==== Columnas detectadas en hoja índice {sheet_index} ====")
    for i, c in enumerate(df_data.columns):
        print(f"{i+1:2d}: {c}")

    return df_data


def build_equipos_df(df_data: pd.DataFrame) -> pd.DataFrame:
    """
    A partir de un df con columnas:
      Tipo, Marca, Modelo, CPU, Localización, Ciudad/Comuna,
      Fecha de Compra, Cliente, Empleado Asignado, Perfil
    construye un df normalizado con columnas:
      nombre_equipo, modelo_cpu, tipo_equipo, pais, ciudad,
      fecha_compra, cliente, perfil, nombre_persona
    """
    df_equipos = pd.DataFrame()

    def add_col(dest_name, source_name, default_value=""):
        if source_name in df_data.columns:
            df_equipos[dest_name] = df_data[source_name]
        else:
            print(
                f"⚠️ En df no se encontró columna '{source_name}'. "
                f"Se rellena '{dest_name}' con valor por defecto."
            )
            df_equipos[dest_name] = default_value

    add_col("tipo_equipo", "Tipo")
    add_col("Marca", "Marca")
    add_col("Modelo", "Modelo")
    add_col("modelo_cpu", "CPU")
    add_col("pais", "Localización")
    add_col("ciudad", "Ciudad/Comuna")
    add_col("fecha_compra", "Fecha de Compra", default_value=pd.NaT)
    add_col("cliente", "Cliente")

    # nombre_persona: probar varios nombres posibles de columna
    if "Empleado Asignado" in df_data.columns:
        df_equipos["nombre_persona"] = df_data["Empleado Asignado"]
    elif "Acidian - Nombre Completo" in df_data.columns:
        df_equipos["nombre_persona"] = df_data["Acidian - Nombre Completo"]
    elif "Nombre Persona" in df_data.columns:
        df_equipos["nombre_persona"] = df_data["Nombre Persona"]
    else:
        print("⚠️ No se encontró columna de nombre de persona; se deja vacío.")
        df_equipos["nombre_persona"] = ""

    add_col("perfil", "Perfil")


    # nombre_equipo = Marca + Modelo
    df_equipos["Marca"] = df_equipos["Marca"].astype(str).str.strip()
    df_equipos["Modelo"] = df_equipos["Modelo"].astype(str).str.strip()
    df_equipos["nombre_equipo"] = (
        df_equipos["Marca"].fillna("") + " " + df_equipos["Modelo"].fillna("")
    ).str.strip()

    # Normalizar fecha
    df_equipos["fecha_compra"] = pd.to_datetime(
        df_equipos["fecha_compra"], errors="coerce"
    )

    # Eliminar filas totalmente vacías
    df_equipos = df_equipos.dropna(how="all")

    df_equipos = df_equipos[
        [
            "nombre_equipo",
            "modelo_cpu",
            "tipo_equipo",
            "pais",
            "ciudad",
            "fecha_compra",
            "cliente",
            "perfil",
            "nombre_persona",
        ]
    ].copy()

    return df_equipos


# ==========================================
# 1) EQUIPOS VIGENTES (hoja 0) → tabla 'equipos'
# ==========================================
df_vig_data = load_sheet_with_header(0)
df_vigentes = build_equipos_df(df_vig_data)

df_vigentes.to_sql("equipos", engine, if_exists="replace", index=False)
print("\n✅ Tabla 'equipos' (vigentes) cargada.")

# ==========================================
# 2) EQUIPOS POR RENOVAR (hoja 1) → tabla 'equipos_renovar'
# ==========================================
df_ren_raw = pd.read_excel(EXCEL_FILE, sheet_name=1)

print("\n==== Columnas detectadas en hoja índice 1 (por renovar) ====")
for i, c in enumerate(df_ren_raw.columns):
    print(f"{i+1:2d}: {c}")

df_renovar = build_equipos_df(df_ren_raw)

# ---- AÑOS DE USO (parseo flexible) ----
if "Años de Uso" in df_ren_raw.columns:
    print("\nUsando columna 'Años de Uso' como anios_uso (parseo flexible)")
    col_anios = df_ren_raw["Años de Uso"].astype(str)
    col_anios = col_anios.str.replace(",", ".", regex=False)
    col_num = col_anios.str.extract(r"([0-9]+(?:\.[0-9]+)?)")[0]
    df_renovar["anios_uso"] = pd.to_numeric(col_num, errors="coerce").fillna(0)
else:
    print("\n⚠️ No se encontró columna 'Años de Uso' en hoja 1; se deja en 0.")
    df_renovar["anios_uso"] = 0

# ---- CLASIFICACIÓN FINANZAS ----
if "Clasificación Finanzas" in df_ren_raw.columns:
    print("Usando columna 'Clasificación Finanzas' como clasificacion_finanzas")
    df_renovar["clasificacion_finanzas"] = (
        df_ren_raw["Clasificación Finanzas"].astype(str).str.strip()
    )
else:
    print("⚠️ No se encontró columna 'Clasificación Finanzas' en hoja 1; se deja vacío.")
    df_renovar["clasificacion_finanzas"] = ""

df_renovar = df_renovar[
    [
        "nombre_equipo",
        "modelo_cpu",
        "tipo_equipo",
        "pais",
        "ciudad",
        "fecha_compra",
        "cliente",
        "perfil",
        "nombre_persona",
        "anios_uso",
        "clasificacion_finanzas",
    ]
].copy()

df_renovar.to_sql("equipos_renovar", engine, if_exists="replace", index=False)
print("✅ Tabla 'equipos_renovar' (por renovar) cargada.")


# ==========================================
# 3) MÓVILES ASIGNADOS (hoja 2) → tabla 'moviles'
# ==========================================
df_mov_data = load_sheet_with_header(2)
df_moviles = build_equipos_df(df_mov_data)

df_moviles.to_sql("moviles", engine, if_exists="replace", index=False)
print("✅ Tabla 'moviles' (móviles asignados) cargada.")


# ==========================================
# 4) TEAM CORPORATIVO SIN EQUIPO (hoja 3) → tabla 'team_sin_equipo'
# ==========================================
df_team_raw = pd.read_excel(EXCEL_FILE, sheet_name=3)

print("\n==== Columnas detectadas en hoja índice 3 (team corporativo sin equipo) ====")
for i, c in enumerate(df_team_raw.columns):
    print(f"{i+1:2d}: {c}")

cols = df_team_raw.columns


def get_col(name, default_value=""):
    if name in cols:
        return df_team_raw[name]
    print(f"⚠️ No se encontró columna '{name}' en hoja 3; se rellena por defecto.")
    return default_value


df_team = pd.DataFrame(
    {
        "nombre_persona": get_col("Acidian - Nombre Completo"),
        "rol": get_col("Rol"),
        "area": get_col("Área"),
        "pais": get_col("Localización"),
        "observaciones": get_col("Observaciones", default_value=""),
    }
)

# Eliminar filas totalmente vacías
df_team = df_team.dropna(how="all")

df_team.to_sql("team_sin_equipo", engine, if_exists="replace", index=False)
print("✅ Tabla 'team_sin_equipo' (team corporativo sin equipo) cargada.")
