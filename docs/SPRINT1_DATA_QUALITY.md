# SPRINT 1 DATA QUALITY

Fecha: 2026-06-18
Snapshot reconciliado: 2026-06-17

## Dominio piloto

El primer piloto Medallion se ejecuto sobre `Calidad de Datos` porque era un dominio importante pero relativamente encapsulado respecto de Home, Activos y Ficha.

## Objetos Bronze / Silver / Gold creados

### Bronze

- `bronze.brz_data_quality__summary_snapshot`
- `bronze.brz_data_quality__issues_snapshot`

### Silver

- `silver.slv_data_quality_snapshot`
- `silver.slv_data_quality_issues`

### Gold

- `gold.gld_data_quality__summary`
- `gold.gld_data_quality__issues`

## Reconciliacion legacy vs Gold

El piloto se reconcilio contra:

- `analytics.mart_data_quality_summary`
- `analytics.mart_data_quality_issues`

Resultado:

- `total_equipos`: `355` legacy vs `355` gold
- `registros_con_error`: `18` legacy vs `18` gold
- `registros_observados`: `70` legacy vs `70` gold
- `completitud_pct`: `95.31` legacy vs `95.31` gold
- `confianza_pct`: `76.57` legacy vs `76.57` gold
- `issue_rows_total`: `88` legacy vs `88` gold
- `equipos_unicos`: `83` legacy vs `83` gold
- distribucion por prioridad: equivalencia exacta

Todos los deltas reportados fueron `0`.

## Pruebas dbt ejecutadas

- `dbt compile --select medallion`
- `dbt run --select medallion`
- `dbt test --select medallion`

Resultados:

- `run`: `PASS=6`, `ERROR=0`
- `test`: `PASS=51`, `WARN=0`, `ERROR=0`

## Resultado

El piloto demostro que:

- Medallion puede convivir con v1.0
- un dominio puede modelarse en paralelo sin romper contratos
- Gold puede reproducir fielmente el baseline legacy
- Silver puede introducir semantica canonica adicional sin exponerla todavia a consumidores productivos

## Decision arquitectonica

Sprint 1 valida la estrategia de construccion paralela.

Regla ratificada:

- no reemplazar legacy de inmediato
- construir Bronze y Silver por dominio
- exigir Gold reconciliado antes de cualquier adaptacion de API

## Salvedad importante

La semantica `issue_status` e `issue_state` en Silver se infirio porque el legacy actual no expone ciclo de vida real de resolucion. Esto no invalida el piloto, pero muestra que la canonizacion debe distinguir claramente entre snapshot actual e historial.
