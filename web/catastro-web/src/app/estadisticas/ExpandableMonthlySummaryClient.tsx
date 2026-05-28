"use client";

import dynamic from "next/dynamic";

const ExpandableMonthlySummary = dynamic(() => import("./ExpandableMonthlySummary"), {
  ssr: false,
  loading: () => (
    <div className="max-w-[17rem] rounded-2xl border border-[rgba(50,76,194,0.14)] bg-white/72 p-3 text-xs text-[var(--cat-text-soft)]">
      Cargando resumen...
    </div>
  ),
});

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

export default function ExpandableMonthlySummaryClient({
  row,
  compact = false,
}: {
  row: MovimientoMesSummary;
  compact?: boolean;
}) {
  return <ExpandableMonthlySummary row={row} compact={compact} />;
}
