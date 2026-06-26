# Cierre Mensual Junio 2026 - Validacion Compras 2026

Fecha de validacion: `2026-06-24`

## Decision

El estado reproducible de Compras 2026 con upstream actual queda en `101`, no en `100` ni en `102`.

Distribucion validada:

- `2026-01-01`: `36`
- `2026-02-01`: `20`
- `2026-04-01`: `20`
- `2026-06-01`: `25`

## Causa raiz del conflicto 100 vs 102

El salto previo `100 -> 102` no correspondia a un estado estable del upstream:

- `102` aparecio en una corrida intermedia donde enero quedaba en `37` y junio todavia no estaba estabilizado contra el MTR crudo vigente.
- al recomputar la cadena core y contrastar directamente con Postgres al `2026-06-24`, el estado consistente quedo en `101`.
- `100` tampoco se sostiene con el upstream actual porque abril sigue mostrando `20` equipos validos, no `19`.

Conclusion:

- `102` fue un estado transitorio de rebuild parcial.
- `100` fue una expectativa previa que ya no coincide con la evidencia actual.
- `101` es el estado reproducible para cierre al `2026-06-24`.

## Evidencia de enero 2026

El bloque crudo actual de MTR para enero 2026 vive en `raw.mtr_google_sheet_rows`, `source_name = 'equipos_asignados'`, `run_id = 140`.

Ese bloque contiene exactamente:

- `16` HP con SKU `556-558` y `560-572`
- `20` Mac con SKU `573-592`

Total: `36`.

No existe `SKU 559` en el upstream crudo actual y no hay otra fila vigente que sostenga el `37` previo. Por eso enero `37` se considera un artefacto anterior no reproducible.

## Evidencia de abril 2026

Abril 2026 sigue mostrando `20` filas unicas en MTR, todas vigentes en el upstream actual:

- `10` Mac con SKU `613-622`
- `10` HP con SKU `623-632`

La guia `DOC-2026-RICOH-620561`, emitida el `2026-04-23`, respalda el lote HP, y los `10` Mac ya aparecen serializados en MTR.

No se encontro un vigesimo registro invalido ni un duplicado de serial que justifique bajar abril a `19`. Con la evidencia actual, abril `20` debe aceptarse como correcto.

## Registros exactos involucrados

Los registros revisados para cerrar la discrepancia fueron:

1. Enero 2026:
   El supuesto registro adicional no sobrevive al upstream actual. La ausencia de `SKU 559` explica que el `37` anterior no sea reproducible.
2. Junio 2026:
   Las filas manuales que siguen siendo necesarias y no aparecen en MTR son exactamente estos `11` seriales:
   `GP6D4D32GD`, `GP3VPWGJX4`, `MDXV6H7GCQ`, `DVT2X12QW2`, `MT4J6XQGGQ`, `F22PDYJ766`, `5CG6072W11`, `5CG6072VZX`, `5CG6072V5P`, `5CG6072P6K`, `5CG6072P8Q`.
3. Abril 2026:
   El lote completo de `20` filas MTR sigue vigente y no contiene un registro aislable para excluir. El desvio contra la meta `19` corresponde a una expectativa desactualizada, no a un duplicado identificado.

## Impacto para cierre

El contrato de datos para cierre mensual debe considerar `101` como acumulado confirmado 2026 hasta el corte del `2026-06-24`.
