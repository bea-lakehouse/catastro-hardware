# Flujo de datos: Excel → Bronze → Silver → Gold

**Proyecto:** twobrains-lakehouse  
**Base de datos:** twobrains_assets  
**Arquitectura:** Medallion (Bronze / Silver / Gold / Ops)  
**Fecha:** Jun 2026

---

## Resumen ejecutivo

2Brains deja de depender del Excel como base de trabajo para pasar a una arquitectura Lakehouse real. El Excel sigue siendo la **fuente de entrada**, pero los datos fluyen a través de capas progresivas de calidad hasta llegar a marts analíticos consumibles por el dashboard y la API.

```
Excel (.xlsx)
    │
    ▼ POST /api/v1/ingest
┌─────────────────────────────────┐
│ BRONZE (inmutable, append-only)  │
│  bronze.ingestion_batches        │  ← un registro por archivo
│  bronze.raw_excel_rows           │  ← un registro por fila de Excel
└─────────────────────────────────┘
    │
    ▼ pipeline/silver.ts → runSilverTransform()
┌─────────────────────────────────┐
│ SILVER (normalizado, upsert)     │
│  silver.dim_client               │  ← maestro de clientes canónico
│  silver.dim_employee             │  ← maestro de colaboradores
│  silver.dim_asset                │  ← activos con scores calculados
│  silver.fact_movements           │  ← eventos discretos por activo
│  silver.fact_asset_snapshot      │  ← foto mensual del parque
└─────────────────────────────────┘
    │
    ▼ gold.refresh_all() — SQL function
┌─────────────────────────────────┐
│ GOLD (vistas calculadas desde Silver)  │
│  gold.governance_summary         │  ← quality score, DG score
│  gold.quality_kpis               │  ← completitud por campo
│  gold.movements_quality          │  ← gaps por hoja de origen
│  gold.asset_risk                 │  ← risk score + bonus movimientos
│  gold.financial_summary          │  ← valor parque por CPU/cliente/año
│  gold.forecast                   │  ← clasificación de renovación
│  gold.park_quality               │  ← score 0-100 del parque
└─────────────────────────────────┘
    │
    ▼ API REST
┌─────────────────────────────────┐
│ asset-governance (dashboard)     │
│  GET /api/v1/gold/governance     │
│  GET /api/v1/gold/quality        │
│  GET /api/v1/gold/forecast       │
└─────────────────────────────────┘
```

---

## Capa Bronze — Ingesta cruda

### Responsabilidad
Guardar cada fila del Excel exactamente como llega. Nunca modificar ni eliminar.

### Tablas

| Tabla | Propósito |
|---|---|
| `bronze.ingestion_batches` | Un registro por archivo xlsx cargado. Ciclo de vida de la ingesta. |
| `bronze.raw_excel_rows` | Un registro por fila de Excel × hoja. Inmutable. |

### Campos clave

```sql
bronze.raw_excel_rows
  batch_id          UUID     -- FK a ingestion_batches
  source_file       TEXT     -- '2brains1706.xlsx'
  source_sheet      TEXT     -- 'Equipos Asignados'
  sheet_row_number  INTEGER  -- número de fila (1-based)
  raw_data          JSONB    -- toda la fila como clave-valor
  row_hash          TEXT     -- MD5(raw_data) para deduplicación
  load_timestamp    TIMESTAMPTZ
```

### Deduplicación incremental

Antes de insertar una fila, Bronze calcula su `row_hash = MD5(raw_data::text)`. Si el hash ya existe para esa hoja y archivo, la fila se marca como `rows_skipped`. Esto permite recargar el mismo Excel sin generar duplicados.

### Invariantes Bronze
- NUNCA `UPDATE` ni `DELETE` sobre `raw_excel_rows`
- SIEMPRE generar un nuevo `batch_id` por archivo (incluso si es el mismo filename)
- `status` empieza en `running`, termina en `success` o `failed`

---

## Capa Silver — Normalización

### Responsabilidad
Leer filas Bronze y producir modelos limpios y tipados. Toda la lógica de negocio vive aquí.

### Funciones de normalización (SQL + TypeScript espejado)

| Función SQL | Función TS | Qué hace |
|---|---|---|
| `silver.normalize_serial(raw)` | `normalizeSerial()` | Strip + uppercase del serial |
| `silver.normalize_cpu(raw)` | `normalizeCpu()` | Familia canónica de chip |
| `silver.normalize_estado(raw)` | `normalizeEstado()` | Enum `tb_asset_status` |
| `silver.normalize_client(raw)` | `normalizeClient()` | Nombre canónico de cliente |
| `silver.calc_quality_score(...)` | `calcQualityScore()` | 0-100, 9 campos críticos |
| `silver.calc_risk_score(...)` | `calcRiskScore()` | 0-100 asset risk |
| `silver.calc_renovation_score(...)` | `calcRenovationScore()` | 0-100 urgencia de renovación |
| `silver.calc_valor_dep(...)` | `calcValorDep()` | Depreciación lineal 5 años |

### Tablas Silver

**`silver.dim_asset`** — Registro maestro por activo (PK: `serial`)
- Upsert en cada ingesta: los datos frescos sobreescriben los anteriores
- Incluye todos los scores calculados: `risk_score`, `risk_nivel`, `calidad_dato`, `score_renovacion`
- FK a `dim_client` y `dim_employee` para integridad referencial

**`silver.fact_movements`** — Eventos por activo (PK: `movement_id`)
- Append-only: los movimientos no se modifican
- `movement_id` es determinístico: mismos datos → mismo ID → no duplicados
- `riesgo_percibido_it`: campo ML target, llenado por el equipo IT
- `es_inferido`: marca los eventos derivados del estado actual (no registros directos)

**`silver.fact_asset_snapshot`** — Foto mensual del parque (PK: `(snapshot_date, serial)`)
- Generado por `POST /api/v1/snapshot` o el cron mensual
- Habilita: "¿Cómo era el parque hace 3 meses?"

### Regla de deduplicación Silver

El pipeline Silver nunca reprocesa filas Bronze ya procesadas. Usa la tabla `ops.checkpoints` para recordar el último `row_hash` procesado por hoja.

---

## Capa Gold — Vistas analíticas

### Responsabilidad
Exponer datos listos para consumo. Calculados en tiempo real desde Silver.

### Vistas

| Vista | Fuente | Propósito |
|---|---|---|
| `gold.governance_summary` | `fact_movements` | Quality Score, DG Score, niveles de madurez |
| `gold.quality_kpis` | `fact_movements` | Completitud por campo con semáforo |
| `gold.movements_quality` | `fact_movements` | Gaps por hoja de origen con prioridad |
| `gold.asset_risk` | `dim_asset + fact_movements` | Risk Score + bonus de movimientos |
| `gold.financial_summary` | `dim_asset` | Valor del parque por CPU, cliente, año |
| `gold.forecast` | `dim_asset` | Clasificación de renovación por reglas |
| `gold.park_quality` | `dim_asset` | Score 0-100 del parque (5 componentes) |

### Fórmulas clave

**Quality Score (movimientos):**
```
quality_score = serial×0.35 + fecha×0.35 + gestor×0.15 + cliente×0.15
```

**Data Governance Score:**
```
dg_score = serial×0.20 + fecha×0.20 + cliente×0.15 + gestor×0.20 + riesgo_it×0.15
```

**Asset Risk Score:**
```
base   = antigüedad(30) + estado(25) + ciclos_bateria(20) + cpu_legacy(15) + ram(10)
bonus  = baja_registrada(+15) + recuperacion(+10) + n_movimientos≥4(+8)
risk_v2 = min(100, base + bonus)
```

**Park Quality Score:**
```
park_quality = calidad_datos×0.30 + integridad_serial×0.25 + salud_parque×0.20
             + riesgo_renovacion×0.15 + cobertura_cliente×0.10
```

---

## Capa Ops — Trazabilidad de pipeline

### Tablas

| Tabla | Propósito |
|---|---|
| `ops.pipeline_runs` | Log de cada ejecución del pipeline |
| `ops.ingestion_errors` | Errores por fila de Excel |
| `ops.checkpoints` | Estado de carga incremental por hoja |
| `ops.quality_snapshots` | Historial de métricas de calidad |
| `ops.api_request_log` | Log de llamadas API (particionado) |

### Vista de monitoreo

```sql
-- Estado de las últimas 20 ejecuciones
select * from ops.pipeline_status;
```

---

## API Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/v1/ingest` | Cargar xlsx → Bronze → Silver → Gold |
| `GET` | `/api/v1/pipeline/status` | Estado de las últimas 20 ejecuciones |
| `POST` | `/api/v1/snapshot` | Generar snapshot mensual/manual |
| `GET` | `/api/v1/gold/governance` | DG Score + Quality Score |
| `GET` | `/api/v1/gold/quality` | KPIs completitud + gaps por hoja |
| `GET` | `/api/v1/gold/forecast` | Forecast renovación + top risk |

### Uso típico: carga mensual

```bash
# 1. Cargar el nuevo Excel
curl -X POST /api/v1/ingest \
  -F "file=@2brains_julio2026.xlsx" \
  -F "loaded_by=Daniel Vargas"

# 2. Verificar estado del pipeline
curl /api/v1/pipeline/status

# 3. Generar snapshot mensual
curl -X POST /api/v1/snapshot \
  -H "Content-Type: application/json" \
  -d '{"snapshot_kind": "monthly"}'

# 4. Verificar governance
curl /api/v1/gold/governance
```

---

## Roadmap ML (desde la arquitectura de datos)

| Período | Hito | Prerrequisito de datos |
|---|---|---|
| Jul–Nov 2026 | Acumular 6 snapshots reales | Checklist mensual ejecutado |
| Jul–Nov 2026 | Completar `riesgo_percibido_it` | Equipo IT evaluando cada movimiento |
| Dic 2026 | Asset Risk ML v1 | 100+ registros con `riesgo_percibido_it` |
| Mar 2027 | Forecast ML v1 | 12+ snapshots con tendencia real |

El campo `riesgo_percibido_it` en `silver.fact_movements` es el **ground truth del ML supervisado**. Cada movimiento completado con este campo es un registro de entrenamiento.
