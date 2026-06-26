# Cloud Ready State - 2026-06-25

Fecha de preparacion: `2026-06-25`

Objetivo:

Dejar Cloud preparado para la promocion controlada de `Catastro v1.0` hacia `ti_opsv2_candidate`, sin modificar `ti_opsv1`, sin cambiar `DATABASE_URL` de produccion y sin ejecutar cutover.

## Resumen ejecutivo

Estado al cierre de esta preparacion:

- `ti_opsv1` sigue existiendo e intacta como baseline Cloud.
- se genero backup logico de `ti_opsv1` en bucket inmutable.
- se creo bucket de staging/backups porque el proyecto no tenia uno visible.
- se creo `ti_opsv2_candidate`.
- se subio la snapshot local corregida de Catastro v1.0 al bucket.
- se importo la snapshot en `ti_opsv2_candidate`.
- se ejecutaron validaciones tecnicas por query exportada desde Cloud SQL.
- no se ejecuto cutover.
- no se modifico `DATABASE_URL` productivo.

Estado final esperado y alcanzado parcialmente:

`Cloud preparado. ti_opsv2_candidate validada. ti_opsv1 intacta. Cutover pendiente de aprobación humana.`

Salvedad importante:

La validacion de aplicacion en modo candidato quedo bloqueada por credencial PostgreSQL Cloud desactualizada en los `.env` locales. El dato importado si quedo validado por consultas read-only ejecutadas desde el control plane.

## 1. Verificacion de entorno Cloud

Proyecto GCP activo:

- `catastro-mtr`
- cuenta activa en `gcloud`: `beatriz.herrera@acidlabs.com`

Instancia Cloud SQL:

- nombre: `free-trial-first-project`
- `connectionName`: `catastro-mtr:southamerica-west1:free-trial-first-project`
- motor: `POSTGRES_18`
- version instalada: `POSTGRES_18_3`
- region: `southamerica-west1`
- zona: `southamerica-west1-b`
- IP primaria: `34.176.173.98`
- estado inicial observado: `STOPPED`
- politica de activacion inicial observada: `NEVER`
- estado despues de preparacion: `RUNNABLE`
- politica de activacion final: `ALWAYS`

Usuario PostgreSQL visible desde control plane:

- `postgres` (`BUILT_IN`)

Bucket de staging y backups:

- no habia buckets visibles al inicio en el proyecto `catastro-mtr`
- bucket creado para esta preparacion:
  - `gs://catastro-mtr-cloud-promotions-20260625`

Conectividad desde entorno local:

- `gcloud` funciono correctamente contra GCP.
- `gcloud sql connect` logro levantar `cloud-sql-proxy` y alcanzar la instancia.
- la autenticacion SQL directa con las credenciales locales conocidas fallo para `postgres`.
- conclusion: conectividad de control plane OK, conectividad SQL con password actual PENDIENTE de regularizacion.

Permisos para import/export:

- export SQL estandar: OK
- export SQL con `--offload`: NO permitido en Free Trial Instance
- import SQL: OK
- acceso Cloud SQL al bucket: habilitado via `roles/storage.objectAdmin` al service account
  `p32891890993-rwpfhp@gcp-sa-cloud-sql.iam.gserviceaccount.com`

Estado actual de `ti_opsv1`:

- base listada en la instancia antes y despues de la preparacion.
- no se sobrescribio.
- no se ejecuto import sobre `ti_opsv1`.
- se respaldo a bucket antes de crear/importar nada en la base candidata.

## 2. Backup de seguridad de `ti_opsv1`

Resultado:

- `PASS`

Comando efectivo usado:

```bash
gcloud sql export sql free-trial-first-project \
  gs://catastro-mtr-cloud-promotions-20260625/catastro/backups/ti_opsv1/pre_cloud_promotion_2026-06-25/ti_opsv1_preupdate_2026-06-25.sql.gz \
  --project=catastro-mtr \
  --database=ti_opsv1
```

Intento descartado:

- `gcloud sql export sql ... --offload`
- fallo por restriccion del tipo `Free Trial Instance`

Backup generado:

- URI:
  `gs://catastro-mtr-cloud-promotions-20260625/catastro/backups/ti_opsv1/pre_cloud_promotion_2026-06-25/ti_opsv1_preupdate_2026-06-25.sql.gz`
- tamano:
  `1,639,495 bytes` (`1.56 MiB`)
- fecha objeto:
  `2026-06-25T18:56:27Z`
- resultado:
  `DONE`
- operacion Cloud SQL:
  `2235281e-70d3-439c-9881-c5fd0000004b`
- responsable:
  `Codex usando la cuenta gcloud beatriz.herrera@acidlabs.com`

Condicion de corte aplicada:

- no continuar si el backup fallaba
- esta condicion quedo satisfecha antes de crear/importar la base candidata

## 3. Preparacion de `ti_opsv2_candidate`

Resultado:

- `PASS`

Estado previo:

- `ti_opsv2_candidate` no existia

Accion ejecutada:

```bash
gcloud sql databases create ti_opsv2_candidate \
  --instance=free-trial-first-project \
  --project=catastro-mtr
```

Evidencia:

- operacion:
  `3697f36a-cc4e-4ece-846a-63df0000004b`
- resultado:
  `DONE`
- bases visibles despues:
  - `postgres`
  - `ti_opsv1`
  - `ti_opsv2_candidate`

Validacion:

- `ti_opsv1` siguio presente
- la candidata quedo lista para recibir import

## 4. Snapshot local corregida subida

Snapshot local usada:

- ruta local:
  [backups/ti_ops/20260625-112906](/Users/bea/Desktop/Catastro/backups/ti_ops/20260625-112906)
- generada con:
  `./scripts/export_ti_ops_snapshot.sh`

Artefactos locales:

- `ti_ops_cloudsql.sql.gz` (`1.5 MiB`)
- `ti_ops_local_restore.dump` (`2.9 MiB`)
- `ti_ops_schema_only.sql` (`1.5 MiB`)
- `manifest.txt`
- `checksums.sha256`

Checksums:

- `manifest.txt`: `57f01da387783061ef07175492d88f5c688e148228f9bc929f839cae08aec7ab`
- `ti_ops_cloudsql.sql.gz`: `54572f2460d29b716d40596762b247486511f298877a8923d820f6c592abd266`
- `ti_ops_local_restore.dump`: `045137909e8a3a0db20207f48305b395252680e382c67ccdccbd454c1aabf53b`
- `ti_ops_schema_only.sql`: `c10b126a880fc7cb44cc5b3070d7ccaeb93cb4e35081f117333287ee8265c40d`

Destino en bucket:

- prefijo:
  `gs://catastro-mtr-cloud-promotions-20260625/catastro/staging/ti_opsv2_candidate/20260625-112906/`

Objetos subidos:

- `checksums.sha256`
- `manifest.txt`
- `ti_ops_cloudsql.sql.gz`
- `ti_ops_local_restore.dump`
- `ti_ops_schema_only.sql`

Tamano total de staging:

- `6,149,688 bytes` (`5.86 MiB`)

## 5. Importacion en `ti_opsv2_candidate`

Resultado:

- `PASS`

Comando ejecutado:

```bash
gcloud sql import sql free-trial-first-project \
  gs://catastro-mtr-cloud-promotions-20260625/catastro/staging/ti_opsv2_candidate/20260625-112906/ti_ops_cloudsql.sql.gz \
  --project=catastro-mtr \
  --database=ti_opsv2_candidate \
  --quiet
```

Validaciones de destino:

- el destino indicado fue exactamente `ti_opsv2_candidate`
- `ti_opsv1` no fue usada como destino

Evidencia:

- operacion:
  `730c5285-2951-4228-a305-5d2c0000004b`
- inicio:
  `2026-06-25T19:09:16.050+00:00`
- fin:
  `2026-06-25T19:09:26.394+00:00`
- resultado:
  `DONE`

## 6. Validacion tecnica

## 6.1 Estado esperado de referencia

Snapshot local validada al preparar esta promocion:

- equipos visibles: `361`
- compras 2026:
  - enero: `36`
  - febrero: `20`
  - abril: `20`
  - junio: `25`
  - acumulado: `101`
- movimientos junio: `22 ingresos / 8 salidas`
- historia junio: `22 / 8 / balance 14`
- `monthly_closures`: `1`
- `mart_mtr_jira_reconciliacion`: `653`
- `mart_operacion_alertas` abiertas: `1150`
- DQ summary: `2026-06-22`, `360`, `95.09`, `76.29`

Desviacion detectada respecto a documentacion previa:

- `raw.sync_runs` en la snapshot local actual dio `142`, no `141`
- esto indica una corrida adicional posterior a la documentacion anterior
- la evidencia actual debe considerarse la fotografia valida para esta preparacion

## 6.2 Metodo de validacion en Cloud

Lo ejecutado:

- validaciones read-only mediante `gcloud sql export csv ... --query=...`
- lectura de resultados con `gcloud storage cat`

Lo no ejecutado:

- `psql` interactivo con usuario `postgres`
- `VALIDATION_QUERIES.sql` completo contra Cloud
- `dbt deps`
- `dbt seed/build/test` contra `ti_opsv2_candidate`

Motivo de lo no ejecutado:

- las credenciales locales conocidas para `postgres` en Cloud SQL no coinciden con la password activa
- el control plane de GCP si estuvo disponible y permitio validar datos criticos por queries exportadas

## 6.3 Resultados validados en `ti_opsv2_candidate`

Core metrics exportadas:

- `equipos_visibles = 361`
- `max_run_id = 142`
- `monthly_closures = 1`
- `ml_scoreados = 361`
- `reconciliacion_rows = 653`
- `alertas_abiertas = 1150`

Compras 2026:

- `2026-01-01,36,20,16,36`
- `2026-02-01,20,20,0,56`
- `2026-04-01,20,10,10,76`
- `2026-06-01,25,15,10,101`

Movimientos mayo/junio:

- `2026-05-01,27,12,27,12`
- `2026-06-01,22,8,22,8`

Historia y DQ:

- `historia,2026-05-01,27,12,15`
- `historia,2026-06-01,22,8,14`
- `dq,2026-06-22,360,95.09,76.29`

Presencia de objetos clave:

- `analytics.mart_compras_2026_confirmadas_resumen_mes`
- `analytics.mart_data_quality_summary`
- `analytics.mart_equipos_estado_actual`
- `analytics.mart_mtr_jira_reconciliacion`
- `ops.monthly_closures`

Conclusion tecnica:

- la importacion en `ti_opsv2_candidate` quedo alineada con la snapshot local corregida
- el unico delta relevante frente a la expectativa previa es `sync_runs = 142`, ya visible en la snapshot local actual

## 7. Validacion de aplicacion en modo candidato

Preparacion realizada:

- archivo preparado:
  [.env.cloud_candidate](/Users/bea/Desktop/Catastro/.env.cloud_candidate)
- target configurado:
  `ti_opsv2_candidate`

Estado:

- `PREPARADO PERO NO EJECUTADO`

No ejecutado:

- no se levanto backend en modo candidato
- no se levanto frontend en modo candidato
- no se validaron Home, Equipos, Compras 2026, Planeacion, Historico, Timeline, Estadisticas, Alertas, Calidad de datos, ML, Resumen Ejecutivo ni Cierres contra la base Cloud candidata

Motivo:

- la password activa de `postgres` en Cloud SQL no coincide con la referencia local disponible
- sin una credencial vigente no es seguro automatizar el modo candidato de aplicacion

## 8. Que se preparo

- instancia Cloud SQL llevada a estado utilizable (`RUNNABLE`)
- bucket de backups/staging creado
- permiso de bucket otorgado al service account de Cloud SQL
- backup logico de `ti_opsv1`
- `ti_opsv2_candidate` creada
- snapshot local corregida subida
- import completado en candidata
- validaciones tecnicas criticas ejecutadas
- `.env.cloud_candidate` preparado como referencia

## 9. Que se ejecuto

- `gcloud sql instances patch ... --activation-policy=ALWAYS`
- `./scripts/export_ti_ops_snapshot.sh`
- `gcloud storage buckets create ...`
- `gcloud storage buckets add-iam-policy-binding ...`
- `gcloud sql export sql ...`
- `gcloud sql databases create ti_opsv2_candidate`
- `gcloud storage cp ...`
- `gcloud sql import sql ...`
- `gcloud sql export csv ... --query=...`
- `gcloud storage cat ...`

## 10. Que NO se ejecuto

- no se modifico `ti_opsv1`
- no se ejecuto import sobre `ti_opsv1`
- no se hizo cutover
- no se cambio `DATABASE_URL` productivo
- no se borro ningun recurso
- no se corrio la aplicacion en modo candidato
- no se ejecutaron `dbt deps`, `dbt seed`, `dbt build`, `dbt test` contra la candidata
- no se ejecuto `VALIDATION_QUERIES.sql` completo por `psql` sobre Cloud

## 11. Estado de `ti_opsv1`

- sigue existiendo
- se respaldo antes de preparar la candidata
- no fue sobrescrita
- no fue usada como destino de import
- debe considerarse intacta al cierre de esta preparacion

## 12. Estado de `ti_opsv2_candidate`

- creada y visible en la instancia
- importada desde la snapshot local corregida
- validada tecnicamente en sus conteos y marts clave
- pendiente de validacion de aplicacion y de validacion SQL completa con credencial vigente

## 13. Riesgos pendientes

- credencial activa de PostgreSQL Cloud no coincide con `.env.cloud`
- sin credencial vigente no puede completarse validacion por `psql`, `dbt` ni modo candidato de la app
- la instancia se dejo `RUNNABLE` para continuidad de validacion; esto tiene costo operativo respecto al estado inicial `STOPPED`
- el proyecto usa una instancia `Free Trial`, lo que restringe algunas variantes de export como `--offload`

## 14. Pasos restantes para cutover

1. recuperar o rotar de forma controlada la credencial PostgreSQL vigente para Cloud SQL
2. ejecutar `VALIDATION_QUERIES.sql` completo contra `ti_opsv2_candidate`
3. ejecutar `dbt deps`, `dbt seed/build/test` si el procedimiento aprobado lo exige sobre la candidata
4. levantar backend/frontend con `.env.cloud_candidate`
5. validar modulos funcionales completos contra la candidata
6. solo despues, solicitar aprobacion humana explicita para cutover

## 15. Condicion de rollback

Mientras no haya cutover:

- el rollback operativo es trivial: seguir usando `ti_opsv1` como base activa y no cambiar `DATABASE_URL`

Si hubiese un cutover posterior y fallara:

- rollback por reconexion a `ti_opsv1`
- sin destruir `ti_opsv2_candidate`
- siguiendo [ROLLBACK_PLAN.md](/Users/bea/Desktop/Catastro/docs/ROLLBACK_PLAN.md)

## 16. Veredicto

Estado final:

`Cloud preparado. ti_opsv2_candidate validada. ti_opsv1 intacta. Cutover pendiente de aprobación humana.`
