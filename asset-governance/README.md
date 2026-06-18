# 2Brains Asset Governance Platform

Plataforma web independiente para gobierno del dato de activos 2Brains.  
Arquitectura Lakehouse Medallion: **Bronze → Silver → Gold**.

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15 (App Router) | Framework |
| TypeScript | 5 | Tipado estático |
| Tailwind CSS | 3 | Estilos |

## Inicio rápido

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # Build de producción
npx tsc --noEmit  # Verificar tipos
```

## Estructura

```
app/            → Páginas (resumen, medallion, bronze, silver, gold, gobierno, calidad, forecast)
components/     → AppShell, KpiCard, StatusCard, GovernanceComponents
lib/data/       → governance.ts · medallion.ts · quality.ts  (toda la lógica)
lib/types.ts    → Tipos TypeScript compartidos
```

## Datos actuales (Jun 2026)

| Métrica | Valor |
|---|---|
| Quality Score movimientos | 61.4/100 |
| Data Governance Score | 49.1/100 — Nivel 2 Controlado |
| Park Quality Score | 88.5/100 |
| Registros a corregir | 68 |
| Snapshots reales | 1 |

## Preparación para API

Reemplazar importaciones de `lib/data/` por `fetch('/api/v1/...')`.  
Los componentes no cambian — cero lógica de negocio en UI.

Endpoints diseñados: `/v1/quality` · `/v1/risk` · `/v1/forecast` · `/v1/snapshot` · `POST /v1/ingest`
