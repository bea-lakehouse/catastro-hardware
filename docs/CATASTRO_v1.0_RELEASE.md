# Catastro v1.0 Release

Fecha de emision: `2026-06-25`

Estado del documento:

Fotografia oficial del proyecto inmediatamente antes de la promocion controlada hacia Cloud SQL.

## 1. Resumen Ejecutivo

`Catastro v1.0` es la linea operacional estable de la plataforma de gestion de parque TI. Su objetivo es unificar inventario fisico, workflow administrativo, conciliacion MTR/Jira, historico operativo, compras, planeacion, calidad de datos, cierres mensuales y senales ML en una sola superficie de trabajo.

Alcance actual:

- operacion diaria del parque TI;
- lectura ejecutiva y operacional del estado actual;
- compras 2026 y planeacion asociada;
- reconstruccion historica de movimientos;
- alertas, auditoria y calidad de datos;
- cierres mensuales persistidos;
- soporte analitico y de priorizacion ML.

Estado del proyecto:

- linea operacional `Catastro Operacional v1.0` congelada como contrato estable desde `2026-06-17`;
- snapshot de liberacion pre-promocion Cloud preparado al `2026-06-25`;
- arquitectura actual estable en produccion local, con promocion a Cloud documentada mediante base paralela y rollback por conexion;
- piloto Medallion implementado y reconciliado en el dominio `Calidad de Datos`.

Fecha de congelamiento para esta liberacion:

- congelamiento arquitectonico v1.0: `2026-06-17`
- fotografia oficial pre-promocion Cloud: `2026-06-25`

Version propuesta:

- `v1.0`

## 2. Arquitectura

Componentes principales:

- Backend: `FastAPI` en [backend/main.py](/Users/bea/Desktop/Catastro/backend/main.py:1), con routers para Home, Compras, Cierres, Operacion, Calidad, ML, Sync y Estadisticas.
- Frontend: `Next.js` App Router en [web/catastro-web/src/app](/Users/bea/Desktop/Catastro/web/catastro-web/src/app), con `31` paginas detectadas.
- Persistencia: `PostgreSQL`, con schemas operativos y analiticos como `raw`, `analytics`, `ops`, `ml`, `bronze`, `silver`, `gold` y remanentes `activos`.
- Transformacion analitica: `dbt` en [dbt_catastro](/Users/bea/Desktop/Catastro/dbt_catastro), con `112` modelos SQL detectados.
- Arquitectura Medallion: piloto paralelo implementado para `Calidad de Datos` con `bronze`, `silver` y `gold`.
- ML: superficie publica principal bajo `/ml/v2`, con senales `v2` y campos `v3` integrados en la mart operativa actual.
- Dashboard Ejecutivo: Home y Resumen Ejecutivo consumen contratos FastAPI sobre marts consolidadas.

Flujo de datos actual:

```text
Google Sheets MTR ----\
Jira -------------------> raw.* ------------------------------\
Seeds y backfills -----> analytics.stg -> int -> core -> marts ---> FastAPI ---> Next.js
                                                            \
ops.monthly_closures ----------------------------------------> API / Cierres
ml.vw_scores_v2_latest + int_ml_scores_v3_latest -----------> marts / ML / Home

Piloto Medallion paralelo:
analytics.mart_data_quality_* <-> bronze -> silver -> gold
```

Lectura por capas:

- `raw`: captura y trazabilidad de fuentes sincronizadas.
- `analytics.stg`: normalizacion inicial y compatibilidad operativa.
- `analytics.int`: reglas canonizantes y deduplicacion.
- `analytics.core`: hechos base de movimientos, compras y planeacion.
- `analytics.mart_*`: consumo operacional, ejecutivo y analitico.
- `bronze/silver/gold`: linea Medallion paralela aun no conectada a consumidores productivos.

## 3. Componentes funcionales

- `Home`: command center ejecutivo-operacional con parque visible, riesgo, conciliacion, auditoria diaria y salud del refresh.
- `Equipos`: listado operacional y detalle por equipo, con ficha canonica, timeline y auditoria.
- `Compras 2026`: lectura ejecutiva y operacional de compras detectadas, conciliacion documental, impacto en planeacion y forecast.
- `Planeacion`: proyeccion de cobertura, gap de compra, backlog, presion y acciones sugeridas.
- `Historico`: reconstruccion mensual del parque y de los movimientos MTR.
- `Timeline`: lectura cronologica de eventos por equipo y timeline visual dentro del historico.
- `Estadisticas`: movimientos, rotacion, resumen mensual, asignaciones y cortes historicos.
- `Alertas`: mesa operacional de inconsistencia, criticidad, SLA, aging y confianza.
- `Calidad de datos`: resumen e issues de completitud, confianza, error y observacion.
- `ML`: scores, explainability, comparacion de versiones y ranking de riesgo.
- `Resumen Ejecutivo`: corte exportable en PDF con parque, ejecucion, planeacion y salud del refresh.
- `Cierres`: persistencia y consulta del snapshot mensual oficial.
- `Auditoria`: before/after, fuente, actor, criticidad y trazabilidad multi-fuente.
- `Ejecucion`: cola operativa y seguimiento de casos.

## 4. Estado de datos

Los valores siguientes representan el estado congelado esperado previo a la promocion Cloud, basado en la validacion de cierre de junio 2026 y en la comparacion del estado local corregido contra la copia `ti_opsv1`.

Parque y marts base:

- `analytics.mart_equipos_estado_actual`: `361` equipos visibles.
- `analytics.mart_data_quality_summary`: snapshot `2026-06-22`, `360` equipos evaluados, `95.09%` completitud, `76.29%` confianza, `18` registros con error y `70` observados.

Compras 2026 confirmadas:

- enero 2026: `36`
- febrero 2026: `20`
- abril 2026: `20`
- junio 2026: `25`
- acumulado 2026 confirmado: `101`

Lectura junio 2026:

- compras junio: `25`
- compras junio Mac: `15`
- compras junio Windows: `10`
- movimientos junio en `mart_estadistica_movimientos_mes_v2`: `22` ingresos / `8` salidas
- historia junio en `mart_catastro_historia_mensual`: `22` ingresos / `8` salidas / balance `14`

Contexto mensual inmediato:

- mayo 2026 en `mart_estadistica_movimientos_mes_v2`: `27` ingresos / `12` salidas
- mayo 2026 en `mart_catastro_historia_mensual`: balance `15`

Sync y cierre:

- `raw.sync_runs`: `max_run_id = 141`
- ultimo run visible: `2026-06-24 17:50:15 -04` aprox
- `ops.monthly_closures`: `1` cierre persistido
- ultimo mes cerrado: `2026-05-01`

Otras referencias validadas:

- `raw.mtr_google_sheet_rows`: `3179` filas
- `raw.jira_issues`: `650` filas
- `analytics.mart_mtr_jira_reconciliacion`: `653` filas
- `analytics.mart_operacion_alertas`: `1150` alertas abiertas, `171` criticas

## 5. Estado dbt

Inventario actual detectado:

- modelos SQL: `112`
- staging: `36`
- intermediate: `14`
- core: `4`
- marts: `52`
- modelos Medallion: `6`
- tests SQL: `20`
- archivos de seed y metadatos en `dbt_catastro/seeds`: `36`
- seeds de datos: `33` CSV + `1` XLSX

Marts y dominios relevantes:

- parque actual: `mart_equipos_estado_actual`
- conciliacion: `mart_mtr_jira_reconciliacion`
- alertas: `mart_operacion_alertas`
- calidad: `mart_data_quality_summary`, `mart_data_quality_issues`
- compras: `mart_compras_2026_confirmadas_resumen_mes`, `mart_compras_2026_parque_detectado`
- planeacion: `mart_forecast_compras`, `mart_planeacion_*`
- historico: `mart_catastro_historia_eventos`, `mart_catastro_historia_mensual`
- cierres: `ops.monthly_closures`

Arquitectura Medallion vigente:

- `bronze.brz_data_quality__summary_snapshot`
- `bronze.brz_data_quality__issues_snapshot`
- `silver.slv_data_quality_snapshot`
- `silver.slv_data_quality_issues`
- `gold.gld_data_quality__summary`
- `gold.gld_data_quality__issues`

Estado funcional dbt:

- la capa `analytics` sigue siendo el contrato operacional principal;
- Medallion ya existe, pero aun no reemplaza el consumo legacy;
- la deduplicacion MTR corregida vive en `stg_mtr_eventos_clean` e `int_mtr_eventos_dedup`;
- los tests de compras, movimientos mayo/junio y Medallion forman parte del set critico previo a promocion.

## 6. Estado ML

Version observable en producto:

- superficie publica principal: `ML v2`
- senales adicionales en consumo actual: `ML v3`

Estado del pipeline:

- `v2` sigue siendo la interfaz dominante de consulta y explicacion;
- `v3` se integra a traves de `int_ml_scores_v3_latest` y de campos embebidos en `mart_equipos_estado_actual`;
- `v3` aun depende de la mart operativa actual y no de una capa Silver propia;
- el proyecto incluye servicios de composicion de payload y summary en [backend/services/ml_v3.py](/Users/bea/Desktop/Catastro/backend/services/ml_v3.py:1).

Endpoints principales de ML:

- `GET /ml/v2/scores`
- `GET /ml/v2/explain/{id_equipo}`
- `GET /estadisticas/ml-score-resumen`
- `GET /estadisticas/ml-risk-summary`
- `GET /estadisticas/ml-version-comparison`
- `GET /estadisticas/ml-risk-equipos`

Estado esperado de ML v3 previo a promocion:

- no debe quedar todo nulo;
- distribucion validada en el estado local corregido:
  - `Alta`: `129`
  - `Media`: `24`
  - `Baja`: `201`
  - `null`: `7`
- fuentes visibles:
  - `analytics.mart_equipos_estado_actual`: `354`
  - `analytics.mart_equipos_estado_actual_missing`: `7`

## 7. API

Principales endpoints utilizados por la aplicacion:

- `GET /health`
- `GET /health/data-platform`
- `GET /home/dashboard`
- `GET /home/equipos`
- `GET /home/kpis`
- `GET /estadisticas/home-resumen-v3`
- `GET /estadisticas/home-activos`
- `GET /estadisticas/equipos`
- `GET /equipos/dashboard`
- `GET /equipos/{id_equipo}`
- `GET /equipos/{id_equipo}/ficha-canonica`
- `GET /equipos/{id_equipo}/timeline`
- `GET /operacion/resumen`
- `GET /operacion/alertas`
- `GET /operacion/sla`
- `GET /operacion/confianza`
- `GET /calidad-datos/resumen`
- `GET /calidad-datos/issues`
- `GET /compras/resumen-2026`
- `GET /compras/documentos`
- `GET /compras/parque-2026`
- `GET /compras/forecast`
- `GET /estadisticas/planeacion-acciones`
- `GET /estadisticas/planeacion-gap-compra`
- `GET /estadisticas/planeacion-compras-resumen`
- `GET /estadisticas/planeacion-parque`
- `GET /estadisticas/movimientos-mes`
- `GET /estadisticas/resumen-operacion-mensual`
- `GET /estadisticas/catastro-historico`
- `GET /cierres`
- `GET /cierres/{mes}`
- `POST /cierres/ejecutar`
- `GET /ejecucion/queue`
- `GET /api/sync/runs`
- `GET /api/sync/health/details`

## 8. Decisiones arquitectonicas

- No sobrescribir `ti_opsv1` in-place.
  Motivo: preservar evidencia historica y evitar un restore destructivo sobre la copia Cloud actual.

- Promocion mediante base paralela `ti_opsv2_candidate`.
  Motivo: validar import, dbt, UI y datos antes de cualquier cutover.

- Rollback por `DATABASE_URL`.
  Motivo: hacer la vuelta atras por cambio de conexion, sin borrar la base candidata ni tocar el baseline.

- Mantener `analytics.mart_*` como contrato operacional v1.0.
  Motivo: Home, Activos, Operacion, Compras, Calidad y ML dependen de esos contratos hoy.

- Implementar Medallion en paralelo y por dominios.
  Motivo: desacoplar sin big bang y exigir reconciliacion real antes de migrar consumidores.

- Separar `bronze`, `silver` y `gold` para el piloto de Calidad de Datos.
  Motivo: demostrar trazabilidad, reproducibilidad y convivencia con legacy sin romper el runtime.

- Corregir deduplicacion MTR por `run_id`, `row_number` y `source_row_key`.
  Motivo: estabilizar mayo/junio 2026 y sostener la historia mensual con una regla deterministica.

- Mantener MTR como verdad fisica y Jira como workflow administrativo.
  Motivo: principio operacional central documentado en `README.md`.

## 9. Riesgos conocidos

Limitaciones actuales:

- fuerte dependencia de `mart_equipos_estado_actual` como pieza central del sistema;
- relaciones legacy y objetos auxiliares fuera del DAG formal de dbt;
- coexistencia de seeds manuales, backfills, snapshots y tablas heredadas;
- ML v3 aun acoplado a la mart operativa actual;
- promocion Cloud aun no ejecutada ni verificada contra la instancia final.

Deuda tecnica pendiente:

- desacoplar contratos FastAPI de tablas fisicas legacy;
- ampliar Medallion a dominios troncales mas alla de Calidad;
- reducir dependencias manuales en compras, planeacion y backfills;
- formalizar observabilidad y automatizacion de promociones;
- fortalecer pruebas CI sobre endpoints y datasets criticos.

Mejoras futuras claras:

- CI/CD para promotion y rollback;
- scheduler formal para refresh y cierres;
- monitoreo de freshness y drift;
- feature store o Silver dedicada para ML;
- reconciliacion mas fuerte de entidades canonicas como usuario, cliente y area.

## 10. Roadmap

Propuestas para la siguiente version:

- automatizacion de promociones hacia Cloud SQL con validaciones previas y posteriores;
- pipeline CI/CD para `dbt`, `typecheck`, `lint` y smoke tests de API;
- monitoreo de sync MTR/Jira y de freshness de marts;
- expansion Medallion a compras, movimientos, planeacion y cierre;
- mejora de ML v3 para independizarlo de la mart operativa;
- observabilidad de datos con alertas de drift y fallas de reconciliacion;
- mejoras de dashboard ejecutivo sobre snapshot mensual y comparativos cerrados.

## 11. Estado de liberacion

Estado:

`Catastro v1.0 listo para promocion controlada hacia Cloud SQL mediante procedimiento documentado.`
