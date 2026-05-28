# backend/routers/catastro.py
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from ..db import engine

router = APIRouter(
    prefix="/catastro",
    tags=["catastro"],
)

# --- NORMALIZADOS POR TABLA (equipos, equipos_renovar, moviles) ---

@router.get("/equipos_normalizados")
def equipos_normalizados(tabla: str = Query(..., pattern="^(equipos|equipos_renovar|moviles)$")):
    """
    Devuelve:
      - clave_equipo
      - nombre_equipo_mostrado
      - modelo_cpu_main
    para la tabla indicada.
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
            return []

        query = text(
            f"""
            SELECT
                UPPER(TRIM(nombre_equipo)) AS clave_equipo,
                MIN(nombre_equipo)        AS nombre_equipo_mostrado,
                MAX(modelo_cpu)           AS modelo_cpu_main
            FROM {tabla}
            GROUP BY UPPER(TRIM(nombre_equipo))
            ORDER BY MIN(nombre_equipo);
            """
        )
        rows = conn.execute(query).mappings().all()

    if tabla == "equipos_renovar":
        filtradas = []
        basura = {"37", "53", "90", "21"}
        for r in rows:
            nombre = (r["nombre_equipo_mostrado"] or "").strip()
            # descarta filas que son solo números / basuritas
            try:
                _ = float(nombre)
                is_numeric = True
            except ValueError:
                is_numeric = False

            if is_numeric or nombre in basura:
                continue
            filtradas.append(dict(r))
        return filtradas

    return [dict(r) for r in rows]


# --- RESUMEN POR EQUIPO ---

@router.get("/resumen_equipo")
def resumen_equipo(
    tabla: str = Query(..., pattern="^(equipos|equipos_renovar|moviles)$"),
    clave_equipo: str = Query(..., description="UPPER(TRIM(nombre_equipo))"),
    incluir_extra: bool = False,
):
    extra_cols = ""
    if incluir_extra and tabla == "equipos_renovar":
        extra_cols = ", AVG(anios_uso)::numeric(10,2) AS anios_uso_promedio"

    query = text(
        f"""
        SELECT
            COUNT(*) AS total_equipos,

            SUM(
                CASE WHEN cliente IS NOT NULL
                     AND upper(trim(cliente)) = 'ALV'
                     THEN 1 ELSE 0 END
            ) AS total_corporativos,

            SUM(CASE WHEN pais = 'Chile' THEN 1 ELSE 0 END) AS total_chile,

            SUM(
                CASE WHEN pais = 'Chile'
                     AND ciudad IS NOT NULL
                     AND ciudad NOT ILIKE '%santiago%'
                     THEN 1 ELSE 0 END
            ) AS total_region,

            SUM(CASE WHEN pais = 'Argentina' THEN 1 ELSE 0 END) AS total_argentina,

            SUM(
                CASE WHEN pais IS NOT NULL
                     AND pais NOT IN ('Chile','Argentina')
                     THEN 1 ELSE 0 END
            ) AS total_otros_paises,

            SUM(
                CASE WHEN perfil IS NOT NULL
                     AND trim(perfil) <> ''
                     THEN 1 ELSE 0 END
            ) AS total_tecnicos
            {extra_cols}
        FROM {tabla}
        WHERE UPPER(TRIM(nombre_equipo)) = :clave;
        """
    )

    with engine.connect() as conn:
        row = conn.execute(query, {"clave": clave_equipo}).mappings().first()

    if not row or row["total_equipos"] is None:
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


# --- DETALLE POR EQUIPO ---

@router.get("/detalle_equipo")
def detalle_equipo(
    tabla: str = Query(..., pattern="^(equipos|equipos_renovar|moviles)$"),
    clave_equipo: str = Query(...),
    por_renovar: bool = False,
):
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
        rows = conn.execute(query, {"clave": clave_equipo}).mappings().all()

    return [dict(r) for r in rows]


# --- TEAM SIN EQUIPO ---

@router.get("/team_sin_equipo")
def team_sin_equipo():
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
            return []

        rows = conn.execute(
            text(
                """
                SELECT nombre_persona, rol, area, pais, observaciones
                FROM team_sin_equipo
                ORDER BY pais, area, nombre_persona;
                """
            )
        ).mappings().all()

    return [dict(r) for r in rows]


# --- CLIENTES EMPRESA ---

@router.get("/clientes_empresa")
def clientes_empresa():
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT DISTINCT cliente
                FROM equipos
                WHERE cliente IS NOT NULL
                  AND trim(cliente) <> ''
                ORDER BY cliente;
                """
            )
        ).mappings().all()
    return [r["cliente"] for r in rows]


# --- PLAN 2026 (mismos cálculos que en Streamlit) ---

@router.get("/plan_2026")
def plan_2026():
    with engine.connect() as conn:
        df_sin = conn.execute(
            text("SELECT COUNT(*) AS backlog_sin_equipo FROM team_sin_equipo;")
        ).mappings().first()
        backlog_sin_equipo = int(df_sin["backlog_sin_equipo"])

        df_ren = conn.execute(
            text("SELECT COUNT(*) AS backlog_renovar FROM equipos_renovar;")
        ).mappings().first()
        backlog_renovar = int(df_ren["backlog_renovar"])

        df_rep = conn.execute(
            text(
                """
                SELECT COUNT(*) AS reemplazos_2026
                FROM equipos
                WHERE fecha_compra IS NOT NULL
                  AND EXTRACT(YEAR FROM AGE('2026-12-31'::date, fecha_compra)) >= 4;
                """
            )
        ).mappings().first()
        reemplazos_2026 = int(df_rep["reemplazos_2026"])

        df_dem = conn.execute(
            text(
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
                """
            )
        ).mappings().first()
        demanda_organica = int(df_dem["demanda_organica"])

    total_conservador = (
        backlog_sin_equipo
        + backlog_renovar
        + reemplazos_2026
        + demanda_organica
    )

    total_gradual = (
        backlog_sin_equipo
        + int(round(backlog_renovar / 2))
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
