import Link from "next/link";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusDefinition, prettyOperationalStatus } from "@/lib/statusMatrix";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type OperacionAlertRow = {
  alert_id: string;
  id_equipo: string;
  tipo_alerta: string;
  titulo?: string | null;
  descripcion?: string | null;
  criticidad?: string | null;
  origen?: string | null;
  evidencia?: string | null;
  accion_sugerida?: string | null;
  fecha_detectada?: string | null;
  dias_abierta?: number | null;
  estado_alerta?: string | null;
  confianza_dato?: string | null;
};

type OperacionSummaryResponse = {
  kpis?: {
    alertas_criticas?: number | null;
    alertas_altas?: number | null;
    total_alertas_abiertas?: number | null;
    equipos_afectados?: number | null;
    confianza_score_promedio?: number | null;
    confianza_dato_general?: string | null;
    sla_promedio_dias?: number | null;
    aging_promedio_dias?: number | null;
    aging_operativo_promedio_dias?: number | null;
    ultima_alerta_detectada?: string | null;
  };
  alertas_por_origen?: Array<{ origen?: string | null; total?: number | null }>;
  alertas_por_tipo?: Array<{ tipo_alerta?: string | null; total?: number | null }>;
  alertas_por_criticidad?: Array<{ criticidad?: string | null; total?: number | null }>;
  available_filters?: {
    criticidades?: string[];
    origenes?: string[];
    tipos_alerta?: string[];
    estados_alerta?: string[];
  };
  copy_ejecutivo?: string | null;
  error?: string;
};

type OperacionAlertasResponse = {
  rows?: OperacionAlertRow[];
  count?: number;
  error?: string;
};

type OperacionConfianzaResponse = {
  distribution?: Array<{ confianza_dato?: string | null; equipos?: number | null }>;
  promedio?: number | null;
  error?: string;
};

type OperacionSlaResponse = {
  rows?: Array<{
    id_equipo: string;
    sla_estado?: string | null;
    jira_days_open_max?: number | null;
    aging_operativo_dias?: number | null;
    backlog_operativo?: boolean | null;
  }>;
  aggregates?: {
    sla_promedio_dias?: number | null;
    aging_promedio_dias?: number | null;
    equipos_en_backlog?: number | null;
  };
  error?: string;
};

type DashboardFallbackResponse = {
  overview?: {
    alertas_criticas?: number | null;
    alertas_warn?: number | null;
  } | null;
  operations?: {
    focos_operativos?: Array<{
      id_equipo: string;
      cliente?: string | null;
      estado_operativo?: string | null;
      priority_final_rank?: number | null;
      alertas_resumen?: string | null;
      jira_open_count?: number | null;
      last_event_date?: string | null;
    }>;
  } | null;
  integrations?: {
    jira?: {
      equipos_con_issues?: number | null;
      issues_abiertos?: number | null;
      max_dias_issue_abierto?: number | null;
      top_equipos?: Array<{
        id_equipo: string;
        cliente?: string | null;
        jira_open_count?: number | null;
        jira_days_open_max?: number | null;
        priority_final_rank?: number | null;
      }>;
      reconciliation?: {
        equipos_conciliados?: number | null;
        inconsistencias_mtr_jira?: number | null;
        jira_sin_match_mtr?: number | null;
        mtr_sin_match_jira?: number | null;
        creados_jira_sin_ingreso_mtr?: number | null;
        reservas_jira_pendientes?: number | null;
      } | null;
      top_inconsistencias?: Array<{
        id_equipo: string;
        cliente?: string | null;
        conciliacion_estado?: string | null;
        jira_estado?: string | null;
        mtr_estado?: string | null;
      }>;
    } | null;
  } | null;
  errors?: Record<string, string> | null;
};

type ExecutionQueueRow = {
  case_key: string;
  source_ref?: string | null;
  id_equipo: string;
  owner_display?: string | null;
  estado_seguimiento?: string | null;
  validacion_cierre?: string | null;
  tracking_updated_at?: string | null;
  comentario_operativo?: string | null;
};

type ExecutionQueueResponse = {
  rows?: ExecutionQueueRow[];
};

const EMPTY_SUMMARY: OperacionSummaryResponse = {
  kpis: {},
  alertas_por_origen: [],
  alertas_por_tipo: [],
  alertas_por_criticidad: [],
  available_filters: {},
  copy_ejecutivo: "Las alertas no son errores del sistema; son brechas operativas detectadas entre fuentes.",
};

const EMPTY_ALERTAS: OperacionAlertasResponse = {
  rows: [],
  count: 0,
};

const EMPTY_CONFIANZA: OperacionConfianzaResponse = {
  distribution: [],
  promedio: null,
};

const EMPTY_SLA: OperacionSlaResponse = {
  rows: [],
  aggregates: {},
};

async function safeApiProxyGet<T>(path: string, origin: string): Promise<T | null> {
  try {
    return await apiProxyGet<T>(path, { origin });
  } catch {
    return null;
  }
}

function pickString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function fmtIsoDate(value?: string | null) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function safeText(value?: string | null) {
  const text = (value ?? "").trim();
  return text || "—";
}

function sourceClasses(origin?: string | null) {
  const key = (origin ?? "").toUpperCase();
  if (key === "MTR") return "border-sky-300/60 bg-sky-100/80 text-sky-800";
  if (key === "JIRA") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "MTR/JIRA") return "border-fuchsia-300/60 bg-fuchsia-100/80 text-fuchsia-800";
  if (key === "POLITICA") return "border-violet-300/60 bg-violet-100/80 text-violet-800";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

function criticidadClasses(value?: string | null) {
  const tone = getStatusDefinition(value, "confianza")?.tone ?? getStatusDefinition(value)?.tone;
  if (tone === "critica") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  if (tone === "alta") return "border-orange-300/70 bg-orange-100/80 text-orange-800";
  if (tone === "media") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (tone === "baja") return "border-sky-300/60 bg-sky-100/80 text-sky-800";
  return "border-slate-300/60 bg-slate-100/80 text-slate-700";
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
  if (key === "VALIDADO_CRUCE") return "Validado por cruce";
  if (key === "REABIERTO") return "Reabierto";
  if (key === "MANUAL") return "Cierre manual";
  return "Sin validación";
}

function confidenceClasses(value?: string | null) {
  const tone = getStatusDefinition(value, "confianza")?.tone ?? getStatusDefinition(value)?.tone;
  if (tone === "alta") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (tone === "media") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (tone === "baja") return "border-orange-300/60 bg-orange-100/80 text-orange-800";
  if (tone === "critica") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  return "border-slate-300/60 bg-slate-100/80 text-slate-700";
}

function slaClasses(value?: string | null) {
  const key = (value ?? "").toUpperCase();
  if (key === "VENCIDO") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  if (key === "OBSERVACION") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "EN_PLAZO") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  return "border-slate-300/60 bg-slate-100/80 text-slate-700";
}

function KpiCard({
  title,
  value,
  helper,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  helper?: string;
  tone?: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
}) {
  return (
    <div className={`cat-kpi-card kpi-${tone} p-6`}>
      <div className="catastro-kpi-label">{title}</div>
      <div className="catastro-kpi-value text-[clamp(1.85rem,3.6vw,3rem)]">{value}</div>
      {helper ? <div className="catastro-kpi-helper">{helper}</div> : null}
    </div>
  );
}

function num(value?: number | null, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value)}${suffix}`;
}

function numeric(value?: number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function priorityRank(value?: number | null) {
  const n = Number(value ?? 9999);
  return Number.isFinite(n) && n > 0 ? n : 9999;
}

function hasAlertSummary(value?: string | null) {
  const text = String(value ?? "").trim().toLowerCase();
  return Boolean(text && text !== "sin alertas" && text !== "—");
}

function inferFallbackCriticidad(rank?: number | null) {
  const normalized = priorityRank(rank);
  if (normalized <= 10) return "CRITICA";
  if (normalized <= 35) return "ALTA";
  return "MEDIA";
}

function inferConfidenceLabel(score?: number | null) {
  const value = numeric(score);
  if (value >= 85) return "ALTA";
  if (value >= 60) return "MEDIA";
  if (value >= 30) return "BAJA";
  return "CRITICA";
}

function hasOperacionSignal(
  summary: OperacionSummaryResponse,
  alertas: OperacionAlertasResponse,
  confianza: OperacionConfianzaResponse,
  sla: OperacionSlaResponse,
) {
  return Boolean(
    numeric(summary.kpis?.alertas_criticas) ||
      numeric(summary.kpis?.alertas_altas) ||
      numeric(summary.kpis?.total_alertas_abiertas) ||
      numeric(summary.kpis?.equipos_afectados) ||
      (alertas.rows?.length ?? 0) ||
      (confianza.distribution?.length ?? 0) ||
      (sla.rows?.length ?? 0),
  );
}

function buildFallbackOperacion(dashboard?: DashboardFallbackResponse | null) {
  const jira = dashboard?.integrations?.jira;
  const overview = dashboard?.overview;
  const focos = dashboard?.operations?.focos_operativos ?? [];
  const topIssues = jira?.top_equipos ?? [];
  const topInconsistencias = jira?.top_inconsistencias ?? [];
  const reconciliation = jira?.reconciliation;

  if (!overview && !focos.length && !topIssues.length && !topInconsistencias.length) {
    return null;
  }

  const rows: OperacionAlertRow[] = [];
  const seen = new Set<string>();

  for (const item of topInconsistencias) {
    if (!item.id_equipo || seen.has(item.id_equipo)) continue;
    seen.add(item.id_equipo);
    rows.push({
      alert_id: `fallback-recon-${item.id_equipo}`,
      id_equipo: item.id_equipo,
      tipo_alerta: "inconsistencia_operativa",
      titulo: "Brecha de conciliacion Jira / MTR",
      descripcion: `Cliente ${safeText(item.cliente)} con divergencia operacional visible en el cruce actual.`,
      criticidad: "CRITICA",
      origen: "MTR/JIRA",
      evidencia: `Jira ${safeText(item.jira_estado)} · MTR ${safeText(item.mtr_estado)} · Estado ${safeText(item.conciliacion_estado)}`,
      accion_sugerida: "Revisar conciliacion y corregir el estado operativo cruzado.",
      estado_alerta: "ABIERTA",
      confianza_dato: "CRITICA",
    });
  }

  for (const item of focos) {
    if (!item.id_equipo || seen.has(item.id_equipo) || !hasAlertSummary(item.alertas_resumen)) continue;
    seen.add(item.id_equipo);
    rows.push({
      alert_id: `fallback-foco-${item.id_equipo}`,
      id_equipo: item.id_equipo,
      tipo_alerta: "senal_operativa",
      titulo: "Senal operativa priorizada",
      descripcion: safeText(item.alertas_resumen),
      criticidad: inferFallbackCriticidad(item.priority_final_rank),
      origen: numeric(item.jira_open_count) > 0 ? "JIRA" : "MTR/JIRA",
      evidencia: numeric(item.jira_open_count) > 0 ? `Issues Jira abiertos: ${numeric(item.jira_open_count)}` : `Estado operativo ${safeText(item.estado_operativo)}`,
      accion_sugerida: "Validar foco operativo y definir accion de contencion.",
      fecha_detectada: item.last_event_date,
      estado_alerta: "ABIERTA",
      confianza_dato: numeric(item.jira_open_count) > 0 ? "MEDIA" : "BAJA",
    });
  }

  for (const item of topIssues) {
    if (!item.id_equipo || seen.has(item.id_equipo)) continue;
    seen.add(item.id_equipo);
    rows.push({
      alert_id: `fallback-jira-${item.id_equipo}`,
      id_equipo: item.id_equipo,
      tipo_alerta: "jira_abierto",
      titulo: "Issue Jira operativo abierto",
      descripcion: `Cliente ${safeText(item.cliente)} con seguimiento vigente en Jira.`,
      criticidad: inferFallbackCriticidad(item.priority_final_rank),
      origen: "JIRA",
      evidencia: `Issues abiertos: ${numeric(item.jira_open_count)} · Maximo visible: ${num(item.jira_days_open_max)} dias`,
      accion_sugerida: "Priorizar resolucion o actualizar workflow del issue.",
      dias_abierta: item.jira_days_open_max,
      estado_alerta: "ABIERTA",
      confianza_dato: "MEDIA",
    });
  }

  const conciliated = numeric(reconciliation?.equipos_conciliados);
  const criticalCount =
    numeric(reconciliation?.inconsistencias_mtr_jira) +
    numeric(reconciliation?.creados_jira_sin_ingreso_mtr) +
    numeric(reconciliation?.reservas_jira_pendientes);
  const lowCount =
    numeric(reconciliation?.jira_sin_match_mtr) +
    numeric(reconciliation?.mtr_sin_match_jira);
  const mediumCount = Math.max(0, numeric(jira?.equipos_con_issues) - criticalCount - lowCount);
  const confidenceScoreDenominator = conciliated + criticalCount + lowCount + mediumCount;
  const confidenceScorePromedio =
    confidenceScoreDenominator > 0 ? Number(((conciliated / confidenceScoreDenominator) * 100).toFixed(2)) : null;

  const summary: OperacionSummaryResponse = {
    kpis: {
      alertas_criticas: numeric(overview?.alertas_criticas),
      alertas_altas: numeric(overview?.alertas_warn),
      total_alertas_abiertas: numeric(jira?.issues_abiertos) || rows.length,
      equipos_afectados: numeric(jira?.equipos_con_issues) || new Set(rows.map((row) => row.id_equipo)).size,
      confianza_score_promedio: confidenceScorePromedio,
      confianza_dato_general: confidenceScorePromedio === null ? "Sin lectura" : inferConfidenceLabel(confidenceScorePromedio),
      sla_promedio_dias: jira?.max_dias_issue_abierto ?? null,
      aging_promedio_dias: topIssues.length
        ? Number(
            (
              topIssues.reduce((sum, item) => sum + numeric(item.jira_days_open_max), 0) /
              topIssues.length
            ).toFixed(2),
          )
        : null,
      ultima_alerta_detectada: focos.find((item) => item.last_event_date)?.last_event_date ?? null,
    },
    alertas_por_origen: Array.from(
      rows.reduce((map, row) => {
        const key = row.origen ?? "SIN_ORIGEN";
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([origen, total]) => ({ origen, total })),
    alertas_por_tipo: Array.from(
      rows.reduce((map, row) => {
        const key = row.tipo_alerta ?? "SIN_TIPO";
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([tipo_alerta, total]) => ({ tipo_alerta, total })),
    alertas_por_criticidad: Array.from(
      rows.reduce((map, row) => {
        const key = row.criticidad ?? "SIN_CRITICIDAD";
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([criticidad, total]) => ({ criticidad, total })),
    available_filters: {
      criticidades: Array.from(new Set(rows.map((row) => row.criticidad).filter(Boolean) as string[])),
      origenes: Array.from(new Set(rows.map((row) => row.origen).filter(Boolean) as string[])),
      tipos_alerta: Array.from(new Set(rows.map((row) => row.tipo_alerta).filter(Boolean) as string[])),
      estados_alerta: ["ABIERTA"],
    },
    copy_ejecutivo:
      "Vista operativa reconstruida con la senal central del Command Center mientras la mart especifica de alertas no responde.",
  };

  const confianza: OperacionConfianzaResponse = {
    distribution: [
      { confianza_dato: "ALTA", equipos: conciliated },
      { confianza_dato: "MEDIA", equipos: mediumCount },
      { confianza_dato: "BAJA", equipos: lowCount },
      { confianza_dato: "CRITICA", equipos: criticalCount },
    ],
    promedio: confidenceScorePromedio,
  };

  const sla: OperacionSlaResponse = {
    rows: topIssues.map((item) => ({
      id_equipo: item.id_equipo,
      sla_estado: numeric(item.jira_days_open_max) >= 15 ? "VENCIDO" : numeric(item.jira_days_open_max) >= 7 ? "OBSERVACION" : "EN_PLAZO",
      jira_days_open_max: item.jira_days_open_max,
      aging_operativo_dias: item.jira_days_open_max,
      backlog_operativo: numeric(item.jira_open_count) > 0,
    })),
    aggregates: {
      sla_promedio_dias: summary.kpis?.sla_promedio_dias ?? null,
      aging_promedio_dias: summary.kpis?.aging_promedio_dias ?? null,
      equipos_en_backlog: numeric(jira?.equipos_con_issues),
    },
  };

  return {
    summary,
    alertas: {
      rows,
      count: rows.length,
    },
    confianza,
    sla,
    note:
      "Operación está mostrando señal real del tablero central porque los endpoints dedicados de alertas devolvieron error o vacío hoy.",
  };
}

export default async function OperacionPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const q = pickString(params.q) ?? "";
  const criticidad = pickString(params.criticidad) ?? "";
  const origen = pickString(params.origen) ?? "";
  const tipoAlerta = pickString(params.tipo_alerta) ?? "";
  const estadoAlerta = pickString(params.estado_alerta) ?? "ABIERTA";
  const desde = pickString(params.desde) ?? "";
  const hasta = pickString(params.hasta) ?? "";
  const origin = await getRequestOrigin();

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (criticidad) qs.set("criticidad", criticidad);
  if (origen) qs.set("origen", origen);
  if (tipoAlerta) qs.set("tipo_alerta", tipoAlerta);
  if (estadoAlerta) qs.set("estado_alerta", estadoAlerta);
  if (desde) qs.set("desde", desde);
  if (hasta) qs.set("hasta", hasta);
  qs.set("limit", "250");

  const [summary, alertas, confianza, sla, dashboardFallback, executionQueue] = await Promise.all([
    apiProxyGet<OperacionSummaryResponse>(`/operacion/resumen?${qs.toString()}`, { origin }).catch(() => EMPTY_SUMMARY),
    apiProxyGet<OperacionAlertasResponse>(`/operacion/alertas?${qs.toString()}`, { origin }).catch(() => EMPTY_ALERTAS),
    apiProxyGet<OperacionConfianzaResponse>(`/operacion/confianza?${qs.toString()}`, { origin }).catch(() => EMPTY_CONFIANZA),
    apiProxyGet<OperacionSlaResponse>(`/operacion/sla?${qs.toString()}`, { origin }).catch(() => EMPTY_SLA),
    safeApiProxyGet<DashboardFallbackResponse>("/home/dashboard", origin),
    safeApiProxyGet<ExecutionQueueResponse>("/ejecucion/queue?limit=1000", origin),
  ]);

  const fallbackOperacion = !hasOperacionSignal(summary, alertas, confianza, sla)
    ? buildFallbackOperacion(dashboardFallback)
    : null;
  const effectiveSummary = hasOperacionSignal(summary, alertas, EMPTY_CONFIANZA, EMPTY_SLA) ? summary : fallbackOperacion?.summary ?? summary;
  const effectiveAlertas =
    (alertas.rows?.length ?? 0) > 0 || !fallbackOperacion ? alertas : fallbackOperacion.alertas;
  const effectiveConfianza =
    (confianza.distribution?.length ?? 0) > 0 || !fallbackOperacion ? confianza : fallbackOperacion.confianza;
  const effectiveSla =
    (sla.rows?.length ?? 0) > 0 || !fallbackOperacion ? sla : fallbackOperacion.sla;

  const kpis = effectiveSummary.kpis ?? {};
  const rows = effectiveAlertas.rows ?? [];
  const criticidades = effectiveSummary.available_filters?.criticidades ?? [];
  const origenes = effectiveSummary.available_filters?.origenes ?? [];
  const tipos = effectiveSummary.available_filters?.tipos_alerta ?? [];
  const estados = effectiveSummary.available_filters?.estados_alerta ?? [];
  const confidenceMap = new Map((effectiveConfianza.distribution ?? []).map((item) => [String(item.confianza_dato ?? ""), Number(item.equipos ?? 0)]));
  const slaRows = effectiveSla.rows ?? [];
  const activeErrors = [
    summary.error,
    alertas.error,
    confianza.error,
    sla.error,
    dashboardFallback?.errors?.root,
  ].filter(Boolean) as string[];
  const operacionContractMode = fallbackOperacion
    ? "Resiliente reconstruido"
    : activeErrors.length
      ? "Parcial con errores"
      : "Alertas dedicadas";
  const operacionContractCutoff = fmtIsoDate(kpis.ultima_alerta_detectada);
  const operacionContractNote = fallbackOperacion
    ? `${operationalMeaning("modoDegradado")} La vista sigue operativa con señal central del Command Center y conciliación visible.`
    : "Operación no altera movimientos del parque: expone brechas, aging y conflictos entre fuentes para ayudar a priorizar revisión.";
  const executionByAlert = new Map(
    (executionQueue?.rows ?? [])
      .filter((item) => item.source_ref)
      .map((item) => [String(item.source_ref), item]),
  );
  const executionByEquipo = new Map(
    (executionQueue?.rows ?? [])
      .filter((item) => item.id_equipo)
      .map((item) => [String(item.id_equipo), item]),
  );

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Centro de operación
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-card-text)]">Operación y alertas</h1>
              <p className="mt-3 max-w-3xl text-lg text-[var(--cat-card-muted)]">
                {effectiveSummary.copy_ejecutivo ?? "Las alertas no son errores del sistema; son brechas operativas detectadas entre fuentes."}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link href="/" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]">
                Volver al Home
              </Link>
              <div className="text-sm text-[var(--cat-card-muted)]">Última alerta detectada: {fmtIsoDate(kpis.ultima_alerta_detectada)}</div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer Operación"
          description="Operación es la mesa de control de alertas y brechas entre fuentes. No define el movimiento físico del equipo; define dónde mirar primero."
          items={[
            {
              label: "Fuente dominante",
              value: fallbackOperacion ? `${operationalLabel("conciliacionMtrJira")} + Command Center` : "Alertas operativas + conciliación MTR/Jira",
              hint: fallbackOperacion
                ? "Cuando la mart dedicada no responde, el módulo se reconstruye con la señal viva del tablero central."
                : "La vista cruza alertas, confianza y SLA sobre las fuentes operativas visibles.",
              tone: fallbackOperacion ? "amber" : "cyan",
            },
            {
              label: "Corte visible",
              value: operacionContractCutoff,
              hint: "Usa la última alerta o issue visible detectado dentro de los filtros activos.",
              tone: "green",
            },
            {
              label: "Cobertura",
              value: "Alertas + confianza + SLA + accesos a ficha, auditoría y timeline",
              hint: `${operationalMeaning("conciliacionMtrJira")} ${operationalMeaning("boardJiraReal")}`,
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: operacionContractMode,
              hint: fallbackOperacion
                ? "El módulo conserva utilidad operativa aun cuando el backend específico de alertas falle o llegue vacío."
                : "La lectura es táctica: criticidad, evidencia y acción sugerida por caso.",
              tone: fallbackOperacion ? "amber" : activeErrors.length ? "red" : "green",
            },
          ]}
          badges={[
            { label: operationalLabel("conciliacionMtrJira"), tone: "cyan" },
            { label: fallbackOperacion ? operationalLabel("modoDegradado") : "Alertas activas", tone: fallbackOperacion ? "amber" : "red" },
            { label: "SLA / aging", tone: "purple" },
          ]}
          note={operacionContractNote}
        />

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Alertas críticas" value={Number(kpis.alertas_criticas ?? 0)} helper="Casos con conflicto operativo fuerte" tone="red" />
          <KpiCard title="Alertas altas" value={Number(kpis.alertas_altas ?? 0)} helper="Backlog prioritario para el equipo TI" tone="orange" />
          <KpiCard title="Alertas abiertas" value={Number(kpis.total_alertas_abiertas ?? 0)} helper="Brechas operativas visibles con estos filtros" tone="purple" />
          <KpiCard title="Equipos afectados" value={Number(kpis.equipos_afectados ?? 0)} helper="SKU distintos con alguna alerta vigente" tone="yellow" />
        </section>

        <section className="mt-6 catastro-panel rounded-3xl p-5">
          <h2 className="text-xl font-semibold text-[var(--cat-text)]">Filtros</h2>
          <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Buscar SKU</div>
              <input name="q" defaultValue={q} placeholder="SKU-602" className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Criticidad</div>
              <select name="criticidad" defaultValue={criticidad} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todas</option>
                {criticidades.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Origen</div>
              <select name="origen" defaultValue={origen} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todos</option>
                {origenes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Tipo alerta</div>
              <select name="tipo_alerta" defaultValue={tipoAlerta} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todos</option>
                {tipos.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Estado alerta</div>
              <select name="estado_alerta" defaultValue={estadoAlerta} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todos</option>
                {estados.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Desde</div>
              <input type="date" name="desde" defaultValue={desde} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Hasta</div>
              <input type="date" name="hasta" defaultValue={hasta} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <div className="flex items-end gap-3">
              <button type="submit" className="catastro-button-primary rounded-full px-5 py-3 text-sm font-semibold">
                Aplicar filtros
              </button>
              <Link href="/operacion" className="catastro-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Limpiar
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="catastro-panel rounded-3xl p-5">
            <h2 className="text-xl font-semibold text-[var(--cat-text)]">Tabla de alertas</h2>
            <p className="mt-2 text-sm text-[var(--cat-text-muted)]">Las alertas no cambian movimientos; sólo señalan brechas operativas para revisión y acción.</p>

            {rows.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--cat-border)] p-6 text-sm text-[var(--cat-text-muted)]">
                No hay alertas para los filtros actuales.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {rows.map((row) => (
                  <article key={row.alert_id} className="cat-operacion-card rounded-2xl p-4">
                    {(() => {
                      const tracking = executionByAlert.get(String(row.alert_id)) ?? executionByEquipo.get(String(row.id_equipo));
                      return (
                    <>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="cat-badge-stack">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${criticidadClasses(row.criticidad)}`}>
                            {safeText(row.criticidad)}
                          </span>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${sourceClasses(row.origen)}`}>
                            {safeText(row.origen)}
                          </span>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${confidenceClasses(row.confianza_dato)}`}>
                            Confianza {safeText(row.confianza_dato)}
                          </span>
                          {tracking?.estado_seguimiento ? (
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trackingBadge(tracking.estado_seguimiento)}`}>
                              {prettyOperationalStatus(tracking.estado_seguimiento)}
                            </span>
                          ) : null}
                          {tracking?.validacion_cierre ? (
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${validationBadge(tracking.validacion_cierre)}`}>
                              {validationLabel(tracking.validacion_cierre)}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                          <div className="text-xl font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                          <div className="text-sm uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                            {safeText(row.tipo_alerta)}
                          </div>
                        </div>

                        <div className="mt-2 text-[1.05rem] font-semibold leading-7 text-[var(--cat-text)]">
                          {safeText(row.titulo)}
                        </div>
                        <div className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
                          {safeText(row.descripcion)}
                        </div>
                      </div>

                      <div className="cat-operacion-meta-shield">
                        <div className="catastro-kpi-label">Días abierta</div>
                        <div className="mt-2 text-3xl font-bold text-[var(--cat-text)]">{num(row.dias_abierta)}</div>
                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                          {fmtIsoDate(row.fecha_detectada)}
                        </div>
                        {tracking?.owner_display ? (
                          <div className="mt-3 text-xs leading-6 text-[var(--cat-text-soft)]">
                            Owner: <span className="font-semibold text-[var(--cat-text)]">{tracking.owner_display}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr_0.75fr]">
                      <div className="catastro-inset rounded-2xl p-4">
                        <div className="catastro-kpi-label">Evidencia</div>
                        <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{safeText(row.evidencia)}</div>
                      </div>
                      <div className="catastro-inset rounded-2xl p-4">
                        <div className="catastro-kpi-label">Acción sugerida</div>
                        <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{safeText(row.accion_sugerida)}</div>
                      </div>
                      <div className="catastro-inset rounded-2xl p-4">
                        <div className="catastro-kpi-label">Accesos</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link href={`/equipos/${encodeURIComponent(row.id_equipo)}`} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                            Ver ficha
                          </Link>
                          <Link href={`/auditoria?q=${encodeURIComponent(row.id_equipo)}`} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                            Ver auditoría
                          </Link>
                          <Link href={`/timeline/${encodeURIComponent(row.id_equipo)}`} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                            Ver timeline
                          </Link>
                          <Link href={`/ejecucion?q=${encodeURIComponent(row.id_equipo)}`} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                            Ejecución
                          </Link>
                          {tracking ? (
                            <Link href={`/ejecucion/${encodeURIComponent(tracking.case_key)}`} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                              Bitácora
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    </>
                      );
                    })()}
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Confianza del dato</h2>
              <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
                Alta: conciliado. Media: una fuente válida. Baja: inconsistencia. Crítica: conflicto entre fuentes.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {["ALTA", "MEDIA", "BAJA", "CRITICA"].map((level) => (
                  <div key={level} className={`rounded-2xl border p-4 ${confidenceClasses(level)}`}>
                    <div className="text-xs uppercase tracking-[0.18em]">{level}</div>
                    <div className="mt-2 text-3xl font-bold">{confidenceMap.get(level) ?? 0}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">SLA y aging</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-2 text-sm font-semibold ${slaClasses("VENCIDO")}`}>
                  SLA promedio {num(effectiveSla.aggregates?.sla_promedio_dias)}d
                </span>
                <span className={`inline-flex rounded-full border px-3 py-2 text-sm font-semibold ${slaClasses("OBSERVACION")}`}>
                  Aging promedio {num(effectiveSla.aggregates?.aging_promedio_dias)}d
                </span>
                <span className="cat-status-badge cat-status-neutral">
                  Backlog {Number(effectiveSla.aggregates?.equipos_en_backlog ?? 0)}
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {slaRows.slice(0, 5).map((row) => (
                  <div key={row.id_equipo} className="catastro-inset rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                      <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${slaClasses(row.sla_estado)}`}>
                        {safeText(row.sla_estado)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-[var(--cat-text-muted)]">
                      Jira abierto: {num(row.jira_days_open_max)}d · Aging operativo: {num(row.aging_operativo_dias)}d
                    </div>
                  </div>
                ))}
                {slaRows.length === 0 ? <div className="text-sm text-[var(--cat-text-muted)]">No hay backlog SLA para los filtros actuales.</div> : null}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
