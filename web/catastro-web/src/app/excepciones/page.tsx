import Link from "next/link";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyOperationalStatus } from "@/lib/statusMatrix";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type DashboardActionRow = {
  id_equipo: string;
  cliente?: string | null;
  modelo?: string | null;
  estado_operativo?: string | null;
  alertas_resumen?: string | null;
  priority_final_rank?: number | null;
  priority_final_motivo?: string | null;
  jira_open_count?: number | null;
  accion_recomendada?: string | null;
};

type DashboardPlanningRow = {
  id_equipo: string;
  cliente?: string | null;
  modelo?: string | null;
  accion?: string | null;
  priority_final_rank?: number | null;
  motivo?: string | null;
};

type DashboardJiraMismatch = {
  id_equipo: string;
  conciliacion_estado?: string | null;
  jira_estado?: string | null;
  mtr_estado?: string | null;
  cliente?: string | null;
};

type DashboardPayload = {
  meta?: {
    source?: "dashboard" | "fallback";
    notice?: string;
  };
  overview?: {
    mart_actualizado_at?: string | null;
  } | null;
  action_today?: {
    resumen?: {
      total?: number;
      sin_asignacion?: number;
      renovar?: number;
      salida?: number;
      jira?: number;
    };
    rows?: DashboardActionRow[];
  } | null;
  planning?: {
    bolsa_acciones?: DashboardPlanningRow[];
  } | null;
  integrations?: {
    degraded_mode_active?: boolean;
    jira?: {
      top_inconsistencias?: DashboardJiraMismatch[];
    } | null;
  } | null;
};

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

type OperacionAlertasResponse = {
  rows?: OperacionAlertRow[];
  count?: number;
};

type AuditRow = {
  audit_id: string;
  id_equipo: string;
  campo_modificado?: string | null;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  fecha_cambio?: string | null;
  origen?: string | null;
  actor?: string | null;
  tipo_cambio?: string | null;
  criticidad?: string | null;
  confianza?: string | null;
};

type AuditListResponse = {
  rows?: AuditRow[];
  count?: number;
};

type ExceptionKind =
  | "conciliacion"
  | "jira"
  | "asignacion"
  | "renovacion"
  | "salida"
  | "alerta"
  | "auditoria";

type ExceptionSeverity = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";

type ExceptionRow = {
  key: string;
  id_equipo: string;
  cliente: string;
  category: ExceptionKind;
  severity: ExceptionSeverity;
  source: string;
  title: string;
  summary: string;
  suggestedAction: string;
  ownerSuggested: string;
  ownerReal?: string | null;
  ownerDisplay?: string | null;
  trackingStatus?: string | null;
  trackingUpdatedAt?: string | null;
  trackingComment?: string | null;
  freshness: string;
  ageDays: number | null;
  status?: string | null;
  links: Array<{ href: string; label: string }>;
};

type ExecutionQueueRow = {
  case_key: string;
  owner_real?: string | null;
  owner_display?: string | null;
  estado_seguimiento?: string | null;
  comentario_operativo?: string | null;
  tracking_updated_at?: string | null;
};

type ExecutionQueueResponse = {
  rows?: ExecutionQueueRow[];
};

type GroupSummary = {
  key: string;
  label: string;
  count: number;
  criticals: number;
  href: string;
  helper: string;
};

function pickString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function numeric(value?: number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function fmtNumber(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const integer = Math.trunc(Math.abs(n)).toString();
  return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function fmtIsoDate(value?: string | null) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return value;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

function severityRank(value: ExceptionSeverity) {
  if (value === "CRITICA") return 0;
  if (value === "ALTA") return 1;
  if (value === "MEDIA") return 2;
  return 3;
}

function severityBadge(value: ExceptionSeverity) {
  return getStatusClassName(value, { domain: "confianza" });
}

function sourceBadge(source: string) {
  const key = source.toUpperCase();
  if (key.includes("JIRA") && key.includes("MTR")) return getStatusClassName("media");
  if (key.includes("JIRA")) return getStatusClassName("observacion");
  if (key.includes("AUDITORIA")) return getStatusClassName("info");
  if (key.includes("PLANEACION")) return getStatusClassName("renovar");
  return getStatusClassName("core");
}

function trackingBadge(status?: string | null) {
  const key = String(status ?? "PENDIENTE").toUpperCase();
  if (key === "EN_REVISION") return getStatusClassName("observacion");
  if (key === "RESUELTO") return getStatusClassName("confirmada");
  if (key === "ESCALADO") return getStatusClassName("critica");
  if (key === "DESCARTADO") return getStatusClassName("neutral");
  return getStatusClassName("sin asignacion");
}

function categoryLabel(kind: ExceptionKind) {
  if (kind === "conciliacion") return "Conciliación";
  if (kind === "jira") return "Jira";
  if (kind === "asignacion") return "Asignación";
  if (kind === "renovacion") return "Renovación";
  if (kind === "salida") return "Salida";
  if (kind === "alerta") return "Alerta";
  return "Auditoría";
}

function categoryBadge(kind: ExceptionKind) {
  if (kind === "conciliacion") return getStatusClassName("media");
  if (kind === "jira") return getStatusClassName("observacion");
  if (kind === "asignacion") return getStatusClassName("sin asignacion");
  if (kind === "renovacion") return getStatusClassName("renovar");
  if (kind === "salida") return getStatusClassName("baja");
  if (kind === "alerta") return getStatusClassName("critica");
  return getStatusClassName("info");
}

function inferOwner(kind: ExceptionKind, source: string, title?: string | null, summary?: string | null, action?: string | null) {
  const haystack = normalizeText([source, title, summary, action].filter(Boolean).join(" "));
  if (kind === "auditoria") return "Gobierno de dato";
  if (kind === "conciliacion") return "Mesa de conciliación";
  if (kind === "renovacion") return "Planeación y renovación";
  if (kind === "salida" || haystack.includes("baja") || haystack.includes("obsole") || haystack.includes("salida")) {
    return "Lifecycle y bajas";
  }
  if (haystack.includes("recuper") || haystack.includes("resguardo") || haystack.includes("devolucion")) {
    return "Logística y recuperación";
  }
  if (haystack.includes("defect") || haystack.includes("desperfect") || haystack.includes("repar")) {
    return "Soporte y taller";
  }
  if (kind === "jira" || haystack.includes("jira") || haystack.includes("issue") || haystack.includes("ticket")) {
    return "Mesa Jira";
  }
  if (kind === "asignacion" || haystack.includes("asign") || haystack.includes("owner") || haystack.includes("sin asignacion")) {
    return "Operación TI / asignaciones";
  }
  return "Operación TI";
}

function concreteSuggestedAction(kind: ExceptionKind, source: string, title?: string | null, summary?: string | null, action?: string | null) {
  const haystack = normalizeText([source, title, summary, action].filter(Boolean).join(" "));
  if (kind === "conciliacion") {
    return "Corregir el estado maestro en Jira o MTR, dejar el cruce conciliado y validar evidencia cruzada antes del siguiente corte.";
  }
  if (kind === "jira") {
    if (haystack.includes("reserv")) return "Actualizar o cerrar el issue Jira de reserva y dejar el bucket alineado con la realidad operativa.";
    if (haystack.includes("recuper")) return "Cerrar el pendiente Jira de recuperación solo después de confirmar retorno físico o resguardo regularizado.";
    return "Cerrar o corregir el issue Jira y alinear bucket, estado y responsable con la operación visible.";
  }
  if (kind === "asignacion") {
    return "Asignar owner visible o reasignar el equipo en Activos, dejando respaldo cruzado en Jira si aplica.";
  }
  if (kind === "renovacion") {
    return "Programar renovación, confirmar reemplazo y dejar fecha de salida del equipo actual antes del siguiente ciclo.";
  }
  if (kind === "salida") {
    return "Ejecutar salida o baja formal, retirar el equipo del parque visible y cerrar su workflow administrativo asociado.";
  }
  if (kind === "auditoria") {
    return "Validar el cambio formal, confirmar trazabilidad y revisar si también requiere ajuste en operación o en Jira.";
  }
  if (haystack.includes("defect") || haystack.includes("desperfect") || haystack.includes("repar")) {
    return "Validar la falla, definir reparación o baja y actualizar el estado operativo para evitar lecturas falsas.";
  }
  if (haystack.includes("recuper") || haystack.includes("resguardo")) {
    return "Recuperar físicamente el equipo o regularizar su resguardo, dejando el flujo administrativo alineado.";
  }
  return action && action.trim() && action.trim().toLowerCase() !== "revisar caso"
    ? action
    : "Tomar el caso, validar evidencia y regularizarlo en la fuente operativa correspondiente.";
}

function inferSeverityFromRank(rank?: number | null): ExceptionSeverity {
  const normalized = Number(rank ?? 9999);
  if (normalized <= 10) return "CRITICA";
  if (normalized <= 35) return "ALTA";
  if (normalized <= 80) return "MEDIA";
  return "BAJA";
}

function buildClientDirectory(dashboard: DashboardPayload) {
  const directory = new Map<string, string>();
  for (const row of dashboard.action_today?.rows ?? []) {
    if (row.id_equipo && row.cliente) directory.set(row.id_equipo, row.cliente);
  }
  for (const row of dashboard.planning?.bolsa_acciones ?? []) {
    if (row.id_equipo && row.cliente && !directory.has(row.id_equipo)) directory.set(row.id_equipo, row.cliente);
  }
  for (const row of dashboard.integrations?.jira?.top_inconsistencias ?? []) {
    if (row.id_equipo && row.cliente && !directory.has(row.id_equipo)) directory.set(row.id_equipo, row.cliente);
  }
  return directory;
}

function clientLabel(id_equipo: string, clientHint: string | null | undefined, directory: Map<string, string>) {
  return clientHint ?? directory.get(id_equipo) ?? "SIN_CLIENTE";
}

function buildFilterHref(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim()) params.set(key, value.trim());
  });
  const query = params.toString();
  return query ? `/excepciones?${query}` : "/excepciones";
}

function buildGroupSummaries(
  rows: ExceptionRow[],
  keyBuilder: (row: ExceptionRow) => { key: string; label: string; href: string; helper: string } | null,
) {
  const grouped = new Map<string, GroupSummary>();
  rows.forEach((row) => {
    const descriptor = keyBuilder(row);
    if (!descriptor) return;
    const existing = grouped.get(descriptor.key);
    if (existing) {
      existing.count += 1;
      if (row.severity === "CRITICA") existing.criticals += 1;
      return;
    }
    grouped.set(descriptor.key, {
      key: descriptor.key,
      label: descriptor.label,
      count: 1,
      criticals: row.severity === "CRITICA" ? 1 : 0,
      href: descriptor.href,
      helper: descriptor.helper,
    });
  });

  return [...grouped.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.criticals !== a.criticals) return b.criticals - a.criticals;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 6);
}

function buildActionExceptions(rows: DashboardActionRow[] = []): ExceptionRow[] {
  return rows.map((row) => {
    const action = String(row.accion_recomendada ?? "Revisar");
    const category: ExceptionKind =
      action === "Asignar o reasignar"
        ? "asignacion"
        : action === "Renovar"
          ? "renovacion"
          : action === "Salida / recambio"
            ? "salida"
            : action === "Revisar Jira"
              ? "jira"
              : "alerta";
    return {
      key: `action-${row.id_equipo}-${action}`,
      id_equipo: row.id_equipo,
      cliente: row.cliente ?? "SIN_CLIENTE",
      category,
      severity: action === "Revisar Jira" ? "ALTA" : inferSeverityFromRank(row.priority_final_rank),
      source: action === "Revisar Jira" ? "Jira / Command Center" : "Command Center",
      title: action,
      summary: row.alertas_resumen ?? row.priority_final_motivo ?? "Caso priorizado para revisión hoy.",
      suggestedAction: concreteSuggestedAction(category, action === "Revisar Jira" ? "JIRA" : "MTR", action, row.alertas_resumen ?? row.priority_final_motivo, action),
      ownerSuggested: inferOwner(category, action === "Revisar Jira" ? "JIRA" : "MTR", action, row.alertas_resumen ?? row.priority_final_motivo, action),
      freshness: `Prioridad ${fmtNumber(row.priority_final_rank)}`,
      ageDays: null,
      status: row.estado_operativo,
      links: [
        { href: `/equipos/${encodeURIComponent(row.id_equipo)}`, label: "Ficha" },
        { href: `/activos?q=${encodeURIComponent(row.id_equipo)}`, label: "Activos" },
      ],
    };
  });
}

function buildPlanningExceptions(rows: DashboardPlanningRow[] = []): ExceptionRow[] {
  return rows.slice(0, 10).map((row) => {
    const action = String(row.accion ?? "Revisar");
    const category: ExceptionKind =
      action.toLowerCase().includes("renov") ? "renovacion" : action.toLowerCase().includes("salida") ? "salida" : "alerta";
    return {
      key: `planning-${row.id_equipo}-${action}`,
      id_equipo: row.id_equipo,
      cliente: row.cliente ?? "SIN_CLIENTE",
      category,
      severity: inferSeverityFromRank(row.priority_final_rank),
      source: "Planeación",
      title: action,
      summary: row.motivo ?? "Acción sugerida desde la bolsa corta de planeación.",
      suggestedAction: concreteSuggestedAction(category, "PLANEACION", action, row.motivo, action),
      ownerSuggested: inferOwner(category, "PLANEACION", action, row.motivo, action),
      freshness: `Prioridad ${fmtNumber(row.priority_final_rank)}`,
      ageDays: null,
      status: null,
      links: [
        { href: `/planeacion-compra`, label: "Planeación" },
        { href: `/equipos/${encodeURIComponent(row.id_equipo)}`, label: "Ficha" },
      ],
    };
  });
}

function buildMismatchExceptions(rows: DashboardJiraMismatch[] = []): ExceptionRow[] {
  return rows.slice(0, 8).map((row) => ({
    key: `mismatch-${row.id_equipo}`,
    id_equipo: row.id_equipo,
    cliente: row.cliente ?? "SIN_CLIENTE",
    category: "conciliacion",
    severity: "CRITICA",
    source: "MTR/Jira",
    title: "Brecha de conciliación",
    summary: `Jira ${row.jira_estado ?? "—"} · MTR ${row.mtr_estado ?? "—"} · Estado ${row.conciliacion_estado ?? "—"}`,
    suggestedAction: concreteSuggestedAction("conciliacion", "MTR/JIRA", "Brecha de conciliación", `Jira ${row.jira_estado ?? "—"} · MTR ${row.mtr_estado ?? "—"} · Estado ${row.conciliacion_estado ?? "—"}`, "Corregir conciliación"),
    ownerSuggested: inferOwner("conciliacion", "MTR/JIRA", "Brecha de conciliación", `Jira ${row.jira_estado ?? "—"} · MTR ${row.mtr_estado ?? "—"} · Estado ${row.conciliacion_estado ?? "—"}`, "Corregir conciliación"),
    freshness: "Cruce administrativo vs operativo",
    ageDays: null,
    status: row.conciliacion_estado,
    links: [
      { href: `/operacion?q=${encodeURIComponent(row.id_equipo)}`, label: "Operación" },
      { href: `/activos?q=${encodeURIComponent(row.id_equipo)}`, label: "Activos" },
    ],
  }));
}

function buildOperacionExceptions(rows: OperacionAlertRow[] = [], clientDirectory: Map<string, string> = new Map()): ExceptionRow[] {
  return rows.map((row) => ({
    key: row.alert_id,
    id_equipo: row.id_equipo,
    cliente: clientLabel(row.id_equipo, null, clientDirectory),
    category: row.tipo_alerta?.includes("inconsistencia") ? "conciliacion" : "alerta",
    severity: (String(row.criticidad ?? "MEDIA").toUpperCase() as ExceptionSeverity),
    source: row.origen ?? "Operación",
    title: row.titulo ?? row.tipo_alerta,
    summary: row.descripcion ?? row.evidencia ?? "Brecha operativa visible.",
    suggestedAction: concreteSuggestedAction(
      row.tipo_alerta?.includes("inconsistencia") ? "conciliacion" : "alerta",
      row.origen ?? "OPERACION",
      row.titulo ?? row.tipo_alerta,
      row.descripcion ?? row.evidencia,
      row.accion_sugerida,
    ),
    ownerSuggested: inferOwner(
      row.tipo_alerta?.includes("inconsistencia") ? "conciliacion" : "alerta",
      row.origen ?? "OPERACION",
      row.titulo ?? row.tipo_alerta,
      row.descripcion ?? row.evidencia,
      row.accion_sugerida,
    ),
    freshness: row.fecha_detectada ? `Detectada ${fmtIsoDate(row.fecha_detectada)}` : "Alerta abierta",
    ageDays: row.dias_abierta ?? null,
    status: row.confianza_dato,
    links: [
      { href: `/operacion?q=${encodeURIComponent(row.id_equipo)}`, label: "Operación" },
      { href: `/equipos/${encodeURIComponent(row.id_equipo)}`, label: "Ficha" },
      { href: `/auditoria?q=${encodeURIComponent(row.id_equipo)}`, label: "Auditoría" },
    ],
  }));
}

function buildAuditExceptions(rows: AuditRow[] = [], clientDirectory: Map<string, string> = new Map()): ExceptionRow[] {
  return rows.map((row) => ({
    key: row.audit_id,
    id_equipo: row.id_equipo,
    cliente: clientLabel(row.id_equipo, null, clientDirectory),
    category: "auditoria",
    severity: (String(row.criticidad ?? "MEDIA").toUpperCase() as ExceptionSeverity),
    source: `Auditoría / ${row.origen ?? "Sin origen"}`,
    title: row.tipo_cambio ?? "Cambio auditado",
    summary: `${row.campo_modificado ?? "Campo"}: ${row.valor_anterior ?? "—"} → ${row.valor_nuevo ?? "—"}`,
    suggestedAction: concreteSuggestedAction("auditoria", row.origen ?? "AUDITORIA", row.tipo_cambio, row.campo_modificado, "Validar cambio formal"),
    ownerSuggested: inferOwner("auditoria", row.origen ?? "AUDITORIA", row.tipo_cambio, row.campo_modificado, "Validar cambio formal"),
    freshness: row.fecha_cambio ? `Cambio ${fmtIsoDate(row.fecha_cambio)}` : "Cambio formal",
    ageDays: null,
    status: row.confianza,
    links: [
      { href: `/auditoria?q=${encodeURIComponent(row.id_equipo)}`, label: "Auditoría" },
      { href: `/equipos/${encodeURIComponent(row.id_equipo)}#auditoria`, label: "Ficha" },
    ],
  }));
}

function dedupeExceptions(rows: ExceptionRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.id_equipo}::${row.category}::${row.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyTrackingOverlay(rows: ExceptionRow[], executionRows: ExecutionQueueRow[] = []) {
  const trackedByKey = new Map<string, ExecutionQueueRow>();
  executionRows.forEach((row) => {
    if (row.case_key) trackedByKey.set(String(row.case_key), row);
  });

  return rows.map((row) => {
    const tracked = trackedByKey.get(row.key);
    if (!tracked) {
      return {
        ...row,
        trackingStatus: "PENDIENTE",
        ownerDisplay: row.ownerSuggested,
      };
    }

    return {
      ...row,
      ownerReal: tracked.owner_real ?? null,
      ownerDisplay: tracked.owner_display ?? tracked.owner_real ?? row.ownerSuggested,
      trackingStatus: tracked.estado_seguimiento ?? "PENDIENTE",
      trackingUpdatedAt: tracked.tracking_updated_at ?? null,
      trackingComment: tracked.comentario_operativo ?? null,
    };
  });
}

function sortExceptions(rows: ExceptionRow[]) {
  return [...rows].sort((a, b) => {
    const severityDiff = severityRank(a.severity) - severityRank(b.severity);
    if (severityDiff !== 0) return severityDiff;
    const ageA = a.ageDays == null ? -1 : a.ageDays;
    const ageB = b.ageDays == null ? -1 : b.ageDays;
    if (ageA !== ageB) return ageB - ageA;
    return a.id_equipo.localeCompare(b.id_equipo);
  });
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

export default async function ExcepcionesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const q = pickString(params.q)?.trim().toLowerCase() ?? "";
  const categoryFilter = pickString(params.categoria)?.trim().toLowerCase() ?? "";
  const severityFilter = pickString(params.severidad)?.trim().toUpperCase() ?? "";
  const sourceFilter = pickString(params.fuente)?.trim().toLowerCase() ?? "";
  const ownerFilter = pickString(params.owner)?.trim().toLowerCase() ?? "";
  const clientFilter = pickString(params.cliente)?.trim().toLowerCase() ?? "";
  const origin = await getRequestOrigin();

  const [dashboard, operacionAlertas, auditoriaCritica, executionQueue] = await Promise.all([
    apiProxyGet<DashboardPayload>("/home/dashboard", { origin }).catch(() => ({}) as DashboardPayload),
    apiProxyGet<OperacionAlertasResponse>("/operacion/alertas?estado_alerta=ABIERTA&limit=80", { origin }).catch(() => ({ rows: [] }) as OperacionAlertasResponse),
    apiProxyGet<AuditListResponse>("/auditoria?criticidad=CRITICA&limit=30", { origin }).catch(() => ({ rows: [] }) as AuditListResponse),
    apiProxyGet<ExecutionQueueResponse>("/ejecucion/queue?limit=1000", { origin }).catch(() => ({ rows: [] }) as ExecutionQueueResponse),
  ]);

  const clientDirectory = buildClientDirectory(dashboard);

  const merged = sortExceptions(
    applyTrackingOverlay(
      dedupeExceptions([
      ...buildOperacionExceptions(operacionAlertas.rows ?? [], clientDirectory),
      ...buildMismatchExceptions(dashboard.integrations?.jira?.top_inconsistencias ?? []),
      ...buildActionExceptions(dashboard.action_today?.rows ?? []),
      ...buildPlanningExceptions(dashboard.planning?.bolsa_acciones ?? []),
      ...buildAuditExceptions(auditoriaCritica.rows ?? [], clientDirectory),
      ]),
      executionQueue.rows ?? [],
    ),
  );

  const visible = merged.filter((row) => {
    const matchesQ =
      !q ||
      row.id_equipo.toLowerCase().includes(q) ||
      row.title.toLowerCase().includes(q) ||
      row.summary.toLowerCase().includes(q) ||
      row.ownerSuggested.toLowerCase().includes(q) ||
      String(row.ownerDisplay ?? "").toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || row.category === categoryFilter;
    const matchesSeverity = !severityFilter || row.severity === severityFilter;
    const matchesSource = !sourceFilter || row.source.toLowerCase().includes(sourceFilter);
    const matchesOwner =
      !ownerFilter ||
      row.ownerSuggested.toLowerCase().includes(ownerFilter) ||
      String(row.ownerDisplay ?? "").toLowerCase().includes(ownerFilter);
    const matchesClient = !clientFilter || row.cliente.toLowerCase().includes(clientFilter);
    return matchesQ && matchesCategory && matchesSeverity && matchesSource && matchesOwner && matchesClient;
  });

  const topRows = visible.slice(0, 20);
  const categoryCounts = new Map<ExceptionKind, number>();
  const severityCounts = new Map<ExceptionSeverity, number>();

  visible.forEach((row) => {
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
    severityCounts.set(row.severity, (severityCounts.get(row.severity) ?? 0) + 1);
  });

  const groupedByOwner = buildGroupSummaries(visible, (row) => ({
    key: `owner:${row.ownerDisplay ?? row.ownerSuggested}`,
    label: row.ownerDisplay ?? row.ownerSuggested,
    href: buildFilterHref({ owner: row.ownerDisplay ?? row.ownerSuggested }),
    helper: row.ownerReal ? "Carga activa dentro del owner real" : "Carga activa dentro del owner sugerido",
  })).map((group) => ({
    ...group,
    helper: group.criticals ? `${fmtNumber(group.criticals)} críticas dentro del owner` : group.helper,
  }));
  const groupedByClient = buildGroupSummaries(visible.filter((row) => row.cliente !== "SIN_CLIENTE" && row.cliente !== "—"), (row) => ({
    key: `client:${row.cliente}`,
    label: row.cliente,
    href: buildFilterHref({ cliente: row.cliente }),
    helper: "Concentración por cliente visible",
  })).map((group) => ({
    ...group,
    helper: group.criticals ? `${fmtNumber(group.criticals)} críticas visibles en este cliente` : "Concentración por cliente visible",
  }));
  const groupedBySource = buildGroupSummaries(visible, (row) => ({
    key: `source:${row.source}`,
    label: row.source,
    href: buildFilterHref({ fuente: row.source }),
    helper: "Fuente dominante del caso",
  })).map((group) => ({
    ...group,
    helper: group.criticals ? `${fmtNumber(group.criticals)} críticas nacen aquí` : "Fuente dominante del caso",
  }));

  const dashboardMode = dashboard.meta?.source === "fallback" ? "Señal resiliente" : "Mesa transversal activa";
  const martCutoff = fmtDateTime(dashboard.overview?.mart_actualizado_at);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Centro de excepciones
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-card-text)]">Excepciones y prioridades del día</h1>
              <p className="mt-3 max-w-4xl text-lg text-[var(--cat-card-muted)]">
                Mesa transversal para ver lo que no cuadra hoy: conciliación, Jira abierto, asignación pendiente, renovación, salida y cambios formales con impacto operativo.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link href="/" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]">
                Volver al Home
              </Link>
              <div className="text-sm text-[var(--cat-card-muted)]">Corte base visible: {martCutoff}</div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer Excepciones"
          description="Esta mesa no crea una fuente nueva: concentra las fricciones operativas más relevantes del día para que el equipo actúe sin cambiar de módulo a ciegas."
          items={[
            {
              label: "Fuente dominante",
              value: "Home + Operación + Planeación + Auditoría",
              hint: "La lista se arma sólo con señales ya validadas en módulos existentes.",
              tone: "cyan",
            },
            {
              label: "Corte visible",
              value: martCutoff,
              hint: "El módulo usa como ancla el último corte operativo visible del dashboard y sus fuentes transversales.",
              tone: "green",
            },
            {
              label: "Cobertura",
              value: "Top 20 casos accionables con dueño, acción y accesos",
              hint: `${operationalMeaning("parqueVisible")} ${operationalMeaning("boardJiraReal")} ${operationalMeaning("conciliacionMtrJira")}`,
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: dashboardMode,
              hint: dashboard.meta?.source === "fallback"
                ? `${operationalMeaning("modoDegradado")} La mesa sigue viva aunque el agregado central no haya respondido.`
                : "Lectura transversal para priorizar sin sustituir el detalle de cada módulo.",
              tone: dashboard.meta?.source === "fallback" ? "amber" : "red",
            },
          ]}
          badges={[
            { label: operationalLabel("parqueVisible"), tone: "green" },
            { label: operationalLabel("boardJiraReal"), tone: "amber" },
            { label: operationalLabel("conciliacionMtrJira"), tone: "cyan" },
          ]}
          note="El criterio de esta mesa es simple: mostrar primero lo que requiere acción humana concreta hoy, no lo que solo es interesante ver."
        />

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Excepciones visibles" value={fmtNumber(visible.length)} helper="Casos que pasan el filtro actual" tone="cyan" />
          <KpiCard title="Críticas" value={fmtNumber(severityCounts.get("CRITICA") ?? 0)} helper="Conflicto o prioridad máxima" tone="red" />
          <KpiCard title="Asignación / Jira" value={fmtNumber((categoryCounts.get("asignacion") ?? 0) + (categoryCounts.get("jira") ?? 0))} helper="Flujo operativo inmediato" tone="orange" />
          <KpiCard title="Renovación / salida" value={fmtNumber((categoryCounts.get("renovacion") ?? 0) + (categoryCounts.get("salida") ?? 0))} helper="Presión de recambio o retiro" tone="purple" />
          <KpiCard title="Auditoría crítica" value={fmtNumber(categoryCounts.get("auditoria") ?? 0)} helper="Cambios formales a revisar" tone="green" />
        </section>

        <section className="mt-6 catastro-panel rounded-3xl p-5">
          <h2 className="text-xl font-semibold text-[var(--cat-text)]">Filtros</h2>
          <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Buscar</div>
              <input name="q" defaultValue={pickString(params.q) ?? ""} placeholder="SKU, acción, dueño..." className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Categoría</div>
              <select name="categoria" defaultValue={pickString(params.categoria) ?? ""} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todas</option>
                {(["conciliacion", "jira", "asignacion", "renovacion", "salida", "alerta", "auditoria"] as ExceptionKind[]).map((value) => (
                  <option key={value} value={value}>{categoryLabel(value)}</option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Severidad</div>
              <select name="severidad" defaultValue={pickString(params.severidad) ?? ""} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todas</option>
                {(["CRITICA", "ALTA", "MEDIA", "BAJA"] as ExceptionSeverity[]).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Fuente</div>
              <input name="fuente" defaultValue={pickString(params.fuente) ?? ""} placeholder="Jira, Planeación, Auditoría..." className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Owner sugerido</div>
              <input name="owner" defaultValue={pickString(params.owner) ?? ""} placeholder="Mesa Jira, Operación TI..." className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Cliente</div>
              <input name="cliente" defaultValue={pickString(params.cliente) ?? ""} placeholder="Acid Labs, MacOnline..." className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <div className="flex items-end gap-3 md:col-span-2 xl:col-span-2">
              <button type="submit" className="catastro-button-primary rounded-full px-5 py-3 text-sm font-semibold">
                Aplicar filtros
              </button>
              <Link href="/excepciones" className="catastro-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Limpiar
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <section className="catastro-panel rounded-3xl p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Top casos del día</h2>
                <p className="mt-2 text-[var(--cat-text-muted)]">
                  Los primeros 20 casos con mejor combinación de severidad, aging y acción concreta.
                </p>
              </div>
              <div className="text-sm text-[var(--cat-text-soft)]">{fmtNumber(topRows.length)} visibles</div>
            </div>

            <div className="mt-5 space-y-4">
              {topRows.length ? topRows.map((row) => (
                <article key={row.key} className="cat-operacion-card rounded-2xl p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="cat-badge-stack">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${severityBadge(row.severity)}`}>
                          {row.severity}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${categoryBadge(row.category)}`}>
                          {categoryLabel(row.category)}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${sourceBadge(row.source)}`}>
                          {row.source}
                        </span>
                        {row.trackingStatus ? (
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trackingBadge(row.trackingStatus)}`}>
                            {prettyOperationalStatus(row.trackingStatus)}
                          </span>
                        ) : null}
                        {row.status ? (
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(row.status)}`}>
                            {prettyOperationalStatus(row.status)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                        <div className="text-xl font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                        <div className="text-sm uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">{row.cliente}</div>
                      </div>

                      <div className="mt-2 text-[1.05rem] font-semibold leading-7 text-[var(--cat-text)]">{row.title}</div>
                      <div className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">{row.summary}</div>
                    </div>

                    <div className="cat-operacion-meta-shield">
                      <div className="catastro-kpi-label">Seguimiento visible</div>
                      <div className="mt-2 text-base font-semibold text-[var(--cat-text)]">{row.ownerDisplay ?? row.ownerSuggested}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                        {row.ownerReal ? "Owner real tomado" : "Owner sugerido"}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                        {row.trackingUpdatedAt ? `Actualizado ${fmtDateTime(row.trackingUpdatedAt)}` : row.ageDays != null ? `${row.ageDays}d abiertos` : row.freshness}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_0.8fr]">
                    <div className="catastro-inset rounded-2xl p-4">
                      <div className="catastro-kpi-label">Acción sugerida</div>
                      <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{row.suggestedAction}</div>
                      {row.trackingComment ? (
                        <div className="mt-4 rounded-2xl border border-[color:var(--cat-border)] bg-[rgba(9,14,26,0.68)] p-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                          <span className="font-semibold text-[var(--cat-text)]">Última nota:</span> {row.trackingComment}
                        </div>
                      ) : null}
                    </div>
                    <div className="catastro-inset rounded-2xl p-4">
                      <div className="catastro-kpi-label">Accesos</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.links.map((link) => (
                          <Link key={`${row.key}-${link.href}`} href={link.href} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                            {link.label}
                          </Link>
                        ))}
                        <Link href={`/ejecucion?q=${encodeURIComponent(row.id_equipo)}`} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                          Ejecución
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--cat-border)] p-6 text-sm text-[var(--cat-text-muted)]">
                  No hay excepciones visibles con los filtros actuales.
                </div>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Buckets del día</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(["conciliacion", "jira", "asignacion", "renovacion", "salida", "auditoria"] as ExceptionKind[]).map((kind) => (
                  <div key={kind} className="rounded-2xl border border-[color:var(--cat-border)] bg-[rgba(9,14,26,0.84)] p-4">
                    <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${categoryBadge(kind)}`}>
                      {categoryLabel(kind)}
                    </div>
                    <div className="mt-3 text-3xl font-bold text-[var(--cat-text)]">{fmtNumber(categoryCounts.get(kind) ?? 0)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Tensión sistémica</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--cat-text-muted)]">
                <div className="catastro-inset rounded-2xl p-4">
                  <span className="font-semibold text-[var(--cat-text)]">Conciliación:</span> {fmtNumber(categoryCounts.get("conciliacion") ?? 0)} casos con cruce MTR/Jira para revisar.
                </div>
                <div className="catastro-inset rounded-2xl p-4">
                  <span className="font-semibold text-[var(--cat-text)]">Asignación / Jira:</span> {fmtNumber((categoryCounts.get("asignacion") ?? 0) + (categoryCounts.get("jira") ?? 0))} casos que podrían resolverse con workflow operativo.
                </div>
                <div className="catastro-inset rounded-2xl p-4">
                  <span className="font-semibold text-[var(--cat-text)]">Recambio:</span> {fmtNumber((categoryCounts.get("renovacion") ?? 0) + (categoryCounts.get("salida") ?? 0))} casos que empujan renovación o salida.
                </div>
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Concentración por owner</h2>
              <div className="mt-4 space-y-3">
                {groupedByOwner.length ? groupedByOwner.map((group) => (
                  <Link key={group.key} href={group.href} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--cat-text)]">{group.label}</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">{group.helper}</div>
                      </div>
                      <div className="text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(group.count)}</div>
                    </div>
                  </Link>
                )) : (
                  <div className="catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
                    No hay owners visibles con el filtro actual.
                  </div>
                )}
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Concentración por cliente</h2>
              <div className="mt-4 space-y-3">
                {groupedByClient.length ? groupedByClient.map((group) => (
                  <Link key={group.key} href={group.href} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--cat-text)]">{group.label}</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">{group.helper}</div>
                      </div>
                      <div className="text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(group.count)}</div>
                    </div>
                  </Link>
                )) : (
                  <div className="catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
                    No hay clientes agrupables con los filtros actuales.
                  </div>
                )}
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Concentración por fuente</h2>
              <div className="mt-4 space-y-3">
                {groupedBySource.length ? groupedBySource.map((group) => (
                  <Link key={group.key} href={group.href} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--cat-text)]">{group.label}</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">{group.helper}</div>
                      </div>
                      <div className="text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(group.count)}</div>
                    </div>
                  </Link>
                )) : (
                  <div className="catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
                    No hay fuentes visibles con los filtros actuales.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
