# Catastro Hardware MTR

Plataforma operacional y analítica para gestión de parque TI, conciliación MTR/Jira, planeación de compra, auditoría y priorización operacional basada en datos.

---

# 📌 Qué es Catastro

Catastro nació como una necesidad operacional real:

- entender el estado actual del parque TI,
- reconciliar diferencias entre inventario físico y workflow administrativo,
- visualizar presión de stock,
- priorizar renovaciones,
- reconstruir históricos operacionales,
- y transformar movimientos MTR en decisiones concretas.

Hoy Catastro funciona como un **Command Center TI**, integrando:

- Inventario operativo vivo
- Timeline histórico MTR
- Conciliación Jira / MTR
- Planeación y renovación
- Auditoría multi-fuente
- Señales ML de priorización
- KPIs operacionales ejecutivos
- Proyección y presión de compra

---

# 🧠 Filosía Operacional

Catastro sigue una regla central:

> MTR representa la verdad física del parque.  
> Jira representa el workflow administrativo.

El objetivo NO es esconder diferencias entre fuentes, sino hacerlas visibles y operables.

---

# 🚀 Módulos Principales

## 🏠 Command Center

Vista ejecutiva consolidada:

- Parque operativo actual
- Alertas críticas
- Riesgo operacional
- Conciliación
- Señales ML
- Presión de stock
- KPIs globales

---

## 💻 Activos

Vista operacional viva del parque:

- Equipos asignados
- Disponibles
- Bajas
- Conciliación Jira/MTR
- Cola operacional priorizada
- Severidad y alertas
- Filtros dinámicos
- Estado real por SKU
- Ficha de equipo con especificaciones técnicas consolidadas

---

## 📊 Estadísticas

Capa analítica mensual e histórica:

- Ingresos y salidas
- Movimientos físicos
- Reutilización
- Presión de compra
- Distribución de stock
- Evolución mensual
- KPIs operacionales
- Base inicial de sostenibilidad y huella por equipo

---

## 🕓 Timeline Operacional

Reconstrucción histórica completa del parque:

- Evolución mensual
- Recuperaciones
- Reutilización
- Gaps operacionales
- Cambios internos
- Heatmaps operacionales
- Balance histórico

---

## ⚠️ Operación y Alertas

Mesa de control operacional:

- Inconsistencias Jira/MTR
- SLA y aging
- Alertas críticas
- Backlog operacional
- Casos degradados
- Conciliación visible

---

## 🛒 Planeación de Compra

Planeación operacional y financiera:

- Renovaciones
- Modelos legacy
- Presión de compra
- Gap confirmado
- Gap proyectado
- CAPEX referencial
- Stock heredado
- Recomendaciones ejecutivas

---

## 🤖 ML v2

Priorización operacional basada en Machine Learning:

- Scores de riesgo
- Priorización operacional
- Explainability
- PCA
- Clustering
- Señales de comportamiento anómalo

> ML v2 NO reemplaza decisiones de negocio ni MTR.  
> Funciona como una capa de apoyo operacional.

---

## 🧾 Auditoría

Trazabilidad formal multi-fuente:

- Before / After
- Actor
- Fuente
- Criticidad
- Confianza
- Timeline auditado

Fuentes soportadas:

- MTR
- Jira
- Google Sheets
- Excel reparados
- Catastro interno

---

# 🏗️ Arquitectura

## Frontend

- Next.js
- TypeScript
- TailwindCSS
- App Router
- SSR + Proxy interno

---

## Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- APIs REST
- Integración Jira
- Integración Google Sheets

---

## Analytics

- dbt
- Modelado dimensional
- marts operacionales
- staging MTR
- reconciliación multi-fuente
- capa técnica de especificaciones por equipo (`stg_equipo_specs` → `int_equipo_specs_normalized` → `mart_equipo_specs`)
- capa inicial de sostenibilidad por equipo (`stg_equipo_sustainability_inputs` → `int_equipo_carbon_matched` → `int_equipo_carbon_calculated` → `mart_equipo_sustainability`)

---

## Infraestructura

- Docker
- Kubernetes (kind)
- Port-forwarding local
- Deploys locales

---

# 🗂️ Estructura General

```bash
catastro_hardware_mtr/
│
├── backend/
│   ├── routers/
│   ├── services/
│   ├── data_access/
│   └── main.py
│
├── web/
│   └── catastro-web/
│       ├── src/app/
│       ├── src/components/
│       └── src/lib/
│
├── dbt_catastro/
│   ├── models/
│   ├── marts/
│   ├── staging/
│   └── snapshots/
│
├── scripts/
├── docker/
└── k8s/
```
## 🔌 Fuentes de Datos

Catastro integra múltiples fuentes operacionales:

| Fuente | Uso |
|---|---|
| MTR | Estado físico del parque |
| Jira | Workflow administrativo |
| Google Sheets | Asignaciones y conciliación |
| Excel Reparados | Reparaciones y trazabilidad |
| ML Scores | Priorización operacional |

---

## 📈 Casos de Uso

- Gestión de parque TI
- Renovación tecnológica
- Conciliación operacional
- Seguimiento de onboarding
- Recuperación y reutilización
- Planeación de compra
- Auditoría operacional
- Priorización TI
- Reporting ejecutivo

---

## ⚙️ Variables de Entorno

```env
DATABASE_URL=
NEXT_PUBLIC_API_BASE=
API_BASE_INTERNAL=
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
GOOGLE_SERVICE_ACCOUNT_FILE=
MTR_GOOGLE_SPREADSHEET_ID=
```
---

## ☸️ Kubernetes

Catastro puede ejecutarse localmente sobre `kind`.

### Servicios comunes

```bash
kubectl get pods -n catastro

kubectl port-forward svc/catastro-backend 18000:8000 -n catastro

kubectl port-forward svc/catastro-web 52345:3000 -n catastro
```

---

## 📌 Roadmap

### Próximos pasos

- Motor de decisiones operacional
- Explainability avanzada
- Consolidación runtime único
- Forecast predictivo
- Timeline visual avanzado
- Planeación multi-empresa
- Alertas en tiempo real
- Integración IAM / SSO
- Dashboard financiero completo

---

## 🧭 Visión

Catastro busca transformarse en una plataforma integral de operación TI:

- Visible
- Trazable
- Explicable
- Auditable
- Accionable

No sólo mostrar datos.

Sino ayudar a operar mejor.

---

## 👩‍💻 Autor

Desarrollado por **Deejaay Brain**.

“Pain and suffering are always inevitable for a large intelligence and a deep heart.”

— Fyodor Dostoevsky, *Crime and Punishment*
