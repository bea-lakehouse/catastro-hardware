# dbt_catastro – Post-mortem MTR0602  
## Normalización de movimientos, reconstrucción de marts y el “error del infierno”

Este documento registra **todos los errores críticos encontrados**, sus **causas reales** y las **soluciones aplicadas** durante la normalización de datos MTR0602 (ingresos, salidas, equipos asignados) y la reconstrucción completa de staging + marts en Postgres usando dbt.

Sirve como:
- Bitácora técnica
- Troubleshooting guide
- Base para refactorización futura (macros + tests)
- Contexto para rehacer o simplificar el frontend

---

## Contexto general

**Objetivo**
- Normalizar seeds `mtr_ingresos_norm`, `mtr_salidas_norm`, `mtr_equipos_asignados_norm`
- Construir staging (`stg_*`)
- Construir marts:
  - `mart_historia_eventos`
  - `mart_equipos_estado_actual`
- Validar estados reales (caso crítico: `SKU-374`)

**Stack**
- dbt 1.7.x
- Postgres
- CSV seeds con datos históricos inconsistentes (fechas + SKU)

---

## Línea de tiempo de errores y soluciones

---

### 1. Error de ruta dbt
**Error**

Invalid value for '--project-dir': Path 'dbt_catastro' does not exist


**Causa**
- Se ejecutó dbt **dentro** de `dbt_catastro` usando `--project-dir dbt_catastro`.

**Solución**
- Usar siempre:
```bash
--project-dir .
```
2. Error de recursos duplicados en seeds.yml

Error

dbt found two schema.yml entries for the same resource named mtr_ingresos_norm


Causa

Bloques - name: duplicados en seeds/seeds.yml.

Solución

Deduplicar YAML

Mantener un solo bloque por seed

Definir explícitamente column_types

3. id_equipo nulo en staging (100% de filas)

Síntoma

stg_mtr_ingresos / stg_mtr_salidas

con_equipo = 0

sin_equipo = total

Causa

SKUs venían:

vacíos

o como floats (41.0, 114.0)

Casts directos a bigint fallaban silenciosamente o anulaban datos

Solución

Normalización robusta de SKU:

case
  when sku::text ~ '^[0-9]+(\.0+)?$'
    then split_part(sku::text, '.', 1)::bigint
  else null
end

4. Error crítico de fechas MM/DD/YYYY

Error

date/time field value out of range: "01/25/2022"


Causa

El modelo asumía DD/MM/YYYY

Existían fechas MM/DD/YYYY

Solución

Parse robusto en staging y mart:

case
  when d1 > 12 then to_date(..., 'DD/MM/YYYY')
  when d2 > 12 then to_date(..., 'MM/DD/YYYY')
  else to_date(..., 'DD/MM/YYYY')
end

5. Error function ref(unknown) does not exist

Causa

Se escribió:

from ref('mtr_ingresos_norm')


Solución

Usar siempre Jinja:

from {{ ref('mtr_ingresos_norm') }}

6. Error al seedear: "41.0" is not a valid integer

Error

invalid input syntax for type integer: "41.0"


Causa

column_types forzaba integer/bigint

CSV traía floats como texto

Solución

Limpiar SKU antes de cast

Aplicado en:

mtr_ingresos_norm

mtr_salidas_norm

mtr_equipos_asignados_norm

7. mart_historia_eventos seguía rompiendo por SKU

Causa

SKU seguía llegando como "41.0" desde staging

Solución

Introducir sku_int robusto en staging

id_equipo siempre desde sku_int

8. Relación inexistente: stg_equipos_enriched

Error

relation "analytics.stg_equipos_enriched" does not exist


Solución

dbt run --select stg_equipos_enriched

9. Relación inexistente: int_politica_equipos

Solución

dbt run --select +int_politica_equipos

10. Error “fantasma”: dbt OK, pero SELECT COUNT(*) rompe

Error

invalid input syntax for type bigint: "10.0"


Causa real

stg_mtr_equipos_asignados tenía:

else 'SKU-' || sku::bigint


Solución

Reemplazar por cast robusto (regex + split)

Confirmado vía:

select pg_get_viewdef('analytics.stg_mtr_equipos_asignados'::regclass, true);

11. Caso funcional crítico: SKU-374

Síntoma

Evento SAL

Estado seguía como “Asignado / Disponible”

Causas

estado_operativo no consideraba SAL

estado_equipo priorizaba MTR sobre eventos

Soluciones

SAL ⇒ BAJA en estado_operativo

Nuevo criterio:

estado_equipo = coalesce(estado_equipo_eventos, estado_equipo_mtr)

Estado final validado
SKU-374
estado_equipo           = Baja
estado_equipo_mtr       = Asignado
estado_equipo_eventos   = Baja
estado_operativo        = BAJA
last_event_type         = SAL
last_event_date         = 2026-01-23

Golden path (reconstrucción segura)
# Seeds
dbt seed --select mtr_*_norm --full-refresh

# Staging
dbt run --select stg_mtr_ingresos stg_mtr_salidas stg_mtr_equipos_asignados

# Enriched
dbt run --select +stg_equipos_enriched

# Marts
dbt run --select +mart_equipos_estado_actual

Lecciones aprendidas

❌ Nunca castear SKU directo a bigint

❌ Nunca confiar en formato de fecha

❌ Nunca asumir que dbt OK == Postgres OK

✅ Siempre validar pg_get_viewdef

✅ Normalizar en staging, no en marts

✅ Estados operativos deben depender de eventos, no solo MTR
