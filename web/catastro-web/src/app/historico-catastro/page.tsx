import Link from "next/link";
import ModuleContract from "@/components/ModuleContract";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";
import { getUiVisualUpdatedAtLabel } from "@/lib/ui-version";

type HistoricalResponse = {
  periodo: {
    date_from: string;
    date_to: string;
    top_n: number;
  };
  resumen: {
    meses: number;
    movimientos_total: number;
    ingresos_totales: number;
    salidas_totales: number;
    ingresos_nuevos: number;
    ingresos_internos: number;
    ingresos_con_equipo: number;
    ingresos_sin_equipo: number;
    salidas_con_sku: number;
    salidas_sin_sku: number;
    movimientos_internos: number;
    asignaciones: number;
    devoluciones: number;
    presion_compra: number;
    balance_neto: number;
    gap_operativo_estimado: number;
    gap_vs_oferta_actual_ref: number;
    stock_visible_actual_ref: number;
    asignados_actual_ref: number;
    oferta_disponible_actual_ref: number;
  };
  mensual: MonthlyRow[];
  breakdowns: Record<string, BreakdownRow[]>;
  calidad_datos: {
    future_records_excluded?: number;
    google_sheet_history_from?: string | null;
    google_sheet_history_to?: string | null;
    google_sheet_runs?: number;
    eventos_sin_sku?: number;
    eventos_con_sku?: number;
    events_sku_enriquecidos_marca_modelo?: number;
    stock_historico_reconstruible?: boolean;
    months_without_movements?: string[];
    notes?: string[];
  };
};

type MonthlyRow = {
  mes: string;
  movimientos_total: number;
  ingresos_totales: number;
  salidas_totales: number;
  ingresos_nuevos: number;
  ingresos_internos: number;
  ingresos_con_equipo: number;
  ingresos_sin_equipo: number;
  salidas_con_sku: number;
  salidas_sin_sku: number;
  movimientos_internos: number;
  asignaciones: number;
  devoluciones: number;
  stock_visible_mes: number | null;
  oferta_disponible_mes: number | null;
  stock_visible_actual_ref: number;
  asignados_actual_ref: number;
  oferta_disponible_actual_ref: number;
  presion_compra: number;
  ingresos_extranjeros: number;
  salidas_extranjeros: number;
  balance_neto: number;
  pct_movimiento_sobre_stock_actual_ref: number | null;
  gap_operativo_estimado: number;
  gap_vs_oferta_actual_ref: number;
  stock_historico_reconstruible: boolean;
  nota_stock: string;
  nota_ingresos_internos: string;
};

type BreakdownRow = {
  value: string;
  display_value?: string;
  interpretation?: string;
  explanatory_note?: string;
  movimientos_total: number;
  ingresos_totales: number;
  salidas_totales: number;
  ingresos_nuevos: number;
  ingresos_internos: number;
  ingresos_con_equipo: number;
  ingresos_sin_equipo: number;
  salidas_con_sku: number;
  salidas_sin_sku: number;
  presion_compra: number;
  monthly: Array<{
    mes: string;
    movimientos_total: number;
    ingresos_totales: number;
    salidas_totales: number;
    ingresos_nuevos: number;
    ingresos_internos: number;
    ingresos_con_equipo: number;
    ingresos_sin_equipo: number;
    salidas_con_sku: number;
    salidas_sin_sku: number;
    presion_compra: number;
  }>;
};

type Milestone = {
  title: string;
  month?: string | null;
  value: number;
  helper: string;
  tone: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
};

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function fmtNumber(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const integer = Math.trunc(Math.abs(n)).toString();
  return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function fmtPct(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function fmtMes(value?: string | null) {
  if (!value) return "—";
  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (!match) return text;
  return `${MONTHS_ES[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

function yearOf(value?: string | null) {
  const match = String(value ?? "").match(/^(\d{4})-/);
  return match?.[1] ?? "—";
}

function maxValue(rows: MonthlyRow[], selector: (row: MonthlyRow) => number) {
  return rows.reduce((max, row) => Math.max(max, selector(row)), 0);
}

function prettyDimensionName(name: string) {
  const map: Record<string, string> = {
    empresa: "Empresa",
    tipo_equipo: "Tipo de equipo",
    marca: "Marca",
    modelo: "Modelo",
    os_familia: "Sistema operativo",
    tipo_colaborador: "Core / Staffing",
    ambito: "Nacional / Extranjero",
    politica_modelo: "Política de modelo",
  };
  return map[name] ?? name;
}

function barWidth(value: number, max: number) {
  if (!max) return 6;
  return Math.max(6, (value / max) * 100);
}

function heatOpacity(value: number, max: number, base = 0.12, boost = 0.46) {
  if (!max) return base;
  return Math.min(base + (value / max) * boost, 0.72);
}

function getTimelineTone(row: MonthlyRow, limits: { maxPresion: number; maxInternos: number }) {
  const isCritical = row.presion_compra >= limits.maxPresion * 0.66 || row.gap_operativo_estimado > 0;
  if (isCritical) {
    return {
      eventClass: "tone-critical",
      cardClass: "is-critical",
      primaryBadge: getStatusClassName("critica"),
      primaryLabel: "Mes crítico",
    };
  }

  if (row.devoluciones > 0) {
    return {
      eventClass: "tone-reuse",
      cardClass: "is-reuse",
      primaryBadge: getStatusClassName("reutilizable"),
      primaryLabel: "Reutilización activa",
    };
  }

  if (row.movimientos_internos >= limits.maxInternos * 0.5 && row.movimientos_internos > 0) {
    return {
      eventClass: "tone-internal",
      cardClass: "is-internal",
      primaryBadge: getStatusClassName("core"),
      primaryLabel: "Cambios internos",
    };
  }

  if (row.presion_compra >= limits.maxPresion * 0.35) {
    return {
      eventClass: "tone-pressure",
      cardClass: "is-pressure",
      primaryBadge: getStatusClassName("media"),
      primaryLabel: "Presión elevada",
    };
  }

  return {
    eventClass: "tone-stable",
    cardClass: "is-stable",
    primaryBadge: getStatusClassName("info"),
    primaryLabel: "Mes estable",
  };
}

function getHeatLevel(
  row: MonthlyRow,
  limits: { maxMovimientos: number; maxPresion: number; maxDevoluciones: number }
) {
  const movementRatio = limits.maxMovimientos ? row.movimientos_total / limits.maxMovimientos : 0;
  const pressureRatio = limits.maxPresion ? row.presion_compra / limits.maxPresion : 0;
  const intensity = Math.max(movementRatio * 0.55 + pressureRatio * 0.45, pressureRatio);

  if (row.gap_operativo_estimado > 0 || intensity >= 0.8) return "critical";
  if (row.devoluciones > 0 && row.devoluciones >= limits.maxDevoluciones * 0.45) return "reuse";
  if (row.balance_neto > 0 && row.presion_compra <= limits.maxPresion * 0.22) return "positive";
  if (intensity >= 0.58) return "high";
  return "low";
}

function getBreakdownBadgeTone(kind?: string) {
  if (kind === "sin_equipo_presion") {
    return getStatusClassName("reutilizable");
  }
  if (kind === "dato_incompleto") {
    return getStatusClassName("observacion");
  }
  return getStatusClassName("normal");
}

function getHeatBadgeTone(level: "critical" | "reuse" | "positive" | "high" | "low") {
  if (level === "critical") return getStatusClassName("critica");
  if (level === "reuse") return getStatusClassName("reutilizable");
  if (level === "positive") return getStatusClassName("info");
  if (level === "high") return getStatusClassName("alta");
  return getStatusClassName("core");
}

async function getHistoricalData(): Promise<HistoricalResponse> {
  const origin = await getRequestOrigin();
  const qs = new URLSearchParams({
    date_from: "2024-01-01",
    top_n: "6",
  });

  const res = await fetch(`${origin}/api/estadisticas/catastro-historico?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`No pude cargar histórico Catastro (${res.status})`);
  }

  return res.json();
}

function KpiCard({
  title,
  value,
  subtitle,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
}) {
  return (
    <div className={`cat-kpi-card kpi-${tone} p-6`}>
      <div className="catastro-kpi-label">{title}</div>
      <div className="catastro-kpi-value">{value}</div>
      {subtitle ? <div className="catastro-kpi-helper">{subtitle}</div> : null}
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="catastro-panel mt-6 rounded-3xl p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--cat-text)]">{title}</h2>
          {subtitle ? <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--cat-text-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function TimelineEventCard({
  row,
  side,
  maxMovimientos,
  maxIngresos,
  maxSalidas,
  maxInternos,
  maxDevoluciones,
  maxPresion,
}: {
  row: MonthlyRow;
  side: "left" | "right";
  maxMovimientos: number;
  maxIngresos: number;
  maxSalidas: number;
  maxInternos: number;
  maxDevoluciones: number;
  maxPresion: number;
}) {
  const movementRatio = barWidth(row.movimientos_total, maxMovimientos);
  const ingresosRatio = barWidth(row.ingresos_totales, maxIngresos);
  const salidasRatio = barWidth(row.salidas_totales, maxSalidas);
  const internosRatio = barWidth(row.movimientos_internos, maxInternos);
  const devolucionesRatio = barWidth(row.devoluciones, maxDevoluciones);
  const tone = getTimelineTone(row, { maxPresion, maxInternos });

  return (
    <div className={`cat-timeline-entry ${tone.eventClass} side-${side}`}>
      <span className="cat-timeline-node" />
      <article className={`cat-timeline-card ${tone.cardClass}`}>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="catastro-kpi-label">{fmtMes(row.mes)}</div>
            <div className="mt-1 text-[0.9rem] font-semibold text-[var(--cat-text)] md:text-[0.98rem]">
              {fmtNumber(row.movimientos_total)} movimientos
            </div>
            <div className="cat-history-secondary mt-2">
              Ingresos {fmtNumber(row.ingresos_totales)} · salidas {fmtNumber(row.salidas_totales)} · presión{" "}
              {fmtNumber(row.presion_compra)} · balance {fmtNumber(row.balance_neto)}
            </div>
          </div>

          <div className="cat-badge-stack">
            <span className={`${tone.primaryBadge} cat-history-badge`}>{tone.primaryLabel}</span>
            <span className={`${row.movimientos_internos > 0 ? getStatusClassName("core") : getStatusClassName("normal")} cat-history-badge`}>
              Internos {fmtNumber(row.movimientos_internos)}
            </span>
            <span className={`${row.devoluciones > 0 ? getStatusClassName("reutilizable") : getStatusClassName("normal")} cat-history-badge`}>
              Reutilización {fmtNumber(row.devoluciones)}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="cat-history-metric-label">Movimientos</span>
              <span className="cat-history-metric-value">{fmtNumber(row.movimientos_total)}</span>
            </div>
            <div className="cat-command-bar">
              <span
                className="bg-[linear-gradient(90deg,var(--cat-primary)_0%,#6fd6ff_100%)] shadow-[0_0_14px_rgba(0,198,255,0.18)]"
                style={{ width: `${movementRatio}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="cat-history-metric-label">Ingresos</span>
                <span className="cat-history-metric-value">{fmtNumber(row.ingresos_totales)}</span>
              </div>
              <div className="cat-command-bar">
                <span
                  className="bg-[linear-gradient(90deg,var(--cat-success)_0%,#6ef0c0_100%)] shadow-[0_0_14px_rgba(0,229,153,0.16)]"
                  style={{ width: `${ingresosRatio}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="cat-history-metric-label">Salidas</span>
                <span className="cat-history-metric-value">{fmtNumber(row.salidas_totales)}</span>
              </div>
              <div className="cat-command-bar">
                <span
                  className="bg-[linear-gradient(90deg,var(--cat-orange)_0%,#ff9e73_100%)] shadow-[0_0_14px_rgba(255,107,53,0.16)]"
                  style={{ width: `${salidasRatio}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="cat-history-metric-label">Cambios int.</span>
                <span className="cat-history-metric-value">{fmtNumber(row.movimientos_internos)}</span>
              </div>
              <div className="cat-command-bar">
                <span
                  className="bg-[linear-gradient(90deg,var(--cat-purple)_0%,#d09aff_100%)] shadow-[0_0_14px_rgba(168,85,247,0.16)]"
                  style={{ width: `${internosRatio}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="cat-history-metric-label">Recuperac.</span>
                <span className="cat-history-metric-value">{fmtNumber(row.devoluciones)}</span>
              </div>
              <div className="cat-command-bar">
                <span
                  className="bg-[linear-gradient(90deg,var(--cat-warning)_0%,#ffe39f_100%)] shadow-[0_0_14px_rgba(255,209,102,0.16)]"
                  style={{ width: `${devolucionesRatio}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-4">
          <div className="cat-runtime-stat">
            <div className="cat-history-metric-label">Stock mes</div>
            <div className="mt-1 text-[0.94rem] font-semibold text-[var(--cat-text)]">
              {row.stock_visible_mes == null ? "—" : fmtNumber(row.stock_visible_mes)}
            </div>
          </div>
          <div className="cat-runtime-stat">
            <div className="cat-history-metric-label">Disponibles</div>
            <div className="mt-1 text-[0.94rem] font-semibold text-[var(--cat-text)]">
              {row.oferta_disponible_mes == null ? "—" : fmtNumber(row.oferta_disponible_mes)}
            </div>
          </div>
          <div className="cat-runtime-stat">
            <div className="cat-history-metric-label">Gap</div>
            <div className="mt-1 text-[0.94rem] font-semibold text-[var(--cat-text)]">{fmtNumber(row.gap_operativo_estimado)}</div>
          </div>
          <div className="cat-runtime-stat">
            <div className="cat-history-metric-label">% stock ref.</div>
            <div className="mt-1 text-[0.94rem] font-semibold text-[var(--cat-text)]">{fmtPct(row.pct_movimiento_sobre_stock_actual_ref)}</div>
          </div>
        </div>

        <div className="cat-timeline-note mt-2.5">
          {row.nota_stock} {row.nota_ingresos_internos}
        </div>
      </article>
    </div>
  );
}

export default async function HistoricoCatastroPage() {
  const uiUpdatedAtLabel = getUiVisualUpdatedAtLabel();
  const data = await getHistoricalData();
  const rows = data.mensual ?? [];
  const reversed = [...rows].reverse();
  const timelinePairs = Array.from({ length: Math.ceil(reversed.length / 2) }, (_, index) => ({
    left: reversed[index * 2] ?? null,
    right: reversed[index * 2 + 1] ?? null,
  }));
  const latest = rows[rows.length - 1];
  const firstVisible = rows[0];

  const maxMovimientos = Math.max(maxValue(rows, (row) => row.movimientos_total), 1);
  const maxPresion = Math.max(maxValue(rows, (row) => row.presion_compra), 1);
  const maxIngresos = Math.max(maxValue(rows, (row) => row.ingresos_totales), 1);
  const maxSalidas = Math.max(maxValue(rows, (row) => row.salidas_totales), 1);
  const maxInternos = Math.max(maxValue(rows, (row) => row.movimientos_internos), 1);
  const maxDevoluciones = Math.max(maxValue(rows, (row) => row.devoluciones), 1);

  const noSkuShare =
    data.resumen.movimientos_total > 0
      ? (100 * Number(data.calidad_datos.eventos_sin_sku ?? 0)) / data.resumen.movimientos_total
      : 0;

  const pressureExplainedByNoSku =
    data.resumen.presion_compra > 0
      ? (100 * Number(data.resumen.ingresos_sin_equipo ?? 0)) / Number(data.resumen.presion_compra ?? 0)
      : 0;

  const ambitoRows = data.breakdowns.ambito ?? [];
  const extranjeroBreakdown = ambitoRows.find((item) => (item.value ?? "").toUpperCase() === "EXTRANJERO");
  const maxAmbitoPressure = ambitoRows.reduce((max, item) => Math.max(max, item.presion_compra ?? 0), 0);
  const foreignPressureLeads =
    !!extranjeroBreakdown &&
    (extranjeroBreakdown.presion_compra ?? 0) > 0 &&
    (extranjeroBreakdown.presion_compra ?? 0) >= maxAmbitoPressure;

  const pressureNarrative = foreignPressureLeads
    ? "Los ingresos extranjeros concentran la mayor presión histórica de compra."
    : "La presión de compra proviene principalmente de ingresos sin equipo asignado, especialmente en colaboradores extranjeros.";

  const peakOnboarding = [...rows].sort((a, b) => b.ingresos_nuevos - a.ingresos_nuevos)[0];
  const peakPressure = [...rows].sort((a, b) => b.presion_compra - a.presion_compra)[0];
  const peakSalidas = [...rows].sort((a, b) => b.salidas_totales - a.salidas_totales)[0];
  const peakReuse = [...rows].sort((a, b) => b.devoluciones - a.devoluciones)[0];
  const peakInternal = [...rows].sort((a, b) => b.movimientos_internos - a.movimientos_internos)[0];
  const criticalMonth = [...rows].sort((a, b) => b.gap_operativo_estimado - a.gap_operativo_estimado)[0];

  const milestones: Milestone[] = [
    {
      title: "Mes con más onboarding",
      month: peakOnboarding?.mes,
      value: Number(peakOnboarding?.ingresos_nuevos ?? 0),
      helper: "Ingresos nuevos visibles en la serie histórica.",
      tone: "cyan",
    },
    {
      title: "Pico de presión operativa",
      month: peakPressure?.mes,
      value: Number(peakPressure?.presion_compra ?? 0),
      helper: "Ingresos sin equipo que hoy presionan compra.",
      tone: "red",
    },
    {
      title: "Mes con más salidas",
      month: peakSalidas?.mes,
      value: Number(peakSalidas?.salidas_totales ?? 0),
      helper: "Lectura histórica de salidas/bajas visibles.",
      tone: "orange",
    },
    {
      title: "Mayor reutilización",
      month: peakReuse?.mes,
      value: Number(peakReuse?.devoluciones ?? 0),
      helper: "Devoluciones y recuperación reutilizable.",
      tone: "green",
    },
    {
      title: "Más cambios internos",
      month: peakInternal?.mes,
      value: Number(peakInternal?.movimientos_internos ?? 0),
      helper: "Reasignaciones internas sobre parque activo.",
      tone: "purple",
    },
    {
      title: "Mes más crítico",
      month: criticalMonth?.mes,
      value: Number(criticalMonth?.gap_operativo_estimado ?? 0),
      helper: "Gap operativo máximo visible en la serie.",
      tone: "yellow",
    },
  ];

  const yearly = Object.entries(
    rows.reduce<Record<string, {
      ingresos: number;
      salidas: number;
      presion: number;
      internos: number;
      devoluciones: number;
      movimientos: number;
    }>>((acc, row) => {
      const year = yearOf(row.mes);
      acc[year] ??= {
        ingresos: 0,
        salidas: 0,
        presion: 0,
        internos: 0,
        devoluciones: 0,
        movimientos: 0,
      };
      acc[year].ingresos += Number(row.ingresos_totales ?? 0);
      acc[year].salidas += Number(row.salidas_totales ?? 0);
      acc[year].presion += Number(row.presion_compra ?? 0);
      acc[year].internos += Number(row.movimientos_internos ?? 0);
      acc[year].devoluciones += Number(row.devoluciones ?? 0);
      acc[year].movimientos += Number(row.movimientos_total ?? 0);
      return acc;
    }, {}),
  );

  const topDimensions = Object.entries(data.breakdowns)
    .map(([key, value]) => [key, value.slice(0, 4)] as const)
    .slice(0, 4);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] px-6 py-6">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-5xl">
              <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Timeline Operacional
              </div>
              <h1 className="mt-4 text-[clamp(2rem,3.7vw,3.45rem)] font-semibold tracking-[-0.04em] leading-[0.94] text-[var(--cat-card-text)]">
                Timeline Operacional
              </h1>
              <p className="mt-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--cat-card-muted)]">
                Histórico completo MTR · actualización visual {uiUpdatedAtLabel}
              </p>
              <p className="mt-4 max-w-4xl text-[0.9rem] leading-6 text-[var(--cat-card-muted)]">
                Evolución real del parque TI desde los inicios visibles del MTR hasta hoy: ingresos, salidas,
                reutilización, presión de compra, cambios internos y señales acumuladas del ecosistema operativo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[30rem]">
              <div className="catastro-chip-blue rounded-2xl px-4 py-3 text-[0.82rem]">
                Desde: {fmtMes(firstVisible?.mes ?? data.periodo.date_from)}
              </div>
              <div className="catastro-chip-blue rounded-2xl px-4 py-3 text-[0.82rem]">
                Hasta: {fmtMes(latest?.mes ?? data.periodo.date_to)}
              </div>
              <div className="catastro-chip-blue rounded-2xl px-4 py-3 text-[0.82rem]">
                Stock visible actual: {fmtNumber(data.resumen.stock_visible_actual_ref)}
              </div>
              <div className="catastro-chip-blue rounded-2xl px-4 py-3 text-[0.82rem]">
                Oferta disponible actual: {fmtNumber(data.resumen.oferta_disponible_actual_ref)}
              </div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer Histórico"
          description="Histórico conserva la película completa de MTR y la traduce a una lectura mensual del parque: entradas, salidas, presión, reutilización y balance."
          items={[
            {
              label: "Fuente dominante",
              value: "Histórico MTR + reconstrucción operativa mensual",
              hint: "La serie prioriza eventos visibles de MTR y sus notas de trazabilidad antes que snapshots administrativos parciales.",
              tone: "cyan",
            },
            {
              label: "Corte visible",
              value: `${fmtMes(firstVisible?.mes ?? data.periodo.date_from)} → ${fmtMes(latest?.mes ?? data.periodo.date_to)}`,
              hint: `UI validada al ${uiUpdatedAtLabel}; los meses actuales siguen el último corte visible del histórico.`,
              tone: "green",
            },
            {
              label: "Cobertura",
              value: "Timeline MTR + heatmap operacional + breakdowns históricos",
              hint: "No reemplaza Activos ni Jira; muestra la evolución temporal del parque y la presión acumulada.",
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: "Serie histórica consolidada",
              hint: `${operationalMeaning("parqueVisible")} ${operationalMeaning("sinPresionCompra")}`,
              tone: "amber",
            },
          ]}
          badges={[
            { label: operationalLabel("parqueVisible"), tone: "green" },
            { label: "Timeline MTR", tone: "cyan" },
            { label: "Serie histórica", tone: "purple" },
          ]}
          note="Histórico no simplifica la operación: la hace comparable mes a mes para detectar cuándo una presión, reutilización o cambio interno empezó a repetirse."
        />

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Movimientos acumulados" value={fmtNumber(data.resumen.movimientos_total)} subtitle="Runtime histórico consolidado" tone="cyan" />
          <KpiCard title="Ingresos / salidas" value={`${fmtNumber(data.resumen.ingresos_totales)} / ${fmtNumber(data.resumen.salidas_totales)}`} subtitle="Flujo operativo completo" tone="green" />
          <KpiCard title="Presión de compra" value={fmtNumber(data.resumen.presion_compra)} subtitle="Ingresos que presionan compra" tone="red" />
          <KpiCard title="Cambios internos" value={fmtNumber(data.resumen.movimientos_internos)} subtitle="Reasignaciones y traspasos" tone="purple" />
          <KpiCard title="Activos ref." value={fmtNumber(data.resumen.asignados_actual_ref)} subtitle="Asignados visibles del corte actual" tone="yellow" />
          <KpiCard title="Disponibles ref." value={fmtNumber(data.resumen.oferta_disponible_actual_ref)} subtitle="Oferta visible del corte actual" tone="green" />
          <KpiCard title="Recuperaciones" value={fmtNumber(data.resumen.devoluciones)} subtitle="Devoluciones reutilizables históricas" tone="cyan" />
          <KpiCard title="Eventos sin SKU" value={fmtPct(noSkuShare)} subtitle={`${fmtNumber(data.calidad_datos.eventos_sin_sku)} eventos sin SKU`} tone="orange" />
        </section>

        <SectionShell
          title="Hitos Históricos"
          subtitle="Momentos que resumen la tensión del parque: onboarding, salidas, reutilización y presión operativa."
        >
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {milestones.map((item) => (
              <div key={item.title} className={`cat-kpi-card kpi-${item.tone} p-5`}>
                <div className="catastro-kpi-label">{item.title}</div>
                <div className="mt-3 text-lg font-semibold text-[var(--cat-text)]">{fmtMes(item.month)}</div>
                <div className="mt-3 font-mono text-[clamp(2rem,3vw,2.8rem)] font-bold leading-none text-[var(--cat-card-text)]">
                  {fmtNumber(item.value)}
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--cat-card-muted)]">{item.helper}</div>
              </div>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          title="Radar Histórico"
          subtitle="Lectura anual comparando ingresos, salidas, presión, reutilización y cambios internos sobre el runtime del parque."
        >
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {yearly.map(([year, summary]) => (
              <div key={year} className="catastro-panel-soft rounded-3xl p-5">
                <div className="catastro-kpi-label">{year}</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="cat-runtime-stat">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">Ingresos</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--cat-text)]">{fmtNumber(summary.ingresos)}</div>
                  </div>
                  <div className="cat-runtime-stat">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">Salidas</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--cat-text)]">{fmtNumber(summary.salidas)}</div>
                  </div>
                  <div className="cat-runtime-stat">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">Presión</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--cat-text)]">{fmtNumber(summary.presion)}</div>
                  </div>
                  <div className="cat-runtime-stat">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">Reutilización</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--cat-text)]">{fmtNumber(summary.devoluciones)}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-[var(--cat-text-muted)]">
                  {fmtNumber(summary.movimientos)} movimientos totales · {fmtNumber(summary.internos)} cambios internos.
                </div>
              </div>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          title="Timeline Visual"
          subtitle="Feed operativo mensual del parque con presión, movimientos, balance y lectura de estabilidad."
        >
          <div className="mt-5 hidden md:block">
            <div className="cat-timeline cat-timeline-balanced">
              {timelinePairs.map((pair) => (
                <div
                  key={`pair-${pair.left?.mes ?? pair.right?.mes ?? "empty"}`}
                  className="cat-timeline-row"
                >
                  <div className="cat-timeline-slot">
                    {pair.left ? (
                      <TimelineEventCard
                        key={`left-${pair.left.mes}`}
                        row={pair.left}
                        side="left"
                        maxMovimientos={maxMovimientos}
                        maxIngresos={maxIngresos}
                        maxSalidas={maxSalidas}
                        maxInternos={maxInternos}
                        maxDevoluciones={maxDevoluciones}
                        maxPresion={maxPresion}
                      />
                    ) : (
                      <div className="cat-timeline-slot-empty" />
                    )}
                  </div>

                  <div className="cat-timeline-centerline" aria-hidden="true" />

                  <div className="cat-timeline-slot">
                    {pair.right ? (
                      <TimelineEventCard
                        key={`right-${pair.right.mes}`}
                        row={pair.right}
                        side="right"
                        maxMovimientos={maxMovimientos}
                        maxIngresos={maxIngresos}
                        maxSalidas={maxSalidas}
                        maxInternos={maxInternos}
                        maxDevoluciones={maxDevoluciones}
                        maxPresion={maxPresion}
                      />
                    ) : (
                      <div className="cat-timeline-slot-empty" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 md:hidden">
            <div className="cat-timeline cat-timeline-mobile">
              {reversed.map((row) => (
                <TimelineEventCard
                  key={`mobile-${row.mes}`}
                  row={row}
                  side="left"
                  maxMovimientos={maxMovimientos}
                  maxIngresos={maxIngresos}
                  maxSalidas={maxSalidas}
                  maxInternos={maxInternos}
                  maxDevoluciones={maxDevoluciones}
                  maxPresion={maxPresion}
                />
              ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          title="Mapa De Calor Operacional"
          subtitle="Lectura rápida por mes para reconocer presión, movimientos y balance sin caer en una tabla plana."
        >
          <div className="mt-5 cat-heat-grid">
            {rows.map((row) => {
              const movementOpacity = heatOpacity(row.movimientos_total, maxMovimientos, 0.14, 0.24);
              const pressureOpacity = heatOpacity(row.presion_compra, maxPresion, 0.1, 0.42);
              const heatLevel = getHeatLevel(row, { maxMovimientos, maxPresion, maxDevoluciones });
              const glowColor =
                heatLevel === "critical"
                  ? `rgba(255,71,87,${Math.min(pressureOpacity + 0.08, 0.62)})`
                  : heatLevel === "reuse"
                    ? `rgba(0,229,153,${Math.min(movementOpacity + 0.06, 0.48)})`
                    : heatLevel === "positive"
                      ? `rgba(0,198,255,${Math.min(movementOpacity + 0.06, 0.44)})`
                  : heatLevel === "high"
                    ? `rgba(255,107,53,${Math.min(pressureOpacity + 0.06, 0.54)})`
                    : `rgba(42,95,255,${Math.min(movementOpacity + 0.04, 0.34)})`;
              const accentColor =
                heatLevel === "critical"
                  ? `rgba(255,71,87,${Math.min(pressureOpacity + 0.04, 0.44)})`
                  : heatLevel === "reuse"
                    ? `rgba(0,229,153,${Math.min(movementOpacity + 0.03, 0.36)})`
                    : heatLevel === "positive"
                      ? `rgba(0,198,255,${Math.min(movementOpacity + 0.03, 0.32)})`
                  : heatLevel === "high"
                    ? `rgba(255,107,53,${Math.min(pressureOpacity + 0.02, 0.4)})`
                    : `rgba(42,95,255,${Math.min(movementOpacity + 0.02, 0.28)})`;
              const statusLabel =
                heatLevel === "critical"
                  ? "Presión alta"
                  : heatLevel === "reuse"
                    ? "Reutilización alta"
                    : heatLevel === "positive"
                      ? "Balance positivo"
                      : heatLevel === "high"
                        ? "Carga alta"
                        : "Mes estable";

              return (
                <div
                  key={`heat-${row.mes}`}
                  className={`cat-heat-card level-${heatLevel}`}
                  style={{
                    background: `linear-gradient(180deg, rgba(13,18,32,0.96), rgba(9,14,26,0.96)), radial-gradient(circle at top right, rgba(0,198,255,${movementOpacity}), transparent 26%), radial-gradient(circle at bottom left, ${glowColor}, transparent 32%), radial-gradient(circle at center, ${accentColor}, transparent 55%)`,
                  }}
                >
                  <div className="catastro-kpi-label cat-heat-month">{fmtMes(row.mes)}</div>
                  <div className="mt-2">
                    <span className={`${getHeatBadgeTone(heatLevel)} cat-heat-badge`}>{statusLabel}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="cat-heat-metric-name">Movimientos</div>
                      <div className="cat-heat-metric-value mt-1 font-semibold">{fmtNumber(row.movimientos_total)}</div>
                    </div>
                    <div>
                      <div className="cat-heat-metric-name">Presión</div>
                      <div className="cat-heat-metric-value mt-1 font-semibold">{fmtNumber(row.presion_compra)}</div>
                    </div>
                    <div>
                      <div className="cat-heat-metric-name">Onboarding</div>
                      <div className="cat-heat-metric-value mt-1 font-semibold">{fmtNumber(row.ingresos_nuevos)}</div>
                    </div>
                    <div>
                      <div className="cat-heat-metric-name">Bajas / salidas</div>
                      <div className="cat-heat-metric-value mt-1 font-semibold">{fmtNumber(row.salidas_totales)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionShell>

        <SectionShell
          title="Breakdowns Históricos"
          subtitle="Segmentos de empresa, plataforma, política y ámbito para entender dónde se concentra la presión histórica."
        >
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="catastro-panel-soft rounded-3xl p-5">
              <div className="catastro-kpi-label">Presión explicada por ingresos sin equipo</div>
              <div className="mt-3 text-3xl font-semibold text-[var(--cat-text)]">{fmtPct(pressureExplainedByNoSku)}</div>
              <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                {fmtPct(pressureExplainedByNoSku)} de la presión histórica de compra proviene de ingresos sin equipo asignado.
              </div>
            </div>
            <div className="catastro-panel-soft rounded-3xl p-5">
              <div className="catastro-kpi-label">Lectura ejecutiva</div>
              <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{pressureNarrative}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {topDimensions.map(([dimensionName, items]) => {
              const maxBar = Math.max(...items.map((item) => Math.max(item.movimientos_total, item.presion_compra)), 1);
              return (
                <div key={dimensionName} className="catastro-panel-soft rounded-3xl p-5">
                  <h3 className="text-lg font-semibold text-[var(--cat-text)]">{prettyDimensionName(dimensionName)}</h3>
                  <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
                    Top {items.length} segmentos por volumen histórico y presión operativa.
                  </p>

                  <div className="mt-5 space-y-4">
                    {items.map((item) => (
                      <div key={`${dimensionName}-${item.value}`} className="catastro-inset rounded-2xl p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-base font-semibold text-[var(--cat-text)]">
                              {item.display_value ?? item.value}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                              Movimientos {fmtNumber(item.movimientos_total)} · presión {fmtNumber(item.presion_compra)}
                            </div>
                            {item.interpretation && item.interpretation !== "normal" ? (
                              <div className="mt-3">
                                <span className={getBreakdownBadgeTone(item.interpretation)}>
                                  {item.interpretation === "sin_equipo_presion" ? "Presión real sin equipo" : "Dato incompleto"}
                                </span>
                              </div>
                            ) : null}
                            {item.explanatory_note ? (
                              <div className="mt-3 text-xs leading-6 text-[var(--cat-text-soft)]">
                                {item.explanatory_note}
                              </div>
                            ) : null}
                          </div>
                          <div className="cat-badge-stack">
                            <span className={getStatusClassName("info")}>Ingresos {fmtNumber(item.ingresos_totales)}</span>
                            <span className={getStatusClassName("observacion")}>Salidas {fmtNumber(item.salidas_totales)}</span>
                            <span className={getStatusClassName("reutilizable")}>Con equipo {fmtNumber(item.ingresos_con_equipo)}</span>
                            <span className={getStatusClassName("renovar")}>Sin equipo {fmtNumber(item.ingresos_sin_equipo)}</span>
                          </div>
                        </div>

                        <div className="mt-4 cat-command-bar">
                          <span
                            className="bg-[linear-gradient(90deg,var(--cat-primary)_0%,var(--cat-success)_100%)]"
                            style={{ width: `${barWidth(Math.max(item.movimientos_total, item.presion_compra), maxBar)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionShell>

        <SectionShell
          title="Calidad Del Histórico"
          subtitle="Qué está consolidado desde MTR y qué vacíos todavía condicionan la lectura histórica exacta."
        >
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="catastro-panel-soft rounded-3xl p-5">
              <div className="catastro-kpi-label">Google Sheets raw</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--cat-text)]">
                {data.calidad_datos.google_sheet_history_from ? fmtMes(data.calidad_datos.google_sheet_history_from) : "Sin historial"}
              </div>
              <div className="mt-2 text-sm text-[var(--cat-text-muted)]">
                Historia visible desde {data.calidad_datos.google_sheet_history_from ?? "—"} · runs {fmtNumber(data.calidad_datos.google_sheet_runs)}
              </div>
            </div>
            <div className="catastro-panel-soft rounded-3xl p-5">
              <div className="catastro-kpi-label">Eventos sin SKU</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--cat-text)]">{fmtNumber(data.calidad_datos.eventos_sin_sku)}</div>
              <div className="mt-2 text-sm text-[var(--cat-text-muted)]">
                Reducen el enriquecimiento histórico por marca, modelo y OS.
              </div>
            </div>
            <div className="catastro-panel-soft rounded-3xl p-5">
              <div className="catastro-kpi-label">Fechas futuras excluidas</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--cat-text)]">{fmtNumber(data.calidad_datos.future_records_excluded)}</div>
              <div className="mt-2 text-sm text-[var(--cat-text-muted)]">
                Se filtran para no inflar el runtime histórico con eventos no ocurridos.
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="catastro-panel-soft rounded-3xl p-5">
              <div className="text-lg font-semibold text-[var(--cat-text)]">Notas de consolidación</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                {(data.calidad_datos.notes ?? []).map((note) => (
                  <div key={note} className="catastro-inset rounded-2xl px-4 py-3">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="catastro-panel-soft rounded-3xl p-5">
              <div className="text-lg font-semibold text-[var(--cat-text)]">Cobertura del feed</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                <div className="catastro-inset rounded-2xl px-4 py-3">
                  Histórico visible desde {fmtMes(data.periodo.date_from)} hasta {fmtMes(data.periodo.date_to)}.
                </div>
                <div className="catastro-inset rounded-2xl px-4 py-3">
                  Stock histórico reconstruible: {data.calidad_datos.stock_historico_reconstruible ? "sí" : "parcial"}.
                </div>
                <div className="catastro-inset rounded-2xl px-4 py-3">
                  Meses sin movimientos: {(data.calidad_datos.months_without_movements ?? []).length ? data.calidad_datos.months_without_movements?.map(fmtMes).join(", ") : "ninguno visible"}.
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        <section className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="catastro-button-secondary rounded-full px-5 py-3 text-sm transition hover:-translate-y-0.5">
            Volver a Home
          </Link>
          <Link href="/estadisticas" className="catastro-button-secondary rounded-full px-5 py-3 text-sm transition hover:-translate-y-0.5">
            Ver estadísticas actuales
          </Link>
          <Link href="/planeacion-compra" className="catastro-button-secondary rounded-full px-5 py-3 text-sm transition hover:-translate-y-0.5">
            Ir a planeación de compra
          </Link>
        </section>
      </div>
    </main>
  );
}
