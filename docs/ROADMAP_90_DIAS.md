# ROADMAP 90 DIAS

Fecha base: 2026-06-18

## Objetivo

Definir una secuencia realista de evolucion para Catastro Medallion sin comprometer la estabilidad de `Catastro Operacional v1.0`.

## Principios

- evolucion por dominios
- reconciliacion antes de adopcion
- no hacer big bang
- preservar contratos API y frontend en las primeras fases

## Dominios candidatos

- Cierres
- Compras
- Forecast
- ML
- API v2

## Fase 1: dias 1 a 30

Foco:

- consolidar el piloto de Calidad
- preparar `Cierres` como siguiente dominio
- formalizar naming, tolerancias y adaptadores

Entregables sugeridos:

- reconciliacion historica de Calidad por `snapshot_date`
- inventario fino de dependencias de `ops.monthly_closures`
- baseline Gold para Cierres

Riesgos:

- mezclar snapshot formal con estado actual mutable
- subestimar dependencias del Home sobre Cierres

## Fase 2: dias 31 a 60

Foco:

- piloto Medallion en `Compras`
- separar hechos documentales, planeacion y forecast base

Entregables sugeridos:

- Bronze de documentos y planeacion
- Silver de compras y lineas documentales
- Gold de resumen de compras reconciliado

Riesgos:

- reglas de negocio dispersas entre seeds y marts actuales
- dependencia de frontend de columnas ejecutivas ya estabilizadas

## Fase 3: dias 61 a 90

Foco:

- avanzar sobre `Forecast` y `ML`
- evaluar primer adaptador `API v2` read-only

Entregables sugeridos:

- Silver de senales ML y forecast base
- Gold de forecast controlado
- propuesta de endpoint `v2` para un dominio ya reconciliado

Riesgos:

- ML v3 aun depende de capas operativas legacy
- riesgo de exponer Gold sin adaptador semantico

## Prioridad recomendada

1. Cierres
2. Compras
3. Forecast
4. ML
5. API v2

## Criterio de avance por etapa

Cada dominio deberia pasar a la siguiente etapa solo si cumple:

- fuentes identificadas
- baseline legacy definido
- Bronze estable
- Silver canonica documentada
- Gold reconciliado
- riesgo de contrato explicitado

## Recomendacion final

Los proximos 90 dias no deberian medirse por cantidad de modelos nuevos, sino por cantidad de dominios reconciliados y listos para una adopcion segura.
