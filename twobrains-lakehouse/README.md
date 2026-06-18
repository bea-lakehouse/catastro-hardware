# twobrains-lakehouse

Plataforma de datos Lakehouse para 2Brains Asset Governance.  
**INDEPENDIENTE de Catastro y asset-governance.**

## Separación arquitectónica

| Proyecto | Responsabilidad |
|---|---|
| `asset-governance` | Visualización y gobierno del dato (Next.js dashboard) |
| `twobrains-lakehouse` | Plataforma de datos Bronze / Silver / Gold |

## Base de datos

**Nombre:** `twobrains_assets`  
**Esquemas:** `bronze` · `silver` · `gold` · `ops`

## Stack

| Componente | Tecnología |
|---|---|
| Base de datos | Supabase / PostgreSQL |
| Lenguaje | TypeScript 5 + Node 22 |
| Parser Excel | SheetJS (xlsx) |
| Cliente DB | @supabase/supabase-js |

## Inicio rápido

```bash
npm install
npm run typecheck   # 0 errores esperados
npm run build       # compila a dist/
node scripts/validate_migrations.js  # 52/52 checks
```

## Configuración

```bash
cp .env.example .env
# Editar .env con credenciales de Supabase
```

## Ejecutar migraciones

En el SQL Editor de Supabase, ejecutar en orden:

```
supabase/migrations/001_create_schemas.sql
supabase/migrations/002_bronze_tables.sql
supabase/migrations/003_silver_tables.sql
supabase/migrations/004_gold_views.sql
supabase/migrations/005_ops_tables.sql
supabase/migrations/006_seed_initial_data.sql
```

## Estructura

```
supabase/migrations/     ← 6 archivos SQL (001–006)
src/
  types/index.ts         ← tipos TypeScript del schema
  utils/db.ts            ← cliente Supabase
  utils/normalize.ts     ← funciones de normalización (espejo de SQL)
  ingest/excel.ts        ← Bronze: xlsx → raw_excel_rows
  pipeline/silver.ts     ← Silver: Bronze → dim_asset + fact_movements
  api/routes.ts          ← handlers para POST /ingest, GET /gold/*
scripts/
  validate_migrations.js ← 52 checks de contenido SQL
docs/
  flow.md                ← documentación del flujo Excel → Bronze → Silver → Gold
```

## Flujo de carga

```
xlsx → ingest/excel.ts → bronze.raw_excel_rows
                       ↓
              pipeline/silver.ts
                       ↓
         silver.dim_asset + fact_movements
                       ↓
            gold.refresh_all() [SQL]
                       ↓
    gold.governance_summary + gold.asset_risk + ...
```

## API Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/ingest` | Cargar xlsx → pipeline completo |
| GET  | `/api/v1/pipeline/status` | Últimas 20 ejecuciones |
| POST | `/api/v1/snapshot` | Generar snapshot mensual |
| GET  | `/api/v1/gold/governance` | DG Score + Quality Score |
| GET  | `/api/v1/gold/quality` | KPIs completitud |
| GET  | `/api/v1/gold/forecast` | Forecast renovación |

## Datos del snapshot Jun 2026

| Métrica | Valor |
|---|---|
| Activos en Silver | 83 (con serial) |
| Movimientos | 139 |
| Snapshots | 84 |
| Quality Score | 61.4/100 |
| DG Score | 49.1/100 — Nivel 2 Controlado |
| Park Quality | 88.5/100 |
