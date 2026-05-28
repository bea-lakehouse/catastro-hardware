-- 1. Schema para el modelo de activos
CREATE SCHEMA IF NOT EXISTS activos;

-- 2. Tabla maestra de equipos (hardware)
CREATE TABLE IF NOT EXISTS activos.equipos (
    id              SERIAL PRIMARY KEY,
    asset_tag       TEXT UNIQUE,              -- identificador lógico del equipo
    serie           TEXT,
    tipo_equipo     TEXT NOT NULL DEFAULT 'Notebook',
    marca           TEXT,
    modelo          TEXT,
    cpu             TEXT,
    ram_gb          INTEGER,
    almacenamiento  TEXT,
    estado          TEXT NOT NULL DEFAULT 'vigente', -- vigente, baja, robado, etc.

    fecha_compra    DATE NOT NULL,
    fecha_baja      DATE,
    costo_compra    NUMERIC(12,2),
    moneda          TEXT DEFAULT 'USD',

    cliente_actual  TEXT,
    persona_actual  TEXT,
    pais_actual     TEXT,
    ciudad_actual   TEXT,
    perfil_actual   TEXT,

    fuente_registro TEXT,
    creado_en       TIMESTAMP DEFAULT now(),
    actualizado_en  TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipos_fecha_compra_idx
    ON activos.equipos (fecha_compra);

CREATE INDEX IF NOT EXISTS equipos_estado_idx
    ON activos.equipos (estado);

CREATE INDEX IF NOT EXISTS equipos_cliente_idx
    ON activos.equipos (cliente_actual);

-- 3. Vista de KPIs anuales 2022–2025
CREATE OR REPLACE VIEW activos.vw_kpi_anual AS
SELECT
    EXTRACT(YEAR FROM fecha_compra)::int AS anio,
    COUNT(*)                             AS total_equipos,
    COUNT(*) FILTER (WHERE estado = 'vigente') AS equipos_vigentes,
    COUNT(*) FILTER (WHERE estado = 'baja')    AS equipos_baja,
    COUNT(DISTINCT cliente_actual)       AS clientes_distintos,
    COUNT(DISTINCT pais_actual)          AS paises_distintos,
    SUM(costo_compra)                    AS capex_total
FROM activos.equipos
GROUP BY EXTRACT(YEAR FROM fecha_compra)
HAVING EXTRACT(YEAR FROM fecha_compra) BETWEEN 2022 AND 2025
ORDER BY anio;
