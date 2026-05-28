"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  isSpotlightSku,
  prettyReconciliationStatus,
  reconciliationClasses,
  reconciliationHelp,
} from "@/lib/reconciliation-ui";
import { prettyJiraBucket, prettyOperationalStatus } from "@/lib/statusMatrix";
import { getStatusClassName } from "@/lib/statusStyles";

type Severidad = "CRITICAL" | "WARN" | "INFO" | "NORMAL";

export type EquipoRow = {
  id_equipo: string;
  estado?: string | null;
  asignado_a?: string | null;
  last_event_persona?: string | null;
  severidad?: Severidad | null;
  cliente?: string | null;
  marca_modelo?: string | null;
  tipo_colaborador?: string | null;
  localizacion?: string | null;
  ciudad_comuna?: string | null;
  alertas_resumen?: string | null;
  jira_open_count?: number | null;
  jira_board_bucket?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ml_alert_code?: string | null;
  ml_motivo_principal?: string | null;
  ml_explain_summary?: string | null;
  ml_scored_at?: string | null;
  ml_scored_at_v3?: string | null;
  ml_risk_level?: string | null;
  ml_score?: number | null;
  ml_link_path?: string | null;
  ml_score_v2?: number | null;
  ml_risk_level_v2?: string | null;
  ml_alert_code_v2?: string | null;
  ml_score_v3?: number | null;
  ml_risk_level_v3?: string | null;
  ml_alert_code_v3?: string | null;
  ml_main_driver_v3?: string | null;
  ml_risk_reason_v3?: string | null;
  ml_explain_summary_v3?: string | null;
  ml_version?: string | null;
  ml_score_delta_v3_vs_v2?: number | null;
  priority_final_rank?: number | null;
  priority_final_sort_key?: number | null;
  conciliacion_estado?: string | null;
  origen_principal?: string | null;
};

export type ExecutionOverlayRow = {
  case_key: string;
  id_equipo: string;
  owner_display?: string | null;
  estado_seguimiento?: string | null;
  validacion_cierre?: string | null;
};

function sevClasses(sev?: string | null) {
  switch (sev) {
    case "CRITICAL":
      return "border-rose-300/60 bg-rose-100/80 text-rose-800";
    case "WARN":
      return "border-amber-300/60 bg-amber-100/80 text-amber-800";
    case "INFO":
      return "border-sky-300/60 bg-sky-100/80 text-sky-800";
    default:
      return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
  }
}

function actionClasses(tone: string) {
  switch (tone) {
    case "red":
      return "border-rose-300/60 bg-rose-100/80 text-rose-800";
    case "amber":
      return "border-amber-300/60 bg-amber-100/80 text-amber-800";
    case "sky":
      return "border-sky-300/60 bg-sky-100/80 text-sky-800";
    default:
      return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
  }
}


function locationBadge(loc?: string | null, city?: string | null) {
  const l = (loc ?? "").toLowerCase().trim();
  const c = (city ?? "").toLowerCase().trim();

  if (!l) {
    return {
      label: "Sin dato",
      short: "—",
      cls: "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]",
      bucket: "sin_dato",
    };
  }

  if (l.includes("chile")) {
    if (c.includes("santiago")) {
      return {
        label: "Chile · Santiago",
        short: "Chile",
        cls: "border-emerald-300/60 bg-emerald-100/80 text-emerald-800",
        bucket: "chile",
      };
    }

    return {
      label: "Chile · Región",
      short: "Chile",
      cls: "border-emerald-300/60 bg-emerald-100/80 text-emerald-800",
      bucket: "chile",
    };
  }

  return {
    label: "Internacional",
    short: "Inter.",
    cls: "border-violet-300/60 bg-violet-100/80 text-violet-800",
    bucket: "internacional",
  };
}

function estadoClasses(estado?: string | null) {
  return getStatusClassName(estado, { domain: "operacion" });
}

function jiraBucketClasses(bucket?: string | null) {
  return getStatusClassName(bucket, { domain: "jira" });
}

function trackingBadge(status?: string | null) {
  const key = String(status ?? "PENDIENTE").toUpperCase();
  if (key === "EN_REVISION") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "RESUELTO") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (key === "ESCALADO") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  if (key === "DESCARTADO") return "border-slate-300/60 bg-slate-100/80 text-slate-700";
  return "border-sky-300/60 bg-sky-100/80 text-sky-800";
}

function validationBadge(status?: string | null) {
  const key = String(status ?? "").toUpperCase();
  if (key === "VALIDADO_CRUCE") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (key === "REABIERTO") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  if (key === "MANUAL") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  return "border-slate-300/60 bg-slate-100/80 text-slate-700";
}

function validationLabel(status?: string | null) {
  const key = String(status ?? "").toUpperCase();
  if (key === "VALIDADO_CRUCE") return "Validado";
  if (key === "REABIERTO") return "Reabierto";
  if (key === "MANUAL") return "Manual";
  return "Sin validación";
}

function prettyReconciliation(status?: string | null) {
  if (!(status ?? "").trim()) return "Sin conciliación";
  return prettyReconciliationStatus(status);
}

function prettyTipo(tipo?: string | null) {
  const key = (tipo ?? "").toLowerCase();
  if (!key || key === "unknown") return "Sin tipificar";
  if (key === "core") return "Core";
  if (key === "staffing") return "Staffing";
  return tipo ?? "Sin tipificar";
}

function decisionFor(row: EquipoRow) {
  const modelo = (row.marca_modelo ?? "").toLowerCase();
  const alerta = (row.alertas_resumen ?? "").toLowerCase();
  const score = Number(row.ml_score ?? 0);
  const tipo = (row.tipo_colaborador ?? "").toLowerCase();

  if (modelo.includes("dell") || modelo.includes("latitude")) {
    return {
      title: "Dar de baja / renovar",
      detail: "Política Dell",
      tone: "red",
    };
  }

  if (modelo.includes("asus")) {
    return {
      title: "Dar de baja / renovar",
      detail: "Política Asus",
      tone: "red",
    };
  }

  if (tipo === "staffing" && modelo.includes("a2141")) {
    return {
      title: "Renovar",
      detail: "Staffing con A2141",
      tone: "red",
    };
  }

  if (
    modelo.includes("a2442") ||
    modelo.includes("a2485") ||
    modelo.includes("a2338") ||
    modelo.includes("a2337")
  ) {
    return {
      title: "Observación",
      detail: "Vida útil vigente",
      tone: "sky",
    };
  }

  if (alerta.includes("sin asignación") || alerta.includes("sin asignacion")) {
    return {
      title: "Asignar o reasignar",
      detail: "Revisar disponibilidad",
      tone: "amber",
    };
  }

  if (score >= 8) {
    return {
      title: "Revisión inmediata",
      detail: "Score alto",
      tone: "red",
    };
  }

  if (alerta.includes("rotación") || alerta.includes("rotacion")) {
    return {
      title: "Revisar estabilidad",
      detail: "Rotación alta",
      tone: "amber",
    };
  }

  if (tipo === "core") {
    return {
      title: "Evaluar reutilización",
      detail: "Parque Core",
      tone: "sky",
    };
  }

  return {
    title: "Mantener",
    detail: "Operación normal",
    tone: "neutral",
  };
}

function SeverityBadge({ sev }: { sev?: string | null }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${sevClasses(sev)}`}>
      {sev ?? "NORMAL"}
    </span>
  );
}

function ScoreBadge({ score }: { score?: number | null }) {
  const n = Number(score ?? 0);
  const cls =
    n >= 8
      ? "border-rose-300/60 bg-rose-100/80 text-rose-800"
      : n >= 4
      ? "border-amber-300/60 bg-amber-100/80 text-amber-800"
      : "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";

  return (
    <span className={`inline-flex min-w-[52px] justify-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {n}
    </span>
  );
}

function DecisionBadge({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className={`inline-flex flex-col rounded-2xl border px-3 py-2 ${actionClasses(tone)}`}>
      <span className="text-xs font-semibold">{title}</span>
      <span className="mt-1 text-[11px] opacity-80">{detail}</span>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "neutral" | "red" | "amber" | "sky";
}) {
  const cls =
    tone === "red"
      ? "kpi-red"
      : tone === "amber"
      ? "kpi-yellow"
      : tone === "sky"
      ? "kpi-purple"
      : "kpi-cyan";

  return (
    <div className={`cat-kpi-card ${cls} p-5`}>
      <div className="catastro-kpi-label">{title}</div>
      <div className="mt-3 font-mono text-[clamp(1.9rem,3vw,2.7rem)] font-bold leading-none text-[var(--cat-card-text)]">{value}</div>
      {subtitle ? <div className="catastro-kpi-helper">{subtitle}</div> : null}
    </div>
  );
}

function SignalRuntimeCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  tone: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
}) {
  return (
    <div className={`cat-kpi-card kpi-${tone} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="catastro-kpi-label">{label}</div>
        <span className="text-base opacity-80">{icon}</span>
      </div>
      <div className="mt-3 font-mono text-[clamp(1.8rem,2.4vw,2.5rem)] font-bold leading-none text-[var(--cat-card-text)]">
        {value}
      </div>
      <div className="mt-3 text-xs leading-5 text-[var(--cat-card-muted)]">{detail}</div>
    </div>
  );
}

function ExplainLink({ row }: { row: EquipoRow }) {
  if (row.ml_link_path) {
    return (
      <Link
        href={row.ml_link_path}
        className="font-medium text-[var(--cat-primary)] hover:text-[var(--cat-primary-strong)]"
      >
        Explain ML
      </Link>
    );
  }

  return <span className="text-[var(--cat-text-soft)]">—</span>;
}

function assetClassFor(row: EquipoRow) {
  const text = `${row.marca_modelo ?? ""} ${row.marca ?? ""} ${row.modelo ?? ""}`.toLowerCase();
  if (text.includes("ipad")) return "tablet";
  if (text.includes("iphone") || text.includes("galaxy") || text.includes("vivo")) return "celular";
  return "equipo";
}

export default function ActivosTableClient({
  items,
  initialEstado,
  initialJiraBucket,
  initialHasJira = false,
  initialClase,
  jiraBoardCounts = {},
  executionRows = [],
}: {
  items: EquipoRow[];
  initialEstado?: string;
  initialJiraBucket?: string;
  initialHasJira?: boolean;
  initialClase?: string;
  jiraBoardCounts?: Record<string, number>;
  executionRows?: ExecutionOverlayRow[];
}) {
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState("todos");
  const [severity, setSeverity] = useState("todas");
  const [tipo, setTipo] = useState("todos");
  const [estado] = useState((initialEstado ?? "todos").toUpperCase());
  const [jiraBucket] = useState((initialJiraBucket ?? "todos").toUpperCase());
  const [hasJira] = useState(initialHasJira);
  const [clase] = useState((initialClase ?? "todos").toLowerCase());

  const decisionOptions = [
    "todos",
    "Dar de baja / renovar",
    "Renovar",
    "Observación",
    "Asignar o reasignar",
    "Revisión inmediata",
    "Revisar estabilidad",
    "Evaluar reutilización",
    "Mantener",
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((r) => {
      const dec = decisionFor(r);

      const matchesSearch =
        !q ||
        (r.id_equipo ?? "").toLowerCase().includes(q) ||
        (r.cliente ?? "").toLowerCase().includes(q) ||
        (r.marca_modelo ?? "").toLowerCase().includes(q);

      const matchesDecision = decision === "todos" || dec.title === decision;
      const matchesSeverity = severity === "todas" || (r.severidad ?? "NORMAL") === severity;
      const matchesTipo = tipo === "todos" || (r.tipo_colaborador ?? "unknown") === tipo;
      const matchesEstado = estado === "TODOS" || (r.estado ?? "").toUpperCase().includes(estado);
      const matchesJiraBucket = jiraBucket === "TODOS" || (r.jira_board_bucket ?? "").toUpperCase() === jiraBucket;
      const matchesHasJira = !hasJira || Number(r.jira_open_count ?? 0) > 0;
      const matchesClase = clase === "todos" || assetClassFor(r) === clase;

      return matchesSearch && matchesDecision && matchesSeverity && matchesTipo && matchesEstado && matchesJiraBucket && matchesHasJira && matchesClase;
    });
  }, [items, search, decision, severity, tipo, estado, jiraBucket, hasJira, clase]);

  const ordered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const rankA = Number(a.priority_final_rank ?? 999999);
      const rankB = Number(b.priority_final_rank ?? 999999);
      if (rankA !== rankB) return rankA - rankB;

      const sortA = Number(a.priority_final_sort_key ?? 0);
      const sortB = Number(b.priority_final_sort_key ?? 0);
      return sortB - sortA;
    });
  }, [filtered]);

  const kpiCritical = ordered.filter((x) => x.severidad === "CRITICAL").length;
  const kpiWarn = ordered.filter((x) => x.severidad === "WARN").length;
  const kpiInfo = ordered.filter((x) => x.severidad === "INFO").length;
  const kpiSinAsignacion = ordered.filter((x) =>
    (x.alertas_resumen ?? "").toLowerCase().includes("sin asignación") ||
    (x.alertas_resumen ?? "").toLowerCase().includes("sin asignacion")
  ).length;

  const kpiJira = ordered.filter((x) => Number(x.jira_open_count ?? 0) > 0).length;
  const kpiDisponibles = ordered.filter((x) => (x.estado ?? "").toUpperCase().includes("DISPONIBLE") || (x.estado ?? "").toUpperCase().includes("STAND_BY")).length;
  const kpiAsignados = ordered.filter((x) => (x.estado ?? "").toUpperCase().includes("ASIGNADO")).length;
  const kpiInconsistencias = ordered.filter((x) => {
    const key = (x.conciliacion_estado ?? "").toUpperCase();
    return !!key && key !== "CONCILIADO";
  }).length;
  const spotlightRows = items
    .filter((x) => isSpotlightSku(x.id_equipo))
    .sort((a, b) => a.id_equipo.localeCompare(b.id_equipo));
  const executionByEquipo = useMemo(() => {
    const map = new Map<string, ExecutionOverlayRow>();
    executionRows.forEach((row) => {
      if (!row.id_equipo || map.has(row.id_equipo)) return;
      map.set(row.id_equipo, row);
    });
    return map;
  }, [executionRows]);

  const topCriticos = [...ordered]
    .sort((a, b) => {
      const rankA = Number(a.priority_final_rank ?? 999999);
      const rankB = Number(b.priority_final_rank ?? 999999);
      if (rankA !== rankB) return rankA - rankB;
      const jiraA = Number(a.jira_open_count ?? 0);
      const jiraB = Number(b.jira_open_count ?? 0);
      if (jiraA !== jiraB) return jiraB - jiraA;
      return Number(b.ml_score ?? 0) - Number(a.ml_score ?? 0);
    })
    .slice(0, 5);

  const topClientes = [...ordered].reduce<Record<string, number>>((acc, row) => {
    const key = (row.cliente ?? "Sin cliente").trim() || "Sin cliente";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const clientesResumen = Object.entries(topClientes)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);

  const visibleBucketsResumen = [...ordered].reduce<Record<string, number>>((acc, row) => {
    const key = (row.jira_board_bucket ?? "").toUpperCase();
    if (!key || Number(row.jira_open_count ?? 0) <= 0) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const visibleBucketsTop = Object.entries(visibleBucketsResumen)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6);
  const boardBucketsTop = Object.entries(jiraBoardCounts)
    .filter(([, total]) => Number(total ?? 0) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const boardBucketTarget = jiraBucket !== "TODOS" ? Number(jiraBoardCounts[jiraBucket] ?? 0) : 0;

  const visible = ordered.slice(0, 200);

  const locChile = ordered.filter((x) => locationBadge(x.localizacion, x.ciudad_comuna).bucket === "chile").length;
  const locIntl = ordered.filter((x) => locationBadge(x.localizacion, x.ciudad_comuna).bucket === "internacional").length;
  const locSinDato = ordered.filter((x) => locationBadge(x.localizacion, x.ciudad_comuna).bucket === "sin_dato").length;
  const totalLoc = ordered.length || 1;

  const pctChile = Math.round((locChile / totalLoc) * 100);
  const pctIntl = Math.round((locIntl / totalLoc) * 100);
  const pctSinDato = Math.round((locSinDato / totalLoc) * 100);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Críticos" value={kpiCritical} subtitle="Atención inmediata" tone="red" />
        <KpiCard title="Warnings" value={kpiWarn} subtitle="Requieren seguimiento" tone="amber" />
        <KpiCard title="Con Jira" value={kpiJira} subtitle="Equipos visibles con respaldo Jira" tone="sky" />
        <KpiCard title="Inconsistencias" value={kpiInconsistencias} subtitle="Cruce MTR vs Jira" tone="amber" />
        <KpiCard title="Disponibles / Asignados" value={`${kpiDisponibles} / ${kpiAsignados}`} subtitle="Base vs uso actual" tone="sky" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="catastro-panel-strong rounded-3xl p-6">
          <div className="cat-section-header-grid">
            <div>
              <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-[11px] font-semibold uppercase">
                Operational Queue
              </div>
              <h2 className="mt-4 text-[clamp(1.8rem,2.5vw,2.4rem)] font-semibold text-[var(--cat-text)]">
                Qué revisar hoy
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--cat-text-muted)]">
                Cola priorizada de equipos con presión operativa, issues Jira, alertas y contexto real del parque.
              </p>
            </div>
            <div className="catastro-inset cat-mini-panel flex min-w-[180px] flex-col justify-between rounded-2xl">
              <div className="catastro-kpi-label">Foco visible</div>
              <div className="mt-2 font-mono text-[clamp(1.9rem,2.8vw,2.7rem)] font-bold text-[var(--cat-text)]">
                {topCriticos.length}
              </div>
              <div className="text-xs leading-5 text-[var(--cat-text-muted)]">
                SKU priorizados para lectura ejecutiva inmediata.
              </div>
            </div>
          </div>

          <div className="mt-6 cat-sku-row">
            {topCriticos.map((r) => {
              const decision = decisionFor(r);

              return (
                <div key={r.id_equipo} className="catastro-inset cat-sku-card rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-[var(--cat-text)]">{r.id_equipo}</div>
                      <div className="cat-sku-description mt-1">
                        {r.cliente ?? "—"} · {r.marca_modelo ?? "—"}
                      </div>
                    </div>
                    <ScoreBadge score={r.ml_score} />
                  </div>

                  <div className="cat-badge-stack">
                    <span className={estadoClasses(r.estado)}>
                      {prettyOperationalStatus(r.estado)}
                    </span>
                    {Number(r.jira_open_count ?? 0) > 0 ? (
                      <span className={`cat-badge-compact inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${jiraBucketClasses(r.jira_board_bucket)}`}>
                        Jira {prettyJiraBucket(r.jira_board_bucket)} · {Number(r.jira_open_count ?? 0)}
                      </span>
                    ) : null}
                    {r.conciliacion_estado ? (
                      <span
                        title={reconciliationHelp(r.conciliacion_estado)}
                        className={`cat-badge-compact inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${reconciliationClasses(r.conciliacion_estado)}`}
                      >
                        {prettyReconciliation(r.conciliacion_estado)}
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <SeverityBadge sev={r.severidad} />
                  </div>

                  <div className="cat-sku-description">
                    {r.ml_explain_summary ?? r.alertas_resumen ?? "Sin alertas"}
                  </div>

                  <div className="text-xs text-[var(--cat-text-soft)]">
                    Tipo: {prettyTipo(r.tipo_colaborador)}
                  </div>

                  <div>
                    <DecisionBadge
                      title={decision.title}
                      detail={decision.detail}
                      tone={decision.tone}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/equipos/${encodeURIComponent(r.id_equipo)}`}
                      className="text-sm font-medium text-[var(--cat-primary)] hover:underline"
                    >
                      Ver equipo →
                    </Link>
                    <ExplainLink row={r} />
                  </div>
                </div>
              );
            })}

            {topCriticos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--cat-border)] p-6 text-[var(--cat-text-soft)]">
                No hay equipos priorizados para mostrar.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <section className="catastro-panel-strong rounded-3xl p-6">
            <div className="cat-section-header-grid">
              <div>
                <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-[11px] font-semibold uppercase">
                  Runtime Signals
                </div>
                <h2 className="mt-4 text-[clamp(1.5rem,2vw,2rem)] font-semibold text-[var(--cat-text)]">Lectura rápida</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--cat-text-muted)]">
                  Señales operacionales del parque para seguimiento diario y lectura de jefatura.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SignalRuntimeCard label="Sin asignación" value={kpiSinAsignacion} detail="Casos sin dueño operativo claro" icon="◉" tone="red" />
              <SignalRuntimeCard label="Issues Jira" value={kpiJira} detail="Equipos visibles hoy con workflow Jira" icon="↗" tone="orange" />
              <SignalRuntimeCard label="Inconsistencias" value={kpiInconsistencias} detail="Brechas visibles entre MTR y Jira" icon="△" tone="yellow" />
              <SignalRuntimeCard label="Disponibles" value={kpiDisponibles} detail="Base visible para absorción operativa" icon="◎" tone="green" />
              <SignalRuntimeCard label="Foco alto / medio" value={kpiCritical + kpiWarn} detail="Equipos con señales críticas o warning" icon="◌" tone="cyan" />
              <SignalRuntimeCard label="Asignados" value={kpiAsignados} detail="Parque actualmente en uso operativo" icon="↺" tone="purple" />
            </div>

            <div className="mt-5 max-w-[900px] rounded-2xl border border-[rgba(63,98,182,0.18)] bg-[rgba(13,18,32,0.72)] px-4 py-3 text-xs leading-6 text-[var(--cat-text-soft)] opacity-75">
              Nota operacional: MTR manda sobre movimientos físicos reales. Jira manda sobre workflow administrativo.
              Una inconsistencia visible aquí representa una brecha entre fuentes, no un error automático del sistema.
            </div>
          </section>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        {spotlightRows.length ? (
          <section className="catastro-panel rounded-3xl p-6">
            <div className="cat-section-header-grid">
              <div>
                <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-[11px] font-semibold uppercase">
                  Jira Equipment Feed
                </div>
                <h2 className="mt-4 text-[clamp(1.6rem,2.2vw,2.1rem)] font-semibold text-[var(--cat-text)]">SKU nuevos Jira / EQUIPAMIENTO</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--cat-text-muted)]">
                  Seguimiento dedicado para los SKU 623-632, con conciliación y estado operacional visibles sin comprimir el layout.
                </p>
              </div>
              <div className="catastro-inset cat-mini-panel min-w-[170px] rounded-2xl xl:text-right">
                <div className="catastro-kpi-label">Visible ahora</div>
                <div className="mt-2 font-mono text-[clamp(1.8rem,2.5vw,2.4rem)] font-bold text-[var(--cat-text)]">
                  {spotlightRows.length}
                </div>
                <div className="text-xs leading-5 text-[var(--cat-text-muted)]">SKU visibles con seguimiento dedicado.</div>
              </div>
            </div>
            <div className="cat-sku-row mt-5">
              {spotlightRows.map((row) => (
                <div key={row.id_equipo} className="catastro-inset cat-sku-card rounded-2xl p-4">
                  <div className="text-lg font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                  <div className="cat-badge-stack">
                    <span
                      className={`cat-badge-compact inline-flex rounded-full border px-3 py-1 text-xs font-medium ${reconciliationClasses(row.conciliacion_estado)}`}
                      title={reconciliationHelp(row.conciliacion_estado)}
                    >
                      {prettyReconciliation(row.conciliacion_estado)}
                    </span>
                    {row.estado ? <span className={estadoClasses(row.estado)}>{prettyOperationalStatus(row.estado)}</span> : null}
                  </div>
                  <div className="cat-sku-description">{row.marca_modelo ?? "Modelo sin detalle visible"}</div>
                  {Number(row.jira_open_count ?? 0) > 0 ? (
                    <div className="cat-technical-value text-xs text-[var(--cat-text-soft)]">
                      Jira: {prettyJiraBucket(row.jira_board_bucket)} · {Number(row.jira_open_count ?? 0)} issue{Number(row.jira_open_count ?? 0) === 1 ? "" : "s"}
                    </div>
                  ) : (
                    <div className="cat-technical-value text-xs text-[var(--cat-text-soft)]">Sin issues Jira visibles</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-6">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-[var(--cat-text)]">Top clientes del parque</h2>
            <p className="mt-2 text-sm text-[var(--cat-text-muted)]">Concentración operacional actual por cliente visible.</p>
            <div className="mt-5 space-y-3">
              {clientesResumen.map(([cliente, total]) => {
                const max = Math.max(...clientesResumen.map(([, count]) => count), 1);
                return (
                  <div key={cliente} className="catastro-inset cat-mini-panel rounded-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--cat-text)]">{cliente}</div>
                      <div className="font-mono text-base font-bold text-[var(--cat-primary)]">{total}</div>
                    </div>
                    <div className="cat-command-bar">
                      <span
                        className="bg-[linear-gradient(90deg,var(--cat-primary)_0%,#6fd6ff_100%)]"
                        style={{ width: `${Math.max(8, (total / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-[var(--cat-text)]">Board Jira real</h2>
            <p className="mt-2 text-sm text-[var(--cat-text-muted)]">Cards administrativas sincronizadas hoy desde Jira.</p>
            <div className="mt-5 space-y-3">
              {boardBucketsTop.length ? (
                boardBucketsTop.map(([bucket, total]) => {
                  const max = Math.max(...boardBucketsTop.map(([, count]) => Number(count)), 1);
                  return (
                    <div key={bucket} className="catastro-inset cat-mini-panel rounded-2xl">
                      <div className="flex items-center justify-between gap-3">
                        <span className={jiraBucketClasses(bucket)}>{prettyJiraBucket(bucket)}</span>
                        <div className="font-mono text-base font-bold text-[var(--cat-text)]">{Number(total)}</div>
                      </div>
                      <div className="cat-command-bar">
                        <span
                          className="bg-[linear-gradient(90deg,var(--cat-purple)_0%,var(--cat-primary)_100%)]"
                          style={{ width: `${Math.max(8, (Number(total) / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="catastro-inset cat-mini-panel rounded-2xl text-sm text-[var(--cat-text-soft)]">
                  Sin buckets Jira sincronizados.
                </div>
              )}
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-[var(--cat-text)]">Buckets Jira sobre parque visible</h2>
            <p className="mt-2 text-sm text-[var(--cat-text-muted)]">Equipos visibles en Activos con bucket Jira asociado hoy.</p>
            <div className="mt-5 space-y-3">
              {visibleBucketsTop.length ? (
                visibleBucketsTop.map(([bucket, total]) => {
                  const max = Math.max(...visibleBucketsTop.map(([, count]) => count), 1);
                  return (
                    <div key={bucket} className="catastro-inset cat-mini-panel rounded-2xl">
                      <div className="flex items-center justify-between gap-3">
                        <span className={jiraBucketClasses(bucket)}>{prettyJiraBucket(bucket)}</span>
                        <div className="font-mono text-base font-bold text-[var(--cat-text)]">{total}</div>
                      </div>
                      <div className="cat-command-bar">
                        <span
                          className="bg-[linear-gradient(90deg,var(--cat-primary)_0%,#6fd6ff_100%)]"
                          style={{ width: `${Math.max(8, (total / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="catastro-inset cat-mini-panel rounded-2xl text-sm text-[var(--cat-text-soft)]">
                  Sin equipos visibles con bucket Jira.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>



      <section className="catastro-panel rounded-3xl p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Filtros operativos</h2>
            <p className="mt-2 text-[var(--cat-text-muted)]">
              Busca por SKU, cliente o modelo y filtra por decisión, severidad y tipo de colaborador.
            </p>
          </div>

          <div className="text-sm text-[var(--cat-text-soft)]">
            {ordered.length} equipos filtrados
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar SKU, cliente o modelo"
            className="catastro-inset rounded-2xl px-4 py-3 text-sm text-[var(--cat-text)] outline-none placeholder:text-[var(--cat-text-soft)]"
          />

          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="catastro-inset rounded-2xl px-4 py-3 text-sm text-[var(--cat-text)] outline-none"
          >
            {decisionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="catastro-inset rounded-2xl px-4 py-3 text-sm text-[var(--cat-text)] outline-none"
          >
            {["todas", "CRITICAL", "WARN", "INFO", "NORMAL"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="catastro-inset rounded-2xl px-4 py-3 text-sm text-[var(--cat-text)] outline-none"
          >
            {["todos", "core", "staffing", "unknown"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {(estado !== "TODOS" || jiraBucket !== "TODOS" || hasJira || clase !== "todos") ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {estado !== "TODOS" ? (
              <span className={getStatusClassName(`estado actual ${estado}`)}>Estado actual: {estado}</span>
            ) : null}
            {jiraBucket !== "TODOS" ? (
              <span className={getStatusClassName(jiraBucket, { domain: "jira" })}>Bucket Jira visible: {prettyJiraBucket(jiraBucket)}</span>
            ) : null}
            {hasJira ? (
              <span className="catastro-chip-blue rounded-full px-3 py-2 text-xs">Con issues Jira</span>
            ) : null}
            {clase !== "todos" ? (
              <span className="catastro-chip-blue rounded-full px-3 py-2 text-xs">Clase: {clase}</span>
            ) : null}
          </div>
        ) : null}

        {jiraBucket !== "TODOS" ? (
          <div className="mt-4 rounded-2xl border border-sky-300/30 bg-sky-100/60 px-4 py-3 text-xs leading-6 text-sky-900">
            Board Jira real en <span className="font-semibold">{prettyJiraBucket(jiraBucket)}</span>:{" "}
            <span className="font-semibold">{boardBucketTarget}</span> card
            {boardBucketTarget === 1 ? "" : "s"}.
            Parque visible en Activos con ese bucket: <span className="font-semibold">{ordered.length}</span> equipo
            {ordered.length === 1 ? "" : "s"}.
          </div>
        ) : null}
      </section>

      <section className="catastro-panel rounded-3xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Tabla operativa</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-100/80 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Chile {pctChile}%
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/60 bg-violet-100/80 px-3 py-1 text-xs font-semibold text-violet-800">
                  Internacional {pctIntl}%
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--cat-border)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--cat-text-muted)]">
                  Sin dato {pctSinDato}%
                </span>
              </div>
            </div>
            <p className="mt-2 text-[var(--cat-text-muted)]">
              Vista principal del parque, priorizada para operación, logística y revisión rápida.
            </p>
          </div>
          <div className="text-sm text-[var(--cat-text-soft)]">
            Mostrando {visible.length} de {ordered.length}
          </div>
        </div>

        <div className="catastro-table-shell mt-6 overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-sm">
              <thead className="catastro-table-head">
                <tr className="text-left text-xs uppercase tracking-wide">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Modelo</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Jira</th>
                  <th className="p-3">ML</th>
                  <th className="p-3">Severidad</th>
                  <th className="p-3">Alerta</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Decisión</th>
                  <th className="p-3">Ubicación</th>
                  <th className="p-3 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const decision = decisionFor(r);
                  const spotlight = isSpotlightSku(r.id_equipo);
                  const tracked = executionByEquipo.get(r.id_equipo);

                  return (
                    <tr key={r.id_equipo} className={`catastro-row ${spotlight ? "bg-amber-50/40" : ""}`}>
                      <td className="p-3 font-medium text-[var(--cat-text)]">
                        <div className="flex flex-col gap-2">
                          <span>{r.id_equipo}</span>
                          {spotlight ? (
                            <span
                              title="SKU nuevo del proyecto Jira SKU / EQUIPAMIENTO. Solo cruza con MTR si existe match real."
                              className="cat-badge-compact inline-flex w-fit rounded-full border border-amber-300/60 bg-amber-100/80 px-3 py-1 text-[11px] font-semibold text-amber-800"
                            >
                              SKU nuevo Jira 623-632
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3 text-[var(--cat-text-muted)]">{r.cliente ?? "—"}</td>
                      <td className="p-3 text-[var(--cat-text-muted)]">{r.marca_modelo ?? "—"}</td>
                      <td className="p-3">
                        <span className={estadoClasses(r.estado)}>
                          {prettyOperationalStatus(r.estado)}
                        </span>
                      </td>
                      <td className="p-3">
                        {Number(r.jira_open_count ?? 0) > 0 ? (
                          <div className="flex flex-col gap-2">
                            <span className={`cat-badge-compact inline-flex rounded-full border px-3 py-1 text-xs font-medium ${jiraBucketClasses(r.jira_board_bucket)}`}>
                              {prettyJiraBucket(r.jira_board_bucket)}
                            </span>
                            <span className="text-xs text-[var(--cat-text-soft)]">
                              {Number(r.jira_open_count ?? 0)} issue{Number(r.jira_open_count ?? 0) === 1 ? "" : "s"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--cat-text-soft)]">Sin issues</span>
                        )}
                        {r.conciliacion_estado ? (
                          <div className="mt-2">
                            <span
                              title={reconciliationHelp(r.conciliacion_estado)}
                              className={`cat-badge-compact inline-flex rounded-full border px-3 py-1 text-xs font-medium ${reconciliationClasses(r.conciliacion_estado)}`}
                            >
                              {prettyReconciliation(r.conciliacion_estado)}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <div className="flex min-w-[180px] flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <ScoreBadge score={r.ml_score} />
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${sevClasses(r.ml_risk_level)}`}>
                              {r.ml_risk_level ?? "NORMAL"}
                            </span>
                            {r.ml_score_v3 != null ? (
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${sevClasses(r.ml_risk_level_v3)}`}>
                                v3 {r.ml_risk_level_v3 ?? "BAJA"} · {Number(r.ml_score_v3 ?? 0)}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-[var(--cat-text-soft)]">
                            {r.ml_explain_summary ?? r.ml_alert_code ?? r.ml_motivo_principal ?? "Sin explicación ML visible"}
                          </div>
                          {r.ml_score_v3 != null ? (
                            <div className="text-xs text-[var(--cat-text-soft)]">
                              v2 {Number(r.ml_score_v2 ?? r.ml_score ?? 0)} → v3 {Number(r.ml_score_v3 ?? 0)}
                              {r.ml_score_delta_v3_vs_v2 != null ? ` · Δ ${r.ml_score_delta_v3_vs_v2}` : ""}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3">
                        <SeverityBadge sev={r.severidad} />
                      </td>
                      <td className="p-3 text-[var(--cat-text-muted)]">{r.alertas_resumen ?? "Sin alertas"}</td>
                      <td className="p-3 text-[var(--cat-text-muted)]">
                        <span className={getStatusClassName(prettyTipo(r.tipo_colaborador))}>
                          {prettyTipo(r.tipo_colaborador)}
                        </span>
                      </td>
                      <td className="p-3">
                        <DecisionBadge
                          title={decision.title}
                          detail={decision.detail}
                          tone={decision.tone}
                        />
                      </td>
                      <td className="p-3">
                        {(() => {
                          const loc = locationBadge(r.localizacion, r.ciudad_comuna);
                          return (
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${loc.cls}`}>
                              {loc.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {tracked ? (
                            <>
                              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${trackingBadge(tracked.estado_seguimiento)}`}>
                                {prettyOperationalStatus(tracked.estado_seguimiento ?? "PENDIENTE")}
                              </span>
                              <div className="max-w-[180px] text-right text-[11px] leading-5 text-[var(--cat-text-soft)]">
                                {tracked.owner_display ?? "Sin owner real"}
                              </div>
                              {tracked.validacion_cierre ? (
                                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${validationBadge(tracked.validacion_cierre)}`}>
                                  {validationLabel(tracked.validacion_cierre)}
                                </span>
                              ) : null}
                              <Link
                                href={`/ejecucion/${encodeURIComponent(tracked.case_key)}`}
                                className="text-xs font-medium text-[var(--cat-primary)] hover:underline"
                              >
                                Bitácora →
                              </Link>
                            </>
                          ) : null}
                          <Link
                            href={`/equipos/${encodeURIComponent(r.id_equipo)}`}
                            className="font-medium text-[var(--cat-primary)] hover:underline"
                          >
                            Ver →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {visible.length === 0 ? (
                  <tr>
                    <td className="p-6 text-[var(--cat-text-soft)]" colSpan={11}>
                      {jiraBucket !== "TODOS" && boardBucketTarget > 0
                        ? `No hay equipos visibles en Activos para ${prettyJiraBucket(jiraBucket)}, aunque Jira si reporta ${boardBucketTarget} card${boardBucketTarget === 1 ? "" : "s"} en el board real.`
                        : "No hay equipos para mostrar con los filtros actuales."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-[var(--cat-text-soft)]">
          Orden actual: <code>priority_final_rank</code> asc + <code>priority_final_sort_key</code> desc.
        </p>
      </section>
    </div>
  );
}
