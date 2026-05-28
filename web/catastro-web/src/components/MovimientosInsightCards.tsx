"use client";

type Row = {
  mes: string;
  movimientos_total: number;
  ingresos: number;
  salidas: number;
  asignaciones: number;
  recuperaciones: number;
  stock_activo: number;
  pct_movimientos_100: number;
  mix_asignaciones_100: number;
  movimientos_ytd: number;
  pct_movimientos_ytd_100: number;
  insight_movimientos: string;
  insight_mix: string;
  insight_delta: string;
};

function formatMesLabel(mesISO: string) {
  const d = new Date(mesISO + "T00:00:00");
  const label = d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function classifyDelta(insightDelta: string) {
  const m = insightDelta.match(/-?\d+/);
  const n = m ? parseInt(m[0], 10) : null;

  if (n === null) return "neutral";
  if (n <= -10) return "bad";
  if (n >= 10) return "good";
  return "warn";
}

export default function MovimientosInsightCards({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const deltaClass = classifyDelta(r.insight_delta);

        const badge =
          deltaClass === "bad"
            ? "bg-red-500/15 text-red-200 ring-1 ring-red-400/30"
            : deltaClass === "good"
            ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
            : deltaClass === "warn"
            ? "bg-yellow-500/15 text-yellow-200 ring-1 ring-yellow-400/30"
            : "bg-neutral-500/15 text-neutral-200 ring-1 ring-neutral-400/30";

        const dot =
          deltaClass === "bad"
            ? "🔴"
            : deltaClass === "good"
            ? "🟢"
            : deltaClass === "warn"
            ? "🟡"
            : "⚪";

        return (
          <div key={r.mes} className="rounded-2xl bg-neutral-900/50 ring-1 ring-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">🗓 {formatMesLabel(r.mes)}</div>
                <div className="mt-1 text-sm text-neutral-400">
                  Stock activo: <span className="text-neutral-200">{r.stock_activo}</span> ·
                  {" "}Movimientos: <span className="text-neutral-200">{r.movimientos_total}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-neutral-400">YTD</div>
                <div className="text-xl font-semibold text-white">
                  {Number(r.pct_movimientos_ytd_100).toFixed(2)}%
                </div>
                <div className="text-xs text-neutral-500">({r.movimientos_ytd} mov.)</div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="text-neutral-200">📦 {r.insight_movimientos}</div>
              <div className="text-neutral-200">🔁 {r.insight_mix}</div>

              <div className="inline-flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${badge}`}>
                  {dot} {r.insight_delta}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
