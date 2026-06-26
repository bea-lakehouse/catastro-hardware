# CATASTRO MEDALLION ANALISIS 2026-06

Fecha: 2026-06-18

## 1. Veredicto arquitectonico

Catastro actual es migrable hacia una arquitectura Medallion, pero no debe migrarse con enfoque big bang.

El repositorio ya contiene una base analitica madura, con integraciones operativas reales, capa dbt extensa, backend FastAPI productivo y frontend Next.js consumiendo contratos activos. Sin embargo, la implementacion actual esta centrada en el schema `analytics` como capa unica de consumo y mezcla responsabilidades de ingesta, normalizacion, reconciliacion, enriquecimiento, reglas operativas, agregacion ejecutiva y compatibilidad legacy.

El diagnostico concluye que:

- `Catastro Operacional v1.0` debe permanecer congelado como linea estable.
- `Catastro Corporativo Medallion` debe construirse en paralelo, no encima del contrato actual.
- La transicion debe desacoplar progresivamente fuentes, entidades y contratos API antes de reemplazar cualquier `mart`.
- El principal riesgo no es dbt por si solo, sino el acoplamiento cruzado entre `dbt`, FastAPI, vistas legacy y agregaciones del frontend.

## 2. Estado actual de Catastro

Catastro actual opera como plataforma integrada de datos y operacion TI con cinco zonas de datos de facto:

- `raw`: eventos y cargas base de sincronizacion.
- `analytics`: staging, intermediate, core y marts operativos.
- `ml`: fuente de scoring ML externo.
- `ops`: seguimiento operacional y cierres.
- `activos`: esquema legacy historico.

La plataforma estable v1.0 ya fue congelada el 2026-06-17 como linea operacional estable.

Fortalezas actuales:

- Integracion real de fuentes operativas y administrativas.
- Capa dbt extensa y con dominio de negocio ya modelado.
- Marts utiles para operacion, auditoria, calidad, compras, planeacion, historico, ML y sostenibilidad.
- Frontend y backend ya expresan una narrativa operacional madura.

Debilidades actuales:

- Exceso de logica de negocio concentrada en `analytics.mart_*`.
- Capa `core` muy delgada para la cantidad de reglas existentes.
- Dependencias directas a tablas fisicas desde FastAPI.
- Presencia de relaciones legacy y vistas auxiliares fuera del DAG formal de dbt.
- Entidades clave como usuario, cliente y area aun no estan normalizadas como dimensiones canonicas.

Metricas estructurales detectadas:

- Modelos dbt SQL: 106
- Staging: 36
- Intermediate: 14
- Core: 4
- Marts: 52
- Endpoints backend detectados: 96
- Paginas Next.js detectadas: 31

## 3. Mapa de fuentes

### 3.1 Fuentes principales detectadas

#### Google Sheets MTR

Fuente operacional principal para parque visible y movimientos recientes.

Rangos detectados:

- `Equipos Asignados`
- `Equipos disponibles`
- `Ingresos`
- `Salidas`

Persistencia actual:

- `raw.mtr_google_sheet_rows`
- trazabilidad en `raw.sync_runs`

Uso actual:

- `stg_mtr_google_sheet_equipos_asignados`
- `stg_mtr_google_sheet_equipos_disponibles`
- `stg_mtr_google_sheet_ingresos`
- `stg_mtr_google_sheet_salidas`
- `stg_mtr_fechas_metricas`
- varios marts operativos e historicos

#### Jira

Fuente administrativa y de workflow.

Persistencia actual:

- `raw.jira_issues`
- `raw.raw_jira_webhook_events`

Uso actual:

- `stg_jira_issues`
- `stg_jira_webhook_events`
- `int_equipo_jira_rollup`
- `mart_mtr_jira_reconciliacion`
- `mart_operacion_alertas`
- `mart_equipo_audit_log`

#### Seeds manuales

Fuentes gobernadas dentro del repo.

Dominios detectados:

- planeacion de compras
- documentos de compras 2026
- capex referencial
- lifecycle override manual
- sostenibilidad y carbono
- costos estimados
- override manual de estadisticas
- reparaciones desde Excel convertido a seed
- semillas historicas de MTR normalizado

#### Cargas historicas y backfills

Fuentes heredadas o de soporte:

- `analytics.equipos_raw`
- `analytics.equipos_backfill`
- `analytics.mtr_1202_equipos_asignados_raw`
- `analytics.mtr_1202_equ_extranjero_raw`
- `analytics.historia_hw_raw`
- varias tablas `*_xlsx`

#### Compras 2026

Fuentes manuales y documentales:

- `compras_documentos_2026`
- `compras_documentos_2026_lineas`
- `capex_hardware_referencias`
- `planeacion_compras_manual`
- `compras_2026_equipos_manual`

#### Planeacion

Fuente principal:

- `planeacion_compras_manual`

Uso actual:

- `stg_planeacion_compras_manual`
- `fact_planeacion_compras`
- marts de planeacion, gap y forecast

#### ML scores

Fuentes detectadas:

- `ml.vw_scores_v2_latest`
- `analytics.ml_scores_v2_history`
- scoring v3 derivado sobre la mart operativa actual

#### Sostenibilidad

Fuentes curadas detectadas:

- `dim_oem_product_carbon_reports`
- `dim_device_power_profiles`
- `dim_grid_emission_factors_country_year`
- `dim_carbon_overrides_manual`

#### Auditoria

Fuentes detectadas:

- snapshots de Google Sheets
- Jira snapshot y webhook
- reparaciones
- conciliacion MTR/Jira
- trazas de sincronizacion

#### Otras fuentes detectadas

- `ops.case_tracking`
- `ops.case_tracking_events`
- `ops.monthly_closures`
- `activos.equipos`
- `activos.historia_hw`
- tablas y vistas auxiliares legacy fuera de dbt formal

### 3.2 Evaluacion de madurez de fuentes

- Alta madurez: MTR Google Sheets, Jira, planeacion manual, documentos compras 2026
- Madurez media: ML, sostenibilidad, cierres, auditoria
- Madurez baja o heterogenea: backfills historicos, vistas legacy, tablas auxiliares `*_xlsx`, esquema `activos`

## 4. Mapa de modelos dbt actuales

### 4.1 Capas actuales

#### Staging

La capa `staging` ya funciona como normalizacion inicial, pero mezcla staging puro con compatibilidad legacy.

Principales grupos detectados:

- MTR parque actual:
  - `stg_mtr_google_sheet_equipos_asignados`
  - `stg_mtr_google_sheet_equipos_disponibles`
  - `stg_mtr_equipos_asignados`
  - `stg_mtr_equipos_disponibles`
  - `stg_equipos`
  - `stg_equipos_enriched`
- MTR movimientos:
  - `stg_mtr_google_sheet_ingresos`
  - `stg_mtr_google_sheet_salidas`
  - `stg_mtr_ingresos`
  - `stg_mtr_salidas`
  - `stg_mtr_eventos_clean`
  - `stg_mtr_fechas_metricas`
- Jira:
  - `stg_jira_issues`
  - `stg_jira_webhook_events`
- Compras:
  - `stg_compras_documentos_2026`
  - `stg_compras_documentos_2026_lineas`
  - `stg_compras_2026_equipos_registrados`
  - `stg_compras_2025_raw`
- Planeacion:
  - `stg_planeacion_compras_manual`
- Specs:
  - `stg_equipo_specs`
- Sostenibilidad:
  - `stg_equipo_sustainability_inputs`
- DQ:
  - `stg_equipos_enriched__dq_missing_specs`
  - `stg_mtr_equipos_asignados_detalle__dq_*`
- Historico:
  - `stg_historia_hw`
  - `stg_reparaciones_excel`

#### Intermediate

La capa `intermediate` ya contiene logica canonizante util para Silver futura.

Modelos principales:

- `int_equipo_jira_rollup`
- `int_equipo_specs_normalized`
- `int_politica_equipos`
- `int_mtr_eventos_dedup`
- `int_mtr_eventos_dedup_stats`
- `int_presion_base`
- `int_presion_stock`
- `int_historia_asignaciones`
- `int_ml_scores_v2_latest`
- `int_ml_scores_v3_latest`
- `int_ml_scores_best_latest`
- `int_equipo_carbon_matched`
- `int_equipo_carbon_calculated`
- `int_funcion_por_equipo`

#### Core

La capa `core` es reducida y hoy no absorbe suficiente negocio.

Modelos detectados:

- `fct_movimientos_detalle`
- `fact_compras_2025`
- `fact_planeacion_compras`
- `fct_historia_hw`

#### Marts

La capa `marts` concentra la mayor parte del dominio de negocio.

Dominios principales:

- Operacion y parque:
  - `mart_equipos_estado_actual`
  - `mart_equipos_estado_actual_v2`
  - `mart_equipos_estado_actual_v3`
  - `mart_operacion_alertas`
  - `mart_operacion_sla`
  - `mart_alertas_acciones`
  - `mart_ranking_global`
- Reconciliacion y auditoria:
  - `mart_mtr_jira_reconciliacion`
  - `mart_equipo_audit_log`
  - `mart_timeline_eventos`
  - `mart_equipo_timeline`
  - `mart_equipo_timeline_v2`
  - `mart_historia_eventos`
  - `mart_catastro_historia_eventos`
- Historico y cierres analiticos:
  - `mart_catastro_historia_mensual`
  - `mart_catastro_historia_mensual_dimension`
  - `mart_parque_tendencias_mes`
- Compras:
  - `mart_compras_equipos_2026`
  - `mart_compras_equipos_resumen_mes`
  - `mart_compras_2026_parque_detectado`
  - `mart_compras_2026_parque_resumen_mes`
  - `mart_compras_2026_confirmadas_resumen_mes`
  - `mart_compras_mensual_mtr`
  - `mart_backlog_compras`
- Planeacion y forecast:
  - `mart_planeacion_compras_resumen_mes`
  - `mart_planeacion_compras_tendencia_mes`
  - `mart_planeacion_compras_tracking`
  - `mart_planeacion_con_compras`
  - `mart_planeacion_forecast_demanda_mes`
  - `mart_forecast_compras`
  - `mart_forecast_compras_base`
  - `mart_forecast_compras_3m`
  - `mart_forecast_compras_cliente_mes`
  - `mart_forecast_compras_os_mes`
  - `mart_ui_planeacion_series`
- Calidad:
  - `mart_confianza_dato`
  - `mart_data_quality_summary`
  - `mart_data_quality_issues`
- Specs y sostenibilidad:
  - `mart_equipo_specs`
  - `mart_equipo_sustainability`
- ML features y apoyo:
  - `fct_ml_features_equipos`

### 4.2 Observacion clave

`mart_equipos_estado_actual` es la mart central del sistema actual. Cumple simultaneamente funciones de:

- activo operativo visible
- punto de reconciliacion
- capa de enriquecimiento
- punto de entrada para ML
- fuente de Home
- fuente de Activos
- fuente de Operacion
- puente para Compras y Ficha de Equipo

Eso la convierte en la principal dependencia critica para cualquier migracion.

## 5. Mapa de entidades principales

### 5.1 Entidades canonicas detectadas en la practica

#### Equipo

Entidad principal del sistema.

Representaciones actuales:

- `stg_equipos`
- `stg_equipos_enriched`
- `mart_equipos_estado_actual`
- `mart_equipo_specs`
- `mart_equipo_sustainability`

#### Usuario

No existe como dimension formal.

Representaciones actuales:

- `persona_actual`
- `persona_asignada`
- `assignee_display_name`
- `reporter_display_name`

#### Cliente

No existe como dimension formal.

Representaciones actuales:

- `cliente`
- `cliente_actual`
- `cliente_mtr`
- `matched_cliente`

#### Area

No existe como dimension formal.

Representaciones actuales:

- `ambito_laboral`
- `tipo_colaborador`
- `segmento_destino`
- `perfil`

#### Movimiento

Representaciones actuales:

- `stg_mtr_ingresos`
- `stg_mtr_salidas`
- `fct_movimientos_detalle`
- `int_mtr_eventos_dedup_stats`
- `mart_historia_eventos`
- `mart_timeline_eventos`

#### Compra

Representaciones actuales:

- `fact_planeacion_compras`
- `mart_compras_equipos_2026`
- `mart_compras_equipos_resumen_mes`
- `mart_planeacion_con_compras`
- `mart_forecast_compras`

#### Ticket Jira

Representaciones actuales:

- `stg_jira_issues`
- `stg_jira_webhook_events`
- `int_equipo_jira_rollup`
- `mart_mtr_jira_reconciliacion`

#### Alerta

Representaciones actuales:

- `mart_operacion_alertas`
- `mart_alertas_acciones`
- `ops.case_tracking`

#### ML score

Representaciones actuales:

- `analytics.ml_scores_v2_history`
- `int_ml_scores_v2_latest`
- `int_ml_scores_v3_latest`
- columnas ML embebidas en `mart_equipos_estado_actual`

#### Forecast

Representaciones actuales:

- `mart_forecast_compras`
- `mart_forecast_compras_base`
- `mart_forecast_compras_3m`
- `mart_forecast_compras_cliente_mes`
- `mart_planeacion_forecast_demanda_mes`

#### Cierre mensual

Representacion actual:

- `ops.monthly_closures`

#### Calidad del dato

Representaciones actuales:

- `mart_confianza_dato`
- `mart_data_quality_summary`
- `mart_data_quality_issues`

#### Especificaciones tecnicas

Representaciones actuales:

- `stg_equipo_specs`
- `int_equipo_specs_normalized`
- `mart_equipo_specs`

#### Carbono / sostenibilidad

Representaciones actuales:

- `stg_equipo_sustainability_inputs`
- `int_equipo_carbon_matched`
- `int_equipo_carbon_calculated`
- `mart_equipo_sustainability`

### 5.2 Brecha estructural

Las entidades `usuario`, `cliente` y `area` todavia viven como atributos derivados o textos libres, no como dimensiones conformadas. Esa es una de las principales razones para introducir una capa Silver canonica.

## 6. Diagnostico backend FastAPI

### 6.1 Estado general

El backend FastAPI esta funcional y cubre operacion, historico, compras, calidad, ejecucion, salud, cierres, ML y sincronizaciones.

Hallazgos principales:

- 96 endpoints detectados.
- Fuerte dependencia a SQL embebido.
- Acoplamiento directo a `analytics.mart_*`, `analytics.stg_*`, `raw.*`, `ops.*` y algunas relaciones legacy.
- Existe una capa `data_access`, pero no cubre todo el backend ni abstrae completamente los contratos de datos.

### 6.2 Routers principales

Routers criticos:

- `backend/routers/estadisticas.py`
- `backend/routers/home.py`
- `backend/routers/compras.py`
- `backend/routers/equipos.py`
- `backend/routers/operacion.py`
- `backend/routers/catastro_historico.py`
- `backend/routers/sync.py`
- `backend/routers/cierres.py`

Hotspots por tamano:

- `estadisticas.py`: 6668 lineas
- `compras.py`: 1496 lineas
- `home.py`: 1251 lineas

### 6.3 Acoplamientos detectados

Acoplamientos directos relevantes:

- `mart_equipos_estado_actual` como fuente directa de multiples endpoints
- `mart_operacion_alertas` y `mart_operacion_sla` para Operacion
- `mart_compras_equipos_2026`, `mart_planeacion_con_compras`, `fact_planeacion_compras` para Compras
- `mart_equipo_audit_log` y `mart_timeline_eventos` para auditoria y ficha
- `mart_data_quality_*` para calidad
- `mart_catastro_historia_*` para historico

### 6.4 Duplicidad y superposicion

Se detectaron contratos duplicados o superpuestos:

- `GET /home/kpis` definido en dos routers
- `GET /estadisticas/modelos-criticos` definido dos veces
- `GET /equipos/{id_equipo}/timeline` expuesto por mas de un router

Esto aumenta el riesgo de migracion por ambiguedad de ownership.

### 6.5 Riesgos backend hacia Medallion

- Cambiar nombres de relations rompe SQL embebido.
- Cambiar columnas rompe serialization inmediata.
- Cambiar semantica de `mart_equipos_estado_actual` impacta mas de un dominio a la vez.
- Existen consultas a staging desde API productiva, lo cual dificulta separar Silver y Gold con fronteras claras.

## 7. Diagnostico frontend Next.js

### 7.1 Estado general

El frontend actual funciona como consola ejecutiva y operacional madura.

Hallazgos principales:

- 31 paginas detectadas.
- fuerte uso de `apiProxyGet` y `/api/proxy/*`
- composicion de dashboards mediante multiples endpoints concurrentes
- varios modulos grandes y de alto acoplamiento semantico

Modulos grandes:

- `src/app/page.tsx`: 2908 lineas
- `src/app/planeacion-compra/PlaneacionCompraView.tsx`: 3178 lineas
- `src/app/planeacion-compra/operativa/PlaneacionCompraView.tsx`: 2837 lineas
- `src/app/compras-2026/Compras2026Dashboard.tsx`: 1482 lineas
- `src/app/equipos/[id]/page.tsx`: 1071 lineas
- `src/app/historico-catastro/page.tsx`: 1037 lineas
- `src/app/excepciones/page.tsx`: 995 lineas
- `src/app/operacion/page.tsx`: 885 lineas

### 7.2 Paginas principales

Paginas troncales:

- Home
- Activos
- Operacion
- Compras 2026
- Planeacion compra
- Estadisticas
- Historico catastro
- Ficha de equipo
- Auditoria
- Calidad de datos
- Cierres
- Resumen ejecutivo
- ML v2

### 7.3 Dependencia de contratos actuales

Pantallas mas dependientes del shape actual:

- Home
- Activos
- Operacion
- Ficha de equipo
- Planeacion compra
- Compras 2026

Motivos:

- agregan varios endpoints simultaneos
- asumen nombres actuales de campos
- incluyen fallback semantico reconstruido desde contratos existentes
- dependen del comportamiento operacional de las marts actuales

### 7.4 Areas con menor friccion para consumir Gold

Las siguientes areas podrian migrar primero a Gold, con bajo riesgo relativo:

- Calidad de datos
- Cierres
- Resumen ejecutivo
- Parte de Compras y Forecast

Las siguientes deben ir al final:

- Home
- Activos
- Operacion
- Ficha de equipo

## 8. Dependencias ocultas y relaciones legacy

### 8.1 Hallazgo principal

El repositorio no depende solo de `ref()` y `source()`. Existen relaciones legacy, compat views y tablas auxiliares consultadas por nombre, fuera del DAG normal de dbt.

### 8.2 Dependencias ocultas detectadas

Ejemplos relevantes:

- `analytics.v_mtr0903_equipos_asignados_norm_compat`
- `analytics.v_tmp_mtr0903_equipos_asignados_norm`
- `analytics.mtr_equipos_asignados`
- `analytics.mtr_salidas_xlsx`
- `analytics.mtr_ingresos_xlsx`
- `analytics.mtr_equipos_asignados_xlsx`
- `analytics.tmp_mtr1903_*`
- `analytics.v_mtr1203_*`
- `analytics.bajas2703`
- `analytics."mtr_equipos_asignados.csv.from_MTR0602"`
- `analytics.equipos_backfill_xlsx`
- `activos.equipos`
- `activos.historia_hw`

### 8.3 Donde aparecen

Patrones observados:

- staging con fallback a vistas legacy
- marts con fallback a latest views historicas
- routers FastAPI que consultan tablas auxiliares directas
- scripts de carga historica que escriben al esquema `activos`

### 8.4 Implicancia arquitectonica

Antes de construir Bronze, se debe cerrar un inventario formal de relaciones no declaradas en dbt y de contratos backend que consumen relaciones legacy por nombre.

Sin eso, cualquier Medallion paralela corre riesgo de quedar incompleta o semanticamente inconsistente frente al estado real del sistema.

## 9. Propuesta Medallion

## 9.1 Bronze

Objetivo:

- preservar la fidelidad de cada fuente
- aislar la ingesta del modelado de negocio
- capturar eventos, snapshots, seeds gobernados y cargas historicas como materia prima

Propuesta de dominios Bronze:

- `bronze.raw_mtr`
- `bronze.raw_jira`
- `bronze.raw_compras`
- `bronze.raw_planeacion`
- `bronze.raw_ml`
- `bronze.raw_specs`
- `bronze.raw_sustainability`
- `bronze.raw_cierres`
- `bronze.raw_excepciones`

Responsabilidades Bronze:

- persistir ingestion cruda
- estandarizar metadata minima de carga
- versionar snapshot y trazabilidad
- no resolver reglas de negocio ni compatibilidad de consumo

## 9.2 Silver

Objetivo:

- construir entidades canonicas
- resolver identidad, deduplicacion y normalizacion
- separar negocio reusable de presentacion operativa

Propuesta de dominios Silver:

- `silver_equipos`
- `silver_usuarios`
- `silver_clientes`
- `silver_movimientos`
- `silver_compras`
- `silver_jira`
- `silver_planeacion`
- `silver_ml_scores`
- `silver_specs`
- `silver_sustainability`
- `silver_quality`

Responsabilidades Silver:

- claves canonicas de equipo
- normalizacion de cliente, usuario y area
- union de snapshots y eventos MTR
- normalizacion de workflow Jira
- compras documentales y compras detectadas con estados claros
- reglas de completitud y calidad reusables
- capa base para ML y forecast desacoplada de la mart actual

## 9.3 Gold

Objetivo:

- publicar datasets de consumo por dominio
- estabilizar contratos para API, dashboard y analitica avanzada

Propuesta de dominios Gold:

- `gold_operacion`
- `gold_activos`
- `gold_compras`
- `gold_planeacion`
- `gold_forecast`
- `gold_ml`
- `gold_sostenibilidad`
- `gold_cierres`
- `gold_data_quality`
- `gold_resumen_ejecutivo`

Responsabilidades Gold:

- metricas operativas listas para API
- vistas agregadas y semanticamente estables
- contratos ejecutivos y de dashboard
- features gobernadas para forecast y ML

## 10. Estrategia de transicion sin big bang

Principios de transicion:

- no reemplazar `analytics.mart_*` al inicio
- no romper contratos REST existentes
- no renombrar endpoints actuales en la primera fase
- construir Medallion paralela y reconciliar contra legacy

Estrategia propuesta:

1. Mantener `Catastro Operacional v1.0` como legacy estable.
2. Crear esquemas Medallion paralelos.
3. Reproducir primero Bronze y Silver sin consumidores productivos.
4. Construir Gold compatible por dominio.
5. Introducir vistas o adaptadores de compatibilidad si hace falta.
6. Migrar backend por endpoint, empezando por dominios menos sensibles.
7. Mantener frontend inicial consumiendo contratos actuales.
8. Solo despues de reconciliacion estable, decidir si algun endpoint se re-apunta a Gold.

Orden recomendado de migracion de consumo:

- primero: calidad, cierres, resumen ejecutivo, compras
- despues: historico, auditoria, forecast, ML
- al final: home, activos, operacion, ficha de equipo

## 11. Riesgos clasificados por severidad

### Critico

- `mart_equipos_estado_actual` concentra demasiadas responsabilidades y dependencias.
- Existen relaciones legacy ocultas fuera del DAG formal.
- El backend consulta relaciones fisicas por nombre en multiples routers.

### Alto

- Entidades `usuario`, `cliente` y `area` no estan conformadas.
- Hay duplicidad o superposicion de contratos API.
- Existen consultas productivas directas a staging.
- La compatibilidad actual depende de vistas auxiliares y fallbacks semanticos.

### Medio

- La capa `core` es demasiado delgada para absorber el negocio reusable.
- ML v3 depende de la mart operativa actual en vez de una Silver propia.
- El frontend recompone dashboards a partir de varios endpoints y fallbacks.
- El esquema `activos` sigue vivo como legado tecnico y semantico.

### Bajo

- La base documental del repo es suficiente para arrancar el diseno.
- Existen tests dbt por dominio que sirven como punto de partida para reconciliacion.

## 12. Roadmap por fases

### Fase 0: diagnostico y preparacion

- inventario formal de relaciones legacy ocultas
- matriz de contratos API actuales
- mapa de dependencias de `mart_equipos_estado_actual`
- definicion de naming y ownership de esquemas Medallion
- plan de reconciliacion legacy vs Medallion

### Fase 1: Bronze paralelo

- persistencia paralela por fuente
- trazabilidad uniforme de cargas
- metadata de freshness y lineage minima

### Fase 2: Silver canonico

- identidad canonica de equipos
- normalizacion de usuarios, clientes y areas
- consolidacion de movimientos, compras, Jira y calidad

### Fase 3: Gold compatible

- datasets de consumo por dominio
- primeras vistas compatibles para API
- reconciliacion numerica y semantica contra legacy

### Fase 4: migracion parcial de APIs

- mover primero dominios de menor riesgo
- introducir adaptadores de contratos
- medir regresion endpoint a endpoint

### Fase 5: forecast / ML sobre Gold

- features basadas en Silver y Gold
- desacople del scoring respecto de la mart operativa legacy

### Fase 6: documentacion y operacion

- runbooks
- catalogo de datasets
- ownership por dominio
- observabilidad de reconciliacion

## 13. Recomendacion final

La recomendacion es avanzar con Catastro Corporativo Medallion, pero como una nueva linea de trabajo paralela, con contratos versionados y reconciliacion explicita contra v1.0.

No se recomienda:

- renombrar marts actuales
- mover el frontend actual de una vez
- reemplazar `mart_equipos_estado_actual` en una sola iteracion
- mezclar implementacion Medallion con hardening legacy dentro del mismo cambio

Si se hace bien, Medallion permitira:

- separar ingestion de negocio
- conformar entidades reales
- estabilizar datasets Gold por dominio
- reducir deuda tecnica en backend
- habilitar forecast y ML sobre una base mas confiable

## 14. Regla de oro

`Catastro Operacional v1.0` queda como contrato legacy estable.

`Catastro Corporativo Medallion` se construye en paralelo.

Ninguna fase inicial de Medallion debe romper:

- marts legacy
- rutas backend actuales
- contratos API actuales
- frontend actual
- comportamiento esperado de la linea operacional congelada

## 15. Primer sprint recomendado

Este sprint es solo de preparacion. No incluye implementacion de Bronze, Silver, Gold ni cambios funcionales.

### 15.1 Inventario de relaciones legacy ocultas

Objetivo:

- enumerar todas las relaciones no declaradas via `ref()` o `source()`
- clasificar si son:
  - legacy critico
  - compat temporal
  - auxiliar descartable

Entregable:

- tabla maestra de relaciones ocultas con origen, consumidor, criticidad y plan de reemplazo

### 15.2 Matriz de contratos API actuales

Objetivo:

- listar endpoints actuales
- identificar fuente SQL principal
- identificar consumidor frontend
- clasificar sensibilidad al cambio

Entregable:

- matriz endpoint -> router -> relacion -> consumidor -> nivel de riesgo

### 15.3 Mapa de dependencias de `mart_equipos_estado_actual`

Objetivo:

- documentar todos los routers, `data_access`, paginas y marts que dependen de esta mart
- separar dependencias directas e indirectas

Entregable:

- mapa de impacto de la mart central operativa

### 15.4 Definicion de nombres de esquemas Bronze / Silver / Gold

Objetivo:

- cerrar convencion de naming antes de construir modelos
- decidir granularidad por schema, capa y dominio

Entregable:

- convencion oficial de nombres para:
  - schemas
  - modelos
  - vistas compatibles
  - datasets de publicacion

### 15.5 Plan de pruebas de reconciliacion legacy vs Medallion

Objetivo:

- definir como validar equivalencia numerica y semantica

Alcances minimos:

- parque total
- asignados
- disponibles
- bajas
- conciliacion MTR/Jira
- compras 2026
- planeacion
- alertas
- data quality
- cierres

Entregable:

- plan de pruebas con criterios de aceptacion, tolerancias y responsables

## Cierre

Catastro ya tiene suficientes piezas para evolucionar a Medallion, pero el exito depende de tratar la migracion como una separacion arquitectonica formal, no como una refactorizacion cosmetica.

La primera prioridad no es construir Bronze/Silver/Gold; es volver visible el mapa real de dependencias, contratos y relaciones legacy sobre el que hoy opera `Catastro Operacional v1.0`.
