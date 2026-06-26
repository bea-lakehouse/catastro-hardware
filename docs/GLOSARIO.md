# GLOSARIO

## Catastro Operacional

Linea estable del producto enfocada en operacion diaria, contratos actuales de API, frontend y marts legacy.

## Catastro Corporativo

Linea evolutiva de arquitectura y datos que busca canonizar entidades y desacoplar consumo a traves de Medallion.

## Medallion

Patron de arquitectura de datos que separa captura, normalizacion y publicacion en capas progresivas.

## Bronze

Capa de captura inicial. Preserva raw o snapshots con trazabilidad y minimo procesamiento.

## Silver

Capa canonica. Normaliza llaves, entidades, catalogos, severidades, estados y reglas de negocio reusables.

## Gold

Capa publicable. Expone datasets listos para API, dashboard, ML, forecast o analitica ejecutiva.

## Mart legacy

Tabla o vista de negocio actual, normalmente en `analytics.mart_*`, que ya alimenta consumidores productivos.

## Reconciliacion

Proceso de comparacion entre legacy y Medallion para validar equivalencia o diferencias controladas antes de migrar consumidores.

## Contrato API

Compromiso funcional y tecnico de una ruta backend: shape, semantica, nombres y comportamiento esperado por consumidores.

## Entidad canonica

Representacion estable de un objeto de negocio, con llave, atributos y reglas consistentes entre fuentes.

## Cierre mensual

Snapshot formal del estado de un mes que congela KPIs, calidad, parque, ML y comparaciones historicas.

## Data Quality

Dominio encargado de medir completitud, confianza, errores, observaciones y brechas estructurales del parque.

## DAG

Grafo de dependencias de dbt basado en `ref()` y `source()`. No captura automaticamente relaciones directas a tablas o vistas fuera del patron formal.

## Adaptador

Capa intermedia que permite exponer Gold a un contrato existente o nuevo sin acoplar consumidores al cambio interno de modelado.
