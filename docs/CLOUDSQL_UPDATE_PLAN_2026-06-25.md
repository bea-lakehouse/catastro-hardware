# Cloud SQL `ti_opsv1` vs Catastro local corregido

Fecha de analisis: `2026-06-25`

## Objetivo

Comparar la copia Cloud SQL `ti_opsv1` contra el estado local corregido de Catastro y definir un plan seguro de actualizacion que:

- no sobrescriba evidencia historica;
- preserve trazabilidad;
- evite una carga destructiva sobre la copia cloud actual;
- permita validar la promotion antes del cutover.

## Metodo usado

1. Se intento conectar en solo lectura a la instancia remota definida en `.env.cloud`.
2. La conexion no respondio desde este entorno.
3. Como fallback seguro, se restauro `ti_ops.dump` en una base temporal local `ti_opsv1_compare`.
4. La comparacion se hizo entre:
   - `ti_ops` local corregida;
   - `ti_opsv1_compare`, copia restaurada del artefacto disponible.

Notas:

- `ti_ops.dump` fue creado el `2026-06-06 10:57:59 -04`.
- El dump contiene `dbname: ti_ops`, por lo que representa una copia anterior del sistema, adecuada como baseline de la nube para este analisis.
- Queda pendiente una validacion final contra la instancia remota real cuando exista conectividad.

## Hallazgos principales

## 1. Drift estructural

El estado local tiene objetos que no existen en la copia restaurada:

- `analytics.compras_2026_equipos_manual`
- `analytics.compras_documentos_2026`
- `analytics.compras_documentos_2026_lineas`
- `analytics.dim_carbon_overrides_manual`
- `analytics.dim_device_power_profiles`
- `analytics.dim_grid_emission_factors_country_year`
- `analytics.dim_oem_product_carbon_reports`
- `analytics.equipos_lifecycle_override_manual`
- `analytics.estadisticas_movimientos_override_manual`
- `analytics.mart_data_quality_issues`
- `analytics.mart_data_quality_summary`
- `analytics.mart_mtr_jira_reconciliacion`
- `analytics.mtr_salidas_manual`
- `analytics.planeacion_compras_manual`
- `analytics.reparaciones_raw`
- `analytics.stg_historia_hw`
- `bronze.brz_data_quality__issues_snapshot`
- `bronze.brz_data_quality__summary_snapshot`
- `gold.gld_data_quality__issues`
- `gold.gld_data_quality__summary`
- `ops.monthly_closures`
- `silver.slv_data_quality_issues`
- `silver.slv_data_quality_snapshot`

Resumen por schema:

- local:
  - `analytics`: `150`
  - `raw`: `9`
  - `ops`: `3`
  - `ml`: `1`
  - `bronze`: `2`
  - `silver`: `2`
  - `gold`: `2`
- copia:
  - `analytics`: `134`
  - `raw`: `9`
  - `ops`: `2`
  - `ml`: `1`

Conclusion:

- Cloud no esta solo atrasado en datos.
- Cloud esta atrasado en estructura, marts, seeds curadas, gobierno operativo y piloto Medallion.

## 2. Drift de raw y refresh

- `raw.sync_runs`
  - local: `141`
  - copia: `98`
- ultimo run visible
  - local: `2026-06-24 17:50:15 -04`
  - copia: `2026-06-06 09:30:29 -04`
- `raw.mtr_google_sheet_rows`
  - local: `3179`
  - copia: `3158`
- `raw.jira_issues`
  - local: `650`
  - copia: `640`

Conclusion:

- La copia cloud esta al menos `18` dias atrasada respecto del estado local corregido.
- Cualquier update segura debe tratar a `ti_opsv1` como snapshot historica y no como replica viva.

## 3. Drift funcional en marts criticas

### Compras 2026

`analytics.mart_compras_2026_confirmadas_resumen_mes`

- local:
  - enero: `36`
  - febrero: `20`
  - abril: `20`
  - junio: `25`
  - acumulado: `101`
- copia:
  - enero: `36`
  - febrero: `20`
  - abril: `19`
  - junio: `25`
  - acumulado: `100`

Conclusion:

- La copia cloud no contiene la resolucion final del conflicto `100 vs 102 vs 101`.
- Si se reutiliza para reporting, reintroduce una lectura ya descartada en cierre.

### Movimientos mayo/junio 2026

`analytics.mart_estadistica_movimientos_mes_v2`

- local:
  - mayo: `27 ingresos / 12 salidas`
  - junio: `22 ingresos / 8 salidas`
- copia:
  - mayo: `27 ingresos / 12 salidas`
  - junio: `16 ingresos / 3 salidas`

`analytics.mart_catastro_historia_mensual`

- local junio: `22 ingresos / 8 salidas / balance 14`
- copia junio: `16 ingresos / 3 salidas / balance 13`

Conclusion:

- La copia cloud no incorpora la correccion de deduplicacion MTR basada en `run_id`, `row_number` y `source_row_key`.
- Promoverla sin refresh correcto romperia el cierre mensual real.

### Parque actual

`analytics.mart_equipos_estado_actual`

- local: `361` equipos
- copia: `352` equipos

### Alertas

`analytics.mart_operacion_alertas`

- local abiertas: `1150`
- local criticas: `171`
- copia abiertas: `1498`
- copia criticas: `128`

Conclusion:

- La nube no solo tiene menos datos frescos; tambien produce una lectura operacional distinta.
- Esto sugiere drift en insumos, estructura o reglas disponibles.

### ML v3

Distribucion `ml_risk_level_v3`

- local:
  - `Alta`: `129`
  - `Media`: `24`
  - `Baja`: `201`
  - `null`: `7`
- copia:
  - `Alta`: `133`
  - `Media`: `19`
  - `Baja`: `192`
  - `null`: `8`

Conclusion:

- La nube no refleja el scoring actual del sistema.
- Dado que v3 depende del estado materializado de `mart_equipos_estado_actual`, una migracion insegura puede mezclar scoring viejo con marts nuevos.

## 4. Gobierno y trazabilidad

Objetos ausentes en la copia que son relevantes para gobierno:

- `ops.monthly_closures`
- `analytics.mart_data_quality_summary`
- `analytics.mart_data_quality_issues`
- `bronze.*`
- `silver.*`
- `gold.*`

Conclusion:

- La copia cloud no contiene ni el cierre operacional persistido ni el piloto Medallion de calidad.
- Un restore destructivo sobre `ti_opsv1` podria borrar la unica evidencia de ese estado cloud sin ganar trazabilidad.

## Riesgo de una actualizacion directa in-place

No se recomienda:

- restaurar encima de `ti_opsv1` con `pg_restore --clean`;
- ejecutar cargas parciales sobre la base cloud vieja;
- usar `ti_opsv1` como destino final de la migracion.

Riesgos:

1. perder evidencia historica de la copia cloud actual;
2. mezclar raw viejo con marts nuevos;
3. dejar la nube en un estado hibrido dificil de auditar;
4. destruir la posibilidad de comparar pre y post cutover;
5. reintroducir el estado de compras `100` y movimientos junio `16/3`.

## Plan seguro recomendado

## Fase 1 - Congelar la evidencia actual de Cloud

Objetivo:

- preservar `ti_opsv1` como evidencia historica antes de cualquier cambio.

Acciones:

1. Exportar `ti_opsv1` completa:
   - dump custom;
   - dump plain para import;
   - schema-only;
   - manifiesto con fecha, instancia, base y checksums.
2. Guardar el export en storage inmutable:
   - `gs://.../catastro/cloudsql/ti_opsv1/preupdate-2026-06-25/`
3. Marcar `ti_opsv1` como baseline historico:
   - no usarla como destino de restore;
   - mantenerla en modo solo lectura si es posible.

Recomendacion de naming:

- base actual: `ti_opsv1`
- evidencia exportada: `ti_opsv1_preupdate_2026-06-25`

## Fase 2 - Crear destino paralelo

Objetivo:

- evitar overwrite destructivo.

Acciones:

1. Crear una base nueva en la misma instancia o en otra instancia trial:
   - `ti_opsv2_candidate`
2. No reciclar `ti_opsv1`.
3. Importar ahi una snapshot fresca desde local usando:
   - `./scripts/export_ti_ops_snapshot.sh`

Artefactos esperados:

- `ti_ops_cloudsql.sql.gz`
- `ti_ops_local_restore.dump`
- `ti_ops_schema_only.sql`
- `manifest.txt`

## Fase 3 - Cargar el estado local corregido

Objetivo:

- promover el estado local ya validado, no reconstruirlo manualmente en Cloud.

Acciones:

1. Tomar snapshot desde `ti_ops` local despues del build/test exitoso del `2026-06-24`.
2. Importarla en `ti_opsv2_candidate`.
3. Si la estrategia es refresh posterior en cloud, hacerlo solo sobre `ti_opsv2_candidate`.
4. Nunca ejecutar refresh nuevo sobre `ti_opsv1`.

## Fase 4 - Validacion post-import

Objetivo:

- demostrar equivalencia funcional antes del cutover.

Validaciones minimas:

1. `raw.sync_runs`
   - max `run_id`
   - timestamp ultimo sync
2. `analytics.mart_compras_2026_confirmadas_resumen_mes`
   - debe quedar:
     - enero `36`
     - febrero `20`
     - abril `20`
     - junio `25`
     - acumulado `101`
3. `analytics.mart_estadistica_movimientos_mes_v2`
   - mayo `27/12`
   - junio `22/8`
4. `analytics.mart_catastro_historia_mensual`
   - junio `22 ingresos / 8 salidas / balance 14`
5. `analytics.mart_equipos_estado_actual`
   - conteo total cercano a `361`
   - ML v3 no todo nulo
6. `ops.monthly_closures`
   - debe existir
   - debe preservar el cierre persistido
7. `analytics.mart_data_quality_summary`
   - debe existir
8. `bronze`, `silver`, `gold`
   - deben existir si la promocion incluye el piloto Medallion

## Fase 5 - Cutover por configuracion, no por restore destructivo

Objetivo:

- cambiar el consumo de Catastro a la base nueva sin borrar la anterior.

Acciones:

1. Crear `.env.cloudsql.v2` apuntando a `ti_opsv2_candidate`.
2. Ejecutar Catastro contra esa base.
3. Validar UI y endpoints:
   - Home
   - Resumen ejecutivo
   - Compras 2026
   - Planeacion
   - Historico
   - Alertas
   - Cierres
4. Solo despues del pass funcional, apuntar los jobs/servicios a `ti_opsv2_candidate`.

## Fase 6 - Retencion y trazabilidad

Objetivo:

- no perder evidencia historica.

Acciones:

1. Mantener `ti_opsv1` al menos un ciclo mensual completo.
2. Mantener:
   - export preupdate;
   - manifest;
   - diff de validacion;
   - fecha de cutover;
   - responsable del cambio.
3. Registrar en documentacion operativa:
   - origen de la snapshot promovida;
   - fecha de freeze local;
   - resultados de dbt build/test;
   - resultados de comparacion contra `ti_opsv1`.

## Estrategia recomendada

La estrategia mas segura es:

1. `ti_opsv1` queda congelada como evidencia.
2. `ti_opsv2_candidate` recibe la snapshot local corregida.
3. El cutover se hace por `DATABASE_URL`, no por overwrite in-place.

## Veredicto

No se recomienda actualizar Cloud SQL con un restore directo sobre `ti_opsv1`.

La ruta segura es una promocion por base paralela porque:

- la copia actual esta estructuralmente atrasada;
- no contiene el cierre mensual persistido;
- no contiene el piloto Medallion;
- no refleja la correccion final de Compras 2026;
- no refleja la correccion final de movimientos junio 2026.

Actualizar por base paralela preserva:

- evidencia historica de la copia cloud original;
- trazabilidad del cambio;
- posibilidad de rollback real;
- validacion objetiva pre/post cutover.
