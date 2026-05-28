"use client";

type MovimientoMesSummary = {
  pct_movimientos_100: number;
  ingresos?: number;
  salidas?: number;
  ingresos_personas?: number;
  salidas_personas?: number;
  presion_compra?: number;
  ingresos_hardware?: number;
  reasignaciones_hardware?: number;
  equipos_reutilizados?: number;
  cambios_equipo_real?: number;
  equipos_retornados?: number;
  devoluciones_hardware?: number;
  equipos_baja?: number;
  movimientos_internos_sin_impacto?: number;
  nuevos_con_equipo?: number;
  nuevos_sin_equipo?: number;
  personas_resueltas_con_equipo?: number;
  stock_disponible?: number;
};

type SummaryMetric = {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "negative" | "accent";
};

function metricToneClass(tone?: SummaryMetric["tone"]) {
  if (tone === "positive") return "text-green-600";
  if (tone === "negative") return "text-red-500";
  if (tone === "accent") return "text-[var(--cat-primary)]";
  return "text-[var(--cat-text)]";
}

function buildPrimarySummaryMetrics(row: MovimientoMesSummary): SummaryMetric[] {
  return [
    { label: "% movimiento", value: `${row.pct_movimientos_100.toFixed(2)}%`, tone: "accent" },
    { label: "Ingresos personas", value: row.ingresos_personas ?? row.ingresos ?? 0, tone: "positive" },
    { label: "Salidas personas", value: row.salidas_personas ?? row.salidas ?? 0, tone: "negative" },
    { label: "Presión compra", value: row.presion_compra ?? 0 },
  ];
}

function buildDetailSummaryMetrics(row: MovimientoMesSummary): SummaryMetric[] {
  return [
    { label: "Equipos incorporados", value: row.ingresos_hardware ?? 0 },
    { label: "Equipos reutilizados", value: row.equipos_reutilizados ?? row.reasignaciones_hardware ?? 0 },
    { label: "Cambios reales de equipo", value: row.cambios_equipo_real ?? 0 },
    { label: "Equipos retornados", value: row.equipos_retornados ?? row.devoluciones_hardware ?? 0 },
    { label: "Equipos dados de baja", value: row.equipos_baja ?? 0 },
    { label: "Movimientos internos sin impacto", value: row.movimientos_internos_sin_impacto ?? 0 },
    { label: "Nuevos con equipo", value: row.nuevos_con_equipo ?? 0 },
    { label: "Nuevos pendientes", value: row.nuevos_sin_equipo ?? 0 },
    { label: "Stock disponible total", value: row.stock_disponible ?? 0, tone: "accent" },
  ];
}

function CompactSummaryList({
  items,
  note,
  dense = false,
}: {
  items: SummaryMetric[];
  note?: string;
  dense?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-[rgba(50,76,194,0.14)] bg-white/72 ${dense ? "p-3" : "p-4"}`}>
      <div
        className={`grid grid-cols-1 ${dense ? "gap-1.5 text-sm leading-tight" : "gap-2 text-sm leading-tight"} max-w-[22rem]`}
      >
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <span className="text-[var(--cat-text-muted)]">{item.label}</span>
            <span className={`font-semibold ${metricToneClass(item.tone)}`}>{item.value}</span>
          </div>
        ))}
      </div>
      {note ? <p className={`${dense ? "mt-2 text-[11px]" : "mt-3 text-xs"} text-[var(--cat-text-soft)]`}>{note}</p> : null}
    </div>
  );
}

export default function ExpandableMonthlySummary({
  row,
  compact = false,
}: {
  row: MovimientoMesSummary;
  compact?: boolean;
}) {
  const primaryItems = buildPrimarySummaryMetrics(row);
  const detailItems = buildDetailSummaryMetrics(row);
  const personasResueltas =
    row.personas_resueltas_con_equipo ??
    Math.max((row.ingresos_personas ?? row.ingresos ?? 0) - (row.nuevos_sin_equipo ?? 0), 0);
  const note = `De ${row.ingresos_personas ?? row.ingresos ?? 0} ingresos de personas, ${personasResueltas} quedaron resueltos con parque actual y ${row.nuevos_sin_equipo ?? 0} siguieron presionando compra.`;

  return (
    <div className={`${compact ? "max-w-[17rem]" : "max-w-[22rem]"}`}>
      <CompactSummaryList items={primaryItems} dense={compact} />
      <details className="mt-2 group">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cat-primary)]">
          Ver detalle
        </summary>
        <div className="mt-2">
          <CompactSummaryList items={detailItems} note={note} dense />
        </div>
      </details>
    </div>
  );
}
