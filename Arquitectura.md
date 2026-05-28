# Arquitectura de Datos — Catastro

## Fuentes Originales

```text
FUENTES ORIGINALES
│
├── MTR Google Sheet
│   └── raw.mtr_google_sheet_rows
│       └── stg_mtr_google_sheet_equipos_asignados
│           └── stg_mtr_equipos_asignados
│               └── stg_equipos
│                   └── stg_equipos_enriched
│                       └── mart_equipos_estado_actual
│
├── MTR XLSX / CSV
│   ├── analytics.mtr_ingresos_xlsx
│   │   └── stg_mtr_ingresos
│   │
│   ├── analytics.mtr_salidas_xlsx
│   │   └── stg_mtr_salidas
│   │
│   ├── analytics.mtr_equipos_asignados
│   │   └── stg_mtr_equipos_asignados
│   │
│   └── analytics.mtr_equipos_disponibles
│       └── stg_mtr_equipos_disponibles
│
├── Jira / operación
│   └── fuentes Jira / issues / cambios
│       └── modelos de conciliación y operación
│           └── marts de auditoría, alertas y operación
│
└── ML / scoring
    └── features desde marts operacionales
        └── ml_scores_v2_history

## Capas Medallion

### 🥉 Bronze (Raw)

- MTR originales
- Google Sheets
- XLSX / CSV
- Jira exports
- Logs operacionales

### 🥈 Silver (Cleaned & Conformed)

- Staging models (`stg_*`)
- Integración de fuentes
- Normalización
- Reglas de negocio
- Conciliación operacional

### 🥇 Gold (Business Ready)

- Marts analíticos
- KPIs operacionales
- Dashboards ejecutivos
- Auditoría
- Planeación
- ML scoring
```
