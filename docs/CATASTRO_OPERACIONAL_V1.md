# CATASTRO OPERACIONAL V1

Fecha de congelacion: 2026-06-17

## Alcance

`Catastro Operacional v1.0` es la linea estable del producto. Su objetivo es soportar la operacion diaria del parque TI sin cambios disruptivos de arquitectura.

Incluye:

- Home ejecutivo-operacional
- Activos y detalle de equipos
- Operacion y alertas
- Calidad de datos
- Cierres mensuales
- Ejecucion operativa
- Compras y planeacion
- Historico y estadisticas
- ML v2 y analitica asociada

## Modulos incluidos

- Home
- Activos
- Equipos
- Operacion
- Calidad de Datos
- Cierres
- Ejecucion
- Compras
- Planeacion
- Historico
- ML
- Health de plataforma

## Rutas principales

- `/`
- `/activos`
- `/equipos/[id]`
- `/operacion`
- `/calidad-datos`
- `/cierres`
- `/planeacion-compra`
- `/compras-2026`
- `/historico-catastro`
- `/ml-v2`
- `/health`

## Marts principales

- `analytics.mart_equipos_estado_actual`
- `analytics.mart_mtr_jira_reconciliacion`
- `analytics.mart_operacion_alertas`
- `analytics.mart_operacion_sla`
- `analytics.mart_confianza_dato`
- `analytics.mart_data_quality_summary`
- `analytics.mart_data_quality_issues`
- `analytics.mart_compras_equipos_2026`
- `analytics.mart_planeacion_*`
- `analytics.mart_catastro_historia_mensual`
- `analytics.mart_ranking_global`
- `analytics.mart_timeline_eventos`

## Endpoints principales

- `GET /home/dashboard`
- `GET /estadisticas/home-activos`
- `GET /estadisticas/equipos`
- `GET /equipos/{id_equipo}/ficha-canonica`
- `GET /operacion/resumen`
- `GET /operacion/alertas`
- `GET /calidad-datos/resumen`
- `GET /cierres`
- `POST /cierres/ejecutar`
- `GET /compras/resumen-2026`
- `GET /compras/forecast`
- `GET /ml/v2/scores`

## Reglas de estabilidad

- no cambiar contratos del frontend actual sin versionado explicito
- no reemplazar `mart_equipos_estado_actual` sin capa adaptadora
- no renombrar marts consumidas por FastAPI productivo
- no retirar vistas o tablas legacy ocultas sin mapa de impacto
- no introducir migraciones big bang sobre Home, Activos, Operacion o Ficha

## Que no debe romperse

- shape de respuestas de Home
- listado y detalle de Activos
- ficha canonica de equipo
- centro de Calidad de Datos
- snapshot y consulta de Cierres
- compras y forecast operativo
- consumo frontend existente
- contratos de backend ya montados en `backend/main.py`

## Decision de gobierno

`Catastro Operacional v1.0` queda protegido como contrato legacy estable. Cualquier evolucion arquitectonica debe ocurrir fuera de esta linea hasta que exista reconciliacion suficiente y una estrategia formal de transicion.
