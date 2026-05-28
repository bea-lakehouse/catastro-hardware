import Link from "next/link";
import { apiProxyGet } from "@/lib/api";
import EquipoAuditPanel, {
  type AuditEquipoSummary,
  type AuditRow,
} from "@/components/audit/EquipoAuditPanel";
import { originHelp, prettyOrigin } from "@/lib/reconciliation-ui";
import { getRequestOrigin } from "@/lib/request-origin";
import { prettyJiraBucket, prettyOperationalStatus } from "@/lib/statusMatrix";
import { getStatusClassName, shouldRenderStatusBadge } from "@/lib/statusStyles";

type EquipoDetalle = {
  id_equipo: string;
  sku?: string | number | null;
  estado?: string | null;
  estado_operativo?: string | null;
  estado_equipo?: string | null;
  estado_equipo_mtr?: string | null;
  asignado_a?: string | null;
  last_event_persona?: string | null;
  last_event_type?: string | null;
  last_event_date?: string | null;
  severidad?: string | null;
  cliente?: string | null;
  marca_modelo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  tipo_equipo?: string | null;
  sistema_operativo?: string | null;
  procesador?: string | null;
  ram_gb?: number | null;
  almacenamiento_gb?: number | null;
  almacenamiento_tipo?: string | null;
  pantalla?: string | null;
  anio_modelo?: string | null;
  serial?: string | null;
  fuente_origen?: string | null;
  specs_confidence_score?: number | null;
  specs_status?: string | null;
  carbon_electricity_country?: string | null;
  carbon_grid_factor_kgco2e_kwh?: number | null;
  carbon_grid_reference_year?: number | null;
  carbon_grid_source?: string | null;
  carbon_source_vendor?: string | null;
  carbon_source_url?: string | null;
  carbon_assumed_lifetime_years?: number | null;
  carbon_use_annual_kwh?: number | null;
  carbon_report_total_kgco2e?: number | null;
  carbon_embodied_kgco2e?: number | null;
  carbon_use_annual_kgco2e?: number | null;
  carbon_use_lifetime_kgco2e?: number | null;
  carbon_total_estimated_kgco2e?: number | null;
  carbon_method?: string | null;
  carbon_confidence_score?: number | null;
  carbon_status?: string | null;
  tipo_colaborador?: string | null;
  localizacion?: string | null;
  ciudad_comuna?: string | null;
  condicion?: string | null;
  plataforma?: string | null;
  alertas_resumen?: string | null;
  jira_open_count?: number | null;
  jira_board_bucket?: string | null;
  ml_alert_code?: string | null;
  ml_motivo_principal?: string | null;
  ml_explain_summary?: string | null;
  ml_scored_at?: string | null;
  ml_drivers_json?: unknown;
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
  ml_scored_at_v3?: string | null;
  ml_source_available_v3?: boolean | null;
  ml_version?: string | null;
  ml_score_delta_v3_vs_v2?: number | null;
  priority_final_rank?: number | null;
  priority_final_motivo?: string | null;
};

type TimelineRow = {
  fecha_evento?: string | null;
  tipo_evento?: string | null;
  detalle_evento?: string | null;
  usuario_evento?: string | null;
  origen_evento?: string | null;
  dias_hasta_siguiente_evento?: number | null;
};
function fmtIsoDate(value?: string | null) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function prettyTipo(tipo?: string | null) {
  const key = (tipo ?? "").toLowerCase();
  if (!key || key === "unknown" || key === "—") return "Sin tipificar";
  if (key === "core") return "Core";
  if (key === "staffing") return "Staffing";
  return tipo ?? "Sin tipificar";
}

function estadoClasses(estado?: string | null) {
  return getStatusClassName(estado, { domain: "operacion" });
}

function severityClasses(sev?: string | null) {
  const s = (sev ?? "").toUpperCase();
  if (s === "CRITICAL") return getStatusClassName("critica");
  if (s === "WARN" || s === "WARNING") return getStatusClassName("media");
  if (s === "INFO") return getStatusClassName("info");
  return getStatusClassName("normal");
}

function riskClasses(risk?: string | null, score?: number | null) {
  const r = (risk ?? "").toUpperCase();
  const s = Number(score ?? 0);
  if (r === "ALTO" || r === "CRITICAL" || s >= 8) return getStatusClassName("critica");
  if (r === "MEDIO" || r === "WARN" || s >= 4) return getStatusClassName("media");
  return getStatusClassName("info");
}

function jiraBucketClasses(bucket?: string | null) {
  return getStatusClassName(bucket, { domain: "jira" });
}

function originClasses(origin?: string | null) {
  const key = (origin ?? "").toUpperCase();
  if (key === "CONCILIADO") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (key === "JIRA") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "MTR") return "border-sky-300/60 bg-sky-100/80 text-sky-800";
  if (key === "EXCEL:REPARADOS") return "border-violet-300/60 bg-violet-100/80 text-violet-800";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

function resolvePersona(e: EquipoDetalle) {
  const asignado = (e.asignado_a ?? "").trim();
  if (asignado && asignado !== "—") return asignado;
  return "Sin persona visible";
}

function buildInsight(e: EquipoDetalle) {
  const alerta = (e.alertas_resumen ?? "").toLowerCase();
  const score = Number(e.ml_score ?? 0);
  const severidad = (e.severidad ?? "").toUpperCase();
  const tipo = (e.tipo_colaborador ?? "").toLowerCase();
  const modelo = `${e.marca_modelo ?? ""} ${e.modelo ?? ""}`.toLowerCase();

  if (modelo.includes("dell") || modelo.includes("latitude")) {
    return "Este equipo cae en una familia con política de salida o renovación, así que conviene planificar reemplazo antes de seguir prolongando uso.";
  }
  if (severidad === "CRITICAL" || score >= 8) {
    return "El equipo quedó con prioridad alta por señal operativa o ML. Conviene revisarlo primero dentro del backlog del parque.";
  }
  if (alerta.includes("sin asignación") || alerta.includes("sin asignacion")) {
    return "El equipo aparece sin asignación visible. Puede ser oportunidad de reasignación o una inconsistencia de dato a corregir.";
  }
  if (Number(e.jira_open_count ?? 0) > 0) {
    return `El equipo tiene ${Number(e.jira_open_count ?? 0)} issue(s) Jira abierto(s), así que ya existe fricción operativa explícita sobre este SKU.`;
  }
  if (tipo === "core") {
    return "Equipo de parque Core, útil para evaluar reutilización interna o continuidad según condición y contexto del último evento.";
  }
  return "Equipo sin señales críticas inmediatas. Se puede mantener en monitoreo operativo normal.";
}

function buildDecision(e: EquipoDetalle) {
  const modelo = `${e.marca_modelo ?? ""} ${e.modelo ?? ""}`.toLowerCase();
  const alerta = (e.alertas_resumen ?? "").toLowerCase();
  const score = Number(e.ml_score ?? 0);

  if (modelo.includes("dell") || modelo.includes("latitude")) {
    return { title: "Renovar o salir", detail: "Familia bajo política de salida/recambio.", tone: "red" };
  }
  if (alerta.includes("sin asignación") || alerta.includes("sin asignacion")) {
    return { title: "Asignar o reasignar", detail: "Hay señal de disponibilidad o inconsistencia en dueño actual.", tone: "amber" };
  }
  if (Number(e.jira_open_count ?? 0) > 0) {
    return { title: "Revisar Jira", detail: `Bucket actual: ${prettyJiraBucket(e.jira_board_bucket)}.`, tone: "sky" };
  }
  if (score >= 8) {
    return { title: "Revisión inmediata", detail: "Score ML alto o foco operativo prioritario.", tone: "red" };
  }
  return { title: "Mantener", detail: "No hay señal de cambio inmediato sobre este equipo.", tone: "neutral" };
}

function firstNonEmpty<T>(...values: T[]): T | null {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCapacityGb(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return /tb/i.test(text) ? parsed * 1024 : parsed;
}

function normalizeEquipoDetalle(raw: EquipoDetalle, idFallback: string): EquipoDetalle {
  const data = (raw ?? {}) as Record<string, unknown>;

  return {
    ...raw,
    id_equipo: toNullableString(firstNonEmpty(data.id_equipo, data.id, data.sku, idFallback)) ?? idFallback,
    sku: firstNonEmpty(data.sku, data.id_equipo, data.id, idFallback) as string | number | null,
    cliente: toNullableString(firstNonEmpty(data.cliente, data.customer)),
    marca_modelo: toNullableString(firstNonEmpty(data.marca_modelo, data.brand_model, data.modelo_equipo)),
    marca: toNullableString(firstNonEmpty(data.marca, data.brand)),
    modelo: toNullableString(firstNonEmpty(data.modelo, data.model, data.modelo_equipo)),
    tipo_equipo: toNullableString(firstNonEmpty(data.tipo_equipo, data.tipo, data.device_type)),
    sistema_operativo: toNullableString(firstNonEmpty(data.sistema_operativo, data.os, data.mac_win, data.plataforma)),
    procesador: toNullableString(firstNonEmpty(data.procesador, data.cpu, data.chipset)),
    ram_gb: toNullableNumber(firstNonEmpty(data.ram_gb, data.ram, data.memoria_ram)),
    almacenamiento_gb: toCapacityGb(firstNonEmpty(data.almacenamiento_gb, data.almacenamiento, data.storage)),
    almacenamiento_tipo: toNullableString(firstNonEmpty(data.almacenamiento_tipo, data.tipo_almacenamiento, data.storage_type)),
    pantalla: toNullableString(firstNonEmpty(data.pantalla, data.screen, data.screen_size)),
    anio_modelo: toNullableString(firstNonEmpty(data.anio_modelo, data.ano_modelo, data.year_model, data.modelo_anio)),
    serial: toNullableString(firstNonEmpty(data.serial, data.serie, data.numero_serie)),
    fuente_origen: toNullableString(firstNonEmpty(data.fuente_origen, data.specs_fuente_origen, data.source)),
    specs_confidence_score: toNullableNumber(firstNonEmpty(data.specs_confidence_score, data.specs_confidence, data.confianza_specs)),
    specs_status: toNullableString(firstNonEmpty(data.specs_status, data.estado_specs)),
    asignado_a: toNullableString(firstNonEmpty(data.asignado_a, data.empleado, data.persona_actual, data.persona_asignada)),
    tipo_colaborador: toNullableString(firstNonEmpty(data.tipo_colaborador, data.tipo_parque, data.tipo)),
    carbon_electricity_country: toNullableString(firstNonEmpty(data.carbon_electricity_country, data.pais_electrico, data.country)),
    carbon_grid_factor_kgco2e_kwh: toNullableNumber(firstNonEmpty(data.carbon_grid_factor_kgco2e_kwh, data.factor_red)),
    carbon_grid_reference_year: toNullableNumber(firstNonEmpty(data.carbon_grid_reference_year, data.factor_red_year)) ?? null,
    carbon_grid_source: toNullableString(firstNonEmpty(data.carbon_grid_source, data.fuente_red)),
    carbon_source_vendor: toNullableString(firstNonEmpty(data.carbon_source_vendor, data.fuente_oem)),
    carbon_source_url: toNullableString(firstNonEmpty(data.carbon_source_url, data.oem_url)),
    carbon_assumed_lifetime_years: toNullableNumber(firstNonEmpty(data.carbon_assumed_lifetime_years, data.vida_util_asumida)),
    carbon_use_annual_kwh: toNullableNumber(firstNonEmpty(data.carbon_use_annual_kwh, data.consumo_anual_kwh)),
    carbon_report_total_kgco2e: toNullableNumber(firstNonEmpty(data.carbon_report_total_kgco2e, data.huella_oem_total_kgco2e)),
    carbon_embodied_kgco2e: toNullableNumber(firstNonEmpty(data.carbon_embodied_kgco2e, data.huella_embebida_kgco2e)),
    carbon_use_annual_kgco2e: toNullableNumber(firstNonEmpty(data.carbon_use_annual_kgco2e, data.huella_uso_anual_kgco2e)),
    carbon_use_lifetime_kgco2e: toNullableNumber(firstNonEmpty(data.carbon_use_lifetime_kgco2e, data.huella_uso_vida_util_kgco2e)),
    carbon_total_estimated_kgco2e: toNullableNumber(firstNonEmpty(data.carbon_total_estimated_kgco2e, data.huella_total_estimada_kgco2e)),
    carbon_method: toNullableString(firstNonEmpty(data.carbon_method, data.metodo_carbono)),
    carbon_confidence_score: toNullableNumber(firstNonEmpty(data.carbon_confidence_score, data.confianza_carbono)),
    carbon_status: toNullableString(firstNonEmpty(data.carbon_status, data.estado_carbono)),
  };
}

function decisionClasses(tone: string) {
  if (tone === "red") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  if (tone === "amber") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (tone === "sky") return "border-sky-300/60 bg-sky-100/80 text-sky-800";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

function specsStatusMeta(status?: string | null) {
  const key = String(status ?? "").toLowerCase().trim();
  if (!key) {
    return {
      label: "Estado no disponible",
      className: "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]",
    };
  }
  if (key === "completo") {
    return {
      label: "Completo",
      className: "border-emerald-300/60 bg-emerald-100/80 text-emerald-800",
    };
  }
  if (key === "parcial") {
    return {
      label: "Parcial",
      className: "border-amber-300/60 bg-amber-100/80 text-amber-800",
    };
  }
  return {
    label: "Sin especificaciones",
    className: "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]",
  };
}

function noDisponible(value?: string | number | null) {
  if (value == null) return "No disponible";
  if (typeof value === "string" && !value.trim()) return "No disponible";
  return value;
}

function normalizeComparableText(value?: string | number | null) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.toLowerCase() : null;
}

function distinctTextFrom(value?: string | number | null, ...others: Array<string | number | null | undefined>) {
  const base = normalizeComparableText(value);
  if (!base) return null;
  for (const other of others) {
    if (base === normalizeComparableText(other)) return null;
  }
  return String(value).trim();
}

function formatRam(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "No disponible";
  return `${Number(value)} GB`;
}

function formatStorage(value?: number | null, tipo?: string | null) {
  if (value == null || Number.isNaN(Number(value))) return "No disponible";
  return tipo ? `${Number(value)} GB ${tipo}` : `${Number(value)} GB`;
}

function formatSpecsConfidence(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "No disponible";
  return Number(value).toFixed(1);
}

function carbonStatusMeta(status?: string | null) {
  const key = String(status ?? "").toLowerCase().trim();
  if (!key) {
    return {
      label: "Estado no disponible",
      className: "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]",
    };
  }
  if (key === "estimado_completo") {
    return {
      label: "Estimado completo",
      className: "border-emerald-300/60 bg-emerald-100/80 text-emerald-800",
    };
  }
  if (key === "estimado_parcial") {
    return {
      label: "Estimado parcial",
      className: "border-amber-300/60 bg-amber-100/80 text-amber-800",
    };
  }
  return {
    label: "Sin datos de carbono",
    className: "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]",
  };
}

function formatKgCo2e(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "No disponible";
  return `${Number(value).toFixed(2)} kgCO2e`;
}

function formatKwh(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "No disponible";
  return `${Number(value).toFixed(1)} kWh/año`;
}

function formatCarbonFactor(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "No disponible";
  return `${Number(value).toFixed(4)} kgCO2e/kWh`;
}

function formatYears(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "No disponible";
  const numeric = Number(value);
  return `${numeric % 1 === 0 ? numeric.toFixed(0) : numeric.toFixed(1)} años`;
}

function prettyCarbonMethod(value?: string | null) {
  const key = String(value ?? "").toLowerCase().trim();
  if (key === "vendor_lifecycle_report") return "Reporte OEM + supuestos de ciclo de vida";
  if (key === "vendor_total_report") return "Reporte OEM total";
  if (key === "grid_factor_x_vendor_energy") return "Energia anual x factor de red";
  if (key === "country_only") return "Pais electrico detectado";
  return "Sin metodologia visible";
}

function sustainFieldTone(label: string) {
  if (["Huella OEM total", "Huella total estimada", "Huella embebida estimada"].includes(label)) return "tone-emerald";
  if (["Uso anual estimado", "Uso vida util", "Consumo anual ref"].includes(label)) return "tone-cyan";
  if (["Pais electrico", "Factor red", "Vida util asumida"].includes(label)) return "tone-amber";
  return "tone-blue";
}

function specFieldTone(label: string) {
  if (["Marca", "Modelo", "Sistema operativo"].includes(label)) return "tone-cyan";
  if (["Procesador", "RAM", "Almacenamiento", "Tipo almacenamiento"].includes(label)) return "tone-purple";
  if (["Tipo equipo", "Pantalla", "Año modelo"].includes(label)) return "tone-green";
  return "tone-amber";
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
      <div className="mt-3 font-mono text-[clamp(1.55rem,3vw,2.35rem)] font-bold tracking-tight text-[var(--cat-card-text)]">{value}</div>
      {helper ? <div className="catastro-kpi-helper">{helper}</div> : null}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  const displayValue = value ?? "—";
  const renderAsBadge = shouldRenderStatusBadge(label, value);

  return (
    <div className="catastro-inset rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">{label}</div>
      <div className="mt-2 text-lg text-[var(--cat-text)]">
        {renderAsBadge ? (
          <span className={getStatusClassName(displayValue)}>{displayValue}</span>
        ) : (
          displayValue
        )}
      </div>
    </div>
  );
}

function SpecField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className={`cat-spec-field ${specFieldTone(label)} rounded-2xl p-4`}>
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">{label}</div>
      <div className="cat-technical-value mt-3 text-[clamp(1.05rem,1.5vw,1.4rem)] font-semibold text-[var(--cat-text)]">
        {noDisponible(value)}
      </div>
    </div>
  );
}

function SustainField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className={`cat-sustain-field ${sustainFieldTone(label)} rounded-2xl p-4`}>
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">{label}</div>
      <div className="cat-technical-value mt-3 text-[clamp(1rem,1.45vw,1.3rem)] font-semibold text-[var(--cat-text)]">
        {noDisponible(value)}
      </div>
    </div>
  );
}

async function fetchJson<T>(origin: string, path: string, fallback: T): Promise<T> {
  try {
    return await apiProxyGet<T>(path, { origin });
  } catch {
    return fallback;
  }
}

export default async function EquipoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const origin = await getRequestOrigin();

  const [equipoRaw, timelineData, auditData] = await Promise.all([
    fetchJson<EquipoDetalle>(origin, `/estadisticas/equipos/${encodeURIComponent(id)}`, {
      id_equipo: id,
    }),
    fetchJson<{ rows?: TimelineRow[]; count?: number }>(origin, `/equipos/${encodeURIComponent(id)}/timeline?limit=12`, { rows: [], count: 0 }),
    fetchJson<{ rows?: AuditRow[]; count?: number; summary?: AuditEquipoSummary | null }>(
      origin,
      `/equipos/${encodeURIComponent(id)}/audit?limit=200`,
      { rows: [], count: 0, summary: null }
    ),
  ]);
  const equipo = normalizeEquipoDetalle(equipoRaw, id);

  const persona = resolvePersona(equipo);
  const insight = buildInsight(equipo);
  const decision = buildDecision(equipo);
  const specsStatus = specsStatusMeta(equipo.specs_status);
  const carbonStatus = carbonStatusMeta(equipo.carbon_status);
  const timelineRows = timelineData.rows ?? [];
  const auditRows = auditData.rows ?? [];
  const auditSummary = auditData.summary ?? null;
  const hasAudit = Number(auditSummary?.cambios_totales ?? auditData.count ?? auditRows.length) > 0;
  const mlVersion = equipo.ml_version ?? (equipo.ml_score_v3 != null ? "v3" : "v2");
  const mlSignalSummary =
    firstNonEmpty(
      distinctTextFrom(equipo.ml_explain_summary, equipo.ml_alert_code),
      distinctTextFrom(equipo.ml_motivo_principal, equipo.ml_alert_code),
      equipo.ml_alert_code
    ) ?? null;
  const mlReasonVisible = distinctTextFrom(equipo.ml_motivo_principal, equipo.ml_alert_code, mlSignalSummary);
  const mlExplainVisible = distinctTextFrom(
    equipo.ml_explain_summary,
    equipo.ml_alert_code,
    mlSignalSummary,
    mlReasonVisible
  );
  const hasV3Signal = [
    equipo.ml_score_v3,
    equipo.ml_alert_code_v3,
    equipo.ml_main_driver_v3,
    equipo.ml_risk_reason_v3,
    equipo.ml_explain_summary_v3,
  ].some((value) => value != null && String(value).trim() !== "");
  const mlSignalSummaryV3 =
    firstNonEmpty(
      distinctTextFrom(equipo.ml_explain_summary_v3, equipo.ml_alert_code_v3),
      distinctTextFrom(equipo.ml_risk_reason_v3, equipo.ml_alert_code_v3),
      distinctTextFrom(equipo.ml_main_driver_v3, equipo.ml_alert_code_v3),
      equipo.ml_alert_code_v3
    ) ?? null;
  const mlDriverVisibleV3 = distinctTextFrom(equipo.ml_main_driver_v3, equipo.ml_alert_code_v3, mlSignalSummaryV3);
  const mlReasonVisibleV3 = distinctTextFrom(
    equipo.ml_risk_reason_v3,
    equipo.ml_alert_code_v3,
    mlSignalSummaryV3,
    mlDriverVisibleV3
  );

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Ficha operativa
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-card-text)]">
                {equipo.id_equipo}
              </h1>
              <p className="mt-3 max-w-3xl text-lg text-[var(--cat-card-muted)]">
                Ficha operativa consolidada con estado actual, señales de riesgo, contexto logístico, especificaciones técnicas y base inicial de sostenibilidad.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${estadoClasses(equipo.estado_operativo ?? equipo.estado)}`}>
                  {prettyOperationalStatus(equipo.estado_operativo ?? equipo.estado)}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${severityClasses(equipo.severidad)}`}>
                  {equipo.severidad ?? "NORMAL"}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${riskClasses(equipo.ml_risk_level, equipo.ml_score)}`}>
                  ML {equipo.ml_risk_level ?? "NORMAL"} · {Number(equipo.ml_score ?? 0)}
                </span>
                {equipo.ml_alert_code ? (
                  <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${riskClasses(equipo.ml_risk_level, equipo.ml_score)}`}>
                    {equipo.ml_alert_code}
                  </span>
                ) : null}
                {Number(equipo.jira_open_count ?? 0) > 0 ? (
                  <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${jiraBucketClasses(equipo.jira_board_bucket)}`}>
                    Jira {prettyJiraBucket(equipo.jira_board_bucket)} · {Number(equipo.jira_open_count ?? 0)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link href="/activos" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]">
                Volver a Activos
              </Link>
              {equipo.ml_link_path ? (
                <Link href={equipo.ml_link_path} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]">
                  Explain ML
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Cliente" value={equipo.cliente ?? "—"} helper="Cliente actual visible" tone="cyan" />
          <KpiCard title="Persona" value={persona} helper="Empleado asignado en MTR" tone="green" />
          <KpiCard title="Estado" value={prettyOperationalStatus(equipo.estado_operativo ?? equipo.estado)} helper="Estado operativo actual" tone="yellow" />
          <KpiCard title="Colaborador" value={prettyTipo(equipo.tipo_colaborador)} helper="Tipo de colaborador" tone="purple" />
          <KpiCard title="Prioridad" value={equipo.priority_final_rank ?? "—"} helper={equipo.priority_final_motivo ?? "Sin motivo de prioridad visible"} tone="orange" />
        </section>

        <section className="mt-8">
          <section className="cat-specs-panel rounded-3xl p-6 md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Especificaciones técnicas</h2>
                <p className="mt-2 text-[var(--cat-text-muted)]">
                  Consolidado técnico inicial por equipo para enriquecer la ficha actual y dejar preparada la base para lifecycle y sostenibilidad.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${specsStatus.className}`}>
                  {specsStatus.label}
                </span>
                <span className="cat-specs-chip inline-flex rounded-full px-3 py-2 text-xs font-semibold text-[var(--cat-text)]">
                  Confianza {formatSpecsConfidence(equipo.specs_confidence_score)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="cat-specs-chip inline-flex rounded-full px-4 py-2 text-xs font-semibold text-[var(--cat-primary-strong)]">
                Fuente: {noDisponible(equipo.fuente_origen)}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SpecField label="Marca" value={equipo.marca} />
              <SpecField label="Modelo" value={equipo.modelo} />
              <SpecField label="Tipo equipo" value={equipo.tipo_equipo} />
              <SpecField label="Sistema operativo" value={equipo.sistema_operativo} />
              <SpecField label="Procesador" value={equipo.procesador} />
              <SpecField label="RAM" value={formatRam(equipo.ram_gb)} />
              <SpecField label="Almacenamiento" value={formatStorage(equipo.almacenamiento_gb, equipo.almacenamiento_tipo)} />
              <SpecField label="Tipo almacenamiento" value={equipo.almacenamiento_tipo} />
              <SpecField label="Pantalla" value={equipo.pantalla} />
              <SpecField label="Año modelo" value={equipo.anio_modelo} />
              <SpecField label="Serial" value={equipo.serial} />
              <SpecField label="SKU" value={equipo.sku ?? equipo.id_equipo} />
            </div>
          </section>
        </section>

        <section className="mt-8">
          <section className="cat-sustain-panel rounded-3xl p-6 md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Sostenibilidad</h2>
                <p className="mt-2 text-[var(--cat-text-muted)]">
                  Primera capa de huella por equipo. Prioriza reportes OEM y referencias energéticas curadas; si no hay base suficiente, deja el dato como no disponible.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${carbonStatus.className}`}>
                  {carbonStatus.label}
                </span>
                <span className="cat-sustain-chip inline-flex rounded-full px-3 py-2 text-xs font-semibold text-[var(--cat-text)]">
                  Confianza {formatSpecsConfidence(equipo.carbon_confidence_score)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="cat-sustain-chip inline-flex rounded-full px-4 py-2 text-xs font-semibold text-emerald-300">
                Metodo: {prettyCarbonMethod(equipo.carbon_method)}
              </span>
              <span className="cat-sustain-chip inline-flex rounded-full px-4 py-2 text-xs font-semibold text-[var(--cat-primary-strong)]">
                Pais electrico: {noDisponible(equipo.carbon_electricity_country)}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SustainField label="Huella OEM total" value={formatKgCo2e(equipo.carbon_report_total_kgco2e)} />
              <SustainField label="Huella embebida estimada" value={formatKgCo2e(equipo.carbon_embodied_kgco2e)} />
              <SustainField label="Uso anual estimado" value={formatKgCo2e(equipo.carbon_use_annual_kgco2e)} />
              <SustainField label="Uso vida util" value={formatKgCo2e(equipo.carbon_use_lifetime_kgco2e)} />
              <SustainField label="Huella total estimada" value={formatKgCo2e(equipo.carbon_total_estimated_kgco2e)} />
              <SustainField label="Consumo anual ref" value={formatKwh(equipo.carbon_use_annual_kwh)} />
              <SustainField label="Vida util asumida" value={formatYears(equipo.carbon_assumed_lifetime_years)} />
              <SustainField
                label="Factor red"
                value={
                  equipo.carbon_grid_reference_year != null
                    ? `${formatCarbonFactor(equipo.carbon_grid_factor_kgco2e_kwh)} · ${equipo.carbon_grid_reference_year}`
                    : formatCarbonFactor(equipo.carbon_grid_factor_kgco2e_kwh)
                }
              />
              <SustainField label="Fuente OEM" value={equipo.carbon_source_vendor} />
              <SustainField label="Fuente red" value={equipo.carbon_grid_source} />
            </div>

            {(equipo.carbon_source_url ?? "").trim() ? (
              <div className="mt-4">
                <a
                  href={equipo.carbon_source_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-emerald-300 hover:underline"
                >
                  Ver reporte OEM referencial →
                </a>
              </div>
            ) : null}
          </section>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Último movimiento</h2>
            <p className="mt-2 text-[var(--cat-text-muted)]">
              Contexto corto del último cambio visible antes de entrar al timeline completo.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <Field label="Último evento" value={equipo.last_event_type} />
              <Field label="Fecha evento" value={fmtIsoDate(equipo.last_event_date)} />
              <Field label="Actor último evento" value={equipo.last_event_persona} />
              <Field label="Estado equipo" value={equipo.estado_equipo ?? equipo.estado} />
              <Field label="Estado MTR" value={equipo.estado_equipo_mtr} />
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Señales Jira y ML</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${riskClasses(equipo.ml_risk_level, equipo.ml_score)}`}>
                Riesgo ML: {equipo.ml_risk_level ?? "NORMAL"} · {Number(equipo.ml_score ?? 0)}
              </span>
              {equipo.ml_score_v3 != null ? (
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${riskClasses(equipo.ml_risk_level_v3, equipo.ml_score_v3)}`}>
                  Riesgo ML v3: {equipo.ml_risk_level_v3 ?? "BAJA"} · {Number(equipo.ml_score_v3 ?? 0)}
                </span>
              ) : null}
              {equipo.ml_scored_at ? (
                <span className="inline-flex rounded-full border border-[color:var(--cat-border)] bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--cat-text-muted)]">
                  Scoreado: {fmtIsoDate(equipo.ml_scored_at)}
                </span>
              ) : null}
              <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${severityClasses(equipo.severidad)}`}>
                Severidad: {equipo.severidad ?? "NORMAL"}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${jiraBucketClasses(equipo.jira_board_bucket)}`}>
                Jira: {prettyJiraBucket(equipo.jira_board_bucket)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <Field label="Issues Jira abiertos" value={equipo.jira_open_count ?? 0} />
              <Field label="Código ML" value={equipo.ml_alert_code} />
              <Field label="Señal ML activa" value={mlSignalSummary} />
              {mlReasonVisible ? <Field label="Motivo ML" value={mlReasonVisible} /> : null}
              {mlExplainVisible ? <Field label="Explicación ML" value={mlExplainVisible} /> : null}
              <Field label="ML versión activa" value={mlVersion} />
              <Field
                label="Comparación v2 / v3"
                value={
                  equipo.ml_score_v3 != null
                    ? `v2 ${Number(equipo.ml_score_v2 ?? equipo.ml_score ?? 0)} · v3 ${Number(equipo.ml_score_v3 ?? 0)}${equipo.ml_score_delta_v3_vs_v2 != null ? ` · Δ ${equipo.ml_score_delta_v3_vs_v2}` : ""}`
                    : "v3 no disponible"
                }
              />
              {hasV3Signal ? <Field label="Código ML v3" value={equipo.ml_alert_code_v3} /> : null}
              {hasV3Signal ? <Field label="Señal ML v3" value={mlSignalSummaryV3} /> : null}
              {mlDriverVisibleV3 ? <Field label="Driver principal v3" value={mlDriverVisibleV3} /> : null}
              {mlReasonVisibleV3 ? <Field label="Razón de riesgo v3" value={mlReasonVisibleV3} /> : null}
              <Field label="Alertas resumen" value={equipo.alertas_resumen} />
            </div>
          </section>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Lectura operativa</h2>
            <div className="catastro-card-blue-soft mt-4 rounded-2xl p-5 text-[var(--cat-card-text)]">
              {insight}
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Acción sugerida</h2>
            <div className={`mt-4 rounded-2xl border p-5 ${decisionClasses(decision.tone)}`}>
              <div className="text-xl font-semibold">{decision.title}</div>
              <div className="mt-2 text-sm opacity-90">{decision.detail}</div>
              {equipo.priority_final_motivo ? (
                <div className="mt-3 text-sm opacity-80">{equipo.priority_final_motivo}</div>
              ) : null}
            </div>
          </section>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Contexto operativo</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="SKU" value={equipo.sku ?? equipo.id_equipo} />
              <Field label="Localización" value={equipo.localizacion} />
              <Field label="Ciudad / comuna" value={equipo.ciudad_comuna} />
              <Field label="Condición" value={equipo.condicion} />
              <Field label="Plataforma" value={equipo.plataforma} />
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Timeline reciente</h2>
            <p className="mt-2 text-[var(--cat-text-muted)]">
              Últimos eventos visibles del equipo para dar contexto operativo sin salir de la ficha.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["MTR", "JIRA", "CONCILIADO", "excel:reparados"].map((originLabel) => (
                <span
                  key={originLabel}
                  title={originHelp(originLabel)}
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${originClasses(originLabel)}`}
                >
                  {originLabel}
                </span>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {timelineRows.length ? (
                timelineRows.map((row, idx) => (
                  <div key={`${row.fecha_evento ?? "sin-fecha"}-${row.tipo_evento ?? "sin-tipo"}-${idx}`} className="catastro-inset rounded-2xl p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-semibold text-[var(--cat-text)]">{row.tipo_evento ?? "Evento"}</div>
                      <div className="flex items-center gap-2">
                        <span
                          title={originHelp(row.origen_evento)}
                          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${originClasses(row.origen_evento)}`}
                        >
                          {prettyOrigin(row.origen_evento)}
                        </span>
                        <div className="text-xs text-[var(--cat-text-soft)]">{fmtIsoDate(row.fecha_evento)}</div>
                      </div>
                    </div>
                    {row.detalle_evento ? <div className="mt-2 text-sm text-[var(--cat-text-muted)]">{row.detalle_evento}</div> : null}
                    <div className="mt-2 text-xs text-[var(--cat-text-soft)]">
                      {(row.usuario_evento ?? "Sin usuario")} · {prettyOrigin(row.origen_evento)}
                      {typeof row.dias_hasta_siguiente_evento === "number" ? ` · Δ ${row.dias_hasta_siguiente_evento} días` : ""}
                    </div>
                    {hasAudit ? (
                      <div className="mt-3">
                        <Link href={`#auditoria`} className="text-xs font-medium text-[var(--cat-primary)] hover:underline">
                          Ver auditoría del cambio →
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-4 text-sm text-[var(--cat-text-muted)]">
                  No hay eventos recientes visibles para este equipo.
                </div>
              )}
            </div>
            <div className="mt-4">
              <Link href={`/timeline/${encodeURIComponent(equipo.id_equipo)}`} className="font-medium text-[var(--cat-primary)] hover:underline">
                Ver timeline completo →
              </Link>
            </div>
          </section>
        </section>

        <section className="mt-8">
          <EquipoAuditPanel idEquipo={equipo.id_equipo} rows={auditRows} summary={auditSummary} />
        </section>
      </div>
    </main>
  );
}
