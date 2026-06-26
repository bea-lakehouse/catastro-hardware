# SPRINT 0 RESUMEN

Fecha: 2026-06-18

## Objetivo

Sprint 0 tuvo como objetivo diagnosticar la plataforma actual y reducir el riesgo de una migracion Medallion a ciegas.

## Hallazgos principales

- la deuda estructural no vive solo en dbt
- `mart_equipos_estado_actual` es la dependencia central del sistema
- hay relaciones legacy ocultas fuera de `ref()` y `source()`
- la superficie API productiva es amplia y heterogenea
- las entidades maestras aun no estan totalmente canonizadas

## Relaciones legacy ocultas

Se detectaron compat views, tablas quoted, vistas `v_mtr1203_*`, tablas `*_xlsx`, objetos temporales y esquemas remanentes como `activos` y `public` consumidos fuera del DAG formal.

Impacto:

- alto riesgo de ruptura silenciosa
- dificultad para estimar cambios
- deuda tecnica persistente en runtime

## Matriz API

La auditoria identifico endpoints troncales con alto riesgo:

- Home
- Activos
- Operacion
- Ficha de Equipo
- Compras
- Cierres

Tambien identifico dominios mas aislables:

- Calidad de Datos
- partes de Cierres
- partes de Compras

## Entidades canonicas

Las entidades priorizadas para Silver futura fueron:

- equipo
- usuario
- cliente
- area
- movimiento
- compra
- ticket
- alerta
- score ML
- forecast
- cierre
- calidad
- sostenibilidad

Las mas inmaduras al cierre del Sprint 0 fueron:

- usuario
- cliente
- area

## Riesgos

### Criticos

- reemplazar `mart_equipos_estado_actual` prematuramente
- retirar relaciones legacy ocultas sin mapa de impacto
- migrar endpoints criticos sin adaptador

### Altos

- cambios de semantica en Home, Activos y Operacion
- duplicidad de contratos API
- ML v3 aun dependiente de la mart operativa

### Medios

- mezcla de snapshots, latest, backfills y seeds
- presencia del schema `activos`
- dependencias semanticas en frontend

## Recomendacion para Sprint 1

- no tocar dominios troncales
- elegir un dominio piloto de bajo riesgo
- exigir reconciliacion real, no equivalencia asumida
- mantener la regla de oro de convivencia paralela

## Decision resultante

Sprint 0 dejo aprobada la direccion arquitectonica y recomendo arrancar por `Calidad de Datos`, decision que se materializo en Sprint 1.
