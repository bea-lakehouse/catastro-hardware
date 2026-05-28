# Trial Cloud SQL para `ti_ops`

Objetivo: mantener `ti_ops` local como verdad actual y mover **solo una copia** a Google Cloud SQL para aprender, validar refresh y decidir después si conviene dejar Catastro ahí.

## Enfoque seguro

1. `ti_ops` local se mantiene intacta.
2. Se crea una snapshot local congelada.
3. Se importa esa snapshot a Cloud SQL.
4. Se prueba Catastro contra la copia cloud usando un `.env` alternativo.
5. Solo si todo sale bien se evalúa migración real.

## 1. Congelar la base local actual

Desde la raíz del repo:

```bash
./scripts/export_ti_ops_snapshot.sh
```

Eso crea una carpeta nueva en `backups/ti_ops/<timestamp>/` con:

- `ti_ops_cloudsql.sql.gz`
  Uso: importarlo en Cloud SQL.
- `ti_ops_local_restore.dump`
  Uso: restore rápido local con `pg_restore`.
- `ti_ops_schema_only.sql`
  Uso: inspección / validación.
- `manifest.txt`
  Uso: trazabilidad de la snapshot.

Este paso es el “freeze” operativo: desde aquí la base local queda respaldada y no se toca para la prueba cloud.

## 2. Crear la instancia de Cloud SQL

Documentación oficial:

- [Cloud SQL for PostgreSQL overview](https://docs.cloud.google.com/sql/docs/postgres?hl=es)
- [Create instances](https://docs.cloud.google.com/sql/docs/postgres/create-instance)
- [Import a SQL file](https://docs.cloud.google.com/sql/docs/postgres/import-export/import-export-sql)
- [Cloud SQL Auth Proxy](https://docs.cloud.google.com/sql/docs/postgres/connect-auth-proxy)

Configuración sugerida para la prueba:

- Motor: `PostgreSQL`
- Nombre instancia: `catastro-ti-ops-trial`
- Tamaño: el menor razonable para pruebas
- Región: cercana a Chile
- Base: `ti_ops_trial`
- Usuario: `catastro_trial`

## 3. Importar la copia

Sube `ti_ops_cloudsql.sql.gz` a un bucket de Cloud Storage y luego impórtalo a la instancia Cloud SQL.

La importación debe apuntar a:

- instancia: `catastro-ti-ops-trial`
- base: `ti_ops_trial`

## 4. Crear un `.env` solo para la copia cloud

Ejemplo:

```env
DATABASE_URL=postgresql://catastro_trial:TU_PASSWORD@TU_HOST:5432/ti_ops_trial
TI_OPS_DATABASE_URL=postgresql://catastro_trial:TU_PASSWORD@TU_HOST:5432/ti_ops_trial

GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
MTR_GOOGLE_SPREADSHEET_ID=tu_spreadsheet_id
MTR_GOOGLE_SHEET_RANGES={"equipos_asignados":"Equipos Asignados!A:ZZ","ingresos":"Ingresos!A:ZZ","salidas":"Salidas!A:ZZ"}

JIRA_BASE_URL=https://tu-org.atlassian.net
JIRA_EMAIL=tu-correo@empresa.com
JIRA_API_TOKEN=tu-token
JIRA_SYNC_HOURS_BACK=8760
JIRA_SYNC_MAX_RESULTS=2000
```

Guárdalo fuera de git, por ejemplo:

```bash
cp .env .env.cloudsql.trial
```

y luego reemplaza solo `DATABASE_URL` / `TI_OPS_DATABASE_URL` por la copia cloud.

## 5. Probar Catastro contra la copia cloud

Con el entorno alternativo:

```bash
./scripts/run_catastro_with_env.sh .env.cloudsql.trial
```

Eso ejecuta el mismo refresh de Catastro, pero contra la copia.

## 6. Qué validar

Antes de decidir migración real, revisar:

- el refresh completa Google Sheets + Jira + dbt
- `analytics.mart_equipos_estado_actual` se actualiza bien
- la UI carga igual que hoy
- Home, Activos, Operación, Planeación, ML, Histórico y Ejecución siguen coherentes
- los tiempos son razonables

## 7. Qué no hacer todavía

- no cambiar `engine.py` para apuntar fijo a Cloud SQL
- no eliminar `ti_ops` local
- no mover el scheduler definitivo a GitHub Actions todavía

## 8. Próximo salto si la prueba sale bien

1. normalizar scripts que aún usan `localhost`
2. dejar todos los accesos a Postgres por `DATABASE_URL`
3. mover el refresh a GitHub Actions
4. recién después decidir si la copia cloud pasa a ser la base principal
