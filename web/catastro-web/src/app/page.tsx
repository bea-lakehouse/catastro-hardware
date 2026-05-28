import Link from "next/link";
import MiniTable from "@/components/MiniTable";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import {
  integrationHealthBadgeClasses,
  integrationHealthCardClasses,
  integrationHealthDotClasses,
  integrationHealthLabel,
} from "@/lib/integration-health";
import {
  prettyReconciliationStatus,
  reconciliationClasses,
  reconciliationHelp,
  reconciliationRate,
} from "@/lib/reconciliation-ui";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyJiraBucket, prettyOperationalStatus } from "@/lib/statusMatrix";
import { getUiVisualUpdatedAtLabel } from "@/lib/ui-version";

type CountRow = {
  grupo?: string;
  cliente?: string;
  equipos?: number;
};

type FocusRow = {
  id_equipo: string;
  cliente?: string | null;
  estado_operativo?: string | null;
  priority_final_rank?: number | null;
  alertas_resumen?: string | null;
  jira_open_count?: number | null;
  last_event_date?: string | null;
};

type PlanningRow = {
  id_equipo: string;
  cliente?: string | null;
  modelo?: string | null;
  accion?: string | null;
  priority_final_rank?: number | null;
  motivo?: string | null;
};

type SyncRun = {
  source_type?: string;
  source_name?: string;
  status?: string;
  started_at?: string;
  finished_at?: string;
  rows_loaded?: number;
  error?: string | null;
};

type IntegrationHealthCard = {
  key: string;
  title?: string;
  status?: string;
  status_label?: string;
  headline?: string | null;
  latest_attempt_at?: string | null;
  latest_success_at?: string | null;
  rows_processed?: number | null;
  rows_basis?: string | null;
  error_short?: string | null;
  source_active?: string | null;
  impact?: string | null;
  suggested_action?: string | null;
};

type BoardMetric = {
  label?: string;
  value?: number;
  href?: string;
};

type BoardCard = {
  title?: string;
  detail?: string;
  metrics?: BoardMetric[];
};

type DashboardResponse = {
  meta?: {
    source?: "dashboard" | "fallback";
    notice?: string;
  };
  overview?: {
    activos_totales?: number;
    asignados?: number;
    disponibles?: number;
    bajas?: number;
    sin_asignacion?: number;
    riesgo_alto?: number;
    riesgo_medio?: number;
    riesgo_bajo?: number;
    equipos_con_jira?: number;
    equipos_con_ml?: number;
    alertas_criticas?: number;
    alertas_warn?: number;
    mart_actualizado_at?: string | null;
    riesgo_ml_disponible?: boolean;
    equipos_conciliados?: number;
    inconsistencias_mtr_jira?: number;
    jira_sin_match_mtr?: number;
    mtr_sin_match_jira?: number;
    creados_jira_sin_ingreso_mtr?: number;
    reservas_jira_pendientes?: number;
    asignados_sin_respaldo_cruzado?: number;
  } | null;
  action_today?: {
    resumen?: {
      total?: number;
      sin_asignacion?: number;
      renovar?: number;
      salida?: number;
      jira?: number;
    };
    rows?: Array<{
      id_equipo: string;
      cliente?: string | null;
      modelo?: string | null;
      estado_operativo?: string | null;
      alertas_resumen?: string | null;
      priority_final_rank?: number | null;
      priority_final_motivo?: string | null;
      jira_open_count?: number | null;
      accion_recomendada?: string | null;
    }>;
  } | null;
  operations?: {
    top_clientes?: CountRow[];
    tipo_colaborador?: CountRow[];
    plataforma?: CountRow[];
    senales?: {
      sin_asignacion?: number;
      en_baja?: number;
      prioridad_alta?: number;
      con_alerta_relevante?: number;
    };
    focos_operativos?: FocusRow[];
  } | null;
  planning?: {
    resumen?: {
      renovar_mart?: number;
      renovar_politica?: number;
      salida_legacy?: number;
      presion_alta?: number;
      presion_media?: number;
      elegibles_dev?: number;
    };
    modelos_criticos?: Array<{ modelo?: string; accion?: string; equipos?: number }>;
    bolsa_acciones?: PlanningRow[];
    acciones_sugeridas?: Array<{ titulo?: string; detalle?: string }>;
  } | null;
  integrations?: {
    ultimas_syncs?: Record<string, SyncRun>;
    degraded_mode_active?: boolean;
    health_cards?: IntegrationHealthCard[];
    jira?: {
      available?: boolean;
      message?: string | null;
      equipos_con_issues?: number;
      issues_abiertos?: number;
      max_dias_issue_abierto?: number | null;
      ultimo_evento_jira_at?: string | null;
      board_summary?: Array<{
        bucket?: string | null;
        issues?: number | null;
      }>;
      board_cards?: BoardCard[];
      top_equipos?: Array<{
        id_equipo: string;
        cliente?: string | null;
        jira_open_count?: number | null;
        jira_days_open_max?: number | null;
        priority_final_rank?: number | null;
      }>;
      reconciliation?: {
        equipos_conciliados?: number;
        inconsistencias_mtr_jira?: number;
        jira_sin_match_mtr?: number;
        mtr_sin_match_jira?: number;
        reservas_jira_pendientes?: number;
        asignados_sin_respaldo_cruzado?: number;
        creados_jira_sin_ingreso_mtr?: number;
      };
      top_inconsistencias?: Array<{
        id_equipo: string;
        conciliacion_estado?: string | null;
        jira_estado?: string | null;
        mtr_estado?: string | null;
        cliente?: string | null;
      }>;
    };
  } | null;
  errors?: Record<string, string>;
};

type FallbackHomeResumen = {
  activos_totales?: number;
  asignados?: number;
  disponibles?: number;
  bajas?: number;
  sin_asignacion?: number;
  riesgo_alto?: number;
  riesgo_medio?: number;
  riesgo_bajo?: number;
};

type FallbackHomeActivosRow = {
  id_equipo: string;
  cliente?: string | null;
  persona?: string | null;
  estado_operativo?: string | null;
  estado_equipo?: string | null;
  last_event_date?: string | null;
  alertas_resumen?: string | null;
  priority_final_rank?: number | null;
  jira_open_count?: number | null;
  jira_days_open_max?: number | null;
  jira_board_bucket?: string | null;
};

type FallbackHomeActivos = {
  resumen?: {
    activos_totales?: number;
    asignados?: number;
    disponibles?: number;
    bajas?: number;
    sin_asignacion?: number;
    sin_score?: number;
    renovar?: number;
    rotacion_alta?: number;
  };
  reconciliacion?: NonNullable<NonNullable<DashboardResponse["integrations"]>["jira"]>["reconciliation"];
  top_clientes?: Array<{ cliente?: string | null; equipos?: number | null }>;
  tabla?: FallbackHomeActivosRow[];
};

type FallbackEquipo = {
  id_equipo: string;
  cliente?: string | null;
  estado?: string | null;
  last_event_persona?: string | null;
  tipo_colaborador?: string | null;
  severidad?: string | null;
  alertas_resumen?: string | null;
  jira_open_count?: number | null;
  jira_board_bucket?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ml_risk_level?: string | null;
  ml_score?: number | null;
  priority_final_rank?: number | null;
  conciliacion_estado?: string | null;
  origen_principal?: string | null;
};

type FallbackEquiposResponse = {
  count?: number;
  items?: FallbackEquipo[];
};

type FallbackPlanningItem = {
  id_equipo: string;
  cliente?: string | null;
  marca_modelo?: string | null;
  decision?: string | null;
  motivo?: string | null;
  priority_final_rank?: number | null;
};

type FallbackPlanningFamily = {
  modelo?: string | null;
  cantidad?: number | null;
};

type FallbackPlanningResponse = {
  resumen?: {
    retiro_renovacion?: number;
    compra_staffing?: number;
    movimientos_core?: number;
    asignacion_reasignacion?: number;
    observacion?: number;
    mantener?: number;
    total?: number;
  };
  bloques?: Record<string, FallbackPlanningItem[]>;
  obsoletos_staffing_asignados?: FallbackPlanningFamily[];
  excluidos_parque_operativo?: FallbackPlanningFamily[];
};

type FallbackSyncHealth = {
  sync_runs?: Record<string, SyncRun>;
  raw?: {
    mtr_google_sheet_rows?: {
      latest_inserted_at?: string | null;
      freshness_hours?: number | null;
      row_count?: number | null;
    };
    jira_issues?: {
      latest_inserted_at?: string | null;
      freshness_hours?: number | null;
      row_count?: number | null;
    };
  };
  analytics?: {
    mart_equipos_estado_actual?: {
      latest_loaded_at?: string | null;
      row_count?: number | null;
      freshness_hours?: number | null;
    };
  };
  ml?: {
    latest_scores?: {
      row_count?: number | null;
      latest_scored_at?: string | null;
      freshness_hours?: number | null;
    };
    latest_relation_present?: boolean;
  };
};

type RefreshObservabilityCard = {
  key: string;
  title: string;
  status: "SUCCESS" | "DEGRADED" | "ERROR";
  headline: string;
  latest_success_at?: string | null;
  freshness_hours?: number | null;
  rows_processed?: number | null;
  threshold_hours: number;
  suggested_action: string;
};

type RefreshObservability = {
  cards: RefreshObservabilityCard[];
  overall_status: "SUCCESS" | "DEGRADED" | "ERROR";
  stale_sources: number;
  failing_sources: number;
  latest_success_at?: string | null;
  headline: string;
  detail: string;
};

type AuditSummaryResponse = {
  kpis?: {
    total_cambios_auditados?: number | null;
    equipos_con_cambios?: number | null;
    cambios_criticos?: number | null;
    ultimo_cambio_global?: string | null;
  };
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

type OperacionSummaryResponse = {
  kpis?: {
    alertas_criticas?: number | null;
    alertas_altas?: number | null;
    total_alertas_abiertas?: number | null;
    equipos_afectados?: number | null;
    ultima_alerta_detectada?: string | null;
  };
};

type OperacionAlertRow = {
  alert_id: string;
  id_equipo: string;
  tipo_alerta?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  criticidad?: string | null;
  origen?: string | null;
  fecha_detectada?: string | null;
};

type OperacionAlertasResponse = {
  rows?: OperacionAlertRow[];
  count?: number;
};

type HistoricalPulseResponse = {
  mensual?: Array<{
    mes: string;
    movimientos_total?: number | null;
    ingresos_totales?: number | null;
    salidas_totales?: number | null;
    ingresos_internos?: number | null;
    devoluciones?: number | null;
    presion_compra?: number | null;
    balance_neto?: number | null;
  }>;
};

type DailyPulseEvent = {
  key: string;
  kind: "Auditoría" | "Alerta";
  id_equipo: string;
  source: string;
  summary: string;
  when: string;
  href: string;
};

type DailyPulseNarrative = {
  label: string;
  headline: string;
  detail: string;
  tone: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
};

type DailyPulse = {
  todayIso: string;
  yesterdayIso: string;
  auditTodayCount: number;
  auditDelta: number;
  alertsTodayCount: number;
  alertsDelta: number;
  regularizedCount: number;
  worsenedCount: number;
  auditCriticalToday: number;
  alertCriticalToday: number;
  latestVisibleAt: string | null;
  monthComparisonLabel: string;
  monthMovementsDelta: number | null;
  monthPressureDelta: number | null;
  monthBalanceDelta: number | null;
  narratives: DailyPulseNarrative[];
  latestEvents: DailyPulseEvent[];
};

type ExecutionQueueRow = {
  case_key: string;
  id_equipo: string;
  cliente: string;
  severity: string;
  source: string;
  title: string;
  owner_display?: string | null;
  estado_seguimiento?: string | null;
  tracking_updated_at?: string | null;
  links?: Array<{ href: string; label: string }>;
};

type ExecutionQueueResponse = {
  kpis?: {
    total?: number;
    criticas?: number;
    pendientes?: number;
    en_revision?: number;
    escalados?: number;
    sin_owner_real?: number;
    resueltos_hoy?: number;
    validados_cruce?: number;
    reabiertos?: number;
    tiempo_medio_resolucion_horas?: number | null;
  };
  total_visible?: number;
  rows?: ExecutionQueueRow[];
};

type ChangeReason = {
  key: string;
  title: string;
  value: string;
  explanation: string;
  href: string;
  hrefLabel: string;
  tone: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
};

type DecisionRecommendation = {
  title: string;
  tone: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
  headline: string;
  rationale: string;
  confidence: string;
  reasons: string[];
  links: Array<{ href: string; label: string }>;
};

type ExecutiveBrief = {
  statusLine: string;
  headline: string;
  summary: string;
  highlights: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  nextFocus: string[];
};

async function safeApiProxyGet<T>(path: string, origin: string): Promise<T | null> {
  try {
    return await apiProxyGet<T>(path, { origin });
  } catch {
    return null;
  }
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

function formatIsoInTimezone(date: Date, timeZone = "America/Santiago") {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function monthStartIso(date: Date) {
  const copy = new Date(date);
  copy.setDate(1);
  return formatIsoInTimezone(copy);
}

function previousMonthStartIso(date: Date) {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setMonth(copy.getMonth() - 1);
  return formatIsoInTimezone(copy);
}

function monthNameFromIso(value?: string | null) {
  if (!value) return "mes previo";
  const match = String(value).match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  const monthIndex = Number(match[2]) - 1;
  const months = [
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
  return `${months[monthIndex] ?? "mes"} ${match[1]}`;
}

function formatSignedDelta(value?: number | null) {
  const n = numeric(value);
  if (n > 0) return `+${fmtNumber(n)}`;
  if (n < 0) return `-${fmtNumber(Math.abs(n))}`;
  return "0";
}

function isRegularizedAudit(row: AuditRow) {
  const haystack = normalizeText(
    `${row.tipo_cambio ?? ""} ${row.campo_modificado ?? ""} ${row.valor_anterior ?? ""} ${row.valor_nuevo ?? ""} ${row.origen ?? ""}`,
  );
  return (
    haystack.includes("conciliad") ||
    haystack.includes("regulariz") ||
    haystack.includes("cerrad") ||
    haystack.includes("resuelt") ||
    haystack.includes("normal") ||
    haystack.includes("disponible") ||
    haystack.includes("asignado")
  );
}

function isWorsenedAudit(row: AuditRow) {
  const haystack = normalizeText(
    `${row.tipo_cambio ?? ""} ${row.campo_modificado ?? ""} ${row.valor_nuevo ?? ""} ${row.criticidad ?? ""}`,
  );
  return (
    haystack.includes("critica") ||
    haystack.includes("baja") ||
    haystack.includes("defect") ||
    haystack.includes("desperfect") ||
    haystack.includes("obsole") ||
    haystack.includes("por recuperar") ||
    haystack.includes("sin asignacion")
  );
}

function isWorsenedAlert(row: OperacionAlertRow) {
  const severity = String(row.criticidad ?? "").toUpperCase();
  if (severity === "CRITICA" || severity === "ALTA") return true;
  const haystack = normalizeText(`${row.tipo_alerta ?? ""} ${row.titulo ?? ""} ${row.descripcion ?? ""}`);
  return (
    haystack.includes("inconsistencia") ||
    haystack.includes("sin match") ||
    haystack.includes("brecha") ||
    haystack.includes("jira") ||
    haystack.includes("backlog")
  );
}

function buildDailyNarratives(pulse: Omit<DailyPulse, "narratives" | "latestEvents">): DailyPulseNarrative[] {
  const movementDetail =
    pulse.monthMovementsDelta == null
      ? "Todavía no hay comparación mensual suficiente para cuantificar el ritmo del mes."
      : pulse.monthMovementsDelta > 0
        ? `El runtime del mes viene con ${fmtNumber(pulse.monthMovementsDelta)} movimientos más que ${pulse.monthComparisonLabel}.`
        : pulse.monthMovementsDelta < 0
          ? `El runtime del mes viene con ${fmtNumber(Math.abs(pulse.monthMovementsDelta))} movimientos menos que ${pulse.monthComparisonLabel}.`
          : `El runtime del mes está parejo contra ${pulse.monthComparisonLabel}.`;

  const pressureDetail =
    pulse.monthPressureDelta == null
      ? "La presión mensual todavía no tiene comparativo directo en esta lectura."
      : pulse.monthPressureDelta > 0
        ? `La presión MTR sube ${fmtNumber(pulse.monthPressureDelta)} puntos frente a ${pulse.monthComparisonLabel}.`
        : pulse.monthPressureDelta < 0
          ? `La presión MTR baja ${fmtNumber(Math.abs(pulse.monthPressureDelta))} puntos frente a ${pulse.monthComparisonLabel}.`
          : `La presión MTR no cambia frente a ${pulse.monthComparisonLabel}.`;

  return [
    {
      label: "Subió",
      headline:
        pulse.auditDelta > 0
          ? `Subió la actividad formal: ${formatSignedDelta(pulse.auditDelta)} cambios vs ayer.`
          : pulse.monthMovementsDelta != null && pulse.monthMovementsDelta > 0
            ? `Subió el runtime del mes frente a ${pulse.monthComparisonLabel}.`
            : "No hay alza fuerte adicional frente al corte anterior.",
      detail:
        pulse.auditDelta > 0
          ? `Hoy quedaron ${fmtNumber(pulse.auditTodayCount)} cambios auditados visibles sobre el parque.`
          : movementDetail,
      tone: pulse.auditDelta > 0 || (pulse.monthMovementsDelta ?? 0) > 0 ? "cyan" : "green",
    },
    {
      label: "Bajó",
      headline:
        pulse.alertsDelta < 0
          ? `Bajó el ingreso de alertas nuevas: ${fmtNumber(Math.abs(pulse.alertsDelta))} menos que ayer.`
          : pulse.monthBalanceDelta != null && pulse.monthBalanceDelta < 0
            ? `Bajó el balance neto del mes frente a ${pulse.monthComparisonLabel}.`
            : "No se ve una baja fuerte de señal nueva hoy.",
      detail:
        pulse.alertsDelta < 0
          ? `Hoy entraron ${fmtNumber(pulse.alertsTodayCount)} alertas abiertas nuevas a la mesa.`
          : pulse.monthBalanceDelta != null
            ? `El balance del mes se mueve ${formatSignedDelta(pulse.monthBalanceDelta)} contra ${pulse.monthComparisonLabel}.`
            : "Sin comparativo suficiente para marcar una baja clara.",
      tone: pulse.alertsDelta < 0 ? "green" : "yellow",
    },
    {
      label: "Se regularizó",
      headline:
        pulse.regularizedCount > 0
          ? `${fmtNumber(pulse.regularizedCount)} cambios de hoy apuntan a conciliación o cierre visible.`
          : "No aparecen regularizaciones claras en el corte visible de hoy.",
      detail:
        pulse.regularizedCount > 0
          ? "La señal viene de auditoría formal: cierres, conciliaciones o normalizaciones capturadas en la bitácora."
          : "Si la regularización ocurrió fuera de la bitácora auditada, todavía no queda trazada aquí.",
      tone: pulse.regularizedCount > 0 ? "green" : "yellow",
    },
    {
      label: "Empeoró",
      headline:
        pulse.worsenedCount > 0
          ? `${fmtNumber(pulse.worsenedCount)} señales nuevas empujan riesgo o conflicto hoy.`
          : "No se detecta empeoramiento fuerte nuevo en el corte visible.",
      detail:
        pulse.worsenedCount > 0
          ? `Se mezclan ${fmtNumber(pulse.auditCriticalToday)} cambios críticos auditados y ${fmtNumber(pulse.alertCriticalToday)} alertas altas/críticas nuevas. ${pressureDetail}`
          : pressureDetail,
      tone: pulse.worsenedCount > 0 ? "red" : "purple",
    },
  ];
}

function buildChangeReasons(dashboard: DashboardResponse, pulse: DailyPulse | null): ChangeReason[] {
  const reasons: ChangeReason[] = [];
  const jiraInconsistencies = numeric(dashboard.overview?.inconsistencias_mtr_jira);
  const pendingReservations = numeric(dashboard.integrations?.jira?.reconciliation?.reservas_jira_pendientes);
  const actionTodayTotal = numeric(dashboard.action_today?.resumen?.total);
  const renewalPressure = numeric(dashboard.planning?.resumen?.renovar_mart) + numeric(dashboard.planning?.resumen?.renovar_politica);
  const outputPressure = numeric(dashboard.planning?.resumen?.salida_legacy);
  const operationalPriority = numeric(dashboard.operations?.senales?.prioridad_alta);
  const criticalAlerts = numeric(dashboard.overview?.alertas_criticas);

  reasons.push({
    key: "traceability",
    title: "Trazabilidad formal del día",
    value: pulse ? fmtNumber(pulse.auditTodayCount) : fmtNumber(0),
    explanation: pulse
      ? pulse.auditTodayCount > 0
        ? `La bitácora auditada registró ${fmtNumber(pulse.auditTodayCount)} cambios hoy y ${fmtNumber(pulse.regularizedCount)} apuntan a regularización o cierre visible.`
        : "Hoy no se ve actividad formal fuerte en auditoría; el corte está más dominado por continuidad que por cambios documentados."
      : "No hay señal diaria suficiente para explicar trazabilidad formal en este corte.",
    href: "/auditoria",
    hrefLabel: "Abrir Auditoría",
    tone: pulse && pulse.auditTodayCount > 0 ? "cyan" : "green",
  });

  reasons.push({
    key: "operacion",
    title: "Brecha operativa activa",
    value: fmtNumber(criticalAlerts + operationalPriority),
    explanation:
      criticalAlerts > 0 || operationalPriority > 0
        ? `La variación del tablero viene empujada por ${fmtNumber(criticalAlerts)} alertas críticas y ${fmtNumber(operationalPriority)} focos con prioridad alta en operación.`
        : "Operación no muestra un salto fuerte de criticidad hoy; la señal está relativamente contenida.",
    href: "/operacion",
    hrefLabel: "Abrir Operación",
    tone: criticalAlerts > 0 ? "red" : operationalPriority > 0 ? "orange" : "green",
  });

  reasons.push({
    key: "conciliacion",
    title: "Conciliación MTR/Jira",
    value: fmtNumber(jiraInconsistencies + pendingReservations),
    explanation:
      jiraInconsistencies > 0 || pendingReservations > 0
        ? `El cambio del día también se explica por ${fmtNumber(jiraInconsistencies)} inconsistencias visibles y ${fmtNumber(pendingReservations)} reservas Jira pendientes de cierre operativo.`
        : "Hoy no se ve una presión relevante desde conciliación; MTR y Jira se mantienen relativamente alineados.",
    href: "/excepciones?categoria=conciliacion",
    hrefLabel: "Ver conciliación",
    tone: jiraInconsistencies > 0 ? "purple" : "green",
  });

  reasons.push({
    key: "planeacion",
    title: "Recambio y bolsa corta",
    value: fmtNumber(renewalPressure + outputPressure + actionTodayTotal),
    explanation:
      renewalPressure > 0 || outputPressure > 0 || actionTodayTotal > 0
        ? `Planeación y la bolsa corta explican parte del movimiento: ${fmtNumber(renewalPressure)} casos de renovación, ${fmtNumber(outputPressure)} salidas legacy y ${fmtNumber(actionTodayTotal)} acciones del día visibles.`
        : "Planeación no está metiendo presión adicional fuerte hoy; el tablero se sostiene más por operación que por recambio.",
    href: "/planeacion-compra",
    hrefLabel: "Abrir Planeación",
    tone: renewalPressure > 0 ? "yellow" : outputPressure > 0 ? "orange" : "green",
  });

  if (pulse) {
    reasons.push({
      key: "historico",
      title: "Deriva mensual",
      value: pulse.monthMovementsDelta == null ? "—" : formatSignedDelta(pulse.monthMovementsDelta),
      explanation:
        pulse.monthMovementsDelta == null
          ? "Todavía no hay suficiente histórico visible para explicar el cambio desde el mes previo."
          : pulse.monthMovementsDelta > 0
            ? `El mes en curso acelera ${fmtNumber(pulse.monthMovementsDelta)} movimientos sobre ${pulse.monthComparisonLabel}; por eso el runtime se siente más cargado.`
            : pulse.monthMovementsDelta < 0
              ? `El mes en curso baja ${fmtNumber(Math.abs(pulse.monthMovementsDelta))} movimientos frente a ${pulse.monthComparisonLabel}; el corte está más estabilizado.`
              : `El ritmo del mes está prácticamente igual a ${pulse.monthComparisonLabel}; el cambio del día viene más por detalle que por tendencia macro.`,
      href: "/historico-catastro",
      hrefLabel: "Abrir Histórico",
      tone:
        pulse.monthMovementsDelta == null
          ? "purple"
          : pulse.monthMovementsDelta > 0
            ? "cyan"
            : pulse.monthMovementsDelta < 0
              ? "green"
              : "yellow",
    });
  }

  return reasons.slice(0, 5);
}

function buildDecisionRecommendation(dashboard: DashboardResponse, pulse: DailyPulse | null): DecisionRecommendation {
  const criticalAlerts = numeric(dashboard.overview?.alertas_criticas);
  const highRiskMl = numeric(dashboard.overview?.riesgo_alto);
  const jiraInconsistencies = numeric(dashboard.overview?.inconsistencias_mtr_jira);
  const pendingReservations = numeric(dashboard.integrations?.jira?.reconciliation?.reservas_jira_pendientes);
  const unsupportedAssigned = numeric(dashboard.integrations?.jira?.reconciliation?.asignados_sin_respaldo_cruzado);
  const withoutOwner = numeric(dashboard.overview?.sin_asignacion);
  const renewalPressure = numeric(dashboard.planning?.resumen?.renovar_mart) + numeric(dashboard.planning?.resumen?.renovar_politica);
  const legacyExit = numeric(dashboard.planning?.resumen?.salida_legacy);
  const stockPressure = numeric(dashboard.planning?.resumen?.presion_alta) + numeric(dashboard.planning?.resumen?.presion_media);
  const dailyWorsened = numeric(pulse?.worsenedCount);
  const dailyRegularized = numeric(pulse?.regularizedCount);

  if (criticalAlerts > 0 || jiraInconsistencies >= 8 || dailyWorsened >= 6) {
    return {
      title: "Regularizar operación y conciliación",
      tone: "red",
      headline: "La decisión del día es cerrar brechas operativas antes de abrir más movimiento.",
      rationale: `Hay ${fmtNumber(criticalAlerts)} alertas críticas, ${fmtNumber(jiraInconsistencies)} inconsistencias MTR/Jira y ${fmtNumber(dailyWorsened)} señales nuevas que empeoran el runtime.`,
      confidence: "Alta",
      reasons: [
        `${fmtNumber(criticalAlerts)} alertas críticas siguen abiertas.`,
        `${fmtNumber(jiraInconsistencies)} cruces MTR/Jira siguen inconsistentes.`,
        `${fmtNumber(pendingReservations + unsupportedAssigned)} casos Jira siguen sin cierre o sin respaldo cruzado.`,
      ],
      links: [
        { href: "/operacion", label: "Abrir Operación" },
        { href: "/excepciones?categoria=conciliacion", label: "Ver conciliación" },
        { href: "/auditoria", label: "Validar trazabilidad" },
      ],
    };
  }

  if (renewalPressure > 0 || legacyExit > 0 || highRiskMl > 0) {
    return {
      title: "Ejecutar recambio priorizado",
      tone: "orange",
      headline: "La señal del día empuja renovación, salida o recambio dirigido sobre casos ya maduros.",
      rationale: `Planeación y ML ya muestran ${fmtNumber(renewalPressure)} casos de renovación, ${fmtNumber(legacyExit)} salidas legacy y ${fmtNumber(highRiskMl)} equipos en riesgo alto.`,
      confidence: highRiskMl > 0 ? "Alta" : "Media",
      reasons: [
        `${fmtNumber(renewalPressure)} casos están marcados para renovar por mart o política.`,
        `${fmtNumber(legacyExit)} equipos siguen en salida legacy.`,
        `${fmtNumber(highRiskMl)} equipos quedan en riesgo ML alto visible.`,
      ],
      links: [
        { href: "/planeacion-compra", label: "Abrir Planeación" },
        { href: "/ml-v2", label: "Abrir ML v2" },
        { href: "/activos", label: "Revisar parque" },
      ],
    };
  }

  if (withoutOwner > 0 || pendingReservations > 0 || unsupportedAssigned > 0) {
    return {
      title: "Reasignar y limpiar backlog",
      tone: "yellow",
      headline: "La operación del día pide ordenar ownership y cerrar pendientes administrativos visibles.",
      rationale: `Se mantienen ${fmtNumber(withoutOwner)} equipos sin asignación, ${fmtNumber(pendingReservations)} reservas Jira pendientes y ${fmtNumber(unsupportedAssigned)} asignados sin respaldo cruzado.`,
      confidence: "Media",
      reasons: [
        `${fmtNumber(withoutOwner)} equipos siguen sin owner operativo claro.`,
        `${fmtNumber(pendingReservations)} reservas Jira no han cerrado su correlato operativo.`,
        `${fmtNumber(unsupportedAssigned)} asignados aún no tienen respaldo conciliado.`,
      ],
      links: [
        { href: "/activos?estado=Sin%20asignacion", label: "Abrir Activos" },
        { href: "/excepciones?categoria=asignacion", label: "Ver asignación" },
        { href: "/operacion", label: "Revisar backlog" },
      ],
    };
  }

  if (stockPressure > 0) {
    return {
      title: "Cubrir demanda con stock visible",
      tone: "purple",
      headline: "La prioridad es sostener continuidad con stock y bolsa operativa antes de escalar compra.",
      rationale: `Planeación marca ${fmtNumber(stockPressure)} puntos de presión visible, pero la lectura actual sigue siendo más de cobertura y monitoreo que de compra inmediata.`,
      confidence: "Media",
      reasons: [
        `${fmtNumber(stockPressure)} puntos de presión están visibles en planeación.`,
        `La continuidad del mes sigue apoyada en stock y pendientes heredados.`,
        dailyRegularized > 0
          ? `${fmtNumber(dailyRegularized)} regularizaciones de hoy ayudan a contener nueva presión.`
          : "No hay regularizaciones suficientes todavía para cerrar el seguimiento.",
      ],
      links: [
        { href: "/planeacion-compra", label: "Abrir Planeación" },
        { href: "/historico-catastro", label: "Ver Histórico" },
        { href: "/excepciones", label: "Ver Excepciones" },
      ],
    };
  }

  return {
    title: "Mantener monitoreo ejecutivo",
    tone: "green",
    headline: "El sistema está más estable que reactivo; la recomendación del día es vigilar cambios extraordinarios, no forzar acción nueva.",
    rationale: `No domina una presión crítica única: las regularizaciones visibles (${fmtNumber(dailyRegularized)}) compensan buena parte de las señales nuevas (${fmtNumber(dailyWorsened)}).`,
    confidence: "Media",
    reasons: [
      `${fmtNumber(criticalAlerts)} alertas críticas visibles no cambian el eje del día por sí solas.`,
      `${fmtNumber(dailyRegularized)} regularizaciones ayudan a estabilizar el corte actual.`,
      "No aparece una presión de compra o conciliación dominante que obligue una decisión más agresiva hoy.",
    ],
    links: [
      { href: "/excepciones", label: "Abrir Excepciones" },
      { href: "/historico-catastro", label: "Ver Histórico" },
      { href: "/operacion", label: "Monitorear Operación" },
    ],
  };
}

function buildExecutiveBrief(
  dashboard: DashboardResponse,
  pulse: DailyPulse | null,
  decision: DecisionRecommendation,
): ExecutiveBrief {
  const criticalAlerts = numeric(dashboard.overview?.alertas_criticas);
  const inconsistencies = numeric(dashboard.overview?.inconsistencias_mtr_jira);
  const withoutOwner = numeric(dashboard.overview?.sin_asignacion);
  const renewalPressure = numeric(dashboard.planning?.resumen?.renovar_mart) + numeric(dashboard.planning?.resumen?.renovar_politica);
  const statusLine =
    criticalAlerts > 0 || inconsistencies > 0
      ? "Runtime exigido"
      : pulse && pulse.regularizedCount > pulse.worsenedCount
        ? "Runtime estabilizándose"
        : "Runtime bajo monitoreo";

  const highlights = [
    {
      label: "Decisión",
      value: decision.title,
      detail: `Confianza ${decision.confidence}`,
    },
    {
      label: "Riesgo dominante",
      value:
        criticalAlerts > 0
          ? `${fmtNumber(criticalAlerts)} alertas críticas`
          : inconsistencies > 0
            ? `${fmtNumber(inconsistencies)} brechas MTR/Jira`
            : renewalPressure > 0
              ? `${fmtNumber(renewalPressure)} renovaciones activas`
              : "Sin pico crítico único",
      detail:
        criticalAlerts > 0
          ? "La operación sigue cargada por alertas abiertas."
          : inconsistencies > 0
            ? "La conciliación sigue empujando parte del ruido."
            : renewalPressure > 0
              ? "Planeación y recambio mueven el corte."
              : "La lectura es más de vigilancia que de reacción.",
    },
    {
      label: "Cambio visible",
      value: pulse ? `${formatSignedDelta(pulse.auditDelta)} audit / ${formatSignedDelta(pulse.alertsDelta)} alertas` : "Sin delta visible",
      detail: pulse
        ? `${fmtNumber(pulse.regularizedCount)} regularizaciones vs ${fmtNumber(pulse.worsenedCount)} señales que empeoran.`
        : "No hubo suficiente señal diaria para comparar hoy contra ayer.",
    },
    {
      label: "Próximo cuello",
      value:
        withoutOwner > 0
          ? `${fmtNumber(withoutOwner)} sin asignación`
          : renewalPressure > 0
            ? `${fmtNumber(renewalPressure)} por renovar`
            : "Backlog contenido",
      detail:
        withoutOwner > 0
          ? "Ownership y reasignación siguen abiertos."
          : renewalPressure > 0
            ? "Recambio pendiente todavía visible."
            : "No aparece un cuello único más fuerte que el resto.",
    },
  ];

  const nextFocus: string[] = [];
  if (criticalAlerts > 0) {
    nextFocus.push(`Reducir ${fmtNumber(criticalAlerts)} alertas críticas abiertas desde Operación.`);
  }
  if (inconsistencies > 0) {
    nextFocus.push(`Cerrar ${fmtNumber(inconsistencies)} cruces MTR/Jira inconsistentes en Excepciones.`);
  }
  if (withoutOwner > 0) {
    nextFocus.push(`Asignar dueño operativo a ${fmtNumber(withoutOwner)} equipos sin owner visible.`);
  }
  if (renewalPressure > 0) {
    nextFocus.push(`Alinear ${fmtNumber(renewalPressure)} renovaciones activas con Planeación.`);
  }
  if (pulse && pulse.worsenedCount > pulse.regularizedCount) {
    nextFocus.push(`Monitorear si la señal diaria vuelve a empeorar en el próximo corte.`);
  }
  if (!nextFocus.length) {
    nextFocus.push("Mantener monitoreo ejecutivo y validar si aparece un foco dominante nuevo.");
  }

  return {
    statusLine,
    headline: decision.headline,
    summary: decision.rationale,
    highlights,
    nextFocus: nextFocus.slice(0, 4),
  };
}

function hasMeaningfulDashboardData(payload?: DashboardResponse | null) {
  return Boolean(
    payload?.overview ||
      payload?.operations ||
      payload?.planning ||
      payload?.integrations
  );
}

function sortCountRows(rows: CountRow[]) {
  return [...rows].sort((a, b) => numeric(b.equipos) - numeric(a.equipos));
}

function aggregateCountRows(values: Array<string | null | undefined>, key: "grupo" | "cliente"): CountRow[] {
  const map = new Map<string, number>();

  values.forEach((value) => {
    const label = String(value ?? "").trim() || "Sin dato";
    map.set(label, (map.get(label) ?? 0) + 1);
  });

  return sortCountRows(
    Array.from(map.entries()).map(([label, equipos]) =>
      key === "cliente" ? { cliente: label, equipos } : { grupo: label, equipos }
    )
  );
}

function inferPlatform(item: FallbackEquipo) {
  const raw = `${item.marca ?? ""} ${item.modelo ?? ""}`.toLowerCase();
  if (raw.includes("apple") || raw.includes("mac")) return "Mac";
  if (raw.includes("windows") || raw.includes("dell") || raw.includes("hp")) return "Windows";
  return "Otro";
}

function priorityRank(value?: number | null) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
}

function quantitySum(items?: FallbackPlanningFamily[] | null) {
  return (items ?? []).reduce((sum, item) => sum + numeric(item.cantidad), 0);
}

function buildBoardSummary(items: FallbackEquipo[]) {
  const relevant = items.filter((item) => numeric(item.jira_open_count) > 0);
  const map = new Map<string, number>();

  relevant.forEach((item) => {
    const bucket = String(item.jira_board_bucket ?? "SIN_BUCKET").trim() || "SIN_BUCKET";
    map.set(bucket, (map.get(bucket) ?? 0) + numeric(item.jira_open_count));
  });

  return Array.from(map.entries())
    .map(([bucket, issues]) => ({ bucket, issues }))
    .sort((a, b) => numeric(b.issues) - numeric(a.issues));
}

function buildBoardCards(summary: Array<{ bucket?: string | null; issues?: number | null }>): BoardCard[] {
  return summary.slice(0, 3).map((item) => {
    const bucket = item.bucket ?? "SIN_BUCKET";
    return {
      title: prettyJiraBucket(bucket),
      detail: "Equipos con issues visibles en este bucket del flujo actual.",
      metrics: [
        {
          label: "Issues",
          value: numeric(item.issues),
          href: `/activos?jira_bucket=${encodeURIComponent(bucket)}`,
        },
      ],
    };
  });
}

function buildFallbackOperations(
  equipos: FallbackEquipo[],
  homeActivos: FallbackHomeActivos | null,
  homeResumen: FallbackHomeResumen | null
): DashboardResponse["operations"] {
  const topClientes =
    (homeActivos?.top_clientes ?? []).map((item) => ({
      cliente: item.cliente ?? "Sin cliente",
      equipos: numeric(item.equipos),
    })) ?? [];

  const focos = [...equipos]
    .sort((a, b) => priorityRank(a.priority_final_rank) - priorityRank(b.priority_final_rank))
    .slice(0, 12)
    .map((item) => ({
      id_equipo: item.id_equipo,
      cliente: item.cliente ?? "SIN_CLIENTE",
      estado_operativo: item.estado ?? "SIN_ESTADO",
      priority_final_rank: item.priority_final_rank,
      alertas_resumen: item.alertas_resumen ?? "Sin alertas",
      jira_open_count: item.jira_open_count,
      last_event_date: null,
    }));

  return {
    top_clientes: topClientes,
    tipo_colaborador: aggregateCountRows(
      equipos.map((item) => item.tipo_colaborador),
      "grupo"
    ),
    plataforma: aggregateCountRows(
      equipos.map((item) => inferPlatform(item)),
      "grupo"
    ),
    senales: {
      sin_asignacion: numeric(homeResumen?.sin_asignacion),
      en_baja: numeric(homeResumen?.bajas),
      prioridad_alta: equipos.filter((item) => priorityRank(item.priority_final_rank) <= 25).length,
      con_alerta_relevante: equipos.filter((item) => {
        const severity = String(item.severidad ?? "").toUpperCase();
        return (
          severity === "WARN" ||
          severity === "CRITICAL" ||
          numeric(item.jira_open_count) > 0 ||
          String(item.alertas_resumen ?? "").trim().toLowerCase() !== "sin alertas"
        );
      }).length,
    },
    focos_operativos: focos,
  };
}

function buildFallbackPlanning(planeacion: FallbackPlanningResponse | null): DashboardResponse["planning"] {
  if (!planeacion) return null;

  const bloques = planeacion.bloques ?? {};
  const resumen = planeacion.resumen ?? {};
  const obsoletos = planeacion.obsoletos_staffing_asignados ?? [];
  const excluidos = planeacion.excluidos_parque_operativo ?? [];
  const bolsa = Object.values(bloques)
    .flat()
    .sort((a, b) => priorityRank(a.priority_final_rank) - priorityRank(b.priority_final_rank))
    .slice(0, 12);

  const acciones = [
    {
      titulo: "Renovar / retirar",
      detalle: `${fmtNumber(resumen.retiro_renovacion)} equipos o casos marcados para salida o renovación.`,
    },
    {
      titulo: "Presión de compra / asignación",
      detalle: `${fmtNumber(numeric(resumen.compra_staffing) + numeric(resumen.asignacion_reasignacion))} casos piden cobertura operativa o reasignación.`,
    },
    {
      titulo: "Movimientos Core",
      detalle: `${fmtNumber(resumen.movimientos_core)} equipos elegibles para reutilización o movimiento interno.`,
    },
  ].filter((item) => !item.detalle.startsWith("0 "));

  return {
    resumen: {
      renovar_mart: numeric(resumen.retiro_renovacion),
      renovar_politica: quantitySum(obsoletos),
      salida_legacy: quantitySum(excluidos),
      presion_alta: numeric(resumen.compra_staffing) + numeric(resumen.asignacion_reasignacion),
      presion_media: numeric(resumen.movimientos_core),
      elegibles_dev: numeric(resumen.mantener),
    },
    modelos_criticos: [
      ...obsoletos.map((item) => ({
        modelo: item.modelo ?? "SIN_MODELO",
        accion: "Renovar / recambiar",
        equipos: numeric(item.cantidad),
      })),
      ...excluidos.map((item) => ({
        modelo: item.modelo ?? "SIN_MODELO",
        accion: "Excluir del parque",
        equipos: numeric(item.cantidad),
      })),
    ].slice(0, 12),
    acciones_sugeridas: acciones,
    bolsa_acciones: bolsa.map((item) => ({
      id_equipo: item.id_equipo,
      cliente: item.cliente ?? "SIN_CLIENTE",
      modelo: item.marca_modelo ?? "SIN_MODELO",
      accion: item.decision ?? "REVISAR",
      priority_final_rank: item.priority_final_rank,
      motivo: item.motivo ?? "Sin motivo",
    })),
  };
}

function buildFallbackIntegrations(
  syncHealth: FallbackSyncHealth | null,
  equipos: FallbackEquipo[],
  homeActivos: FallbackHomeActivos | null
): DashboardResponse["integrations"] {
  if (!syncHealth) return null;

  const syncRuns = syncHealth.sync_runs ?? {};
  const googleSheetsRun = syncRuns.google_sheets_mtr;
  const jiraRun = syncRuns.jira_issue_snapshot_backfill;
  const mlRows = numeric(syncHealth.ml?.latest_scores?.row_count);
  const jiraAvailable = String(jiraRun?.status ?? "").toUpperCase() === "SUCCESS";
  const boardSummary = buildBoardSummary(equipos);
  const jiraRows = equipos.filter((item) => numeric(item.jira_open_count) > 0);

  return {
    ultimas_syncs: syncRuns,
    degraded_mode_active: !jiraAvailable,
    health_cards: [
      {
        key: "google_sheets_mtr",
        title: "Google Sheets / MTR",
        status: String(googleSheetsRun?.status ?? "").toUpperCase() === "SUCCESS" ? "SUCCESS" : "ERROR",
        headline: googleSheetsRun?.error ?? "Fuente primaria operativa para el parque actual.",
        latest_attempt_at: googleSheetsRun?.started_at,
        latest_success_at: googleSheetsRun?.finished_at,
        rows_processed: googleSheetsRun?.rows_loaded,
        rows_basis: "sync_runs.google_sheets_mtr",
        source_active: "Google Sheets + mart",
        impact: "Sostiene la visibilidad operativa base del Home, Activos e Histórico.",
        suggested_action: "Mantener monitoreo normal.",
      },
      {
        key: "jira",
        title: "Jira / Equipamiento",
        status: jiraAvailable ? "SUCCESS" : "DEGRADED",
        headline: jiraAvailable
          ? "Snapshot Jira disponible para conciliación y workflow."
          : jiraRun?.error ?? "Jira no respondió en la última lectura visible.",
        latest_attempt_at: jiraRun?.started_at,
        latest_success_at: jiraRun?.finished_at,
        rows_processed: jiraRun?.rows_loaded,
        rows_basis: "sync_runs.jira_issue_snapshot_backfill",
        error_short: jiraAvailable ? null : jiraRun?.error ?? null,
        source_active: jiraAvailable ? "Jira snapshot" : "MTR / Google Sheets",
        impact: jiraAvailable
          ? "Permite ver issues abiertos, conciliación y buckets operativos."
          : "El Home sigue operativo, pero los bloques Jira quedan en modo degradado.",
        suggested_action: jiraAvailable ? "Sin acción inmediata." : "Revisar sync Jira si la degradación persiste.",
      },
      {
        key: "ml",
        title: "ML Scores",
        status: mlRows > 0 ? "SUCCESS" : "DEGRADED",
        headline:
          mlRows > 0
            ? "Hay scores vigentes para riesgo operativo."
            : "No hay scores vigentes en la mart visible hoy.",
        latest_attempt_at: syncHealth.ml?.latest_scores?.latest_scored_at,
        latest_success_at: syncHealth.ml?.latest_scores?.latest_scored_at,
        rows_processed: mlRows,
        rows_basis: "ml.latest_scores",
        source_active: mlRows > 0 ? "ML latest scores" : "Sin scores vigentes",
        impact: mlRows > 0
          ? "La priorización ML puede mostrarse en Home y ML v2."
          : "La UI sigue operativa, pero sin señal ML utilizable en Home.",
        suggested_action:
          mlRows > 0 ? "Sin acción inmediata." : "Esperar nueva corrida de scoring o revisar pipeline ML.",
      },
    ],
    jira: {
      available: jiraAvailable,
      message: jiraAvailable ? null : "Jira no está entregando snapshot operativo hoy.",
      equipos_con_issues: jiraRows.length,
      issues_abiertos: jiraRows.reduce((sum, item) => sum + numeric(item.jira_open_count), 0),
      max_dias_issue_abierto: Math.max(
        0,
        ...(homeActivos?.tabla ?? []).map((item) => numeric(item.jira_days_open_max))
      ),
      ultimo_evento_jira_at:
        jiraRun?.finished_at ??
        syncHealth.raw?.jira_issues?.latest_inserted_at ??
        null,
      board_summary: boardSummary,
      board_cards: buildBoardCards(boardSummary),
      top_equipos: [...jiraRows]
        .sort((a, b) => priorityRank(a.priority_final_rank) - priorityRank(b.priority_final_rank))
        .slice(0, 10)
        .map((item) => {
          const fallbackRow = (homeActivos?.tabla ?? []).find((row) => row.id_equipo === item.id_equipo);
          return {
            id_equipo: item.id_equipo,
            cliente: item.cliente ?? "SIN_CLIENTE",
            jira_open_count: item.jira_open_count,
            jira_days_open_max: fallbackRow?.jira_days_open_max ?? null,
            priority_final_rank: item.priority_final_rank,
          };
        }),
      reconciliation: homeActivos?.reconciliacion,
      top_inconsistencias: equipos
        .filter((item) => {
          const status = String(item.conciliacion_estado ?? "").toUpperCase();
          return status && status !== "CONCILIADO";
        })
        .sort((a, b) => priorityRank(a.priority_final_rank) - priorityRank(b.priority_final_rank))
        .slice(0, 10)
        .map((item) => ({
          id_equipo: item.id_equipo,
          cliente: item.cliente ?? "SIN_CLIENTE",
          conciliacion_estado: item.conciliacion_estado,
          jira_estado: item.jira_board_bucket ?? "—",
          mtr_estado: item.estado ?? "—",
        })),
    },
  };
}

async function buildDashboardFallback(origin: string): Promise<DashboardResponse | null> {
  const [homeResumen, homeActivos, equiposResponse, planeacion, syncHealth] = await Promise.all([
    safeApiProxyGet<FallbackHomeResumen>("/estadisticas/home-resumen-v3", origin),
    safeApiProxyGet<FallbackHomeActivos>("/estadisticas/home-activos", origin),
    safeApiProxyGet<FallbackEquiposResponse>("/estadisticas/equipos?limit=400", origin),
    safeApiProxyGet<FallbackPlanningResponse>("/estadisticas/planeacion-acciones?limit=200", origin),
    safeApiProxyGet<FallbackSyncHealth>("/api/sync/health/details", origin),
  ]);

  const equipos = equiposResponse?.items ?? [];
  const reconciliation = homeActivos?.reconciliacion;
  const jiraRows = equipos.filter((item) => numeric(item.jira_open_count) > 0);
  const criticalAlerts = equipos.filter((item) => String(item.severidad ?? "").toUpperCase() === "CRITICAL").length;
  const warningAlerts = equipos.filter((item) => String(item.severidad ?? "").toUpperCase() === "WARN").length;
  const mlRows = numeric(syncHealth?.ml?.latest_scores?.row_count);
  const martUpdatedAt = syncHealth?.analytics?.mart_equipos_estado_actual?.latest_loaded_at ?? null;

  if (!homeResumen && !homeActivos && !equipos.length && !planeacion && !syncHealth) {
    return null;
  }

  return {
    meta: {
      source: "fallback",
      notice:
        "El agregado central del Home no respondió a tiempo. Se cargó el tablero con endpoints operativos directos que sí están vivos hoy.",
    },
    overview: {
      activos_totales:
        homeResumen?.activos_totales ?? homeActivos?.resumen?.activos_totales ?? equiposResponse?.count,
      asignados: homeResumen?.asignados ?? homeActivos?.resumen?.asignados,
      disponibles: homeResumen?.disponibles ?? homeActivos?.resumen?.disponibles,
      bajas: homeResumen?.bajas ?? homeActivos?.resumen?.bajas,
      sin_asignacion: homeResumen?.sin_asignacion ?? homeActivos?.resumen?.sin_asignacion,
      riesgo_alto: homeResumen?.riesgo_alto,
      riesgo_medio: homeResumen?.riesgo_medio,
      riesgo_bajo: homeResumen?.riesgo_bajo,
      equipos_con_jira: jiraRows.length,
      equipos_con_ml: mlRows,
      alertas_criticas: criticalAlerts,
      alertas_warn: warningAlerts,
      mart_actualizado_at: martUpdatedAt,
      riesgo_ml_disponible: numeric(syncHealth?.ml?.latest_scores?.row_count) > 0,
      equipos_conciliados: reconciliation?.equipos_conciliados,
      inconsistencias_mtr_jira: reconciliation?.inconsistencias_mtr_jira,
      jira_sin_match_mtr: reconciliation?.jira_sin_match_mtr,
      mtr_sin_match_jira: reconciliation?.mtr_sin_match_jira,
      creados_jira_sin_ingreso_mtr: reconciliation?.creados_jira_sin_ingreso_mtr,
      reservas_jira_pendientes: reconciliation?.reservas_jira_pendientes,
      asignados_sin_respaldo_cruzado: reconciliation?.asignados_sin_respaldo_cruzado,
    },
    operations: buildFallbackOperations(equipos, homeActivos, homeResumen),
    planning: buildFallbackPlanning(planeacion),
    integrations: buildFallbackIntegrations(syncHealth, equipos, homeActivos),
    errors: {},
  };
}

async function getDashboard(origin: string): Promise<DashboardResponse> {
  try {
    const live = await apiProxyGet<DashboardResponse>("/home/dashboard", {
      origin,
      timeoutMs: 1800,
    });

    return {
      ...live,
      meta: {
        source: "dashboard",
        notice: undefined,
      },
    };
  } catch (error) {
    const fallback = await buildDashboardFallback(origin);
    if (fallback && hasMeaningfulDashboardData(fallback)) {
      return fallback;
    }

    return {
      errors: {
        root: error instanceof Error ? error.message : String(error ?? "fetch failed"),
      },
    };
  }
}

async function getDailyChangePulse(origin: string): Promise<DailyPulse | null> {
  const now = new Date();
  const todayIso = formatIsoInTimezone(now);
  const yesterdayIso = formatIsoInTimezone(addDays(now, -1));
  const currentMonthStart = monthStartIso(now);
  const previousMonthStart = previousMonthStartIso(now);

  const [
    auditTodaySummary,
    auditYesterdaySummary,
    auditTodayList,
    alertsTodaySummary,
    alertsYesterdaySummary,
    alertsTodayList,
    historicalPulse,
  ] = await Promise.all([
    safeApiProxyGet<AuditSummaryResponse>(`/auditoria/resumen?desde=${todayIso}&hasta=${todayIso}`, origin),
    safeApiProxyGet<AuditSummaryResponse>(`/auditoria/resumen?desde=${yesterdayIso}&hasta=${yesterdayIso}`, origin),
    safeApiProxyGet<AuditListResponse>(`/auditoria?desde=${todayIso}&hasta=${todayIso}&limit=12`, origin),
    safeApiProxyGet<OperacionSummaryResponse>(`/operacion/resumen?estado_alerta=ABIERTA&desde=${todayIso}&hasta=${todayIso}`, origin),
    safeApiProxyGet<OperacionSummaryResponse>(`/operacion/resumen?estado_alerta=ABIERTA&desde=${yesterdayIso}&hasta=${yesterdayIso}`, origin),
    safeApiProxyGet<OperacionAlertasResponse>(`/operacion/alertas?estado_alerta=ABIERTA&desde=${todayIso}&hasta=${todayIso}&limit=12`, origin),
    safeApiProxyGet<HistoricalPulseResponse>(`/estadisticas/catastro-historico?date_from=${previousMonthStart}&date_to=${todayIso}&top_n=3`, origin),
  ]);

  const auditRows = auditTodayList?.rows ?? [];
  const alertRows = alertsTodayList?.rows ?? [];
  const auditTodayCount = numeric(auditTodaySummary?.kpis?.total_cambios_auditados);
  const auditYesterdayCount = numeric(auditYesterdaySummary?.kpis?.total_cambios_auditados);
  const alertsTodayCount = numeric(alertsTodaySummary?.kpis?.total_alertas_abiertas);
  const alertsYesterdayCount = numeric(alertsYesterdaySummary?.kpis?.total_alertas_abiertas);
  const auditCriticalToday = numeric(auditTodaySummary?.kpis?.cambios_criticos);
  const alertCriticalToday =
    numeric(alertsTodaySummary?.kpis?.alertas_criticas) + numeric(alertsTodaySummary?.kpis?.alertas_altas);
  const regularizedCount = auditRows.filter(isRegularizedAudit).length;
  const worsenedCount = auditRows.filter(isWorsenedAudit).length + alertRows.filter(isWorsenedAlert).length;

  const monthlyRows = historicalPulse?.mensual ?? [];
  const previousMonth = monthlyRows[0];
  const currentMonth = monthlyRows[monthlyRows.length - 1];
  const hasMonthComparison =
    monthlyRows.length >= 2 &&
    previousMonth?.mes &&
    currentMonth?.mes &&
    previousMonth.mes !== currentMonth.mes;

  const pulseBase = {
    todayIso,
    yesterdayIso,
    auditTodayCount,
    auditDelta: auditTodayCount - auditYesterdayCount,
    alertsTodayCount,
    alertsDelta: alertsTodayCount - alertsYesterdayCount,
    regularizedCount,
    worsenedCount,
    auditCriticalToday,
    alertCriticalToday,
    latestVisibleAt:
      auditTodaySummary?.kpis?.ultimo_cambio_global ??
      alertsTodaySummary?.kpis?.ultima_alerta_detectada ??
      null,
    monthComparisonLabel: hasMonthComparison ? monthNameFromIso(previousMonth?.mes) : "el corte previo",
    monthMovementsDelta: hasMonthComparison
      ? numeric(currentMonth?.movimientos_total) - numeric(previousMonth?.movimientos_total)
      : null,
    monthPressureDelta: hasMonthComparison
      ? numeric(currentMonth?.presion_compra) - numeric(previousMonth?.presion_compra)
      : null,
    monthBalanceDelta: hasMonthComparison
      ? numeric(currentMonth?.balance_neto) - numeric(previousMonth?.balance_neto)
      : null,
  };

  const latestEvents: DailyPulseEvent[] = [
    ...auditRows.map((row) => ({
      key: `audit-${row.audit_id}`,
      kind: "Auditoría" as const,
      id_equipo: row.id_equipo,
      source: row.origen ?? "Auditoría",
      summary: `${row.tipo_cambio ?? "Cambio"} · ${row.campo_modificado ?? "campo"} · ${row.valor_nuevo ?? "sin valor nuevo"}`,
      when: row.fecha_cambio ?? "",
      href: `/auditoria?q=${encodeURIComponent(row.id_equipo)}`,
    })),
    ...alertRows.map((row) => ({
      key: `alert-${row.alert_id}`,
      kind: "Alerta" as const,
      id_equipo: row.id_equipo,
      source: row.origen ?? "Operación",
      summary: row.titulo ?? row.tipo_alerta ?? row.descripcion ?? "Nueva alerta visible",
      when: row.fecha_detectada ?? "",
      href: `/operacion?q=${encodeURIComponent(row.id_equipo)}`,
    })),
  ]
    .sort((a, b) => String(b.when).localeCompare(String(a.when)))
    .slice(0, 8);

  if (
    !auditTodaySummary &&
    !auditYesterdaySummary &&
    !alertsTodaySummary &&
    !alertsYesterdaySummary &&
    !historicalPulse
  ) {
    return null;
  }

  return {
    ...pulseBase,
    narratives: buildDailyNarratives(pulseBase),
    latestEvents,
  };
}

function fmtNumber(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const integer = Math.trunc(Math.abs(n)).toString();
  return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function fmtPercent(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

function fmtHoursCompact(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 h";
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} h`;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtFreshnessHours(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "<1 h";
  if (n < 24) return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} h`;
  const days = n / 24;
  return `${days % 1 === 0 ? days.toFixed(0) : days.toFixed(1)} d`;
}

function normalizeIntegrationStatus(status?: string | null): "SUCCESS" | "DEGRADED" | "ERROR" {
  const upper = String(status ?? "").toUpperCase();
  if (upper === "SUCCESS") return "SUCCESS";
  if (upper === "DEGRADED") return "DEGRADED";
  return "ERROR";
}

function buildRefreshObservability(syncHealth: FallbackSyncHealth | null): RefreshObservability | null {
  if (!syncHealth) return null;

  const googleRun = syncHealth.sync_runs?.google_sheets_mtr;
  const jiraRun = syncHealth.sync_runs?.jira_issue_snapshot_backfill;
  const googleFreshness = optionalNumber(syncHealth.raw?.mtr_google_sheet_rows?.freshness_hours);
  const jiraFreshness = optionalNumber(syncHealth.raw?.jira_issues?.freshness_hours);
  const martFreshness = optionalNumber(syncHealth.analytics?.mart_equipos_estado_actual?.freshness_hours);
  const mlFreshness = optionalNumber(syncHealth.ml?.latest_scores?.freshness_hours);
  const mlRows = numeric(syncHealth.ml?.latest_scores?.row_count);

  const cards: RefreshObservabilityCard[] = [
    {
      key: "google_sheets_mtr",
      title: "Google Sheets / MTR",
      status:
        normalizeIntegrationStatus(googleRun?.status) === "ERROR"
          ? "ERROR"
          : googleFreshness != null && googleFreshness > 24
            ? "DEGRADED"
            : "SUCCESS",
      headline:
        normalizeIntegrationStatus(googleRun?.status) === "ERROR"
          ? googleRun?.error ?? "La sync de MTR falló en el último intento visible."
          : "Fuente primaria del parque actual y de la lectura base del runtime.",
      latest_success_at: googleRun?.finished_at ?? syncHealth.raw?.mtr_google_sheet_rows?.latest_inserted_at ?? null,
      freshness_hours: googleFreshness,
      rows_processed: googleRun?.rows_loaded ?? syncHealth.raw?.mtr_google_sheet_rows?.row_count ?? null,
      threshold_hours: 24,
      suggested_action:
        normalizeIntegrationStatus(googleRun?.status) === "ERROR"
          ? "Revisar la lectura de Google Sheets antes del siguiente corte."
          : "Mantener monitoreo normal del parque base.",
    },
    {
      key: "jira_snapshot",
      title: "Jira snapshot",
      status:
        normalizeIntegrationStatus(jiraRun?.status) === "ERROR"
          ? "ERROR"
          : jiraFreshness != null && jiraFreshness > 24
            ? "DEGRADED"
            : "SUCCESS",
      headline:
        normalizeIntegrationStatus(jiraRun?.status) === "ERROR"
          ? jiraRun?.error ?? "La sync Jira no cerró bien en el último intento visible."
          : "Soporta conciliación, workflow y lectura administrativa del board real.",
      latest_success_at: jiraRun?.finished_at ?? syncHealth.raw?.jira_issues?.latest_inserted_at ?? null,
      freshness_hours: jiraFreshness,
      rows_processed: jiraRun?.rows_loaded ?? syncHealth.raw?.jira_issues?.row_count ?? null,
      threshold_hours: 24,
      suggested_action:
        normalizeIntegrationStatus(jiraRun?.status) === "ERROR"
          ? "Revisar Jira o reintentar el backfill si la degradación persiste."
          : "Mantener monitoreo normal del board Jira real.",
    },
    {
      key: "mart_operativa",
      title: "Mart operativa",
      status:
        martFreshness != null && martFreshness <= 24
          ? "SUCCESS"
          : syncHealth.analytics?.mart_equipos_estado_actual?.row_count
            ? "DEGRADED"
            : "ERROR",
      headline:
        syncHealth.analytics?.mart_equipos_estado_actual?.row_count
          ? "Capa consolidada que alimenta Home, Activos y varias vistas ejecutivas."
          : "La mart operativa no dejó filas visibles en el último corte.",
      latest_success_at: syncHealth.analytics?.mart_equipos_estado_actual?.latest_loaded_at ?? null,
      freshness_hours: martFreshness,
      rows_processed: syncHealth.analytics?.mart_equipos_estado_actual?.row_count ?? null,
      threshold_hours: 24,
      suggested_action:
        syncHealth.analytics?.mart_equipos_estado_actual?.row_count
          ? "Validar solo si la mart queda vieja respecto del refresh del día."
          : "Revisar el tramo dbt o la disponibilidad de analytics.mart_equipos_estado_actual.",
    },
    {
      key: "ml_scores",
      title: "ML scores",
      status:
        mlRows <= 0
          ? "DEGRADED"
          : mlFreshness != null && mlFreshness > 72
            ? "DEGRADED"
            : "SUCCESS",
      headline:
        mlRows > 0
          ? "Prioriza riesgo operativo y explain views cuando hay scoring vigente."
          : "No hay scores vigentes para el corte actual, pero el refresh operativo principal sí puede seguir sano.",
      latest_success_at: syncHealth.ml?.latest_scores?.latest_scored_at ?? null,
      freshness_hours: mlFreshness,
      rows_processed: syncHealth.ml?.latest_scores?.row_count ?? null,
      threshold_hours: 72,
      suggested_action:
        mlRows > 0
          ? "Sin acción inmediata mientras el scoring se mantenga vigente."
          : "Revisar pipeline de scoring si ML debe entrar en la lectura del día.",
    },
  ];

  const hardRefreshKeys = new Set(["google_sheets_mtr", "jira_snapshot", "mart_operativa"]);
  const failingSources = cards.filter((card) => hardRefreshKeys.has(card.key) && card.status === "ERROR").length;
  const staleSources = cards.filter((card) => card.status === "DEGRADED").length;
  const overallStatus = failingSources > 0 ? "ERROR" : staleSources > 0 ? "DEGRADED" : "SUCCESS";
  const latestSuccessAt = cards
    .map((card) => card.latest_success_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    cards,
    overall_status: overallStatus,
    stale_sources: staleSources,
    failing_sources: failingSources,
    latest_success_at: latestSuccessAt,
    headline:
      overallStatus === "SUCCESS"
        ? "Todas las capas críticas del refresh siguen vigentes para el corte actual."
        : overallStatus === "DEGRADED"
          ? "Hay capas activas, pero una o más fuentes ya quedaron viejas para operar con confianza plena."
          : "Una o más etapas del refresh fallaron o no dejaron datos vigentes en la capa visible.",
    detail:
      overallStatus === "SUCCESS"
        ? "Puedes leer el Home y los módulos fuente sin alerta de frescura inmediata."
        : overallStatus === "DEGRADED"
          ? "Catastro sigue operativo, pero la lectura ejecutiva debe considerar señales stale antes de decidir."
          : "La actualización necesita revisión: hay fuentes sin refresh utilizable o con error visible.",
  };
}

function fmtDateTime(value?: string | null) {
  if (!value) return "Sin dato";
  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/,
  );
  if (!match) return value;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

function trackingBadge(status?: string | null) {
  const key = String(status ?? "PENDIENTE").toUpperCase();
  if (key === "EN_REVISION") return getStatusClassName("observacion");
  if (key === "RESUELTO") return getStatusClassName("confirmada");
  if (key === "ESCALADO") return getStatusClassName("critica");
  if (key === "DESCARTADO") return getStatusClassName("neutral");
  return getStatusClassName("sin asignacion");
}

function fmtIsoDate(value?: string | null) {
  if (!value) return "Sin dato";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function SectionShell({
  title,
  subtitle,
  error,
  children,
}: {
  title: string;
  subtitle: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="catastro-panel mt-6 rounded-3xl p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--cat-text)]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cat-text-muted)]">{subtitle}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-sm text-amber-950">
          No se pudo cargar este bloque con datos reales.
          <div className="mt-2 text-amber-900/80">{error}</div>
        </div>
      ) : (
        children
      )}
    </section>
  );
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

function LinkedKpiCard({
  href,
  title,
  value,
  subtitle,
}: {
  href: string;
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      <KpiCard title={title} value={value} subtitle={subtitle} />
    </Link>
  );
}

function BarList({
  items,
  labelKey,
}: {
  items: CountRow[];
  labelKey: "grupo" | "cliente";
}) {
  const rowClassName = "mb-1 flex items-center justify-between gap-3 text-sm";
  const trackClassName = "h-2 rounded-full bg-[rgba(24,76,255,0.10)]";
  const fillClassName = "h-2 rounded-full";

  const normalizedItems = items.map((item, index) => {
    const rawLabel = item[labelKey];
    const rawValue = Number(item.equipos ?? 0);
    const label = rawLabel ? String(rawLabel) : "Sin dato";
    const value = Number.isFinite(rawValue) ? rawValue : 0;

    return {
      key: `${labelKey}-${label}-${value}-${index}`,
      label,
      value,
    };
  });

  const max = Math.max(...normalizedItems.map((item) => item.value), 1);

  function toneFor(label: string) {
    const normalized = label.toLowerCase();
    if (labelKey === "cliente") {
      return "linear-gradient(90deg, rgba(0,198,255,0.88), rgba(66,117,255,0.92))";
    }
    if (normalized.includes("staff")) {
      return "linear-gradient(90deg, rgba(0,198,255,0.88), rgba(88,213,255,0.92))";
    }
    if (normalized.includes("core")) {
      return "linear-gradient(90deg, rgba(168,85,247,0.88), rgba(115,104,255,0.92))";
    }
    if (normalized.includes("mac")) {
      return "linear-gradient(90deg, rgba(0,229,153,0.88), rgba(0,198,255,0.9))";
    }
    if (normalized.includes("win")) {
      return "linear-gradient(90deg, rgba(66,117,255,0.9), rgba(168,85,247,0.88))";
    }
    return "linear-gradient(90deg, rgba(120,138,175,0.7), rgba(90,112,152,0.82))";
  }

  return (
    <div className="space-y-3">
      {normalizedItems.map((item) => {
        const { key, label, value } = item;
        const width = `${Math.max(8, (value / max) * 100)}%`;

        return (
          <div key={key}>
            <div className={rowClassName}>
              <span className="font-medium text-[var(--cat-text)]">{label}</span>
              <span className="font-medium text-[var(--cat-text-muted)]">{fmtNumber(value)}</span>
            </div>
            <div className={trackClassName}>
              <div
                className={fillClassName}
                style={{
                  width,
                  background: toneFor(label),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function HomePage() {
  const uiUpdatedAtLabel = getUiVisualUpdatedAtLabel();
  const origin = await getRequestOrigin();
  const [dashboard, dailyPulse, executionQueue, syncHealth] = await Promise.all([
    getDashboard(origin),
    getDailyChangePulse(origin),
    safeApiProxyGet<ExecutionQueueResponse>("/ejecucion/queue?limit=8", origin),
    safeApiProxyGet<FallbackSyncHealth>("/api/sync/health/details", origin),
  ]);
  const rootError = dashboard.errors?.root;
  const rootNotice = dashboard.meta?.notice;

  const overview = dashboard.overview;
  const operations = dashboard.operations;
  const planning = dashboard.planning;
  const integrations = dashboard.integrations;

  const riesgoDisponible = Boolean(overview?.riesgo_ml_disponible);
  const syncs = integrations?.ultimas_syncs ?? {};
  const jiraAvailable = Boolean(integrations?.jira?.available);
  const jiraMessage = integrations?.jira?.message ?? "Jira no disponible";
  const jiraBoardCards = integrations?.jira?.board_cards ?? [];
  const jiraBoardSummary = integrations?.jira?.board_summary ?? [];
  const integrationHealth = integrations?.health_cards ?? [];
  const jiraHealth = integrationHealth.find((item) => item.key === "jira");
  const degradedModeActive = Boolean(integrations?.degraded_mode_active);
  const operationalReconciliationPct = reconciliationRate(overview ?? undefined);
  const homeContractSource =
    dashboard.meta?.source === "fallback"
      ? "Endpoints operativos directos MTR / Activos / Planeación"
      : "Agregado central + mart operativa";
  const homeContractMode = degradedModeActive
    ? "Degradado por Jira"
    : dashboard.meta?.source === "fallback"
      ? "Resiliente directo"
      : "Centralizado";
  const homeContractNote =
    rootNotice ??
    (degradedModeActive
      ? "El tablero sigue operativo, pero los bloques dependientes de Jira quedan condicionados a la última sync visible."
      : "Esta vista sintetiza el estado diario del sistema y actúa como entrada ejecutiva para Activos, Operación, Planeación e Integraciones.");
  const changeReasons = buildChangeReasons(dashboard, dailyPulse);
  const decisionRecommendation = buildDecisionRecommendation(dashboard, dailyPulse);
  const executiveBrief = buildExecutiveBrief(dashboard, dailyPulse, decisionRecommendation);
  const executionKpis = executionQueue?.kpis ?? {};
  const executionRows = executionQueue?.rows ?? [];
  const refreshObservability = buildRefreshObservability(syncHealth);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[72rem]">
              <span className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Catastro Operations Grid
              </span>
              <h1 className="catastro-hero-title mt-4 max-w-4xl text-[var(--cat-card-text)]">
                Catastro
              </h1>
              <p className="catastro-hero-subtitle mt-3 max-w-[68rem]">
                Estado operativo real del parque TI, presión de stock, movimientos MTR y señales críticas del ecosistema operativo.
              </p>
            </div>

            <div className="grid gap-2 text-xs text-[var(--cat-card-muted)] sm:grid-cols-2 lg:pb-1 xl:w-[24rem]">
              <div className="catastro-inset rounded-2xl px-4 py-3">
                <div className="catastro-kpi-label">Mart actualizada</div>
                <div className="mt-2 text-sm text-[var(--cat-text)]">{fmtDateTime(overview?.mart_actualizado_at)}</div>
              </div>
              <div className="catastro-inset rounded-2xl px-4 py-3">
                <div className="catastro-kpi-label">Actualización visual</div>
                <div className="mt-2 text-sm text-[var(--cat-text)]">{uiUpdatedAtLabel}</div>
              </div>
              <Link href="/resumen-ejecutivo" className="catastro-inset rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 sm:col-span-2">
                <div className="catastro-kpi-label">Salida ejecutiva</div>
                <div className="mt-2 text-sm font-semibold text-[var(--cat-text)]">Abrir resumen exportable</div>
              </Link>
            </div>
          </div>
        </section>

        {rootError ? (
          <section className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-sm text-amber-950">
            El Home no pudo cargar su resumen centralizado.
            <div className="mt-2 text-amber-900/80">{rootError}</div>
          </section>
        ) : rootNotice ? (
          <section className="mt-6 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-4 text-sm text-[var(--cat-text)]">
            {rootNotice}
          </section>
        ) : null}

        <ModuleContract
          title="Cómo leer el Command Center"
          description="Este módulo resume el estado operativo vigente sin reemplazar las vistas fuente. Aquí importa más la lectura consolidada que el detalle fila a fila."
          items={[
            {
              label: "Fuente dominante",
              value: homeContractSource,
              hint: degradedModeActive
                ? "Cuando Jira no está vigente, MTR / Google Sheets sostienen la lectura principal."
                : "La mart central reúne parque, conciliación, planeación y señal de integraciones.",
              tone: degradedModeActive ? "amber" : "cyan",
            },
            {
              label: "Cobertura",
              value: "Parque visible + conciliación MTR/Jira + planeación + syncs",
              hint: "No sustituye el board Jira real ni el detalle técnico por módulo; los sintetiza.",
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: homeContractMode,
              hint:
                dashboard.meta?.source === "fallback"
                  ? "El agregado central no respondió y la vista se recompuso con endpoints operativos vivos."
                  : "Lectura ejecutiva de entrada para priorizar qué módulo abrir después.",
              tone: degradedModeActive ? "amber" : "green",
            },
            {
              label: "Condición Jira",
              value: degradedModeActive ? "Degradado" : "Vigente",
              hint: degradedModeActive
                ? "La conciliación y los buckets Jira dependen de la última sync visible."
                : "El board real y la conciliación están entrando al resumen central.",
              tone: degradedModeActive ? "amber" : "cyan",
            },
          ]}
          badges={[
            { label: `UI ${uiUpdatedAtLabel}`, tone: "cyan" },
            { label: degradedModeActive ? "Jira degradado" : "Jira vigente", tone: degradedModeActive ? "amber" : "green" },
            { label: dashboard.meta?.source === "fallback" ? "Fuente resiliente" : "Fuente central", tone: dashboard.meta?.source === "fallback" ? "amber" : "purple" },
          ]}
          note={homeContractNote}
        />

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Activos totales" value={fmtNumber(overview?.activos_totales)} subtitle="Parque visible hoy" tone="cyan" />
          <KpiCard title="Asignados" value={fmtNumber(overview?.asignados)} subtitle="Con dueño operativo actual" tone="green" />
          <KpiCard title="Disponibles / Stand-by" value={fmtNumber(overview?.disponibles)} subtitle="Base disponible para operación" tone="yellow" />
          <KpiCard title="Bajas" value={fmtNumber(overview?.bajas)} subtitle="Fuera del parque operativo" tone="red" />
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Sin asignación" value={fmtNumber(overview?.sin_asignacion)} subtitle="Casos sin dueño actual" tone="orange" />
          <KpiCard
            title={jiraAvailable ? "Jira abiertos" : "Jira"}
            value={jiraAvailable ? fmtNumber(overview?.equipos_con_jira) : "No disp."}
            subtitle={jiraAvailable ? "Equipos con issues asociados" : jiraMessage}
            tone="purple"
          />
          <KpiCard title="Alertas críticas" value={fmtNumber(overview?.alertas_criticas)} subtitle="Requieren atención inmediata" tone="red" />
          <KpiCard
            title={riesgoDisponible ? "Riesgo ML alto" : "Riesgo ML"}
            value={fmtNumber(riesgoDisponible ? overview?.riesgo_alto : overview?.equipos_con_ml)}
            subtitle={riesgoDisponible ? "Siembra de priorización actual" : "Aún sin scores útiles en la mart"}
            tone="purple"
          />
        </section>

        {dailyPulse ? (
          <SectionShell
            title="Cambios del día"
            subtitle={`Qué subió, qué bajó, qué se regularizó y qué empeoró entre ${fmtIsoDate(dailyPulse.yesterdayIso)} y ${fmtIsoDate(dailyPulse.todayIso)}. Este bloque también explica los motivos principales del cambio contra ${dailyPulse.monthComparisonLabel}.`}
          >
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Cambios auditados hoy"
                value={fmtNumber(dailyPulse.auditTodayCount)}
                subtitle={`${formatSignedDelta(dailyPulse.auditDelta)} vs ayer`}
                tone={dailyPulse.auditDelta > 0 ? "cyan" : dailyPulse.auditDelta < 0 ? "green" : "yellow"}
              />
              <KpiCard
                title="Alertas nuevas hoy"
                value={fmtNumber(dailyPulse.alertsTodayCount)}
                subtitle={`${formatSignedDelta(dailyPulse.alertsDelta)} vs ayer`}
                tone={dailyPulse.alertsDelta > 0 ? "red" : dailyPulse.alertsDelta < 0 ? "green" : "yellow"}
              />
              <KpiCard
                title="Regularizaciones visibles"
                value={fmtNumber(dailyPulse.regularizedCount)}
                subtitle="Conciliaciones o cierres trazados hoy"
                tone={dailyPulse.regularizedCount > 0 ? "green" : "yellow"}
              />
              <KpiCard
                title="Señales que empeoran"
                value={fmtNumber(dailyPulse.worsenedCount)}
                subtitle={`Audit crítica ${fmtNumber(dailyPulse.auditCriticalToday)} · Alertas altas/críticas ${fmtNumber(dailyPulse.alertCriticalToday)}`}
                tone={dailyPulse.worsenedCount > 0 ? "red" : "purple"}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {dailyPulse.narratives.map((item) => (
                  <div key={item.label} className="catastro-card-blue-soft rounded-2xl p-4">
                    <div className="catastro-kpi-label">{item.label}</div>
                    <div className="mt-3 text-lg font-semibold text-[var(--cat-card-text)]">{item.headline}</div>
                    <div className="mt-2 text-sm leading-7 text-[var(--cat-card-muted)]">{item.detail}</div>
                    <div className="mt-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${item.tone === "red"
                        ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                        : item.tone === "green"
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : item.tone === "cyan"
                            ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-200"
                            : item.tone === "purple"
                              ? "border-violet-400/35 bg-violet-500/10 text-violet-200"
                              : "border-amber-400/35 bg-amber-500/10 text-amber-200"}`}>
                        Lectura viva
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="catastro-panel-soft rounded-2xl p-5">
                  <div className="text-sm font-semibold text-[var(--cat-text)]">Deriva del mes en curso</div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="catastro-inset rounded-2xl p-4">
                      <div className="catastro-kpi-label">Movimientos vs {dailyPulse.monthComparisonLabel}</div>
                      <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">
                        {dailyPulse.monthMovementsDelta == null ? "—" : formatSignedDelta(dailyPulse.monthMovementsDelta)}
                      </div>
                    </div>
                    <div className="catastro-inset rounded-2xl p-4">
                      <div className="catastro-kpi-label">Balance neto</div>
                      <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">
                        {dailyPulse.monthBalanceDelta == null ? "—" : formatSignedDelta(dailyPulse.monthBalanceDelta)}
                      </div>
                    </div>
                    <div className="catastro-inset rounded-2xl p-4">
                      <div className="catastro-kpi-label">Presión MTR</div>
                      <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">
                        {dailyPulse.monthPressureDelta == null ? "—" : formatSignedDelta(dailyPulse.monthPressureDelta)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm leading-7 text-[var(--cat-text-muted)]">
                    Última señal visible del bloque: {fmtDateTime(dailyPulse.latestVisibleAt)}. La actividad diaria se compara contra ayer; la deriva mensual usa el mes anterior visible del histórico.
                  </div>
                </div>

                <div className="catastro-panel-soft rounded-2xl p-5">
                  <div className="text-sm font-semibold text-[var(--cat-text)]">Últimos cambios visibles hoy</div>
                  <div className="mt-4 space-y-3">
                    {dailyPulse.latestEvents.length ? dailyPulse.latestEvents.map((item) => (
                      <Link key={item.key} href={item.href} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="catastro-chip-blue rounded-full px-3 py-1 text-xs">{item.kind}</span>
                              <span className="text-sm font-semibold text-[var(--cat-text)]">{item.id_equipo}</span>
                            </div>
                            <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">{item.summary}</div>
                            <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">{item.source}</div>
                          </div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                            {fmtDateTime(item.when)}
                          </div>
                        </div>
                      </Link>
                    )) : (
                      <div className="catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
                        No hay eventos diarios visibles todavía para este corte.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 catastro-panel-soft rounded-2xl p-5">
              <div className="text-sm font-semibold text-[var(--cat-text)]">Motivos principales</div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {changeReasons.map((reason) => (
                  <div key={reason.key} className="catastro-inset rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="catastro-kpi-label">{reason.title}</div>
                        <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{reason.value}</div>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                          reason.tone === "red"
                            ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                            : reason.tone === "green"
                              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                              : reason.tone === "cyan"
                                ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-200"
                                : reason.tone === "purple"
                                  ? "border-violet-400/35 bg-violet-500/10 text-violet-200"
                                  : reason.tone === "orange"
                                    ? "border-orange-400/35 bg-orange-500/10 text-orange-200"
                                    : "border-amber-400/35 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        Razón activa
                      </span>
                    </div>
                    <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{reason.explanation}</div>
                    <div className="mt-4">
                      <Link href={reason.href} className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                        {reason.hrefLabel}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionShell>
        ) : null}

        <SectionShell
          title="Decisión del día"
          subtitle="Qué conviene hacer ahora, con lectura ejecutiva, confianza visible y foco operativo siguiente. Esta es la síntesis principal del Home."
        >
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="catastro-card-blue rounded-[28px] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="catastro-kpi-label">Estado general</div>
                  <div className="mt-3 text-sm uppercase tracking-[0.18em] text-[var(--cat-card-muted)]">
                    {executiveBrief.statusLine}
                  </div>
                  <h3 className="mt-3 text-[clamp(1.9rem,3.8vw,3.1rem)] font-semibold leading-[1.04] text-[var(--cat-card-text)]">
                    {decisionRecommendation.title}
                  </h3>
                  <div className="mt-3 text-lg leading-8 text-[var(--cat-card-text)]">
                    {executiveBrief.headline}
                  </div>
                  <div className="mt-4 rounded-2xl border border-[color:var(--cat-border)] bg-[rgba(9,14,26,0.7)] p-4 text-sm leading-7 text-[var(--cat-card-muted)]">
                    {executiveBrief.summary}
                  </div>
                </div>
                <div className="catastro-inset rounded-2xl px-5 py-4">
                  <div className="catastro-kpi-label">Confianza</div>
                  <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{decisionRecommendation.confidence}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                {executiveBrief.highlights.map((item) => (
                  <div key={item.label} className="catastro-inset rounded-2xl p-4">
                    <div className="catastro-kpi-label">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{item.value}</div>
                    <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">{item.detail}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {decisionRecommendation.links.map((link) => (
                  <Link key={link.href} href={link.href} className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="catastro-panel-soft rounded-2xl p-5">
                <div className="text-sm font-semibold text-[var(--cat-text)]">Por qué esta decisión</div>
                <div className="mt-4 space-y-3">
                  {decisionRecommendation.reasons.map((reason, index) => (
                    <div key={`${decisionRecommendation.title}-${index}`} className="catastro-inset rounded-2xl p-4 text-sm leading-7 text-[var(--cat-text-muted)]">
                      <span className="font-semibold text-[var(--cat-text)]">{index + 1}.</span> {reason}
                    </div>
                  ))}
                </div>
              </div>

              <div className="catastro-panel-soft rounded-2xl p-5">
                <div className="text-sm font-semibold text-[var(--cat-text)]">Próximos focos</div>
                <div className="mt-4 space-y-3">
                  {executiveBrief.nextFocus.map((item, index) => (
                    <div key={`${item}-${index}`} className="catastro-inset rounded-2xl p-4 text-sm leading-7 text-[var(--cat-text-muted)]">
                      <span className="font-semibold text-[var(--cat-text)]">{index + 1}.</span> {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="catastro-panel-soft rounded-2xl p-5">
                <div className="text-sm font-semibold text-[var(--cat-text)]">Entradas rápidas</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {decisionRecommendation.links.map((link) => (
                    <Link key={link.href} href={link.href} className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                      {link.label}
                    </Link>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="catastro-inset rounded-2xl p-4">
                    <div className="catastro-kpi-label">Base operativa</div>
                    <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">
                      Activos visibles, alertas críticas, bolsas cortas y conciliación MTR/Jira.
                    </div>
                  </div>
                  <div className="catastro-inset rounded-2xl p-4">
                    <div className="catastro-kpi-label">Horizonte</div>
                    <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">
                      Decisión del día con respaldo de deriva mensual e historia reciente del runtime.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        {executionQueue ? (
          <SectionShell
            title="Ejecución"
            subtitle="Seguimiento humano de la cola viva: quién tomó los casos, cuáles siguen pendientes y dónde conviene entrar para destrabarlos."
          >
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <LinkedKpiCard href="/ejecucion?estado=PENDIENTE" title="Pendientes" value={fmtNumber(executionKpis.pendientes)} subtitle="Sin toma formal todavía" />
              <LinkedKpiCard href="/ejecucion?estado=EN_REVISION" title="En revisión" value={fmtNumber(executionKpis.en_revision)} subtitle="Owner y seguimiento activos" />
              <LinkedKpiCard href="/ejecucion?estado=ESCALADO" title="Escalados" value={fmtNumber(executionKpis.escalados)} subtitle="Necesitan apoyo o destrabe" />
              <LinkedKpiCard href="/ejecucion" title="Sin owner real" value={fmtNumber(executionKpis.sin_owner_real)} subtitle="Todavía viven solo con owner sugerido" />
              <LinkedKpiCard href="/ejecucion?estado=RESUELTO" title="Resueltos hoy" value={fmtNumber(executionKpis.resueltos_hoy)} subtitle="Pasaron hoy a cierre manual" />
              <LinkedKpiCard href="/ejecucion?estado=RESUELTO" title="Validados por cruce" value={fmtNumber(executionKpis.validados_cruce)} subtitle="Ya desaparecieron de la fuente activa" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="catastro-panel-soft rounded-2xl p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--cat-text)]">Casos con seguimiento visible</div>
                    <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">
                      Vista corta de la mesa de ejecución para no perder ownership desde el Home.
                    </div>
                  </div>
                  <Link href="/ejecucion" className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                    Abrir Ejecución
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {executionRows.length ? executionRows.map((row) => (
                    <Link key={row.case_key} href={`/ejecucion?q=${encodeURIComponent(row.id_equipo)}`} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trackingBadge(row.estado_seguimiento)}`}>
                              {prettyOperationalStatus(row.estado_seguimiento ?? "PENDIENTE")}
                            </span>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(row.severity, { domain: "confianza" })}`}>
                              {row.severity}
                            </span>
                          </div>
                          <div className="mt-3 text-base font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                          <div className="mt-1 text-sm leading-7 text-[var(--cat-text-muted)]">{row.title}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                            {row.owner_display ?? "Sin owner real"} · {row.source}
                          </div>
                        </div>
                        <div className="text-right text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                          {fmtDateTime(row.tracking_updated_at)}
                        </div>
                      </div>
                    </Link>
                  )) : (
                    <div className="catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
                      La cola de ejecución todavía no trae casos visibles para este corte.
                    </div>
                  )}
                </div>
              </div>

              <div className="catastro-panel-soft rounded-2xl p-5">
                <div className="text-sm font-semibold text-[var(--cat-text)]">Lectura de gestión</div>
                <div className="mt-4 space-y-3">
                  <div className="catastro-inset rounded-2xl p-4 text-sm leading-7 text-[var(--cat-text-muted)]">
                    <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(executionKpis.total)}</span> casos activos viven hoy en la cola de ejecución.
                  </div>
                  <div className="catastro-inset rounded-2xl p-4 text-sm leading-7 text-[var(--cat-text-muted)]">
                    <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(executionKpis.pendientes)}</span> siguen sin toma formal y <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(executionKpis.sin_owner_real)}</span> aún dependen solo del owner sugerido.
                  </div>
                  <div className="catastro-inset rounded-2xl p-4 text-sm leading-7 text-[var(--cat-text-muted)]">
                    <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(executionKpis.en_revision)}</span> ya tienen seguimiento visible y <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(executionKpis.escalados)}</span> requieren apoyo o destrabe.
                  </div>
                  <div className="catastro-inset rounded-2xl p-4 text-sm leading-7 text-[var(--cat-text-muted)]">
                    <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(executionKpis.resueltos_hoy)}</span> quedaron resueltos hoy, <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(executionKpis.validados_cruce)}</span> ya están validados por cruce y el tiempo medio visible de resolución es <span className="font-semibold text-[var(--cat-text)]">{fmtHoursCompact(executionKpis.tiempo_medio_resolucion_horas)}</span>.
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/ejecucion?estado=PENDIENTE" className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                    Tomar pendientes
                  </Link>
                  <Link href="/ejecucion?estado=EN_REVISION" className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                    Ver seguimiento
                  </Link>
                  <Link href="/ejecucion?estado=ESCALADO" className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                    Resolver escalados
                  </Link>
                </div>
              </div>
            </div>
          </SectionShell>
        ) : null}

        {refreshObservability ? (
          <SectionShell
            title="Observabilidad del refresh"
            subtitle="Estado real de las capas que sostienen la actualización diaria: MTR, Jira, mart operativa y scoring ML."
          >
            {refreshObservability.overall_status !== "SUCCESS" ? (
              <div className={`mt-6 rounded-2xl border p-4 text-sm ${
                refreshObservability.overall_status === "ERROR"
                  ? "border-rose-400/40 bg-rose-100/75 text-rose-950"
                  : "border-amber-400/40 bg-amber-100/75 text-amber-950"
              }`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {refreshObservability.overall_status === "ERROR"
                        ? "Alerta automática de actualización"
                        : "Refresh vigente, pero con señales stale"}
                    </div>
                    <div className="mt-1">{refreshObservability.headline}</div>
                    <div className="mt-1 opacity-85">{refreshObservability.detail}</div>
                  </div>
                  <div className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold">
                    {refreshObservability.failing_sources > 0
                      ? `${fmtNumber(refreshObservability.failing_sources)} fuentes con error`
                      : `${fmtNumber(refreshObservability.stale_sources)} fuentes stale`}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Fuentes operativas"
                value={fmtNumber(refreshObservability.cards.filter((card) => card.status === "SUCCESS").length)}
                subtitle="Capas vigentes para el corte actual"
                tone="green"
              />
              <KpiCard
                title="Fuentes stale"
                value={fmtNumber(refreshObservability.stale_sources)}
                subtitle="Siguen arriba, pero ya perdieron frescura"
                tone="yellow"
              />
              <KpiCard
                title="Fuentes con error"
                value={fmtNumber(refreshObservability.failing_sources)}
                subtitle="Necesitan revisión o reintento"
                tone="red"
              />
              <KpiCard
                title="Último refresh visible"
                value={fmtDateTime(refreshObservability.latest_success_at)}
                subtitle="Marca más reciente entre las capas críticas"
                tone="cyan"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
              {refreshObservability.cards.map((card) => (
                <div key={card.key} className={`rounded-3xl border p-4 ${integrationHealthCardClasses(card.status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${integrationHealthDotClasses(card.status)}`} />
                        <div className="text-lg font-semibold text-[var(--cat-text)]">{card.title}</div>
                      </div>
                      <div className="mt-2 text-sm text-[var(--cat-text-muted)]">{card.headline}</div>
                    </div>
                    <span className={`cat-badge-compact inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${integrationHealthBadgeClasses(card.status)}`}>
                      {integrationHealthLabel(card.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="catastro-inset cat-mini-panel rounded-2xl">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">Última ejecución visible</div>
                      <div className="cat-technical-value mt-1 font-medium">{fmtDateTime(card.latest_success_at)}</div>
                    </div>
                    <div className="catastro-inset cat-mini-panel rounded-2xl">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">Frescura</div>
                      <div className="cat-technical-value mt-1 font-medium">
                        {card.freshness_hours == null ? "Sin dato" : `${fmtFreshnessHours(card.freshness_hours)} / SLA ${card.threshold_hours} h`}
                      </div>
                    </div>
                    <div className="catastro-inset cat-mini-panel rounded-2xl">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">Volumen visible</div>
                      <div className="cat-technical-value mt-1 font-medium">
                        {card.rows_processed == null ? "Sin dato" : fmtNumber(card.rows_processed)}
                      </div>
                    </div>
                    <div className="text-sm leading-6 text-[var(--cat-text-muted)]">{card.suggested_action}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionShell>
        ) : null}

        <SectionShell
          title="Salud operativa transversal"
          subtitle="Estado de conciliación y cierre administrativo entre parque visible, workflow Jira y lectura operativa consolidada."
        >
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Conciliados" value={fmtNumber(overview?.equipos_conciliados)} subtitle="MTR y Jira concordantes" tone="green" />
            <KpiCard title="Inconsistencias MTR/Jira" value={fmtNumber(overview?.inconsistencias_mtr_jira)} subtitle="Workflow vs operación" tone="orange" />
            <KpiCard
              title="Pendientes Jira"
              value={fmtNumber(integrations?.jira?.reconciliation?.reservas_jira_pendientes)}
              subtitle="Reservas sin cierre operativo"
              tone="yellow"
            />
            <KpiCard title="% conciliación operacional" value={fmtPercent(operationalReconciliationPct)} subtitle="Conciliados / (conciliados + diferencias + Jira sin MTR)" tone="cyan" />
          </div>
        </SectionShell>

        <SectionShell
          title="Operación"
          subtitle="Lectura rápida del parque por cliente, colaborador, plataforma y focos operativos."
          error={dashboard.errors?.operations}
        >
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="catastro-panel-soft rounded-2xl p-4">
              <div className="text-sm font-semibold text-[var(--cat-text)]">Top clientes</div>
              <div className="mt-4">
                <BarList items={operations?.top_clientes ?? []} labelKey="cliente" />
              </div>
            </div>

            <div className="catastro-panel-soft rounded-2xl p-4">
              <div className="text-sm font-semibold text-[var(--cat-text)]">Tipo de colaborador</div>
              <div className="mt-4">
                <BarList items={operations?.tipo_colaborador ?? []} labelKey="grupo" />
              </div>
            </div>

            <div className="catastro-panel-soft rounded-2xl p-4">
              <div className="text-sm font-semibold text-[var(--cat-text)]">Plataforma</div>
              <div className="mt-4">
                <BarList items={operations?.plataforma ?? []} labelKey="grupo" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Sin asignación" value={fmtNumber(operations?.senales?.sin_asignacion)} subtitle="Señal operativa relevante" tone="orange" />
            <KpiCard title="En baja" value={fmtNumber(operations?.senales?.en_baja)} subtitle="Estado operativo BAJA" tone="red" />
            <KpiCard title="Prioridad alta" value={fmtNumber(operations?.senales?.prioridad_alta)} subtitle="Rank final <= 25" tone="yellow" />
            <KpiCard title="Con alerta relevante" value={fmtNumber(operations?.senales?.con_alerta_relevante)} subtitle="Warn, critical o Jira" tone="purple" />
          </div>

          <div className="mt-6">
            <div className="mb-3 text-sm font-semibold text-[var(--cat-text)]">Focos operativos</div>
            <MiniTable
              headers={["Equipo", "Cliente", "Estado", "Prioridad", "Alertas", "Último evento"]}
              rows={(operations?.focos_operativos ?? []).map((item) => [
                item.id_equipo,
                item.cliente ?? "SIN_CLIENTE",
                item.estado_operativo ?? "SIN_ESTADO",
                fmtNumber(item.priority_final_rank),
                item.alertas_resumen ?? "Sin alertas",
                fmtIsoDate(item.last_event_date),
              ])}
            />
          </div>
        </SectionShell>

        <SectionShell
          title="Planeación"
          subtitle="Renovación por política, modelos legacy y acciones sugeridas sobre el parque actual."
          error={dashboard.errors?.planning}
        >
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Renovar por mart" value={fmtNumber(planning?.resumen?.renovar_mart)} subtitle="Flags activas del modelo" tone="yellow" />
            <KpiCard title="Renovar por política" value={fmtNumber(planning?.resumen?.renovar_politica)} subtitle="Reglas de renovación" tone="orange" />
            <KpiCard title="Salida de legacy" value={fmtNumber(planning?.resumen?.salida_legacy)} subtitle="Modelos marcados para salida" tone="red" />
            <KpiCard
              title="Presión de stock"
              value={fmtNumber((planning?.resumen?.presion_alta ?? 0) + (planning?.resumen?.presion_media ?? 0))}
              subtitle={`Alta: ${fmtNumber(planning?.resumen?.presion_alta)} · Media: ${fmtNumber(planning?.resumen?.presion_media)}`}
              tone="purple"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-semibold text-[var(--cat-text)]">Modelos críticos o legacy</div>
              <MiniTable
                headers={["Modelo", "Acción", "Equipos"]}
                rows={(planning?.modelos_criticos ?? []).map((item) => [
                  item.modelo ?? "SIN_MODELO",
                  item.accion ?? "REVISAR",
                  fmtNumber(item.equipos),
                ])}
              />
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-[var(--cat-text)]">Acciones sugeridas</div>
              <div className="space-y-3">
                {(planning?.acciones_sugeridas ?? []).map((item, index) => (
                  <div key={`${item.titulo}-${index}`} className="catastro-card-blue-soft rounded-2xl p-4">
                    <div className="font-semibold text-[var(--cat-card-text)]">{item.titulo}</div>
                    <div className="mt-1 text-sm text-[var(--cat-card-muted)]">{item.detalle}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-sm font-semibold text-[var(--cat-text)]">Bolsa corta de acciones</div>
            <MiniTable
              headers={["Equipo", "Cliente", "Modelo", "Acción", "Prioridad", "Motivo"]}
              rows={(planning?.bolsa_acciones ?? []).map((item) => [
                item.id_equipo,
                item.cliente ?? "SIN_CLIENTE",
                item.modelo ?? "SIN_MODELO",
                item.accion ?? "REVISAR",
                fmtNumber(item.priority_final_rank),
                item.motivo ?? "Sin motivo",
              ])}
            />
          </div>
        </SectionShell>

        <SectionShell
          title="Integraciones"
          subtitle="Salud de las syncs con MTR / Google Sheets y Jira, con última actividad visible."
          error={dashboard.errors?.integrations}
        >
          {degradedModeActive ? (
            <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-100/75 p-4 text-sm text-amber-950">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold">Modo degradado activo</div>
                  <div className="mt-1">
                    {jiraHealth?.headline ?? jiraMessage}. Catastro sigue operativo usando MTR / Google Sheets como fuente principal.
                  </div>
                </div>
                <div className="rounded-full border border-amber-300/70 bg-white/70 px-3 py-1 text-xs font-semibold text-amber-900">
                  Jira no actualizado
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {integrationHealth.map((card) => (
              <div
                key={card.key}
                className={`rounded-3xl border p-4 ${integrationHealthCardClasses(card.status)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${integrationHealthDotClasses(card.status)}`} />
                      <div className="text-lg font-semibold text-[var(--cat-text)]">{card.title ?? card.key}</div>
                    </div>
                    <div className="mt-2 text-sm text-[var(--cat-text-muted)]">
                      {card.headline ?? integrationHealthLabel(card.status)}
                    </div>
                  </div>
                  <span
                    className={`cat-badge-compact inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${integrationHealthBadgeClasses(card.status)}`}
                  >
                    {integrationHealthLabel(card.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[var(--cat-text)] md:grid-cols-2">
                  <div className="catastro-inset cat-mini-panel rounded-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">
                      Estado actual
                    </div>
                    <div className="cat-technical-value mt-1 font-medium">{integrationHealthLabel(card.status)}</div>
                  </div>
                  <div className="catastro-inset cat-mini-panel rounded-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">
                      Fuente activa
                    </div>
                    <div className="cat-technical-value mt-1 font-medium">{card.source_active ?? "Sin dato"}</div>
                  </div>
                  <div className="catastro-inset cat-mini-panel rounded-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">
                      Último intento
                    </div>
                    <div className="cat-technical-value mt-1 font-medium">{fmtDateTime(card.latest_attempt_at)}</div>
                  </div>
                  <div className="catastro-inset cat-mini-panel rounded-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">
                      Última ejecución exitosa
                    </div>
                    <div className="cat-technical-value mt-1 font-medium">{fmtDateTime(card.latest_success_at)}</div>
                  </div>
                  <div className="catastro-inset cat-mini-panel rounded-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">
                      Filas procesadas
                    </div>
                    <div className="cat-technical-value mt-1 font-medium">
                      {card.rows_processed == null ? "Sin actualización válida" : fmtNumber(card.rows_processed)}
                    </div>
                    {card.rows_basis ? (
                      <div className="cat-technical-value mt-1 text-xs text-[var(--cat-text-muted)]">Base: {card.rows_basis}</div>
                    ) : null}
                  </div>
                  <div className="catastro-inset cat-mini-panel rounded-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-muted)]">
                      Acción sugerida
                    </div>
                    <div className="cat-technical-value mt-1 font-medium">{card.suggested_action ?? "Sin acción inmediata."}</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <span className="font-semibold text-[var(--cat-text)]">Impacto:</span>{" "}
                    <span className="text-[var(--cat-text-muted)]">{card.impact ?? "Sin detalle"}</span>
                  </div>
                  {card.error_short ? (
                    <div>
                      <span className="font-semibold text-[var(--cat-text)]">Error corto:</span>{" "}
                      <span className="text-[var(--cat-text-muted)]">{card.error_short}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-3 text-sm font-semibold text-[var(--cat-text)]">
              {jiraAvailable ? "Resumen vivo del board Jira" : "Estado actual de Jira"}
            </div>
            {jiraAvailable ? (
              <>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {jiraBoardCards.map((card) => (
                    <div key={card.title} className="catastro-card-blue-soft rounded-2xl p-4">
                      <div className="text-sm font-semibold text-[var(--cat-card-text)]">{card.title}</div>
                      <div className="mt-1 text-sm text-[var(--cat-card-muted)]">{card.detail}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(card.metrics ?? []).map((metric) =>
                          metric.href ? (
                            <Link
                              key={metric.label}
                              href={metric.href}
                              className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5"
                            >
                              {metric.label}: {fmtNumber(metric.value)}
                            </Link>
                          ) : (
                            <div key={metric.label} className="catastro-chip-blue rounded-full px-3 py-2 text-xs">
                              {metric.label}: {fmtNumber(metric.value)}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {jiraBoardCards.length === 0 ? (
                  <div className="catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
                    Jira ya está conectado, pero todavía no hay buckets abiertos visibles para resumir en este bloque.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-amber-300/40 bg-amber-50/85 p-4 text-sm text-amber-950">
                <div className="font-semibold">{jiraHealth?.headline ?? jiraMessage}</div>
                <div className="mt-2 text-amber-900/80">
                  {jiraHealth?.impact ??
                    "La operación visible en Home queda basada en Google Sheets y en la mart actual."}
                </div>
                <div className="mt-2 text-amber-900/80">
                  Los componentes dependientes de Jira se muestran como no actualizados hasta que la sync vuelva a estar operativa.
                </div>
              </div>
            )}
          </div>
          {Object.keys(syncs).length === 0 ? (
            <div className="mt-6 catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
              No hay registros de sync visibles.
            </div>
          ) : null}

          {jiraAvailable ? (
            <div className="mt-6 catastro-panel-soft rounded-2xl p-5">
              <div className="text-sm font-semibold text-[var(--cat-text)]">Estado Jira</div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <LinkedKpiCard href="/activos?has_jira=1" title="Equipos con issues" value={fmtNumber(integrations?.jira?.equipos_con_issues)} subtitle="Relacionados en la mart" />
                <LinkedKpiCard href="/activos?has_jira=1" title="Issues abiertos" value={fmtNumber(integrations?.jira?.issues_abiertos)} subtitle="Suma sobre el parque" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <KpiCard title="Conciliados" value={fmtNumber(integrations?.jira?.reconciliation?.equipos_conciliados)} subtitle="Cruce correcto" tone="green" />
                <KpiCard title="Pendientes Jira" value={fmtNumber(integrations?.jira?.reconciliation?.reservas_jira_pendientes)} subtitle="Reservas sin cierre operativo" tone="yellow" />
                <KpiCard title="Asignados sin respaldo" value={fmtNumber(integrations?.jira?.reconciliation?.asignados_sin_respaldo_cruzado)} subtitle="Asignación sin cruce" tone="orange" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { label: "CONCILIADO", status: "CONCILIADO" },
                  { label: "JIRA_SIN_MATCH_MTR", status: "JIRA_SIN_MATCH_MTR" },
                  { label: "MTR_SIN_JIRA", status: "MTR_SIN_MATCH_JIRA" },
                  { label: "CREADO_JIRA_SIN_INGRESO_MTR", status: "CREADO_JIRA_SIN_INGRESO_MTR" },
                  { label: "INCONSISTENCIA_OPERATIVA", status: "INCONSISTENCIA_OPERATIVA" },
                ].map((item) => (
                  <span
                    key={item.label}
                    title={reconciliationHelp(item.status)}
                    className={`cat-badge-compact inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${reconciliationClasses(item.status)}`}
                  >
                    {prettyReconciliationStatus(item.status)}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-sm text-[var(--cat-text-muted)]">
                Último dato Jira visible: {fmtDateTime(integrations?.jira?.ultimo_evento_jira_at)}
              </div>
              <div className="mt-1 text-sm text-[var(--cat-text-muted)]">
                Máximo días abierto: {fmtNumber(integrations?.jira?.max_dias_issue_abierto)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {jiraBoardSummary.map((item) => (
                  <Link
                    key={`${item.bucket}-${item.issues}`}
                    href={`/activos?jira_bucket=${encodeURIComponent(item.bucket ?? "SIN_BUCKET")}`}
                    className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5"
                  >
                    {prettyJiraBucket(item.bucket ?? "SIN_BUCKET")}: {fmtNumber(item.issues)}
                  </Link>
                ))}
              </div>

              <div className="mt-4">
                <MiniTable
                  headers={["Equipo", "Cliente", "Issues", "Máx días", "Prioridad"]}
                  rows={(integrations?.jira?.top_equipos ?? []).map((item) => [
                    item.id_equipo,
                    item.cliente ?? "SIN_CLIENTE",
                    fmtNumber(item.jira_open_count),
                    fmtNumber(item.jira_days_open_max),
                    fmtNumber(item.priority_final_rank),
                  ])}
                />
              </div>

              {(integrations?.jira?.top_inconsistencias ?? []).length > 0 ? (
                <div className="mt-4">
                  <div className="mb-3 text-sm font-semibold text-[var(--cat-text)]">Top inconsistencias</div>
                  <MiniTable
                    headers={["Equipo", "Cliente", "Conciliación", "Jira", "MTR"]}
                    rows={(integrations?.jira?.top_inconsistencias ?? []).map((item) => [
                      item.id_equipo,
                      item.cliente ?? "SIN_CLIENTE",
                      prettyReconciliationStatus(item.conciliacion_estado),
                      item.jira_estado ?? "—",
                      item.mtr_estado ?? "—",
                    ])}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </SectionShell>
      </div>
    </main>
  );
}
