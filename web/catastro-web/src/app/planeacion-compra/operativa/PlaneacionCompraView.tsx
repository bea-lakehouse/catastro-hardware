import Link from "next/link";
import PlanningDrilldownSection, { type PlanningDrilldownRow } from "@/components/planeacion/PlanningDrilldownSection";
import { apiGet } from "@/lib/api";
import { getStatusClassName } from "@/lib/statusStyles";

type PlaneacionCompraViewMode = "executive" | "operativa";

type PlaneacionItem = {
  id_equipo: string;
  estado?: string | null;
  cliente?: string | null;
  persona?: string | null;
  marca_modelo?: string | null;
  tipo_colaborador?: string | null;
  alertas_resumen?: string | null;
  ml_score?: number | null;
  familia_modelo?: string | null;
  decision?: string | null;
  categoria?: string | null;
  motivo?: string | null;
  clasificacion_operacional?: string | null;
  decision_sugerida_operativa?: string | null;
  evidencia_fuente_operativa?: string | null;
  fuente_clasificacion_operativa?: string | null;
};

type ObsoletoStaffingRow = {
  modelo: string;
  cantidad: number;
  skus?: string[];
  personas?: string[];
  clientes?: string[];
  decision_sugerida?: string | null;
  evidencia_fuente?: string | null;
  clasificacion_operacional?: string | null;
  fuente_clasificacion_operativa?: string | null;
};

type PlaneacionResp = {
  resumen?: {
    retiro_renovacion?: number;
    compra_staffing?: number;
    movimientos_core?: number;
    asignacion_reasignacion?: number;
    mantener?: number;
    total?: number;
  };
  compras_por_familia?: {
    MAC?: number;
    HP?: number;
    OTRO?: number;
  };
  bloques?: {
    retiro_renovacion?: PlaneacionItem[];
    compra_staffing?: PlaneacionItem[];
    movimientos_core?: PlaneacionItem[];
    asignacion_reasignacion?: PlaneacionItem[];
    mantener?: PlaneacionItem[];
  };
  obsoletos_staffing_asignados?: ObsoletoStaffingRow[];
  obsoletos_staffing_activos_resumen?: {
    A2141?: number;
    DELL_LATITUDE_7400?: number;
  };
  excluidos_parque_operativo?: ObsoletoStaffingRow[];
};

type GapItem = {
  empresa: string;
  demanda_operativa_estimada: number;
  demanda_fuente: string;
  ventana_mtr_resumen: string;
  meses_considerados: number;
  colchon_operativo: number;
  oferta_inmediata: number;
  oferta_cercana: number;
  recuperables_ponderados: number;
  gap_bruto: number;
  gap_resultante: number;
  exceso_stock: number;
  pressure_score?: number;
  estrategia_recomendada: string;
  recomendacion: string;
  lectura: string;
};

type GapResp = {
  scope_label?: string;
  scope_note?: string;
  formula?: string;
  pressure_formula?: string;
  items?: GapItem[];
  supuestos?: string[];
};

type CompraExecutiveSummary = {
  es_proyeccion?: boolean;
  fuente_presion?: string | null;
  stock_heredado_confirmado?: number;
  stock_heredado_proyectado?: number;
  compras_nuevas_confirmadas_mes?: number;
  compras_nuevas_pendientes_mes?: number;
  total_confirmadas?: number;
  total_pendientes?: number;
  stock_confirmado?: number;
  stock_proyectado?: number;
  stock_disponible_confirmado?: number;
  stock_disponible_total?: number;
  empresas_con_compra?: number;
  proveedores_activos?: number;
  modelos_distintos?: number;
  demanda_presion_compra_mes?: number;
  balance_confirmado_vs_presion_mes?: number;
  balance_total_vs_presion_mes?: number;
  cobertura_confirmada_ratio?: number | null;
  cobertura_total_ratio?: number | null;
  lectura_preparacion?: string | null;
  mes_siguiente?: string | null;
};

type CompraCompanyRow = {
  empresa: string;
  confirmadas: number;
  pendientes: number;
  stock_confirmado: number;
  stock_proyectado: number;
  proveedores: number;
  modelos?: string | null;
};

type CompraProviderRow = {
  proveedor: string;
  confirmadas: number;
  pendientes: number;
  stock_confirmado: number;
  stock_proyectado: number;
  empresas?: string | null;
};

type CompraModelRow = {
  empresa: string;
  proveedor: string;
  marca: string;
  modelo: string;
  os_familia: string;
  confirmadas: number;
  pendientes: number;
  total: number;
};

type CompraDetailRow = {
  id_compra_manual: string;
  mes_referencia: string;
  fecha_compra?: string | null;
  empresa: string;
  proveedor: string;
  marca: string;
  modelo: string;
  os_familia: string;
  tipo_equipo: string;
  cantidad: number;
  estado_compra: string;
  tipo_stock: string;
  observaciones?: string | null;
};

type CompraMayPreview = {
  mes?: string;
  stock_confirmado_arrastre?: number;
  stock_proyectado_arrastre?: number;
  demanda_referencia?: number;
  balance_confirmado?: number;
  balance_total?: number;
  cobertura_confirmada_ratio?: number | null;
  cobertura_total_ratio?: number | null;
  lectura?: string | null;
};

type CompraMonthOption = {
  mes: string;
  label: string;
  es_proyeccion?: boolean;
};

type CompraExecutiveReading = {
  mes?: string;
  mes_label?: string;
  es_proyeccion?: boolean;
  scope?: string;
  scope_note?: string | null;
  presion_mes?: number;
  stock_heredado_confirmado?: number;
  stock_heredado_proyectado?: number;
  compras_confirmadas?: number;
  compras_pendientes?: number;
  stock_disponible_confirmado?: number;
  stock_disponible_total?: number;
  gap_confirmado?: number;
  gap_total?: number;
  cobertura_confirmada?: number | null;
  cobertura_total?: number | null;
  conclusion?: string | null;
  estado?: string | null;
};

type CompraDecisionRecommended = {
  title?: string;
  body?: string;
  tone?: "red" | "amber" | "green" | "sky" | "neutral";
  actions?: string[];
};

type CompraFormulaBreakdown = {
  presion_mensual?: number;
  stock_heredado_confirmado?: number;
  stock_heredado_proyectado?: number;
  compras_nuevas_confirmadas_mes?: number;
  compras_nuevas_pendientes_mes?: number;
  stock_confirmado?: number;
  stock_proyectado?: number;
  stock_disponible_confirmado?: number;
  stock_disponible_total?: number;
  gap_confirmado?: number;
  gap_proyectado?: number;
  cobertura_confirmada?: number | null;
  cobertura_proyectada?: number | null;
  fuente_presion?: string;
  presion_formula?: string;
  stock_heredado_formula?: string;
  stock_proyectado_heredado_formula?: string;
  stock_confirmado_formula?: string;
  stock_proyectado_formula?: string;
  stock_disponible_formula?: string;
  stock_disponible_total_formula?: string;
  gap_confirmado_formula?: string;
  gap_proyectado_formula?: string;
  gap_proyectado_note?: string;
  status_confirmado?: string;
  status_proyectado?: string;
};

type ProjectionRisk = {
  title?: string;
  summary?: string;
  items?: string[];
  gap_note?: string | null;
  renewal_note?: string | null;
};

type ScenarioRow = {
  name: string;
  stock: number;
  demanda: number;
  gap: number;
  decision: string;
  note?: string;
};

type ForecastScenarioRow = {
  name: string;
  demanda: number;
  gap_confirmado: number;
  gap_total: number;
  decision: string;
};

type ForecastSegmentRow = {
  segmento: string;
  presion_mes: number;
  presion_mes_anterior: number;
  presion_hace_2_meses: number;
  forecast_segmento: number;
};

type ForecastPayload = {
  mes?: string;
  mes_label?: string;
  subtitle?: string;
  metodo?: string;
  presion_mes?: number;
  presion_mes_anterior?: number;
  presion_hace_2_meses?: number;
  forecast_presion_base?: number;
  forecast_presion_bajo?: number;
  forecast_presion_alto?: number;
  stock_confirmado?: number;
  stock_total?: number;
  gap_base_confirmado?: number;
  gap_alto_confirmado?: number;
  gap_base_total?: number;
  gap_alto_total?: number;
  fuente_forecast?: string;
  insight_forecast?: string;
  risk_high_scenario?: string;
  pending_cover_note?: string | null;
  segment_insight?: string;
  scenarios?: ForecastScenarioRow[];
  segments?: ForecastSegmentRow[];
};

type ExecutiveAlert = {
  severity: "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  recommended_action: string;
  related_metric: string;
};

type CompraTrackingRow = {
  mes?: string;
  mes_compra?: string;
  id_compra: string;
  empresa: string;
  proveedor: string;
  modelo: string;
  cantidad: number;
  estado: "CONFIRMADA" | "PENDIENTE" | "RECIBIDA" | "CANCELADA" | string;
  tipo_stock: string;
  fecha_estimada_entrega?: string | null;
  fecha_ingreso_real?: string | null;
  accion_recomendada: string;
  cuenta_stock_real?: boolean;
  cuenta_stock_proyectado?: boolean;
  observacion?: string | null;
};

type CapexSummary = {
  capex_confirmado_label?: string;
  capex_confirmado?: number | null;
  capex_pendiente?: number | null;
  capex_pendiente_status?: string | null;
  capex_proyectado_label?: string;
  capex_proyectado?: number | null;
  forecast_unidades?: number | null;
  mix_unitario_referencial?: number | null;
  capex_renovacion_urgente?: number | null;
  capex_renovacion_urgente_status?: string | null;
  capex_total_estimado?: number | null;
  capex_total_status?: string | null;
  proveedor_mas_relevante?: string | null;
  empresa_mayor_presion?: string | null;
};

type CapexBreakdownRow = {
  empresa?: string;
  proveedor?: string;
  categoria?: string;
  capex_confirmado?: number | null;
  capex_pendiente?: number | null;
  capex_proyectado?: number | null;
  monto?: number | null;
  status?: string | null;
};

type CapexReferenceRow = {
  empresa: string;
  proveedor: string;
  modelo: string;
  cantidad: number;
  precio_unitario: number;
  monto_estimado: number;
  moneda: string;
  estado_compra: string;
  observacion?: string | null;
};

type CapexPayload = {
  currency?: string;
  scope?: string;
  reference_month?: string;
  reference_note?: string;
  summary?: CapexSummary;
  by_company?: CapexBreakdownRow[];
  by_provider?: CapexBreakdownRow[];
  categories?: CapexBreakdownRow[];
  references?: CapexReferenceRow[];
  reading?: string | null;
};

type CompraTrendRow = {
  mes: string;
  mes_label?: string;
  mes_corto?: string;
  es_proyeccion?: boolean;
  fuente_presion?: string;
  demanda_presion_compra_mes?: number;
  stock_heredado_confirmado?: number;
  stock_heredado_proyectado?: number;
  compras_nuevas_confirmadas_mes?: number;
  compras_nuevas_pendientes_mes?: number;
  total_confirmadas?: number;
  total_pendientes?: number;
  stock_confirmado?: number;
  stock_proyectado?: number;
  stock_disponible_confirmado?: number;
  stock_disponible_total?: number;
  balance_confirmado_vs_presion_mes?: number;
  balance_total_vs_presion_mes?: number;
  cobertura_confirmada_ratio?: number | null;
  cobertura_total_ratio?: number | null;
  lectura_preparacion?: string | null;
  nota_mes?: string | null;
};

type MlRiskModelItem = {
  decision_categoria: string;
  marca: string;
  modelo: string;
  regla_negocio: string;
  equipos: number;
  riesgo_alto_ml: number;
  riesgo_alto_operativo: number;
  riesgo_alto_urgente: number;
  prioridad_accion_inmediata: number;
  riesgo_alto: number;
  riesgo_medio: number;
  equipos_rotacion_alta: number;
  proximos_90d: number;
  ml_score_promedio: number | null;
  rotacion_promedio_12m: number | null;
  presion_stock_max: number;
  clientes?: string | null;
};

type MlRiskPayload = {
  summary?: Record<string, number>;
  groups?: Record<string, MlRiskModelItem[]>;
  policy_notes?: string[];
};

type CompraResumenResp = {
  mes?: string;
  scope?: string;
  scope_note?: string | null;
  summary?: CompraExecutiveSummary;
  compras_mes?: CompraExecutiveSummary;
  executive_reading?: CompraExecutiveReading;
  decision_recommended?: CompraDecisionRecommended;
  formula_breakdown?: CompraFormulaBreakdown;
  projection_risk?: ProjectionRisk;
  scenarios?: ScenarioRow[];
  forecast?: ForecastPayload;
  trend?: CompraTrendRow[];
  month_options?: CompraMonthOption[];
  by_company?: CompraCompanyRow[];
  by_provider?: CompraProviderRow[];
  by_model?: CompraModelRow[];
  detail?: CompraDetailRow[];
  alertas?: ExecutiveAlert[];
  compras_tracking?: CompraTrackingRow[];
  compras_tracking_note?: string | null;
  capex?: CapexPayload;
  may_preview?: CompraMayPreview;
  ml_risk?: MlRiskPayload;
  pending_notes?: string[];
};

type ExecutionQueueOverlayRow = {
  case_key: string;
  id_equipo?: string | null;
  owner_display?: string | null;
  estado_seguimiento?: string | null;
};

type QuotePlan = {
  empresa: string;
  estrategia: string;
  compraRecomendada: string;
  stockMinimo: string;
  stockOptimo: string;
  inversion: string;
  escenario: string;
  equipos: string;
  inversionResumen: string;
  referencia?: string;
};

const QUOTE_PLANS: QuotePlan[] = [
  {
    empresa: "Acid Labs",
    estrategia: "Compra bimensual",
    compraRecomendada: "12-15 equipos cada 2 meses",
    stockMinimo: "12 equipos",
    stockOptimo: "15 equipos",
    inversion: "~$189M anual",
    escenario: "Bimensual",
    equipos: "12-15 por ciclo",
    inversionResumen: "~$189M anual",
    referencia: "~$31.5M por ciclo",
  },
];

function getQuotePlan(empresa: string) {
  return QUOTE_PLANS.find((plan) => plan.empresa === empresa);
}

function formatMonthLabel(value?: string | null) {
  if (!value) return "Sin mes";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

function formatMonthShortFromIso(value?: string | null, monthOffset = 0) {
  if (!value) return "—";
  const [year, month] = (value ?? "").split("-").map((part) => Number(part));
  if (!year || !month) return value;
  const date = new Date(year, month - 1 + monthOffset, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL", { month: "short" }).replace(".", "");
}

function formatRatio(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

function formatSigned(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatDateLabel(value?: string | null, emptyLabel = "Sin fecha definida") {
  if (!value) return emptyLabel;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL");
}

function formatCurrencyClp(value?: number | null, emptyLabel = "Por estimar") {
  if (typeof value !== "number" || !Number.isFinite(value)) return emptyLabel;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildPlaneacionCompraHref(
  mode: PlaneacionCompraViewMode,
  params?: { mes?: string; empresa?: string }
) {
  const pathname = mode === "operativa" ? "/planeacion-compra/operativa" : "/planeacion-compra";
  const search = new URLSearchParams();
  if (params?.mes) search.set("mes", params.mes);
  if (params?.empresa) search.set("empresa", params.empresa);
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getDecisionTone(
  tone?: "red" | "amber" | "green" | "sky" | "neutral"
): string {
  if (tone === "red") return "border-red-300/80 bg-red-50/80 text-red-950";
  if (tone === "amber") return "border-amber-300/80 bg-amber-50/80 text-amber-950";
  if (tone === "green") return "border-emerald-300/80 bg-emerald-50/80 text-emerald-950";
  if (tone === "sky") return "border-sky-300/80 bg-sky-50/80 text-sky-950";
  return "border-[color:var(--cat-border)] bg-white/80 text-[var(--cat-text)]";
}

function getGapTone(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "text-[var(--cat-text)]";
  if (value < 0) return "text-red-700";
  if (value === 0) return "text-amber-700";
  return "text-emerald-700";
}

function getAlertTone(severity: ExecutiveAlert["severity"]) {
  if (severity === "high") return "border-red-300/80 bg-red-50/80 text-red-950";
  if (severity === "medium") return "border-amber-300/80 bg-amber-50/80 text-amber-950";
  if (severity === "low") return "border-emerald-300/80 bg-emerald-50/80 text-emerald-950";
  return "border-sky-300/80 bg-sky-50/80 text-sky-950";
}

function getTrackingStatusTone(status?: string | null) {
  if (status === "PENDIENTE") return "bg-amber-100 text-amber-900 border border-amber-300/80";
  if (status === "CONFIRMADA") return "bg-sky-100 text-sky-950 border border-sky-300/80";
  if (status === "RECIBIDA") return "bg-emerald-100 text-emerald-950 border border-emerald-300/80";
  if (status === "CANCELADA") return "bg-slate-100 text-slate-700 border border-slate-300/80";
  return "bg-white text-[var(--cat-text)] border border-[color:var(--cat-border)]";
}

function segmentLabel(value?: string | null) {
  if (value === "extranjero") return "Extranjero";
  if (value === "nacional") return "Nacional";
  if (value === "no_clasificado") return "No clasificado";
  return value ?? "Sin segmento";
}

const TEXT_HIGHLIGHTS = [
  "oferta inmediata real",
  "oferta inmediata realmente asignable",
  "oferta inmediata",
  "recuperables ponderados",
  "presión de compra",
  "presión proyectada",
  "acción inmediata",
  "riesgo alto operativo",
  "riesgo urgente",
  "ingresos sin equipo",
  "extranjeros",
  "ejecución de pendientes es crítica",
  "lectura ejecutiva",
  "reglas de negocio",
  "compra inmediata",
  "compra adicional inmediata",
  "stock confirmado",
  "stock total con pendientes",
  "compras pendientes",
  "compras confirmadas",
  "cobertura confirmada",
  "cobertura proyectada",
  "demanda reciente",
  "brecha operativa",
  "ML alta",
  "ventana activa de renovación",
];

const FORMULA_HIGHLIGHTS = [
  "presión mensual",
  "stock heredado",
  "stock proyectado",
  "stock disponible",
  "gap confirmado",
  "gap proyectado",
  "pendientes",
  "confirmadas",
  "presión",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emphasizeText(
  text?: string | null,
  highlights: string[] = TEXT_HIGHLIGHTS,
  strongClassName = "font-semibold text-[var(--cat-text)]"
) {
  if (!text) return text ?? null;

  const phrases = [...new Set(highlights.map((item) => item.trim()).filter(Boolean))].sort(
    (left, right) => right.length - left.length
  );

  if (!phrases.length) return text;

  const matcher = new RegExp(`(${phrases.map(escapeRegExp).join("|")})`, "gi");

  return text.split(matcher).map((segment, index) => {
    const isMatch = phrases.some((phrase) => phrase.toLowerCase() === segment.toLowerCase());

    if (!isMatch) return segment;

    return (
      <span key={`${segment}-${index}`} className={strongClassName}>
        {segment}
      </span>
    );
  });
}

function buildPlanningDrilldownRows(
  bloques: PlaneacionResp["bloques"],
  executionRows: ExecutionQueueOverlayRow[],
): PlanningDrilldownRow[] {
  const executionByEquipo = new Map(
    (executionRows ?? [])
      .filter((row) => row.id_equipo)
      .map((row) => [String(row.id_equipo), row]),
  );
  const order: Array<{ key: keyof NonNullable<PlaneacionResp["bloques"]>; label: string }> = [
    { key: "retiro_renovacion", label: "Renovación / retiro" },
    { key: "compra_staffing", label: "Cobertura / compra" },
    { key: "asignacion_reasignacion", label: "Asignación / reasignación" },
    { key: "movimientos_core", label: "Movimiento core" },
    { key: "mantener", label: "Mantener / observar" },
  ];

  const unique = new Set<string>();
  const rows: PlanningDrilldownRow[] = [];

  for (const bucket of order) {
    for (const item of bloques?.[bucket.key] ?? []) {
      if (!item.id_equipo || unique.has(item.id_equipo)) continue;
      unique.add(item.id_equipo);
      const tracking = executionByEquipo.get(item.id_equipo);
      rows.push({
        id_equipo: item.id_equipo,
        cliente: item.cliente,
        modelo: item.marca_modelo,
        focusLabel: bucket.label,
        action:
          item.decision_sugerida_operativa ??
          item.decision ??
          item.categoria ??
          bucket.label,
        reason:
          item.motivo ??
          item.evidencia_fuente_operativa ??
          item.alertas_resumen ??
          item.clasificacion_operacional,
        ownerDisplay: tracking?.owner_display ?? null,
        trackingStatus: tracking?.estado_seguimiento ?? null,
        caseKey: tracking?.case_key ?? null,
      });
      if (rows.length >= 8) return rows;
    }
  }

  return rows;
}

function HorizontalMetricBar({
  label,
  value,
  max,
  tone = "sky",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "red" | "amber" | "green" | "sky";
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 0) : 0;
  const bar =
    tone === "red"
      ? "from-red-500 to-red-300"
      : tone === "amber"
      ? "from-amber-500 to-amber-300"
      : tone === "green"
      ? "from-emerald-500 to-emerald-300"
      : "from-sky-500 to-indigo-300";

  return (
    <div>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-[var(--cat-text-soft)]">
        <span>{label}</span>
        <span className="text-[var(--cat-text)]">{value}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgba(132,148,255,0.12)]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${bar}`}
          style={{ width: `${Math.min(width, 100)}%` }}
        />
      </div>
    </div>
  );
}

function getPressureScore(item: GapItem) {
  if (typeof item.pressure_score === "number" && Number.isFinite(item.pressure_score)) {
    return item.pressure_score;
  }

  return (item.demanda_operativa_estimada + item.colchon_operativo) / Math.max(1, item.oferta_inmediata);
}

function GapMetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-red-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,241,0.88))] shadow-[0_14px_32px_rgba(170,48,48,0.08)]"
          : "catastro-inset border-[color:rgba(132,148,255,0.12)]"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] leading-5 text-[var(--cat-text-soft)]">
        {label}
      </div>
      <div
        className={`mt-3 leading-none ${
          highlight
            ? "text-3xl font-bold text-[var(--cat-text)]"
            : "text-[28px] font-semibold text-[var(--cat-text)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function getStrategyActivation(item: GapItem, plan?: QuotePlan) {
  const pressureScore = getPressureScore(item);

  if (!plan) {
    return {
      badge: "Sin estrategia asociada",
      detail: "No hay una política de compra conectada para este bloque.",
      tone: "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]",
    };
  }

  if (pressureScore < 1) {
    return {
      badge: "Mantener reposición planificada",
      detail: `La cobertura de corto plazo es suficiente, pero la cantidad de referencia para negocio sigue siendo la estrategia vigente: ${plan.estrategia.toLowerCase()} de ${plan.compraRecomendada.toLowerCase()}.`,
      tone: "border-emerald-300/80 bg-emerald-50/80 text-emerald-900",
    };
  }

  if (pressureScore <= 1.5) {
    return {
      badge: "Preparar próximo ciclo",
      detail: `La presión operativa es media y conviene dejar listo el siguiente ciclo. La cantidad de referencia para compra se mantiene en ${plan.compraRecomendada.toLowerCase()} bajo una estrategia ${plan.estrategia.toLowerCase()}.`,
      tone: "border-amber-300/80 bg-amber-50/80 text-amber-900",
    };
  }

  return {
    badge: "Activar próximo ciclo",
    detail: `La presión actual es alta y valida activar la estrategia vigente de ${plan.estrategia.toLowerCase()}. La cantidad de referencia para compra se mantiene en ${plan.compraRecomendada.toLowerCase()}.`,
    tone: "border-red-300/80 bg-red-50/80 text-red-900",
  };
}

function KpiCard({
  title,
  value,
  subtitle,
  tone = "neutral",
  valueClassName,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "neutral" | "red" | "amber" | "sky" | "green";
  valueClassName?: string;
}) {
  const cls =
    tone === "red"
      ? "kpi-red"
      : tone === "amber"
      ? "kpi-yellow"
      : tone === "sky"
      ? "kpi-purple"
      : tone === "green"
      ? "kpi-green"
      : "kpi-cyan";

  return (
    <div className={`cat-kpi-card ${cls} p-6`}>
      <div className="catastro-kpi-label">{title}</div>
      <div className={`mt-3 font-mono text-[clamp(1.9rem,3.6vw,3rem)] font-bold leading-none text-[var(--cat-text)] ${valueClassName ?? ""}`.trim()}>
        {value}
      </div>
      {subtitle ? <div className="catastro-kpi-helper">{subtitle}</div> : null}
    </div>
  );
}

function SectionTable({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: PlaneacionItem[];
}) {
  return (
    <section className="catastro-panel rounded-3xl p-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--cat-text)]">{title}</h2>
          <p className="mt-2 text-[var(--cat-text-muted)]">{subtitle}</p>
        </div>
        <div className="text-sm text-[var(--cat-text-soft)]">{items.length} equipos</div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-white/60">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                <th className="p-3">SKU</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Modelo</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Alerta</th>
                <th className="p-3">Score</th>
                <th className="p-3">Decisión</th>
                <th className="p-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id_equipo}
                  className="border-t border-[color:rgba(132,148,255,0.10)] hover:bg-[rgba(45,86,245,0.03)]"
                >
                  <td className="p-3 font-medium text-[var(--cat-text)]">{r.id_equipo}</td>
                  <td className="p-3 text-[var(--cat-text-muted)]">{r.cliente ?? "—"}</td>
                  <td className="p-3 text-[var(--cat-text-muted)]">{r.marca_modelo ?? "—"}</td>
                  <td className="p-3 text-[var(--cat-text-muted)]">{r.tipo_colaborador ?? "—"}</td>
                  <td className="p-3 text-[var(--cat-text-muted)]">{r.alertas_resumen ?? "—"}</td>
                  <td className="p-3 text-[var(--cat-text-muted)]">{r.ml_score ?? 0}</td>
                  <td className="p-3 text-[var(--cat-text)]">{r.decision ?? "—"}</td>
                  <td className="p-3 text-[var(--cat-text-soft)]">{r.motivo ?? "—"}</td>
                </tr>
              ))}

              {items.length === 0 ? (
                <tr>
                  <td className="p-6 text-[var(--cat-text-soft)]" colSpan={8}>
                    No hay equipos en este bloque.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SummaryTable({
  title,
  subtitle,
  headers,
  rows,
}: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}) {
  return (
    <section className="catastro-panel rounded-3xl p-6">
      <div>
        <h3 className="text-xl font-semibold text-[var(--cat-text)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--cat-text-muted)]">{subtitle}</p>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/70">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                {headers.map((header) => (
                  <th key={header} className="p-4">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${index}-${cellIndex}`}
                      className={cellIndex === 0 ? "p-4 font-medium text-[var(--cat-text)]" : "p-4 text-[var(--cat-text-muted)]"}
                    >
                      {cell ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="p-5 text-[var(--cat-text-soft)]" colSpan={headers.length}>
                    No hay filas para este bloque.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function GapCard({ item, plan }: { item: GapItem; plan?: QuotePlan }) {
  const pressureScore = getPressureScore(item);
  const gapTone =
    pressureScore < 1
      ? "border-emerald-300/80"
      : pressureScore <= 1.5
      ? "border-amber-300/80"
      : "border-red-300/80";
  const strategy = getStrategyActivation(item, plan);
  const metrics = [
    { label: "Demanda estimada", value: item.demanda_operativa_estimada },
    { label: "Oferta inmediata", value: item.oferta_inmediata },
    { label: "Oferta cercana", value: item.oferta_cercana },
    { label: "Recup. ponderados", value: item.recuperables_ponderados },
    { label: "Colchón mínimo", value: item.colchon_operativo },
    { label: "Presión", value: `${pressureScore.toFixed(2)}x`, highlight: true },
  ];

  return (
    <article className={`catastro-panel rounded-3xl border ${gapTone} p-7`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">
            {item.empresa}
          </div>
          <h3 className="mt-3 text-[32px] font-semibold leading-tight text-[var(--cat-text)]">
            {item.recomendacion}
          </h3>
          <div className="mt-3 text-base text-[var(--cat-text-muted)]">
            {item.gap_resultante > 0 ? `Brecha operativa de corto plazo: ${item.gap_resultante}` : "Brecha operativa cubierta"}
          </div>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[color:var(--cat-border)] bg-white/80 px-4 py-1.5 text-xs font-semibold text-[var(--cat-text-muted)] shadow-[0_8px_20px_rgba(46,70,152,0.06)]">
          Estrategia vigente
        </span>
      </div>

      <div className="mt-5 max-w-3xl text-sm leading-6 text-[var(--cat-text-muted)]">{item.lectura}</div>
      <div className="mt-2 text-xs font-medium tracking-[0.04em] text-[var(--cat-text-soft)]">{item.ventana_mtr_resumen}</div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <GapMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            highlight={metric.highlight}
          />
        ))}
      </div>

      {plan ? (
        <div className="mt-7 rounded-[1.75rem] border border-[color:var(--cat-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(240,244,255,0.76))] p-5 shadow-[0_16px_36px_rgba(46,70,152,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">Conexión con estrategia</div>
              <div className="mt-3 text-xl font-semibold leading-tight text-[var(--cat-text)]">
                Cantidad de referencia: {plan.compraRecomendada}
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--cat-text-muted)] md:flex-row md:flex-wrap md:gap-x-5 md:gap-y-2">
                <span>Estrategia vigente: {plan.estrategia}</span>
                <span>Inversión de referencia: {plan.inversion}</span>
              </div>
            </div>
            <div className={`inline-flex w-fit rounded-full border px-4 py-2 text-xs font-semibold ${strategy.tone}`}>
              {strategy.badge}
            </div>
          </div>
          <div className="mt-5 max-w-3xl text-sm leading-6 text-[var(--cat-text-muted)]">{strategy.detail}</div>
        </div>
      ) : null}
    </article>
  );
}

function PlaneacionTabs({
  mode,
  mes,
  empresa,
}: {
  mode: PlaneacionCompraViewMode;
  mes?: string;
  empresa?: string;
}) {
  const tabs = [
    { key: "executive" as const, label: "Resumen" },
    { key: "operativa" as const, label: "Operativa" },
  ];

  return (
    <section className="mt-8 flex flex-wrap gap-3">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={buildPlaneacionCompraHref(tab.key, { mes, empresa })}
          className={`rounded-full border px-4 py-2 text-sm transition ${
            mode === tab.key
              ? "border-[color:var(--cat-accent)] bg-[rgba(45,86,245,0.10)] text-[var(--cat-text)]"
              : "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-soft)] hover:text-[var(--cat-text)]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </section>
  );
}

function GapSummaryTable({
  items,
  scopeLabel,
  scopeNote,
  formula,
  pressureFormula,
  supuestos,
}: {
  items: GapItem[];
  scopeLabel?: string;
  scopeNote?: string;
  formula?: string;
  pressureFormula?: string;
  supuestos?: string[];
}) {
  return (
    <div className="catastro-panel-soft rounded-3xl p-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase">
            Gap de compra
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--cat-text)]">
            {scopeLabel ? `Gap de compra ${scopeLabel}` : "Cobertura vs demanda planeada"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">
            Lectura simple para conectar <span className="font-semibold text-[var(--cat-text)]">ingresos recientes del MTR</span>,{" "}
            <span className="font-semibold text-[var(--cat-text)]">oferta inmediata realmente asignable</span> y{" "}
            <span className="font-semibold text-[var(--cat-text)]">recuperables</span> con la{" "}
            <span className="font-semibold text-[var(--cat-text)]">presión de compra</span>. La{" "}
            <span className="font-semibold text-[var(--cat-text)]">brecha operativa</span> no equivale a la cantidad final recomendada de compra.
          </p>
          {scopeNote ? (
            <p className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
              {emphasizeText(scopeNote)}
            </p>
          ) : null}
        </div>
        {formula ? (
          <div className="flex flex-wrap gap-2">
            <div className="rounded-full border border-[color:var(--cat-border)] bg-white/70 px-3 py-1 text-sm text-[var(--cat-text-soft)]">
              {emphasizeText(formula, FORMULA_HIGHLIGHTS)}
            </div>
            {pressureFormula ? (
              <div className="rounded-full border border-[color:var(--cat-border)] bg-white/70 px-3 py-1 text-sm text-[var(--cat-text-soft)]">
                {emphasizeText(pressureFormula, FORMULA_HIGHLIGHTS)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-white/75">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                <th className="p-4">Empresa</th>
                <th className="p-4">Promedio MTR</th>
                <th className="p-4">Oferta inmediata real</th>
                <th className="p-4">Oferta cercana</th>
                <th className="p-4">Recup. ponderados</th>
                <th className="p-4">Colchón</th>
                <th className="p-4">Fuente / ventana</th>
                <th className="p-4">Brecha operativa</th>
                <th className="p-4">Presión</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const pressureScore = getPressureScore(item);

                return (
                <tr
                  key={item.empresa}
                  className="border-t border-[color:rgba(132,148,255,0.10)] hover:bg-[rgba(45,86,245,0.03)]"
                >
                  <td className="p-4 font-medium text-[var(--cat-text)]">{item.empresa}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{item.demanda_operativa_estimada}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{item.oferta_inmediata}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{item.oferta_cercana}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{item.recuperables_ponderados}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{item.colchon_operativo}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">
                    <div>{item.demanda_fuente}</div>
                    <div className="mt-1 text-xs text-[var(--cat-text-soft)]">{item.ventana_mtr_resumen}</div>
                  </td>
                  <td className="p-4 text-[var(--cat-text)]">
                    {item.gap_resultante > 0 ? item.gap_resultante : `0 (${item.exceso_stock} exceso)`}
                  </td>
                  <td className="p-4 text-[var(--cat-text)]">
                    <div>{item.recomendacion}</div>
                    <div className="mt-1 text-xs text-[var(--cat-text-soft)]">{pressureScore.toFixed(2)}x</div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {supuestos?.length ? (
        <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--cat-text-muted)]">
          {supuestos.map((supuesto) => (
            <div key={supuesto}>- {emphasizeText(supuesto)}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExecutiveReadingSection({
  reading,
  selectedMonthLabel,
}: {
  reading: CompraExecutiveReading;
  selectedMonthLabel: string;
}) {
  const title = reading.es_proyeccion
    ? `Proyección ${selectedMonthLabel}`
    : `Qué pasó en ${selectedMonthLabel} y cómo parte el siguiente ciclo`;

  return (
    <section className="catastro-panel-strong rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Lectura ejecutiva
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
            {emphasizeText(
              reading.conclusion ?? "Sin lectura ejecutiva disponible para el mes seleccionado."
            )}
          </p>
        </div>
        <span className={getStatusClassName(reading.estado ?? "Sin estado")}>
          {reading.estado ?? "Sin estado"}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        <KpiCard title="Presión del mes" value={reading.presion_mes ?? 0} subtitle="Ingresos MTR que presionan compra" tone="red" />
        <KpiCard title="Stock heredado" value={reading.stock_heredado_confirmado ?? 0} subtitle="Arrastre confirmado del mes anterior" tone="green" />
        <KpiCard title="Pendientes heredados" value={reading.stock_heredado_proyectado ?? 0} subtitle="Aún no cuentan como stock real" tone="amber" />
        <KpiCard title="Compras nuevas mes" value={reading.compras_confirmadas ?? 0} subtitle="Confirmadas en el mes seleccionado" tone="sky" />
        <KpiCard title="Gap confirmado" value={formatSigned(reading.gap_confirmado)} subtitle="Disponible confirmado - presión" tone="sky" />
        <KpiCard title="Cobertura confirmada" value={formatRatio(reading.cobertura_confirmada)} subtitle="Disponible confirmado / presión" />
        <KpiCard title="Cobertura proyectada" value={formatRatio(reading.cobertura_total)} subtitle="Disponible total / presión" tone="sky" />
      </div>
    </section>
  );
}

function ExecutiveAlertsSection({
  alerts,
}: {
  alerts: ExecutiveAlert[];
}) {
  if (!alerts.length) return null;

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Qué revisar hoy
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            Alertas accionables ejecutivas
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            Prioriza la acción inmediata sin cambiar el forecast ni la cobertura actual: aquí se ve qué destraba la continuidad del parque y qué sigue siendo riesgo operativo.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {alerts.map((alert, index) => (
          <article
            key={`${alert.title}-${index}`}
            className={`rounded-[1.5rem] border p-5 ${getAlertTone(alert.severity)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-current/75">
                {alert.severity}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-current">
                {alert.related_metric}
              </span>
            </div>
            <h3 className="mt-4 text-xl font-semibold leading-tight text-current">
              {emphasizeText(alert.title, TEXT_HIGHLIGHTS, "font-semibold text-current")}
            </h3>
            <p className="mt-3 text-sm leading-7 text-current/85">
              {emphasizeText(alert.description, TEXT_HIGHLIGHTS, "font-semibold text-current")}
            </p>
            <div className="mt-4 rounded-2xl bg-white/65 p-4 text-sm leading-6 text-current/90">
              <span className="font-semibold">Acción recomendada:</span>{" "}
              {emphasizeText(alert.recommended_action, TEXT_HIGHLIGHTS, "font-semibold text-current")}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CapexSection({
  capex,
}: {
  capex: CapexPayload;
}) {
  const summary = capex.summary ?? {};
  const byCompany = capex.by_company ?? [];
  const byProvider = capex.by_provider ?? [];
  const categories = capex.categories ?? [];
  const capexValueClassName = "w-full text-xl font-bold leading-tight tracking-tight whitespace-nowrap md:text-2xl";

  if (!summary.capex_confirmado && !summary.capex_proyectado && !capex.reading) {
    return null;
  }

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            CAPEX estimado
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            Capa financiera referencial
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            Traduce la planeación operativa de <span className="font-semibold text-[var(--cat-text)]">Acid Labs</span> a una lectura financiera simple usando la última factura real disponible como referencia, sin cambiar los cálculos de forecast ni cobertura.
          </p>
        </div>
        <div className="rounded-full border border-[color:var(--cat-border)] bg-white/75 px-4 py-2 text-sm text-[var(--cat-text-soft)]">
          {capex.scope ?? "Alcance financiero vigente"}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title={summary.capex_confirmado_label ?? "CAPEX confirmado"}
          value={formatCurrencyClp(summary.capex_confirmado)}
          subtitle="Última factura real usada como referencia"
          tone="green"
          valueClassName={capexValueClassName}
        />
        <KpiCard
          title="CAPEX pendiente"
          value={formatCurrencyClp(summary.capex_pendiente)}
          subtitle={summary.capex_pendiente_status ?? "Sin monto definitivo"}
          tone="amber"
          valueClassName={capexValueClassName}
        />
        <KpiCard
          title={summary.capex_proyectado_label ?? "CAPEX proyectado"}
          value={formatCurrencyClp(summary.capex_proyectado)}
          subtitle={
            summary.forecast_unidades
              ? `${summary.forecast_unidades} equipos con mix referencial`
              : "Sin forecast valorizable"
          }
          tone="sky"
          valueClassName={capexValueClassName}
        />
        <KpiCard
          title="CAPEX renovación urgente"
          value={formatCurrencyClp(summary.capex_renovacion_urgente)}
          subtitle={summary.capex_renovacion_urgente_status ?? "Sin referencia vigente"}
          tone="red"
          valueClassName={capexValueClassName}
        />
        <KpiCard
          title="CAPEX total estimado"
          value={formatCurrencyClp(summary.capex_total_estimado)}
          subtitle={summary.capex_total_status ?? "Total conocido"}
          valueClassName={capexValueClassName}
        />
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-[color:var(--cat-border)] bg-white/75 p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Lectura ejecutiva</div>
            <p className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
              {emphasizeText(capex.reading ?? "Sin lectura ejecutiva CAPEX disponible.")}
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Proveedor más relevante</div>
            <div className="mt-3 text-xl font-semibold text-[var(--cat-text)]">
              {summary.proveedor_mas_relevante ?? "Sin referencia"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Empresa con mayor presión</div>
            <div className="mt-3 text-xl font-semibold text-[var(--cat-text)]">
              {summary.empresa_mayor_presion ?? "Sin referencia"}
            </div>
          </div>
        </div>
      </div>

      {capex.reference_note ? (
        <div className="mt-5 rounded-2xl border border-amber-300/80 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950">
          {emphasizeText(capex.reference_note, TEXT_HIGHLIGHTS, "font-semibold text-amber-950")}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SummaryTable
          title="CAPEX por empresa"
          subtitle="Alcance financiero actual por empresa."
          headers={["Empresa", "Confirmado", "Pendiente", "Proyectado", "Estado"]}
          rows={byCompany.map((row) => [
            row.empresa,
            formatCurrencyClp(row.capex_confirmado),
            formatCurrencyClp(row.capex_pendiente),
            formatCurrencyClp(row.capex_proyectado),
            row.status,
          ])}
        />

        <SummaryTable
          title="CAPEX por proveedor"
          subtitle="Separación simple de gasto por proveedor."
          headers={["Proveedor", "Confirmado", "Pendiente", "Proyectado", "Estado"]}
          rows={byProvider.map((row) => [
            row.proveedor,
            formatCurrencyClp(row.capex_confirmado),
            formatCurrencyClp(row.capex_pendiente),
            formatCurrencyClp(row.capex_proyectado),
            row.status,
          ])}
        />

        <SummaryTable
          title="CAPEX por categoría"
          subtitle="Separación entre gasto ejecutado, pendiente y proyectado."
          headers={["Categoría", "Monto", "Estado"]}
          rows={categories.map((row) => [
            row.categoria,
            formatCurrencyClp(row.monto),
            row.status,
          ])}
        />
      </div>
    </section>
  );
}

function ProjectionRiskSection({
  risk,
}: {
  risk: ProjectionRisk;
}) {
  if (!risk.summary && !risk.items?.length && !risk.gap_note && !risk.renewal_note) {
    return null;
  }

  return (
    <section className="catastro-panel rounded-[2rem] border border-amber-300/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,245,220,0.88))] p-7">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900/70">
        {risk.title ?? "Riesgo operativo"}
      </div>
      {risk.summary ? (
        <p className="mt-4 max-w-4xl text-sm leading-7 text-amber-950/90">
          {emphasizeText(risk.summary, TEXT_HIGHLIGHTS, "font-semibold text-amber-950")}
        </p>
      ) : null}
      {risk.gap_note ? (
        <div className="mt-5 rounded-2xl border border-amber-300/70 bg-white/75 p-4 text-sm leading-6 text-amber-950/90">
          {emphasizeText(risk.gap_note, TEXT_HIGHLIGHTS, "font-semibold text-amber-950")}
        </div>
      ) : null}
      {risk.items?.length ? (
        <div className="mt-5 space-y-2 text-sm leading-6 text-amber-950/90">
          {risk.items.map((item) => (
            <div key={item}>- {emphasizeText(item, TEXT_HIGHLIGHTS, "font-semibold text-amber-950")}</div>
          ))}
        </div>
      ) : null}
      {risk.renewal_note ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--cat-border)] bg-white/75 p-4 text-sm leading-6 text-[var(--cat-text-muted)]">
          {emphasizeText(risk.renewal_note)}
        </div>
      ) : null}
    </section>
  );
}

function ScenariosSection({
  scenarios,
}: {
  scenarios: ScenarioRow[];
}) {
  if (!scenarios.length) return null;

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
          Escenarios del mes
          </div>
        <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
          Lectura rápida por escenario
        </h2>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {scenarios.map((scenario) => (
          <article key={scenario.name} className="rounded-[1.5rem] border border-[color:var(--cat-border)] bg-white/75 p-5">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">{scenario.name}</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <GapMetricCard label="Stock" value={scenario.stock} />
              <GapMetricCard label="Demanda" value={scenario.demanda} />
              <GapMetricCard label="Gap" value={formatSigned(scenario.gap)} highlight />
            </div>
            <div className="mt-5 text-base font-semibold text-[var(--cat-text)]">{scenario.decision}</div>
            {scenario.note ? (
              <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                {emphasizeText(scenario.note)}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function DecisionSection({
  decision,
  formula,
}: {
  decision: CompraDecisionRecommended;
  formula: CompraFormulaBreakdown;
}) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <article className={`catastro-panel rounded-[2rem] border p-7 ${getDecisionTone(decision.tone)}`}>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-current/70">
          Decisión recomendada
        </div>
        <h2 className="mt-4 text-3xl font-semibold leading-tight text-current">
          {decision.title ?? "Sin decisión automática"}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-current/80">
          {emphasizeText(
            decision.body ?? "No hay suficiente información para sugerir una decisión automática.",
            TEXT_HIGHLIGHTS,
            "font-semibold text-current"
          )}
        </p>

        {decision.actions?.length ? (
          <div className="mt-6 space-y-2 text-sm leading-6 text-current/85">
            {decision.actions.map((action) => (
              <div key={action}>
                - {emphasizeText(action, TEXT_HIGHLIGHTS, "font-semibold text-current")}
              </div>
            ))}
          </div>
        ) : null}
      </article>

      <article className="catastro-panel rounded-[2rem] p-7">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">
          Fórmula y lectura simple
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GapMetricCard label="Presión mensual" value={formula.presion_mensual ?? 0} />
          <GapMetricCard label="Stock heredado" value={formula.stock_heredado_confirmado ?? 0} />
          <GapMetricCard label="Nuevas confirmadas" value={formula.compras_nuevas_confirmadas_mes ?? 0} />
          <GapMetricCard label="Pendiente heredado" value={formula.stock_heredado_proyectado ?? 0} />
          <GapMetricCard label="Gap proyectado" value={formatSigned(formula.gap_proyectado)} highlight />
        </div>

        <div className="mt-6 space-y-3 text-sm leading-6 text-[var(--cat-text-muted)]">
          <div>{emphasizeText(formula.presion_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.stock_heredado_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.stock_proyectado_heredado_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.stock_confirmado_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.stock_proyectado_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.stock_disponible_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.stock_disponible_total_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.gap_confirmado_formula, FORMULA_HIGHLIGHTS)}</div>
          <div>{emphasizeText(formula.gap_proyectado_formula, FORMULA_HIGHLIGHTS)}</div>
        </div>

        {formula.gap_proyectado_note ? (
          <div className="mt-5 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950/85">
            {emphasizeText(formula.gap_proyectado_note, TEXT_HIGHLIGHTS, "font-semibold text-amber-950")}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Lectura confirmada</div>
            <div className={`mt-2 text-lg font-semibold ${getGapTone(formula.gap_confirmado)}`}>
              {formula.status_confirmado ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Lectura proyectada</div>
            <div className={`mt-2 text-lg font-semibold ${getGapTone(formula.gap_proyectado)}`}>
              {formula.status_proyectado ?? "—"}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function ForecastDemandSection({
  forecast,
}: {
  forecast: ForecastPayload;
}) {
  if (!forecast.mes) return null;

  const scenarios = forecast.scenarios ?? [];
  const segments = forecast.segments ?? [];
  const hasSegmentRows = segments.some((item) => (item.forecast_segmento ?? 0) > 0);
  const lastMonthShort = formatMonthShortFromIso(forecast.mes, -1);
  const prevMonthShort = formatMonthShortFromIso(forecast.mes, -2);
  const prevTwoMonthShort = formatMonthShortFromIso(forecast.mes, -3);
  const highScenarioGap = forecast.gap_alto_confirmado ?? 0;
  const highScenarioTitle =
    highScenarioGap < 0 ? "Déficit potencial escenario alto" : "Margen confirmado escenario alto";
  const highScenarioValue =
    highScenarioGap < 0 ? `${Math.abs(highScenarioGap)} equipos` : `${formatSigned(highScenarioGap)} equipos`;
  const highScenarioContractTone =
    highScenarioGap < 0
      ? "text-amber-950 border-amber-300/80 bg-amber-50/80"
      : "text-emerald-950 border-emerald-300/80 bg-emerald-50/80";
  const marginInsight =
    (forecast.gap_base_confirmado ?? 0) <= 0 || (forecast.gap_alto_confirmado ?? 0) < 0
      ? "El margen de error operativo es bajo, por lo que la ejecución de pendientes es crítica."
      : "La cobertura confirmada mantiene margen suficiente incluso ante variaciones razonables de demanda.";

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Forecast de demanda
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            {forecast.mes_label ?? "Siguiente ciclo"}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            {emphasizeText(
              forecast.subtitle ?? "Proyección de presión de compra para el siguiente ciclo."
            )}
          </p>
        </div>
        <div className="rounded-full border border-[color:var(--cat-border)] bg-white/80 px-4 py-2 text-sm text-[var(--cat-text-soft)]">
          {forecast.metodo ?? "Ponderación histórica"}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Presión proyectada"
          value={forecast.forecast_presion_base ?? 0}
          subtitle={`Últimos 3 meses: ${forecast.presion_mes ?? 0} (${lastMonthShort}) / ${forecast.presion_mes_anterior ?? 0} (${prevMonthShort}) / ${forecast.presion_hace_2_meses ?? 0} (${prevTwoMonthShort})`}
          tone="red"
        />
        <KpiCard
          title="Rango esperado"
          value={`${forecast.forecast_presion_bajo ?? 0}–${forecast.forecast_presion_alto ?? 0}`}
          subtitle="Sensibilidad simple ±10%"
          tone="amber"
        />
        <KpiCard
          title="Stock confirmado"
          value={forecast.stock_confirmado ?? 0}
          subtitle="Cobertura disponible confirmada"
          tone="green"
        />
        <KpiCard
          title="Stock total con pendientes"
          value={forecast.stock_total ?? 0}
          subtitle="Incluye pendientes aún no ingresados"
          tone="sky"
        />
        <KpiCard
          title={highScenarioTitle}
          value={highScenarioValue}
          subtitle={forecast.risk_high_scenario}
          tone={highScenarioGap < 0 ? "amber" : "green"}
        />
      </div>

      <div className={`mt-4 rounded-[1.35rem] border px-5 py-4 text-sm leading-7 ${highScenarioContractTone}`}>
        <div className="text-xs uppercase tracking-[0.14em] opacity-80">Mini contrato del forecast</div>
        <div className="mt-2">
          <span className="font-semibold">Cómo leer la cifra final:</span> se calcula como{" "}
          <span className="font-semibold">stock confirmado - demanda del escenario alto</span>.
        </div>
        <div>
          <span className="font-semibold">Si el resultado es positivo</span>, hay margen o cobertura sobrante.{" "}
          <span className="font-semibold">Si es negativo</span>, aparece déficit y falta cobertura real.
        </div>
        <div>
          <span className="font-semibold">Stock confirmado</span> no incluye pendientes;{" "}
          <span className="font-semibold">stock total</span> sí los considera como cobertura proyectada.
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-[color:var(--cat-border)] bg-white/75 p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Lectura ejecutiva del forecast</div>
          <p className="mt-4 text-sm leading-7 text-[var(--cat-text-muted)]">
            {emphasizeText(
              forecast.insight_forecast ??
                "Sin lectura automática disponible para el forecast del ciclo seleccionado."
            )}
          </p>
          <p className="mt-4 text-sm leading-7 text-[var(--cat-text-muted)]">
            {emphasizeText(marginInsight)}
          </p>
          {forecast.pending_cover_note ? (
            <div className="mt-4 rounded-2xl border border-emerald-300/80 bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-950">
              {emphasizeText(
                forecast.pending_cover_note,
                TEXT_HIGHLIGHTS,
                "font-semibold text-emerald-950"
              )}
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-7 text-[var(--cat-text-muted)]">
            {emphasizeText(
              forecast.segment_insight ??
                "No hay suficiente historia segmentada para proyectar por segmento."
            )}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--cat-border)] bg-white/75 p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Conexión con cobertura</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--cat-text-muted)]">
            <div>
              <span className="font-semibold text-[var(--cat-text)]">gap base confirmado</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.stock_confirmado ?? 0}</span> -{" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.forecast_presion_base ?? 0}</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{formatSigned(forecast.gap_base_confirmado)}</span>
            </div>
            <div>
              <span className="font-semibold text-[var(--cat-text)]">gap alto confirmado</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.stock_confirmado ?? 0}</span> -{" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.forecast_presion_alto ?? 0}</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{formatSigned(forecast.gap_alto_confirmado)}</span>
            </div>
            <div>
              <span className="font-semibold text-[var(--cat-text)]">gap base total</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.stock_total ?? 0}</span> -{" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.forecast_presion_base ?? 0}</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{formatSigned(forecast.gap_base_total)}</span>
            </div>
            <div>
              <span className="font-semibold text-[var(--cat-text)]">gap alto total</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.stock_total ?? 0}</span> -{" "}
              <span className="font-bold text-[var(--cat-text)]">{forecast.forecast_presion_alto ?? 0}</span> ={" "}
              <span className="font-bold text-[var(--cat-text)]">{formatSigned(forecast.gap_alto_total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-white/70">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                <th className="p-4">Escenario</th>
                <th className="p-4">Demanda</th>
                <th className="p-4">Gap confirmado</th>
                <th className="p-4">Gap total</th>
                <th className="p-4">Decisión</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={`forecast-${scenario.name}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                  <td className="p-4 font-medium text-[var(--cat-text)]">{scenario.name}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{scenario.demanda}</td>
                  <td className={`p-4 ${getGapTone(scenario.gap_confirmado)}`}>{formatSigned(scenario.gap_confirmado)}</td>
                  <td className={`p-4 ${getGapTone(scenario.gap_total)}`}>{formatSigned(scenario.gap_total)}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{scenario.decision}</td>
                </tr>
              ))}
              {scenarios.length === 0 ? (
                <tr>
                  <td className="p-5 text-[var(--cat-text-soft)]" colSpan={5}>
                    No hay escenarios de forecast disponibles.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-[color:var(--cat-border)] bg-white/75 p-5">
        <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Forecast por segmento</div>
        {hasSegmentRows ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-white/70">
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                    <th className="p-4">Segmento</th>
                    <th className="p-4">Mes -1</th>
                    <th className="p-4">Mes -2</th>
                    <th className="p-4">Mes -3</th>
                    <th className="p-4">Forecast</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((segment) => (
                    <tr key={`segment-${segment.segmento}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                      <td className="p-4 font-medium text-[var(--cat-text)]">{segmentLabel(segment.segmento)}</td>
                      <td className="p-4 text-[var(--cat-text-muted)]">{segment.presion_mes}</td>
                      <td className="p-4 text-[var(--cat-text-muted)]">{segment.presion_mes_anterior}</td>
                      <td className="p-4 text-[var(--cat-text-muted)]">{segment.presion_hace_2_meses}</td>
                      <td className="p-4 text-[var(--cat-text-muted)]">{segment.forecast_segmento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[var(--cat-text-muted)]">
            No hay suficiente historia segmentada para proyectar por segmento.
          </p>
        )}
      </div>
    </section>
  );
}

function TrackingSection({
  rows,
  note,
}: {
  rows: CompraTrackingRow[];
  note?: string | null;
}) {
  if (!rows.length) return null;

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Seguimiento de compras
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            Compras reales y pendientes
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            Esta capa separa lo que ya está aprobado de lo que realmente ingresó al parque, para que la cobertura de <span className="font-semibold text-[var(--cat-text)]">Acid Labs</span> no se lea como stock operativo antes de tiempo.
          </p>
        </div>
      </div>

      {note ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--cat-border)] bg-white/75 p-4 text-sm leading-6 text-[var(--cat-text-muted)]">
          {emphasizeText(note)}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-white/70">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                <th className="p-4">Proveedor</th>
                <th className="p-4">Empresa</th>
                <th className="p-4">Modelo</th>
                <th className="p-4">Cantidad</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Tipo stock</th>
                <th className="p-4">Fecha estimada</th>
                <th className="p-4">Ingreso real</th>
                <th className="p-4">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.id_compra}-${row.proveedor}-${row.empresa}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                  <td className="p-4 font-medium text-[var(--cat-text)]">{row.proveedor}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{row.empresa}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">
                    <div>{row.modelo}</div>
                    {row.observacion ? (
                      <div className="mt-1 text-xs leading-5 text-[var(--cat-text-soft)]">
                        {emphasizeText(row.observacion)}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-[var(--cat-text)]">{row.cantidad}</span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTrackingStatusTone(row.estado)}`}>
                      {row.estado}
                    </span>
                  </td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{row.tipo_stock}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">
                    {formatDateLabel(row.fecha_estimada_entrega, "Sin ETA definida")}
                  </td>
                  <td className="p-4 text-[var(--cat-text-muted)]">
                    {formatDateLabel(row.fecha_ingreso_real, "Pendiente de ingreso")}
                  </td>
                  <td className="p-4 text-[var(--cat-text)]">
                    {emphasizeText(row.accion_recomendada)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function TrackingSummarySection({
  rows,
  note,
}: {
  rows: CompraTrackingRow[];
  note?: string | null;
}) {
  if (!rows.length) return null;

  const visibleRows = rows.slice(0, 3);

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Seguimiento de compras
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            Resumen de compras reales y pendientes
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            Vista corta para identificar qué ya entró a <span className="font-semibold text-[var(--cat-text)]">stock real</span> y qué sigue siendo <span className="font-semibold text-[var(--cat-text)]">seguimiento pendiente</span>.
          </p>
        </div>
      </div>

      {note ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--cat-border)] bg-white/75 p-4 text-sm leading-6 text-[var(--cat-text-muted)]">
          {emphasizeText(note)}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {visibleRows.map((row) => (
          <article
            key={`${row.id_compra}-${row.proveedor}-${row.empresa}-summary`}
            className="rounded-[1.5rem] border border-[color:var(--cat-border)] bg-white/75 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">
                  {row.proveedor} · {row.empresa}
                </div>
                <h3 className="mt-3 text-xl font-semibold text-[var(--cat-text)]">{row.modelo}</h3>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTrackingStatusTone(row.estado)}`}>
                {row.estado}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/70 p-4">
                <div className="text-xs uppercase tracking-[0.12em] text-[var(--cat-text-soft)]">Cantidad</div>
                <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{row.cantidad}</div>
              </div>
              <div className="rounded-2xl bg-white/70 p-4">
                <div className="text-xs uppercase tracking-[0.12em] text-[var(--cat-text-soft)]">Tipo stock</div>
                <div className="mt-2 text-base font-semibold text-[var(--cat-text)]">{row.tipo_stock}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--cat-text-muted)]">
              <div>
                <span className="font-semibold text-[var(--cat-text)]">Ingreso real:</span>{" "}
                {formatDateLabel(row.fecha_ingreso_real, "Sin ingreso real")}
              </div>
              <div>
                <span className="font-semibold text-[var(--cat-text)]">Acción:</span>{" "}
                {emphasizeText(row.accion_recomendada)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TrendSection({
  trend,
}: {
  trend: CompraTrendRow[];
}) {
  const maxBarValue = Math.max(
    1,
    ...trend.flatMap((row) => [
      row.demanda_presion_compra_mes ?? 0,
      row.stock_heredado_confirmado ?? 0,
      row.stock_heredado_proyectado ?? 0,
      row.compras_nuevas_confirmadas_mes ?? 0,
      row.compras_nuevas_pendientes_mes ?? 0,
    ])
  );

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Tendencia mensual
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            Serie reciente + siguiente corte proyectado
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            La serie mensual conecta <span className="font-semibold text-[var(--cat-text)]">presión de compra</span>,{" "}
            <span className="font-semibold text-[var(--cat-text)]">compras confirmadas</span>,{" "}
            <span className="font-semibold text-[var(--cat-text)]">compras pendientes</span>, gap y cobertura. Así deja de ser una foto estática y pasa a ser una historia operativa.
          </p>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-5">
        {trend.map((row) => (
          <article
            key={row.mes}
            className={`rounded-[1.5rem] border p-5 ${
              row.es_proyeccion
                ? "border-amber-300/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,244,214,0.86))]"
                : "border-[color:var(--cat-border)] bg-white/75"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">
                  {row.mes_corto}
                </div>
                <div className="mt-1 text-xl font-semibold text-[var(--cat-text)]">
                  {row.mes_label}
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cat-text-soft)]">
                {row.es_proyeccion ? "Proyectado" : "Real"}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <HorizontalMetricBar
                label="Presión"
                value={row.demanda_presion_compra_mes ?? 0}
                max={maxBarValue}
                tone="red"
              />
              <HorizontalMetricBar
                label="Heredado"
                value={row.stock_heredado_confirmado ?? 0}
                max={maxBarValue}
                tone="green"
              />
              <HorizontalMetricBar
                label="Nuevas mes"
                value={row.compras_nuevas_confirmadas_mes ?? 0}
                max={maxBarValue}
                tone="amber"
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/75 p-3">
                <div className="text-xs uppercase tracking-[0.12em] text-[var(--cat-text-soft)]">Gap</div>
                <div className={`mt-2 text-xl font-semibold ${getGapTone(row.balance_confirmado_vs_presion_mes)}`}>
                  {formatSigned(row.balance_confirmado_vs_presion_mes)}
                </div>
              </div>
              <div className="rounded-2xl bg-white/75 p-3">
                <div className="text-xs uppercase tracking-[0.12em] text-[var(--cat-text-soft)]">Cobertura</div>
                <div className="mt-2 text-xl font-semibold text-[var(--cat-text)]">
                  {formatRatio(row.cobertura_total_ratio)}
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--cat-text-muted)]">
              {emphasizeText(row.lectura_preparacion ?? row.nota_mes ?? "Sin lectura disponible.")}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-white/70">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                <th className="p-4">Mes</th>
                <th className="p-4">Presión</th>
                <th className="p-4">Stock heredado</th>
                <th className="p-4">Pend. heredados</th>
                <th className="p-4">Nuevas conf.</th>
                <th className="p-4">Nuevas pend.</th>
                <th className="p-4">Gap confirmado</th>
                <th className="p-4">Gap proyectado</th>
                <th className="p-4">Cobertura conf.</th>
                <th className="p-4">Cobertura total</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((row) => (
                <tr key={`trend-${row.mes}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                  <td className="p-4 font-medium text-[var(--cat-text)]">
                    {row.mes_label}
                    {row.es_proyeccion ? (
                      <span className="ml-2 text-xs uppercase tracking-[0.12em] text-amber-700">proyección</span>
                    ) : null}
                  </td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{row.demanda_presion_compra_mes ?? 0}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{row.stock_heredado_confirmado ?? 0}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{row.stock_heredado_proyectado ?? 0}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{row.compras_nuevas_confirmadas_mes ?? 0}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{row.compras_nuevas_pendientes_mes ?? 0}</td>
                  <td className={`p-4 ${getGapTone(row.balance_confirmado_vs_presion_mes)}`}>
                    {formatSigned(row.balance_confirmado_vs_presion_mes)}
                  </td>
                  <td className={`p-4 ${getGapTone(row.balance_total_vs_presion_mes)}`}>
                    {formatSigned(row.balance_total_vs_presion_mes)}
                  </td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{formatRatio(row.cobertura_confirmada_ratio)}</td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{formatRatio(row.cobertura_total_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MlRiskSection({
  risk,
}: {
  risk: MlRiskPayload;
}) {
  const groups = risk.groups ?? {};
  const summary = risk.summary ?? {};
  const order: Array<{ key: string; title: string; subtitle: string }> = [
    { key: "renovar", title: "Renovar", subtitle: "Modelos que justifican recambio prioritario." },
    { key: "dar_baja", title: "Dar de baja", subtitle: "Modelos que salen de parque y no se recompran." },
    { key: "observar", title: "Observar", subtitle: "Modelos que requieren seguimiento o definición de baja/renovación." },
    { key: "mantener", title: "Mantener", subtitle: "Modelos objetivo o sin urgencia inmediata." },
  ];

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Riesgo operativo por modelo
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            Señales ML y reglas de negocio conectadas a la compra
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            Este bloque conecta <span className="font-semibold text-[var(--cat-text)]">score ML</span>, nivel de riesgo, rotación de 12 meses y ventana de 90 días con la <span className="font-semibold text-[var(--cat-text)]">política real del parque</span> para explicar qué renovar, qué retirar y qué observar.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            <span className="font-semibold text-[var(--cat-text)]">Riesgo alto operativo</span> prioriza urgencia de negocio sobre la señal ML cruda: usa <span className="font-semibold text-[var(--cat-text)]">ML alta</span> y además exige <span className="font-semibold text-[var(--cat-text)]">ventana activa de renovación</span>.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            El <span className="font-semibold text-[var(--cat-text)]">riesgo urgente</span> es una subcapa más estricta para priorizar <span className="font-semibold text-[var(--cat-text)]">acción inmediata</span>; no reemplaza el score ML ni la regla operativa general.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            <span className="font-semibold text-[var(--cat-text)]">Acción inmediata</span> prioriza los casos donde el riesgo alto coincide con vencimiento crítico y señales operativas como tickets abiertos o rotación reciente.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            La renovación de modelos críticos, especialmente Apple A2141 y Dell en salida, puede aumentar la presión futura si no se planifica junto con las <span className="font-semibold text-[var(--cat-text)]">compras nuevas</span>.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard title="Renovar" value={summary.renovar ?? 0} subtitle="Recambio activo" tone="amber" />
        <KpiCard title="Dar de baja" value={summary.dar_baja ?? 0} subtitle="Salida sin recompra" tone="red" />
        <KpiCard title="Observar" value={summary.observar ?? 0} subtitle="Seguimiento ML y negocio" />
        <KpiCard title="Mantener" value={summary.mantener ?? 0} subtitle="Modelos objetivo / sanos" tone="green" />
      </div>

      {risk.policy_notes?.length ? (
        <div className="mt-6 space-y-2 text-sm leading-6 text-[var(--cat-text-muted)]">
          {risk.policy_notes.map((note) => (
            <div key={note}>- {emphasizeText(note)}</div>
          ))}
        </div>
      ) : null}

      <div className="mt-7 space-y-6">
        {order.map((bucket) => {
          const items = groups[bucket.key] ?? [];

          return (
            <article key={bucket.key} className="rounded-[1.75rem] border border-[color:var(--cat-border)] bg-white/65 p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-[var(--cat-text)]">{bucket.title}</h3>
                  <p className="mt-2 text-sm text-[var(--cat-text-muted)]">{bucket.subtitle}</p>
                </div>
                <div className="text-sm text-[var(--cat-text-soft)]">{items.length} modelos</div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-sm">
                    <thead className="bg-white/70">
                      <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                        <th className="p-4">Modelo</th>
                        <th className="p-4">Equipos</th>
                        <th className="p-4">Riesgo alto op.</th>
                        <th className="p-4">Riesgo alto ML</th>
                        <th className="p-4">Riesgo urgente</th>
                        <th className="p-4">Acción inmediata</th>
                        <th className="p-4">Score ML</th>
                        <th className="p-4">Rotación 12m</th>
                        <th className="p-4">Próx. 90d</th>
                        <th className="p-4">Presión stock</th>
                        <th className="p-4">Regla</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={`${bucket.key}-${item.marca}-${item.modelo}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                          <td className="p-4 font-medium text-[var(--cat-text)]">
                            {item.marca} {item.modelo}
                            {item.clientes ? (
                              <div className="mt-1 text-xs text-[var(--cat-text-soft)]">{item.clientes}</div>
                            ) : null}
                          </td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.equipos}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.riesgo_alto_operativo ?? item.riesgo_alto}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.riesgo_alto_ml ?? item.riesgo_alto}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.riesgo_alto_urgente ?? 0}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.prioridad_accion_inmediata ?? 0}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.ml_score_promedio ?? "—"}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.rotacion_promedio_12m ?? "—"}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.proximos_90d}</td>
                          <td className="p-4 text-[var(--cat-text-muted)]">{item.presion_stock_max}</td>
                          <td className="p-4 text-[var(--cat-text-soft)]">{item.regla_negocio}</td>
                        </tr>
                      ))}

                      {items.length === 0 ? (
                        <tr>
                          <td className="p-5 text-[var(--cat-text-soft)]" colSpan={11}>
                            No hay modelos clasificados en este grupo.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MlRiskSummarySection({
  risk,
}: {
  risk: MlRiskPayload;
}) {
  const summary = risk.summary ?? {};
  const topItems = Object.values(risk.groups ?? {})
    .flat()
    .sort((left, right) => {
      const rightPriority = (right.prioridad_accion_inmediata ?? 0) + (right.riesgo_alto_urgente ?? 0);
      const leftPriority = (left.prioridad_accion_inmediata ?? 0) + (left.riesgo_alto_urgente ?? 0);
      return rightPriority - leftPriority;
    })
    .slice(0, 4);

  if (!topItems.length && !Object.keys(summary).length) return null;

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Riesgo operativo por modelo
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
            Resumen ML y reglas de negocio
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
            Lectura ejecutiva del riesgo para distinguir rápido qué modelos están en <span className="font-semibold text-[var(--cat-text)]">renovación</span>, <span className="font-semibold text-[var(--cat-text)]">baja</span> u <span className="font-semibold text-[var(--cat-text)]">observación</span>.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard title="Renovar" value={summary.renovar ?? 0} subtitle="Recambio activo" tone="amber" />
        <KpiCard title="Dar de baja" value={summary.dar_baja ?? 0} subtitle="Salida sin recompra" tone="red" />
        <KpiCard title="Observar" value={summary.observar ?? 0} subtitle="Seguimiento de riesgo" />
        <KpiCard title="Mantener" value={summary.mantener ?? 0} subtitle="Modelos objetivo" tone="green" />
      </div>

      {topItems.length ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-white/70">
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                  <th className="p-4">Modelo</th>
                  <th className="p-4">Categoría</th>
                  <th className="p-4">Acción inmediata</th>
                  <th className="p-4">Riesgo urgente</th>
                  <th className="p-4">Regla</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item) => (
                  <tr key={`risk-summary-${item.marca}-${item.modelo}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                    <td className="p-4 font-medium text-[var(--cat-text)]">{item.marca} {item.modelo}</td>
                    <td className="p-4 text-[var(--cat-text-muted)]">{item.decision_categoria}</td>
                    <td className="p-4 text-[var(--cat-text-muted)]">{item.prioridad_accion_inmediata ?? 0}</td>
                    <td className="p-4 text-[var(--cat-text-muted)]">{item.riesgo_alto_urgente ?? 0}</td>
                    <td className="p-4 text-[var(--cat-text-soft)]">{item.regla_negocio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default async function PlaneacionCompraView({
  searchParams,
  mode = "executive",
}: {
  searchParams?: Promise<{ mes?: string; empresa?: string }>;
  mode?: PlaneacionCompraViewMode;
}) {
  const sp = (await searchParams) || {};
  const comprasResumenParams = new URLSearchParams();
  if (sp?.mes) comprasResumenParams.set("mes", sp.mes);
  if (sp?.empresa) comprasResumenParams.set("empresa", sp.empresa);
  const comprasResumenPath = comprasResumenParams.toString()
    ? `/estadisticas/planeacion-compras-resumen?${comprasResumenParams.toString()}`
    : "/estadisticas/planeacion-compras-resumen";

  const [data, gapData, comprasResumenData, executionQueue] = await Promise.all([
    apiGet<PlaneacionResp>("/estadisticas/planeacion-acciones?limit=400").catch(
      (): PlaneacionResp => ({
        resumen: {},
        compras_por_familia: {},
        bloques: {},
        obsoletos_staffing_asignados: [],
        obsoletos_staffing_activos_resumen: {},
        excluidos_parque_operativo: [],
      })
    ),
    apiGet<GapResp>("/estadisticas/planeacion-gap-compra").catch(
      (): GapResp => ({
        formula: "",
        items: [],
        supuestos: [],
      })
    ),
    apiGet<CompraResumenResp>(comprasResumenPath).catch(
      (): CompraResumenResp => ({
        scope: "Acid Labs",
        scope_note: "Vista enfocada en Acid Labs. Las compras de 2Brains se gestionan en un flujo separado.",
        summary: {},
        executive_reading: {},
        decision_recommended: {},
        formula_breakdown: {},
        projection_risk: {},
        alertas: [],
        scenarios: [],
        forecast: {},
        trend: [],
        month_options: [],
        by_company: [],
        by_provider: [],
        by_model: [],
        detail: [],
        compras_tracking: [],
        compras_tracking_note: null,
        compras_mes: {},
        capex: {},
        may_preview: {},
        ml_risk: { groups: {}, summary: {}, policy_notes: [] },
        pending_notes: [],
      })
    ),
    apiGet<{ rows?: ExecutionQueueOverlayRow[] }>("/ejecucion/queue?limit=1000").catch(
      (): { rows?: ExecutionQueueOverlayRow[] } => ({ rows: [] })
    ),
  ]);

  const resumen = data.resumen ?? {};
  const compras = data.compras_por_familia ?? {};
  const bloques = data.bloques ?? {};
  const obsoletosStaffing = data.obsoletos_staffing_asignados ?? [];
  const obsoletosStaffingResumen = data.obsoletos_staffing_activos_resumen ?? {};
  const excluidosParqueOperativo = data.excluidos_parque_operativo ?? [];
  const gapItems = gapData.items ?? [];
  const compraSummary = comprasResumenData.summary ?? {};
  const executiveReading = comprasResumenData.executive_reading ?? {};
  const decisionRecommended = comprasResumenData.decision_recommended ?? {};
  const formulaBreakdown = comprasResumenData.formula_breakdown ?? {};
  const projectionRisk = comprasResumenData.projection_risk ?? {};
  const executiveAlerts = comprasResumenData.alertas ?? [];
  const scenarios = comprasResumenData.scenarios ?? [];
  const forecastData = comprasResumenData.forecast ?? {};
  const trendRows = comprasResumenData.trend ?? [];
  const monthOptions = comprasResumenData.month_options ?? [];
  const compraCompanyRows = comprasResumenData.by_company ?? [];
  const compraProviderRows = comprasResumenData.by_provider ?? [];
  const compraModelRows = comprasResumenData.by_model ?? [];
  const compraDetailRows = comprasResumenData.detail ?? [];
  const comprasTrackingRows = comprasResumenData.compras_tracking ?? [];
  const comprasTrackingNote = comprasResumenData.compras_tracking_note ?? null;
  const capexData = comprasResumenData.capex ?? {};
  const mayPreview = comprasResumenData.may_preview ?? {};
  const mlRisk = comprasResumenData.ml_risk ?? { groups: {}, summary: {}, policy_notes: [] };
  const pendingNotes = comprasResumenData.pending_notes ?? [];
  const scopeNote = comprasResumenData.scope_note ?? null;
  const corteMes = formatMonthLabel(comprasResumenData.mes);
  const activeMonth = comprasResumenData.mes ?? sp?.mes ?? "";
  const activeEmpresa = sp?.empresa ?? "Acid Labs";
  const isOperativa = mode === "operativa";
  const planningDrilldownRows = buildPlanningDrilldownRows(bloques, executionQueue.rows ?? []);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-panel-strong rounded-3xl p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Módulo
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-text)]">
                Planeación de compra
              </h1>
              <p className="mt-3 max-w-3xl text-lg text-[var(--cat-text-muted)]">
                Consolidación de decisiones operativas para retiro, compra, movimientos internos y regularización.
              </p>
              {scopeNote ? (
                <div className="mt-4 rounded-2xl border border-[color:var(--cat-border)] bg-white/75 p-4 text-sm leading-6 text-[var(--cat-text-muted)]">
                  {emphasizeText(scopeNote)}
                </div>
              ) : null}
            </div>

            <Link
              href="/"
              className="catastro-button-secondary rounded-full px-4 py-2 text-sm"
            >
              Volver al Home
            </Link>
          </div>
        </section>

        <PlaneacionTabs mode={mode} mes={activeMonth} empresa={activeEmpresa} />

        {monthOptions.length ? (
          <section className="mt-8 flex flex-wrap gap-3">
            {monthOptions.map((option) => (
              <Link
                key={option.mes}
                href={buildPlaneacionCompraHref(mode, { mes: option.mes, empresa: activeEmpresa })}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activeMonth === option.mes
                    ? "border-[color:var(--cat-accent)] bg-[rgba(45,86,245,0.10)] text-[var(--cat-text)]"
                    : "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-soft)] hover:text-[var(--cat-text)]"
                }`}
              >
                {option.label}
                {option.es_proyeccion ? " · proyección" : ""}
              </Link>
            ))}
          </section>
        ) : null}

        <div className="mt-8 space-y-8">
          {!isOperativa ? (
            <>
              <ExecutiveReadingSection reading={executiveReading} selectedMonthLabel={corteMes} />

              <ExecutiveAlertsSection alerts={executiveAlerts} />

              <DecisionSection decision={decisionRecommended} formula={formulaBreakdown} />

              <PlanningDrilldownSection
                rows={planningDrilldownRows}
                title="Casos para ejecutar desde Planeación"
                subtitle="Los equipos que más empujan renovación, cobertura o reasignación ya salen listos para saltar a Activos, Excepciones y Ejecución."
              />

              <CapexSection capex={capexData} />

              <ForecastDemandSection forecast={forecastData} />

              <TrackingSummarySection rows={comprasTrackingRows} note={comprasTrackingNote} />

              <MlRiskSummarySection risk={mlRisk} />

              <section className="catastro-panel rounded-[2rem] p-7">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                      Vista operativa
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
                      Detalle técnico separado
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
                      La cobertura operativa, fórmulas largas, cargas manuales y detalle por modelo quedaron en una subvista aparte para que el resumen principal siga siendo ejecutivo.
                    </p>
                  </div>
                  <Link
                    href={buildPlaneacionCompraHref("operativa", { mes: activeMonth, empresa: activeEmpresa })}
                    className="catastro-button-secondary rounded-full px-4 py-2 text-sm"
                  >
                    Ir a vista operativa
                  </Link>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="catastro-panel rounded-[2rem] p-7">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                      Operativa
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
                      Cobertura, compras y detalle técnico
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
                      Esta subvista concentra el detalle operativo de <span className="font-semibold text-[var(--cat-text)]">cobertura</span>, <span className="font-semibold text-[var(--cat-text)]">gap</span>, <span className="font-semibold text-[var(--cat-text)]">tracking completo</span> y trazabilidad manual.
                    </p>
                  </div>
                  <Link
                    href={buildPlaneacionCompraHref("executive", { mes: activeMonth, empresa: activeEmpresa })}
                    className="catastro-button-secondary rounded-full px-4 py-2 text-sm"
                  >
                    Volver a resumen
                  </Link>
                </div>
              </section>

              <PlanningDrilldownSection
                rows={planningDrilldownRows}
                title="Drilldown operativo de Planeación"
                subtitle="Misma señal ejecutiva, pero con entrada directa a la ejecución y a la ficha de cada equipo para no perder continuidad."
              />

              <section className="catastro-panel rounded-[2rem] p-7">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                      Compras del mes
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">
                      {executiveReading.es_proyeccion ? `Proyección ${corteMes} e inicio operativo` : `Compras ${corteMes} y cierre operativo`}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
                      Resumen operativo separando arrastre heredado, <span className="font-semibold text-[var(--cat-text)]">compras nuevas del mes</span> y demanda del período.
                    </p>
                  </div>
                  <div className="text-sm text-[var(--cat-text-soft)]">Corte {corteMes}</div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <KpiCard title="Stock heredado" value={compraSummary.stock_heredado_confirmado ?? 0} subtitle="Confirmado desde el mes anterior" tone="green" />
                  <KpiCard title="Pend. heredados" value={compraSummary.stock_heredado_proyectado ?? 0} subtitle="Aún no ingresan al parque" tone="amber" />
                  <KpiCard title="Nuevas confirmadas" value={compraSummary.compras_nuevas_confirmadas_mes ?? 0} subtitle="Compras nuevas del mes" tone="sky" />
                  <KpiCard title="Nuevas pendientes" value={compraSummary.compras_nuevas_pendientes_mes ?? 0} subtitle="Pendientes abiertas del mes" />
                  <KpiCard title="Demanda del mes" value={compraSummary.demanda_presion_compra_mes ?? 0} subtitle={compraSummary.es_proyeccion ? "Promedio 3M con presión" : "Ingresos MTR que presionan compra"} tone="red" />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard title="Stock disponible conf." value={compraSummary.stock_disponible_confirmado ?? 0} subtitle="Heredado + nuevas confirmadas" tone="green" />
                  <KpiCard title="Stock disponible total" value={compraSummary.stock_disponible_total ?? 0} subtitle="Incluye pendientes heredados y del mes" tone="amber" />
                  <KpiCard title="Cobertura confirmada" value={formatRatio(mayPreview.cobertura_confirmada_ratio)} subtitle={`Balance confirmado: ${formatSigned(mayPreview.balance_confirmado)}`} />
                  <KpiCard title="Cobertura total" value={formatRatio(mayPreview.cobertura_total_ratio)} subtitle={`Balance total: ${formatSigned(mayPreview.balance_total)}`} tone="sky" />
                </div>

                {mayPreview.lectura ? (
                  <div className="mt-6 catastro-panel-soft rounded-3xl p-6 text-sm leading-6 text-[var(--cat-text-muted)]">
                    {emphasizeText(mayPreview.lectura)}
                  </div>
                ) : null}

                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <SummaryTable
                    title="Totales por empresa"
                    subtitle="Compras confirmadas, pendientes e impacto de stock por empresa."
                    headers={["Empresa", "Confirmadas", "Pendientes", "Stock confirmado", "Stock proyectado", "Proveedores"]}
                    rows={compraCompanyRows.map((row) => [
                      row.empresa,
                      row.confirmadas,
                      row.pendientes,
                      row.stock_confirmado,
                      row.stock_proyectado,
                      row.proveedores,
                    ])}
                  />

                  <SummaryTable
                    title="Totales por proveedor"
                    subtitle="Distribución del corte por proveedor y empresas impactadas."
                    headers={["Proveedor", "Confirmadas", "Pendientes", "Stock confirmado", "Stock proyectado", "Empresas"]}
                    rows={compraProviderRows.map((row) => [
                      row.proveedor,
                      row.confirmadas,
                      row.pendientes,
                      row.stock_confirmado,
                      row.stock_proyectado,
                      row.empresas,
                    ])}
                  />
                </div>
              </section>

              <TrackingSection rows={comprasTrackingRows} note={comprasTrackingNote} />

              {gapItems.length ? (
                <section className="space-y-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="catastro-tag inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase">
                        Gap de compra
                      </div>
                      <h2 className="mt-3 text-3xl font-semibold text-[var(--cat-text)]">Cobertura operativa vs. demanda inmediata</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">
                        Este bloque sigue midiendo la tensión de corto plazo entre <span className="font-semibold text-[var(--cat-text)]">demanda reciente</span>,{" "}
                        <span className="font-semibold text-[var(--cat-text)]">oferta inmediata real</span> y{" "}
                        <span className="font-semibold text-[var(--cat-text)]">recuperables</span>.
                      </p>
                    </div>
                    <div className="text-sm text-[var(--cat-text-soft)]">Operación de corto plazo</div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {gapItems.map((item) => (
                      <GapCard key={item.empresa} item={item} plan={getQuotePlan(item.empresa)} />
                    ))}
                  </div>

                  <GapSummaryTable
                    items={gapItems}
                    scopeLabel={gapData.scope_label}
                    scopeNote={gapData.scope_note}
                    formula={gapData.formula}
                    pressureFormula={gapData.pressure_formula}
                    supuestos={gapData.supuestos}
                  />

                  <ProjectionRiskSection risk={projectionRisk} />

                  <ScenariosSection scenarios={scenarios} />
                </section>
              ) : null}

              <MlRiskSection risk={mlRisk} />

              <TrendSection trend={trendRows} />

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <KpiCard title="Retiro / renovación" value={resumen.retiro_renovacion ?? 0} subtitle="Política de salida" tone="red" />
                <KpiCard title="Compra staffing" value={resumen.compra_staffing ?? 0} subtitle="Casos con recambio probable" tone="amber" />
                <KpiCard title="Movimientos core" value={resumen.movimientos_core ?? 0} subtitle="Reutilización interna" tone="sky" />
                <KpiCard title="Asignar / reasignar" value={resumen.asignacion_reasignacion ?? 0} subtitle="Regularización operativa" />
                <KpiCard title="Mantener" value={resumen.mantener ?? 0} subtitle="Operación normal" tone="green" />
              </section>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <KpiCard title="Compra MAC" value={compras.MAC ?? 0} subtitle="Objetivo staffing dev" />
                <KpiCard title="Compra HP" value={compras.HP ?? 0} subtitle="Objetivo staffing Windows" />
                <KpiCard title="Compra otro" value={compras.OTRO ?? 0} subtitle="Revisar política" />
              </section>

              <section className="catastro-panel rounded-3xl p-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Obsoletos Staffing activos</h2>
                    <p className="mt-2 text-[var(--cat-text-muted)]">
                      Sólo considera equipos Staffing actualmente asignados y aún operativos dentro del parque vigente.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <KpiCard
                    title="A2141"
                    value={obsoletosStaffingResumen.A2141 ?? 0}
                    subtitle="Mac A2141 activos/asignados en Staffing"
                    tone="amber"
                  />
                  <KpiCard
                    title="Dell Latitude 7400"
                    value={obsoletosStaffingResumen.DELL_LATITUDE_7400 ?? 0}
                    subtitle="Dell 7400 activos/asignados en Staffing"
                    tone="red"
                  />
                </div>
              </section>

              <SummaryTable
                title="Excluidos del parque operativo por venta/baja"
                subtitle="Equipos que ya no deben contar como activos asignados, disponibles, renovación pendiente ni presión operativa."
                headers={["Modelo", "Cant.", "SKU", "Personas", "Cliente", "Lifecycle", "Evidencia"]}
                rows={excluidosParqueOperativo.map((row) => [
                  row.modelo,
                  row.cantidad,
                  row.skus?.join(", ") ?? "—",
                  row.personas?.join(" | ") ?? "—",
                  row.clientes?.join(" | ") ?? "—",
                  row.clasificacion_operacional ?? "—",
                  row.evidencia_fuente ?? "—",
                ])}
              />

              <SummaryTable
                title="Obsoletos asignados a Staffing"
                subtitle="Cruce operativo de equipos staffing asignados que hoy están en renovar, baja requerida u observación."
                headers={["Modelo", "Cant.", "SKU", "Personas", "Cliente", "Decisión", "Evidencia"]}
                rows={obsoletosStaffing.map((row) => [
                  row.modelo,
                  row.cantidad,
                  row.skus?.join(", ") ?? "—",
                  row.personas?.join(" | ") ?? "—",
                  row.clientes?.join(" | ") ?? "—",
                  row.decision_sugerida ?? row.clasificacion_operacional ?? "—",
                  row.evidencia_fuente ?? row.fuente_clasificacion_operativa ?? "—",
                ])}
              />

              <SectionTable
                title="Retiro y renovación"
                subtitle="Equipos bajo política de salida o recambio."
                items={bloques.retiro_renovacion ?? []}
              />

              <SectionTable
                title="Compra staffing"
                subtitle="Equipos staffing que hoy apuntan a revisión inmediata o recambio."
                items={bloques.compra_staffing ?? []}
              />

              <SectionTable
                title="Movimientos Core"
                subtitle="Equipos evaluables para continuidad o reutilización interna."
                items={bloques.movimientos_core ?? []}
              />

              <SectionTable
                title="Asignación / reasignación"
                subtitle="Equipos con regularización operativa pendiente."
                items={bloques.asignacion_reasignacion ?? []}
              />

              <SummaryTable
                title="Totales por modelo"
                subtitle="Detalle por marca/modelo para seguir mezcla de parque y preparación del siguiente mes."
                headers={["Empresa", "Proveedor", "Modelo", "OS", "Confirmadas", "Pendientes", "Total"]}
                rows={compraModelRows.map((row) => [
                  row.empresa,
                  row.proveedor,
                  `${row.marca} ${row.modelo}`,
                  row.os_familia,
                  row.confirmadas,
                  row.pendientes,
                  row.total,
                ])}
              />

              <SummaryTable
                title="Detalle de cargas manuales"
                subtitle="Filas cargadas para reflejar el corte operativo vigente y los siguientes meses en planeación. Si luego aparecen seriales/SKU en MTR, deberán migrar a stock operativo real."
                headers={["ID", "Empresa", "Proveedor", "Modelo", "Cantidad", "Estado", "Tipo stock"]}
                rows={compraDetailRows.map((row) => [
                  row.id_compra_manual,
                  row.empresa,
                  row.proveedor,
                  `${row.marca} ${row.modelo}`,
                  row.cantidad,
                  row.estado_compra,
                  row.tipo_stock,
                ])}
              />

              {pendingNotes.length ? (
                <div className="space-y-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                  {pendingNotes.map((note) => (
                    <div key={note}>- {emphasizeText(note)}</div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
