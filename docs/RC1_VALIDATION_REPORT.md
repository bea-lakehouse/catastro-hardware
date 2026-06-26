# RC1 Validation Report

Fecha de validacion: `2026-06-25`

Base candidata evaluada: `ti_opsv2_candidate`

Estado final RC1: `NOT READY FOR CUTOVER`

## Resumen ejecutivo

RC1 avanzo correctamente en acceso Cloud SQL, validacion SQL base y smoke test general de la aplicacion candidata, pero no cumple todavia los criterios de aprobacion para cutover.

Lo positivo:

- `ti_opsv2_candidate` responde por `psql` via proxy local.
- las validaciones SQL principales cuadran con la snapshot aprobada para compras y movimientos:
  - equipos visibles SQL: `361`
  - compras 2026 acumuladas: `101`
  - compras junio 2026: `25`
  - movimientos junio 2026: `22 ingresos / 8 salidas`
  - balance junio 2026: `14`
  - `monthly_closures`: `1`
  - reconciliacion SQL: `653`
  - DQ snapshot: `95.09 / 76.29`
  - ML scoreado: `361 equipos`
- backend y frontend levantaron en modo candidato sin tocar `ti_opsv1`.

Bloqueadores vigentes:

- `dbt build` termina con `4 errors`.
- `dbt test` termina con `12 errors`.
- el dashboard y algunos modulos no muestran una lectura consistente con la snapshot aprobada:
  - Home muestra `355` equipos.
  - Activos muestra `362`.
  - SQL validado muestra `361`.
  - Resumen Ejecutivo vuelve a mostrar `355`.
- `/estadisticas` queda detenido en `Cargando runtime operacional` incluso con apertura directa y espera extendida.

## Checklist RC1

- [x] Recuperar acceso a Cloud SQL y documentar el metodo usado.
- [x] Ejecutar `VALIDATION_QUERIES.sql` contra `ti_opsv2_candidate`.
- [x] Ejecutar `dbt deps`.
- [x] Ejecutar `dbt seed`.
- [x] Ejecutar `dbt build`.
- [x] Ejecutar `dbt test`.
- [x] Levantar backend candidato apuntando solo a `ti_opsv2_candidate`.
- [x] Levantar frontend candidato apuntando solo a `ti_opsv2_candidate`.
- [x] Recorrer modulos principales en modo smoke test.
- [ ] Obtener consistencia ejecutiva total entre SQL aprobado, backend y dashboards.
- [ ] Dejar sin errores los modelos y tests criticos de dbt.
- [ ] Aprobar RC1 para cutover.

## Metodo de acceso y entorno

Metodo usado para recuperar acceso a Cloud SQL:

- rotacion controlada de la credencial del usuario PostgreSQL `postgres`;
- actualizacion segura de `.env.cloud_candidate` para usar el proxy local;
- conexion validada via `cloud-sql-proxy` en `127.0.0.1:9470`;
- no se modifico `DATABASE_URL` productivo;
- no se modifico `ti_opsv1`.

Referencia base:

- [CLOUD_READY_STATE_2026-06-25.md](/Users/bea/Desktop/Catastro/docs/CLOUD_READY_STATE_2026-06-25.md)

## Resultados SQL

Evidencia:

- [validation_queries_ti_opsv2_candidate_2026-06-25.txt](/Users/bea/Desktop/Catastro/docs/rc1/validation_queries_ti_opsv2_candidate_2026-06-25.txt)

Resultados principales:

- `total_equipos = 361`
- compras 2026:
  - enero: `36`
  - febrero: `20`
  - abril: `20`
  - junio: `25`
  - acumulado 2026: `101`
- movimientos:
  - mayo: `27 / 12`, balance `15`
  - junio: `22 / 8`, balance `14`
- DQ snapshot `2026-06-22`:
  - completitud `95.09`
  - confianza `76.29`
  - errores `18`
  - observados `70`
- alertas SQL:
  - abiertas `1150`
  - criticas `171`
- reconciliacion SQL: `653`
- `monthly_closures = 1`, ultimo `2026-05-01`
- `sync_runs.max_run_id = 142`
- ML v3:
  - scoreados `361`
  - `Alta 129`, `Media 24`, `Baja 201`, `null 7`

Diferencias detectadas:

- `sync_runs` ya no esta en `141`; el valor vigente validado es `142`.
- la snapshot de calidad usa `total_equipos = 360` al `2026-06-22`, mientras la mart operativa visible ya marca `361`.

## Resultados dbt

Evidencias:

- [dbt_build_ti_opsv2_candidate_2026-06-25.log](/Users/bea/Desktop/Catastro/docs/rc1/dbt_build_ti_opsv2_candidate_2026-06-25.log)
- [dbt_test_ti_opsv2_candidate_2026-06-25.log](/Users/bea/Desktop/Catastro/docs/rc1/dbt_test_ti_opsv2_candidate_2026-06-25.log)

Resumen:

- `dbt deps`: `PASS`
- `dbt seed`: `PASS` (`33 seeds`, `real 25.39s`)
- `dbt build`: `FAIL` (`PASS=569 WARN=7 ERROR=4 SKIP=2 TOTAL=582`, `real 81.60s`)
- `dbt test`: `FAIL` (`PASS=418 WARN=7 ERROR=12 TOTAL=437`, `real 38.82s`)

Errores de `dbt build`:

- `analytics.mart_acciones_vs_movimientos_mes`
- `analytics.stg_ml_features_equipos`
- `analytics.mart_equipos_estado_actual_v2`
- `analytics.mart_ranking_global_top`

Errores de `dbt test`:

- fallas ML:
  - `accepted_values_int_ml_scores_v3_latest_ml_source_available_v3__True`
  - `accepted_values_int_ml_scores_v3_latest_risk_level__Alta__Media__Baja`
  - `dbt_utils_expression_is_true_int_ml_scores_v3_latest_score_is_null_or_score_0_and_score_10_`
  - `not_null_int_ml_scores_v3_latest_entity_id`
  - `unique_int_ml_scores_v3_latest_entity_id`
- fallas marts/acciones:
  - `accepted_values_mart_alertas_acciones_prioridad__Alta__Media__Baja`
  - `not_null_mart_alertas_acciones_prioridad`
  - `not_null_mart_alertas_acciones_tipo_accion`
- fallas Medallion vs legado:
  - `medallion_gold_issues_matches_legacy_counts`
  - `medallion_gold_issues_identity_matches_legacy`
  - `medallion_gold_issues_priority_matches_legacy`
  - `medallion_gold_summary_matches_legacy`

Conclusion dbt:

- RC1 no es aprobable mientras existan errores de build y test en modelos criticos.

## Backend candidato

Validaciones observadas:

- `GET /health`: OK
- `GET /home/dashboard`: OK tecnico, pero con valores inconsistentes respecto de la snapshot aprobada
- `GET /compras/resumen-2026`: OK, consistente con `101` y `junio = 25`
- `GET /cierres`: OK, devuelve `1` cierre
- `GET /operacion/*`: OK despues de correccion critica

Correcciones criticas aplicadas durante RC1:

- [backend/routers/operacion.py](/Users/bea/Desktop/Catastro/backend/routers/operacion.py)
  - correccion de imports para evitar `ModuleNotFoundError`
- [backend/data_access/operacion.py](/Users/bea/Desktop/Catastro/backend/data_access/operacion.py)
  - correccion SQL en `FILTER` de agregacion SLA
- [backend/routers/home.py](/Users/bea/Desktop/Catastro/backend/routers/home.py)
  - correccion de sombra de variable que rompia el bloque `integrations`

Estado despues de las correcciones:

- Operacion deja de devolver el error SQL observado al inicio.
- Home deja de registrar la excepcion de `integrations`.
- Persisten diferencias funcionales de conteo en KPIs ejecutivos.

## Frontend candidato

Validaciones estaticas:

- `npm run typecheck`: `PASS`
- `npm run lint`: `PASS` con `7 warnings`, sin errores bloqueantes

Modulos validados en navegador:

- OK funcional:
  - Home
  - Equipos / Activos
  - Compras 2026
  - Planeacion
  - Historico
  - Operacion
  - Calidad
  - ML
  - Resumen Ejecutivo
  - Cierres
  - Auditoria
  - Ejecucion
- Bloqueado:
  - `Estadisticas` queda en `Cargando runtime operacional`

Inconsistencias funcionales visibles:

- Home:
  - `Activos totales = 355`
  - `Alertas criticas = 135`
- Activos:
  - lectura visible no cuadra con `361` SQL; en la revision se observaron `362` en la vista
- Operacion:
  - muestra `172` alertas criticas y `1150` abiertas
- Resumen Ejecutivo:
  - `Parque visible = 355`
- SQL validado:
  - `361` equipos
  - `171` alertas criticas
  - `653` reconciliacion

Conclusion frontend:

- la app candidata navega en general, pero la lectura ejecutiva no esta estable ni consistente entre modulos.

## Incidencias y riesgos

Incidencias bloqueantes:

- `dbt build` y `dbt test` con errores.
- inconsistencia de KPIs entre SQL, Home, Activos y Resumen Ejecutivo.
- modulo `Estadisticas` no usable en RC1.

Riesgos altos si se hiciera cutover ahora:

- exponer a negocio un dashboard con conteos distintos segun el modulo consultado;
- promover una base candidata con modelos dbt aun fallando;
- perder confianza en la trazabilidad del cierre junio 2026 aunque la capa SQL base este estable;
- introducir ruido operativo en comites de cierre por diferencias `355 / 361 / 362`.

## Evidencias

- [CLOUD_READY_STATE_2026-06-25.md](/Users/bea/Desktop/Catastro/docs/CLOUD_READY_STATE_2026-06-25.md)
- [VALIDATION_QUERIES.sql](/Users/bea/Desktop/Catastro/docs/VALIDATION_QUERIES.sql)
- [validation_queries_ti_opsv2_candidate_2026-06-25.txt](/Users/bea/Desktop/Catastro/docs/rc1/validation_queries_ti_opsv2_candidate_2026-06-25.txt)
- [dbt_build_ti_opsv2_candidate_2026-06-25.log](/Users/bea/Desktop/Catastro/docs/rc1/dbt_build_ti_opsv2_candidate_2026-06-25.log)
- [dbt_test_ti_opsv2_candidate_2026-06-25.log](/Users/bea/Desktop/Catastro/docs/rc1/dbt_test_ti_opsv2_candidate_2026-06-25.log)

## Recomendacion final

Recomendacion tecnica: `NOT READY FOR CUTOVER`

Condiciones minimas antes de reabrir aprobacion:

- dejar `dbt build` en verde para los modelos criticos;
- dejar `dbt test` sin fallas bloqueantes en ML, acciones y Medallion;
- resolver la inconsistencia de KPIs entre SQL y dashboards ejecutivos;
- dejar operativo el modulo `Estadisticas`;
- repetir smoke test completo sobre `ti_opsv2_candidate` y confirmar:
  - `361` equipos visibles
  - `101` compras 2026
  - `25` compras junio
  - `22 / 8` movimientos junio
  - `1` cierre mensual
  - reconciliacion visible coherente con SQL

Mientras estas condiciones no se cumplan, RC1 debe mantenerse abierto y sin cutover.
