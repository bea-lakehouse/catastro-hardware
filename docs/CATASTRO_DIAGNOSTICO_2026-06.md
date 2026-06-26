# Catastro - Diagnostico y roadmap (Junio 2026)

## Estado actual

Catastro ya funciona como una plataforma integrada de operacion TI con cuatro capas claras:

1. Ingesta y normalizacion en dbt desde Google Sheets MTR, Jira, seeds y cargas historicas.
2. Capa analitica en Postgres con marts operativas, historicas, de auditoria, planeacion, ML y sostenibilidad.
3. Backend FastAPI que expone contratos REST directamente sobre las marts.
4. Frontend Next.js que consolida vistas operativas y ejecutivas.

Fortalezas detectadas:

- El modelo de datos ya contiene piezas avanzadas: `mart_equipo_audit_log`, `mart_operacion_alertas`, `mart_confianza_dato`, `mart_catastro_historia_mensual`, `mart_equipo_specs`, `mart_equipo_sustainability`.
- El frontend ya tiene una narrativa ejecutiva y operacional coherente.
- dbt permite extender dominio sin reescribir el backend completo.

Debilidades detectadas:

- No existia un cierre mensual formal persistido.
- `dbt_catastro/snapshots/` estaba vacio; no habia congelamiento oficial de indicadores.
- Parte del DAG declarado en repo no siempre estaba materializado en la base al mismo tiempo.
- Hay modulos muy grandes y concentrados:
  - `backend/routers/estadisticas.py`: 6684 lineas
  - `backend/routers/home.py`: 1138 lineas
  - `web/catastro-web/src/app/page.tsx`: 2830 lineas
- No hay framework formal de migraciones; las tablas operativas se crean via SQL suelto.
- Existen varios fallbacks y compat layers, senal de deuda tecnica activa entre fuentes legacy y capa canonica.

## Implementado en este corte

### Prioridad 1 - Cierre operacional mensual

Se implemento:

- Tabla persistida `ops.monthly_closures`
- Servicio backend para ejecutar y persistir cierres
- Endpoints:
  - `GET /cierres`
  - `GET /cierres/{mes}`
  - `POST /cierres/ejecutar`
- Dashboard web:
  - `/cierres`
  - `/cierres/[mes]`

El cierre congela:

- parque total
- ingresos
- salidas
- compras
- conciliacion MTR/Jira
- alertas operacionales
- metricas ML
- KPI de calidad de datos

### Prioridad 2 - Data Quality Center

Se implemento:

- `analytics.mart_data_quality_issues`
- `analytics.mart_data_quality_summary`
- Endpoints:
  - `GET /calidad-datos/resumen`
  - `GET /calidad-datos/issues`
- Vista web:
  - `/calidad-datos`

Reglas activas:

- serial duplicado
- serial vacio
- equipo sin usuario
- equipo sin area visible
- equipo sin cliente
- fechas invalidas
- inconsistencia MTR vs Jira
- equipo sin especificaciones tecnicas completas

KPIs actuales validados el 2026-06-17:

- Parque evaluado: 355 equipos
- Completitud: 95.31%
- Confianza: 76.57%
- Registros con error: 18
- Registros observados: 70

## Brechas por prioridad

### P3 - Auditoria completa del equipo

Base existente:

- `mart_equipo_audit_log`
- `mart_equipo_timeline`
- `mart_timeline_eventos`

Brecha:

- Falta consolidar timeline de vida util del activo en una sola experiencia canonica para ficha de equipo.
- Falta incorporar compras asociadas como evento explicito del ciclo de vida.

### P4 - Compras 2026 v2

Base existente:

- marts de compras y planeacion ya separan parte del flujo documental.

Brecha:

- Aun falta un modelo de estados unificado y canonico:
  - Proyectado
  - Aprobado
  - Comprado
  - Recibido
  - Ingresado a MTR
  - Asignado

### P5 - Forecast inteligente

Base existente:

- ya hay marts de forecast y series UI.

Brecha:

- falta consolidar horizontes 3m/6m/12m, costo estimado, mezcla Mac/Windows y nivel de confianza en una sola salida ejecutiva.

### P6 - Especificaciones tecnicas y carbono

Base existente:

- `mart_equipo_specs`
- `mart_equipo_sustainability`

Brecha:

- falta mostrar score de completitud tecnica y score de carbono en ficha canonica del equipo.

### P7 - Roles y seguridad

Brecha critica:

- no hay RBAC real en backend ni frontend.
- los endpoints de alto impacto, como ejecucion de cierres, no tienen control de autorizacion.

### P8 - Cloud readiness

Brecha:

- existe documentacion parcial, pero no un blueprint productivo end-to-end para GCP.

### P9 - Documentacion profesional

Brecha:

- README principal orienta bien el producto, pero aun falta separar documentacion ejecutiva, de datos, APIs y operacion en piezas mas mantenibles.

### P10 - Dashboard ejecutivo

Base existente:

- `/resumen-ejecutivo`
- home con narrativa ejecutiva

Brecha:

- falta una vista dedicada para jefaturas que mezcle cierres, forecast, riesgo, calidad y carbono sin detalle tecnico.

## Riesgos tecnicos

1. Riesgo de crecimiento monolitico en routers y paginas principales.
2. Riesgo de inconsistencia entre DAG declarado y marts realmente materializadas.
3. Riesgo operacional por ausencia de RBAC.
4. Riesgo de regresion por exceso de logica SQL y UI dispersa sin capa de dominio intermedia.
5. Riesgo de deploy por falta de pipeline cloud formal y migraciones estandarizadas.

## Quick wins (< 1 dia)

1. Agregar verificadores de salud que contrasten relaciones dbt declaradas vs relaciones materializadas en Postgres.
2. Extraer helpers SQL repetidos (`_row`, `_rows`, `relation_exists`) a una capa comun del backend.
3. Dividir `estadisticas.py` por dominio: historico, forecast, activos, sostenibilidad.
4. Crear una card ejecutiva en Home que compare ultimo cierre vs snapshot actual.
5. Agregar una politica explicita para versionar seeds de compras y planeacion.
6. Añadir tests dbt minimos para compras v2 y conciliacion.

## Roadmap recomendado - 90 dias

### Fase 1 (dias 1-30)

- Operacionalizar cierre mensual con job agendado.
- Llevar calidad de datos a monitoreo semanal.
- Implementar RBAC minimo para lectura vs acciones sensibles.
- Separar `estadisticas.py` en routers de dominio.

### Fase 2 (dias 31-60)

- Construir ficha canonica del equipo con timeline de vida completo.
- Consolidar Compras 2026 v2 con estados reales y trazabilidad a MTR.
- Integrar score tecnico y score carbono en ficha del equipo.

### Fase 3 (dias 61-90)

- Consolidar forecast 3m/6m/12m en vista ejecutiva.
- Diseñar dashboard ejecutivo dedicado para jefaturas.
- Entregar blueprint productivo GCP:
  - Cloud SQL
  - Cloud Run o GKE
  - Artifact Registry
  - Cloud Build
  - Secret Manager
  - Monitoring

## Recomendacion de priorizacion

Seguir este orden:

1. Gobierno operativo del dato: cierres + DQ + RBAC
2. Vida completa del activo: auditoria/ficha canonica
3. Flujo real de compras: estados y recepcion
4. Planeacion futura: forecast ejecutivo
5. Productizacion cloud y documentacion final
