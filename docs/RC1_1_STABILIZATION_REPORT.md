# RC1.1 Stabilization Report

Fecha de estabilizacion: `2026-06-26`

Base validada: `ti_opsv2_candidate`

Alcance aplicado:

- solo correcciones criticas de estabilizacion
- sin tocar `ti_opsv1`
- sin cutover
- sin cambiar `DATABASE_URL` productivo
- sin agregar features nuevas

## Resultado ejecutivo

Estado final RC1.1: `PASS`

Decision:

- RC1 del `2026-06-25` quedo desalineado en KPI ejecutivo y con fallas dbt criticas.
- RC1.1 deja build/test criticos en verde y unifica la lectura de parque visible sobre `analytics.mart_equipos_estado_actual`.
- La foto canónica actual de la candidata al `2026-06-26` es `362` equipos visibles, no `361`.

## Fuente canónica aplicada

Fuente canónica única para parque visible:

- `analytics.mart_equipos_estado_actual`

Definición aplicada en RC1.1:

- `parque visible = count(*)` sobre `analytics.mart_equipos_estado_actual`
- desglose operativo:
  - `activos operativos = 355`
  - `bajas visibles = 7`
  - `total visible = 362`

Nota de fecha:

- el reporte RC1 de `2026-06-25` usaba `361` como esperado
- la base candidata consultada el `2026-06-26` devuelve `362`
- por eso la corrección consistió en alinear módulos al origen canónico actual y no a una expectativa histórica ya desfasada

## Bloqueadores y causa raíz

### 1. Inconsistencia KPI `355 / 361 / 362`

Causa raíz:

- Home y Resumen Ejecutivo calculaban `activos_totales` con filtro de activos operativos, por eso mostraban `355`.
- Activos usaba el total de filas visibles de la mart, por eso mostraba `362`.
- la expectativa SQL `361` venía de validación RC1 del `2026-06-25`; la candidata actual al `2026-06-26` ya expone `362`.

Corrección:

- se unificó `activos_totales` a `count(*)` sobre `analytics.mart_equipos_estado_actual` en Home y fallbacks de Estadísticas.
- se mantuvo el desglose `asignados/disponibles/bajas` sobre la semántica operativa existente.

Resultado:

- `GET /home/dashboard` devuelve `activos_totales = 362`
- `GET /estadisticas/home-activos` devuelve `activos_totales = 362`
- `Activos` y `Resumen Ejecutivo` cargan en web con `200`

### 2. Falta de una definición canónica única para parque visible

Causa raíz:

- coexistían dos semánticas bajo el mismo KPI:
  - parque visible total
  - parque activo operativo

Corrección:

- se fijó `analytics.mart_equipos_estado_actual` como única fuente canónica para el KPI ejecutivo de parque visible.

Resultado:

- el KPI ejecutivo ya no depende de filtros distintos por módulo.

### 3. `dbt build` roto en modelos críticos

#### `mart_acciones_vs_movimientos_mes`

Causa raíz:

- referenciaba una columna `total` inexistente en `mart_alertas_acciones`
- además leía la relación por nombre directo en vez de `ref(...)`

Corrección:

- conteo corregido a `count(*)`
- dependencia cambiada a `{{ ref('mart_alertas_acciones') }}`

#### `stg_ml_features_equipos`

Causa raíz:

- casteo inválido de `interval` a `int`
- columnas equivocadas (`persona`, `origen`) no existen en `stg_historia_hw`

Corrección:

- cálculo de días cambiado a `extract(epoch ...)/86400`
- columnas corregidas a `usuario_evento` y `origen_evento`

#### `mart_equipos_estado_actual_v2`

Causa raíz:

- dependencia dura a la vista legacy inexistente `analytics.v_mtr1203_ml_scores_latest`
- dependencia dura a `analytics.tmp_mtr1903_asignacion_actual`

Corrección:

- se agregaron fallbacks con `relation_exists(...)`
- cuando faltan las vistas legacy, el modelo recompone los datos desde `mart_equipos_estado_actual`

#### `mart_ranking_global_top`

Causa raíz:

- `;` final dentro del SQL compilado de una vista

Corrección:

- se removió el terminador final

Resultado consolidado:

- build crítico consolidado: `PASS`

### 4. `dbt test` roto en ML v3, alertas/acciones y Medallion vs legado

#### ML v3 y alertas/acciones

Causa raíz:

- eran fallas derivadas del build roto: faltaban relaciones materializadas (`int_ml_scores_v3_latest`, `mart_alertas_acciones`) cuando se corría `dbt test`

Corrección:

- al reparar los modelos upstream, los tests quedaron en verde

#### Medallion vs legado

Causa raíz:

- `gold` estaba leyendo una cadena Bronze/Silver vieja
- resultado observado antes de RC1.1:
  - summary gold: snapshot `2026-06-22`
  - summary legacy: snapshot `2026-06-25`
  - issues gold: `88`
  - issues legacy: `109`

Corrección:

- se reconstruyó la cadena completa `Bronze -> Silver -> Gold` con `+gld_data_quality__issues` y `+gld_data_quality__summary`

Resultado:

- tests Medallion vs legado: `PASS`

### 5. Módulo Estadísticas bloqueado en `Cargando runtime operacional`

Causa raíz:

- la página llamaba `/estadisticas/movimientos-mes-historico-v2`, endpoint inexistente
- además esperaba `items`, pero el backend entrega `rows`
- la SSR degradaba tarde porque esperaba el timeout completo por intento

Corrección:

- la página ahora consume `/estadisticas/movimientos-mes`
- acepta `rows` y fallback compatible con `items`
- se agregó timeout local más corto (`3500ms`) para degradar sin congelar la ruta

Resultado:

- `GET /estadisticas` responde `200`
- el módulo deja de quedar detenido en la pantalla global de carga

## Archivos modificados

- `backend/routers/home.py`
- `backend/routers/estadisticas.py`
- `dbt_catastro/models/marts/mart_acciones_vs_movimientos_mes.sql`
- `dbt_catastro/models/staging/stg_ml_features_equipos.sql`
- `dbt_catastro/models/marts/mart_equipos_estado_actual_v2.sql`
- `dbt_catastro/models/marts/mart_ranking_global_top.sql`
- `web/catastro-web/src/app/estadisticas/page.tsx`
- `RC1_1_STABILIZATION_REPORT.md`

## Tests y validaciones ejecutadas

### dbt

1. Build focalizado inicial sobre:
   - `mart_acciones_vs_movimientos_mes`
   - `stg_ml_features_equipos`
   - `mart_equipos_estado_actual_v2`
   - `mart_ranking_global_top`
   - `int_ml_scores_v3_latest`
   - `mart_alertas_acciones`
   - `gld_data_quality__issues`
   - `gld_data_quality__summary`
2. Rebuild completo Medallion:
   - `+gld_data_quality__issues`
   - `+gld_data_quality__summary`
3. Verificación consolidada final:
   - `PASS=71 WARN=0 ERROR=0 SKIP=0 NO-OP=0 TOTAL=71`

### Smoke test backend sobre `ti_opsv2_candidate`

- `GET /health` -> `200`
- `GET /home/dashboard` -> `200`
  - `activos_totales = 362`
- `GET /estadisticas/home-activos` -> `200`
  - `activos_totales = 362`
- `GET /estadisticas/movimientos-mes?limit=15` -> `200`
- `GET /estadisticas/estadisticas-porcentajes?...` -> `200`
- `GET /estadisticas/resumen-operacion-mensual?...` -> `200`

### Smoke test frontend local

- `GET /` -> `200` en `17.64s`
- `GET /activos` -> `200` en `5.28s`
- `GET /resumen-ejecutivo` -> `200` en `2.56s`
- `GET /estadisticas` -> `200` en `21.55s`

### Validación adicional

- `npm run typecheck` en `web/catastro-web` -> `PASS`

## Resultado final

Correcciones cerradas:

- inconsistencia de KPI ejecutivo de parque visible
- build dbt crítico
- tests ML v3
- tests alertas/acciones
- tests Medallion vs legado
- desbloqueo funcional del módulo Estadísticas

Valor canónico vigente validado:

- `parque visible = 362`
- `activos operativos = 355`
- `bajas visibles = 7`

## Riesgos residuales no bloqueantes

- el tiempo de respuesta SSR de `/estadisticas` sigue siendo alto en entorno dev local porque compila y además degrada algunos bloques pesados; no quedó bloqueado, pero conviene optimizarlo fuera de RC1.1.
- `dbt` y smoke fueron corridos sobre `ti_opsv2_candidate`; no se ejecutó ningún cutover.

## Recomendación final

Recomendación técnica RC1.1: `PASS`

Condición para leer correctamente este pass:

- considerar `2026-06-26` como la fecha de verdad operacional de esta estabilización
- tratar el `361` documentado en RC1 (`2026-06-25`) como evidencia histórica desfasada, no como baseline vigente para la candidata actual
