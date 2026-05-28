import Link from "next/link";
import MiniTable from "@/components/MiniTable";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";
import { getUiVisualUpdatedAtIso } from "@/lib/ui-version";
import ExpandableMonthlySummaryClient from "./ExpandableMonthlySummaryClient";

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

function getCurrentMonthStartIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "05";
  return `${year}-${month}-01`;
}

function getCurrentMonthEndIso() {
  const [yearRaw, monthRaw] = getCurrentMonthStartIso().split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
}

function getMonthEndIso(monthStartIso: string) {
  const [yearRaw, monthRaw] = monthStartIso.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthStartIso;
  const end = new Date(Date.UTC(year, month, 0));
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
}

function getYearStartIso(monthStartIso: string) {
  return `${monthStartIso.slice(0, 4)}-01-01`;
}

type MovimientoMes = {
  mes: string;
  movimientos_total: number;
  ingresos: number;
  salidas: number;
  ingresos_personas?: number;
  salidas_personas?: number;
  ingresos_mtr_original?: number;
  salidas_mtr_original?: number;
  estado_mes?: "cerrado" | "en_curso";
  fecha_ultima_actualizacion?: string | null;
  fuente?: string | null;
  movimientos_internos?: number;
  movimientos_internos_sin_impacto?: number;
  cambios_equipo_real?: number;
  cambios_equipo_real_base?: number;
  cambios_reemplazos_mtr?: number | null;
  asignaciones?: number;
  ingresos_hardware?: number;
  reasignaciones_hardware?: number;
  equipos_reutilizados?: number;
  equipos_retornados?: number;
  equipos_baja?: number;
  devoluciones_hardware?: number;
  salidas_hardware?: number;
  nuevos_con_equipo?: number;
  nuevos_sin_equipo?: number;
  nacionales_con_equipo_asignado?: number;
  nacionales_pendientes_equipo?: number;
  internacionales_con_equipo_asignado?: number;
  internacionales_sin_equipo_no_requerido?: number;
  personas_resueltas_con_equipo?: number;
  coherencia_operacional_ingresos?: boolean;
  estado_coherencia_operacional?: string;
  presion_compra?: number;
  stock_activo: number;
  stock_disponible?: number;
  gap?: number;
  delta_ingresos_vs_mtr_original?: number;
  delta_salidas_vs_mtr_original?: number;
  conteo_validado_mtr_original?: boolean;
  estado_validacion_mtr_original?: string;
  override_manual_aplicado?: boolean;
  override_scope?: string | null;
  override_note?: string | null;
  pct_movimientos_100: number;
  insight_movimientos: string;
  insight_mtr?: string;
  is_current_month?: boolean;
  acumulado_hasta?: string | null;
};

type RotacionResumen = {
  bucket_rotacion: string;
  total: number;
};

type RotacionSku = {
  id_equipo: string;
  eventos_totales: number;
  ingresos_totales: number;
  salidas_totales: number;
  eventos_12m: number;
  salidas_12m: number;
  personas_distintas_total: number;
  personas_distintas_12m: number;
  indice_rotacion: number;
  bucket_rotacion: string;
  primera_fecha_evento: string;
  ultima_fecha_evento: string;
  dias_desde_ultimo_evento: number;
};

type ClientePct = {
  cliente: string;
  total: number;
  pct: number | string;
};

type PeriodoClientes = {
  date_from: string;
  date_to: string;
};

type ResumenMensualRow = {
  mes: string;
  ingresos: number;
  salidas: number;
  equipos_asignados_historico: number;
  equipos_disponibles_historico: number;
  equipos_por_recuperar_historico: number;
  stock_activo: number;
  equipos_con_issues_jira: number;
  issues_jira_abiertos: number;
  jira_por_recuperar_actual: number;
  disponibles_mtr_actual: number;
  disponibles_equipos_actual: number;
  disponibles_celulares_actual: number;
  disponibles_tablets_actual: number;
};

type OperacionActual = {
  mtr_disponibles_total: number;
  mtr_disponibles_equipos: number;
  mtr_disponibles_celulares: number;
  mtr_disponibles_tablets: number;
  jira_por_recuperar: number;
  jira_equipos_con_issues: number;
  jira_issues_abiertos: number;
  jira_board: Array<{ bucket?: string; issues?: number }>;
  jira_board_index: Record<string, number>;
  delta_disponibles_mtr_vs_jira: number;
  reconciliacion?: {
    equipos_conciliados?: number;
    inconsistencias_mtr_jira?: number;
    jira_sin_match_mtr?: number;
    mtr_sin_match_jira?: number;
    creados_jira_sin_ingreso_mtr?: number;
    reservas_jira_pendientes?: number;
    asignados_sin_respaldo_cruzado?: number;
  };
};

function fmtMes(mes: string) {
  const match = String(mes).match(/^(\d{4})-(\d{2})/);
  if (!match) return mes;
  const monthIndex = Number(match[2]) - 1;
  return `${MONTHS_ES[monthIndex] ?? match[2]} de ${match[1]}`;
}

function fmtPeriodoCorto(desde?: string, hasta?: string) {
  if (!desde || !hasta) return "";
  return `${fmtMes(desde)} a ${fmtMes(hasta)}`;
}

function fmtIsoDate(value?: string | null) {
  if (!value) return "";
  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function getVisibleUpdatedAt(row?: MovimientoMes | null) {
  if (!row) return "";
  if (row.estado_mes === "en_curso") {
    return getUiVisualUpdatedAtIso();
  }
  return row.acumulado_hasta || row.fecha_ultima_actualizacion || "";
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
      <div className="catastro-kpi-value">{value}</div>
      {helper ? <div className="catastro-kpi-helper">{helper}</div> : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="catastro-card-blue-soft rounded-2xl p-5">
      <div className="catastro-kpi-label">{title}</div>
      <div className="mt-3 font-mono text-[clamp(1.65rem,3vw,2.4rem)] font-bold tracking-tight text-[var(--cat-card-text)]">{value}</div>
      {helper ? <div className="mt-2 text-sm text-[var(--cat-card-muted)]">{helper}</div> : null}
    </div>
  );
}

function GroupHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--cat-text)]">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-[var(--cat-text-muted)]">{subtitle}</p> : null}
    </div>
  );
}

export default async function EstadisticasPage() {
  const origin = await getRequestOrigin();
  const currentMonthStart = getCurrentMonthStartIso();
  const currentMonthEnd = getCurrentMonthEndIso();
  const yearStart = getYearStartIso(currentMonthStart);

  async function fetchJson<T>(path: string, fallback: T): Promise<T> {
    try {
      return await apiProxyGet<T>(path, { origin });
    } catch {
      return fallback;
    }
  }

  const data = await fetchJson<{ items?: MovimientoMes[] }>("/estadisticas/movimientos-mes-historico-v2?limit=15", { items: [] });
  const rows: MovimientoMes[] = data.items || [];
  const ultimo = rows[rows.length - 1] || null;
  const distributionDateFrom = ultimo?.mes || currentMonthStart;
  const distributionDateTo =
    ultimo?.estado_mes === "en_curso"
      ? (ultimo.acumulado_hasta || ultimo.fecha_ultima_actualizacion || currentMonthEnd)
      : getMonthEndIso(distributionDateFrom);

  const [pct, rot, resumenMensual] = await Promise.all([
    fetchJson<{ clientes_ingresos?: ClientePct[]; clientes_salidas?: ClientePct[]; periodo_clientes?: PeriodoClientes }>(
      `/estadisticas/estadisticas-porcentajes?date_from=${distributionDateFrom}&date_to=${distributionDateTo}`,
      { clientes_ingresos: [], clientes_salidas: [], periodo_clientes: undefined }
    ),
    fetchJson<{ resumen?: RotacionResumen[]; top?: RotacionSku[] }>("/estadisticas/rotacion-sku?limit=15", { resumen: [], top: [] }),
    fetchJson<{ rows?: ResumenMensualRow[]; operacion_actual?: OperacionActual }>(
      `/estadisticas/resumen-operacion-mensual?date_from=${yearStart}&date_to=${currentMonthStart}`,
      { rows: [], operacion_actual: undefined }
    ),
  ]);
  const resumenRows: ResumenMensualRow[] = resumenMensual.rows || [];
  const operacionActual: OperacionActual | undefined = resumenMensual.operacion_actual;
  const resumenUltimo = resumenRows[resumenRows.length - 1] || null;
  const hasMovimientos = rows.length > 0;

  const clientesIngresos: ClientePct[] = pct.clientes_ingresos || [];
  const clientesSalidas: ClientePct[] = pct.clientes_salidas || [];
  const periodoClientes = fmtPeriodoCorto(pct.periodo_clientes?.date_from, pct.periodo_clientes?.date_to);

  const rotResumen: RotacionResumen[] = rot.resumen || [];
  const rotTop: RotacionSku[] = rot.top || [];
  const stockComputacionalEfectivo =
    operacionActual?.mtr_disponibles_equipos ?? resumenUltimo?.disponibles_equipos_actual ?? null;
  const stockDisponibleTotal =
    operacionActual?.mtr_disponibles_total ?? ultimo?.stock_disponible ?? 0;
  const holguraOperativaRestante =
    stockComputacionalEfectivo != null && ultimo
      ? stockComputacionalEfectivo - Number(ultimo.presion_compra ?? 0)
      : null;

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
                Estadísticas
              </h1>
              <p className="mt-3 max-w-3xl text-lg text-[var(--cat-text-muted)]">
                Lectura analítica del parque, movimientos MTR, distribución y rotación.
              </p>
            </div>

            <Link
              href="/"
              className="catastro-button-secondary rounded-full px-4 py-2 text-sm"
            >
              Volver al Home
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/operacion"
              className="catastro-button-secondary inline-flex rounded-full px-4 py-2 text-sm"
            >
              Ver reconciliación en Operación
            </Link>
            <Link
              href="/ml-v2"
              className="catastro-button-secondary inline-flex rounded-full px-4 py-2 text-sm"
            >
              Ver ML en ML v2
            </Link>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer Estadísticas"
          description="Estadísticas abre el detalle analítico del mes y del año sobre MTR, stock, rotación y contraste operativo sin salir del lenguaje ejecutivo de Catastro."
          items={[
            {
              label: "Fuente dominante",
              value: "MTR mensual + resumen operación mensual",
              hint: "La vista usa movimientos, stock y distribución desde endpoints analíticos que parten del mismo parque operativo visible.",
              tone: "cyan",
            },
            {
              label: "Corte visible",
              value: ultimo ? fmtMes(ultimo.mes) : "Sin movimientos",
              hint: ultimo?.estado_mes === "en_curso"
                ? `Actualizado al ${fmtIsoDate(getVisibleUpdatedAt(ultimo))}`
                : "Cierre mensual consolidado del último mes disponible.",
              tone: "green",
            },
            {
              label: "Cobertura",
              value: `${operationalLabel("parqueVisible")} + distribución + rotación`,
              hint: "Sirve para jefatura y seguimiento táctico; no reemplaza la conciliación detallada de Operación ni el board Jira real.",
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: ultimo?.estado_mes === "en_curso" ? "Mes en curso acumulado" : "Mes cerrado consolidado",
              hint: `${operationalMeaning("parqueVisible")} ${operationalMeaning("boardJiraReal")}`,
              tone: ultimo?.estado_mes === "en_curso" ? "amber" : "green",
            },
          ]}
          badges={[
            { label: operationalLabel("parqueVisible"), tone: "green" },
            { label: "MTR mensual", tone: "cyan" },
            { label: "Rotación", tone: "purple" },
          ]}
          note={`${operationalMeaning("conciliacionMtrJira")} Cuando necesites reconciliación fina, la salida correcta sigue siendo Operación o Activos.`}
        />

        {hasMovimientos ? (
          <>
            {ultimo ? (
              <section className="catastro-panel mt-8 rounded-3xl p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--cat-text)]">KPIs operacionales del mes</h2>
                    <p className="mt-2 text-[var(--cat-text-muted)]">
                      Lectura simple de personas, equipos y stock para seguimiento operativo y jefatura.
                    </p>
                  </div>
                  <div className="text-sm text-[var(--cat-text-soft)]">
                    {ultimo.estado_mes === "en_curso" && getVisibleUpdatedAt(ultimo)
                      ? `Corte visible al ${fmtIsoDate(getVisibleUpdatedAt(ultimo))}`
                      : "Cierre mensual consolidado"}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">
                    {fmtMes(ultimo.mes)}
                  </span>
                  <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">
                    {ultimo.movimientos_total} movimientos
                  </span>
                  <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">
                    {ultimo.ingresos_personas ?? ultimo.ingresos} / {ultimo.salidas_personas ?? ultimo.salidas} ingresos-salidas
                  </span>
                  <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">
                    {ultimo.pct_movimientos_100.toFixed(2)}% del stock
                  </span>
                </div>

                <div className="mt-6 space-y-8">
                  <div>
                    <GroupHeading
                      title="1. Movimiento de personas"
                      subtitle="Entradas y salidas de personas, separadas de los movimientos físicos de equipos."
                    />
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <StatCard
                        title="Ingresos de personas"
                        value={ultimo.ingresos_personas ?? ultimo.ingresos}
                        helper="Personas que ingresaron en el período según MTR."
                      />
                      <StatCard
                        title="Salidas de personas"
                        value={ultimo.salidas_personas ?? ultimo.salidas}
                        helper="Personas que salieron en el período según MTR."
                      />
                      <StatCard
                        title="Nuevos con equipo asignado"
                        value={ultimo.nuevos_con_equipo ?? 0}
                        helper="Ingresos nuevos que ya quedaron cubiertos con computador, nacionales o internacionales."
                      />
                      <StatCard
                        title="Nuevos pendientes de equipo"
                        value={ultimo.nuevos_sin_equipo ?? 0}
                        helper="Sólo casos que efectivamente requieren computador; onboarding internacional remoto sin SKU no infla este número."
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <StatCard
                        title="Nacionales con equipo asignado"
                        value={ultimo.nacionales_con_equipo_asignado ?? 0}
                        helper="Ingresos nuevos en Chile que ya tienen SKU asignado."
                      />
                      <StatCard
                        title="Nacionales pendientes de equipo"
                        value={ultimo.nacionales_pendientes_equipo ?? 0}
                        helper="Ingresos nuevos en Chile que siguen esperando computador."
                      />
                      <StatCard
                        title="Internacionales con equipo asignado"
                        value={ultimo.internacionales_con_equipo_asignado ?? 0}
                        helper="Ingresos nuevos fuera de Chile que sí quedaron con equipo visible."
                      />
                      <StatCard
                        title="Internacionales sin equipo requerido"
                        value={ultimo.internacionales_sin_equipo_no_requerido ?? 0}
                        helper="Onboarding remoto/internacional sin SKU y sin presión real de hardware."
                      />
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/operacion"
                        className="catastro-button-secondary inline-flex rounded-full px-4 py-2 text-sm"
                      >
                        Ver detalle onboarding en Operación
                      </Link>
                    </div>
                  </div>

                  <div>
                    <GroupHeading
                      title="2. Movimiento de equipos"
                      subtitle="Sólo movimientos físicos o reutilizaciones que impactan la operación del parque."
                    />
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <StatCard
                        title="Equipos incorporados"
                        value={ultimo.ingresos_hardware ?? 0}
                        helper="Equipos que entraron al inventario disponible, no necesariamente equipos nuevos comprados."
                      />
                      <StatCard
                        title="Equipos reutilizados"
                        value={ultimo.equipos_reutilizados ?? ultimo.reasignaciones_hardware ?? 0}
                        helper="Equipos recuperados que fueron asignados nuevamente."
                      />
                      <StatCard
                        title="Cambios reales de equipo"
                        value={ultimo.cambios_equipo_real ?? 0}
                        helper="Reemplazos donde una persona efectivamente cambió de computador."
                      />
                      <StatCard
                        title="Equipos retornados"
                        value={ultimo.equipos_retornados ?? ultimo.devoluciones_hardware ?? 0}
                        helper="Equipos devueltos a TI por salida, cambio o reasignación."
                      />
                      <StatCard
                        title="Equipos dados de baja"
                        value={ultimo.equipos_baja ?? 0}
                        helper="Equipos retirados explícitamente del parque operativo."
                      />
                      <StatCard
                        title="Movimientos internos sin impacto de compra"
                        value={ultimo.movimientos_internos_sin_impacto ?? 0}
                        helper="Cambios administrativos o reasignaciones que no generan necesidad de comprar."
                      />
                    </div>
                  </div>

                  <div>
                    <GroupHeading
                      title="3. Stock disponible"
                      subtitle="Vista de oferta actual para operación, separando inventario general del stock computacional efectivo cuando existe ese dato."
                    />
                    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                      {stockComputacionalEfectivo != null ? (
                        <div className="xl:col-span-3">
                          <KpiCard
                            title="Stock computacional efectivo"
                            value={stockComputacionalEfectivo}
                            helper="Equipos computacionales realmente disponibles para asignación inmediata."
                          />
                        </div>
                      ) : null}
                      <StatCard
                        title="Presión compra"
                        value={ultimo.presion_compra ?? 0}
                        helper="Personas que hoy requieren computador y se contrastan contra el stock computacional efectivo."
                      />
                      {holguraOperativaRestante != null ? (
                        <StatCard
                          title="Holgura operativa restante"
                          value={holguraOperativaRestante}
                          helper="Diferencia entre stock computacional efectivo y presión de compra actual."
                        />
                      ) : null}
                      <StatCard
                        title="Stock disponible total"
                        value={stockDisponibleTotal}
                        helper="Incluye inventario general y puede considerar ítems no computacionales."
                      />
                    </div>
                    <p className="mt-3 text-sm text-[var(--cat-text-soft)]">
                      El stock disponible total puede incluir equipos no computacionales si vienen desde el inventario general.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {hasMovimientos ? (
              <section className="catastro-panel mt-8 rounded-3xl p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Movimiento histórico mensual</h2>
                    <p className="mt-2 text-[var(--cat-text-muted)]">
                      Serie histórica con separación explícita entre movimientos de personas y movimientos físicos de hardware.
                    </p>
                  </div>
                  <div className="text-sm text-[var(--cat-text-soft)]">{rows.length} meses visibles</div>
                </div>

                <div className="catastro-table-shell mt-6 overflow-hidden rounded-2xl">
                  <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[13px]">
                    <thead className="catastro-table-head">
                      <tr className="border-b border-[color:var(--cat-border)]">
                        <th className="px-3 py-2">Mes</th>
                        <th className="px-3 py-2">Mov.</th>
                        <th className="px-3 py-2">Ingresos</th>
                        <th className="px-3 py-2">Salidas</th>
                        <th className="px-3 py-2">Presión compra</th>
                        <th className="px-3 py-2">% stock</th>
                        <th className="px-3 py-2">Resumen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? rows.map((r) => (
                        <tr key={r.mes} className="catastro-row align-top">
                          <td className="px-3 py-2 font-medium text-[var(--cat-text)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{fmtMes(r.mes)}</span>
                              {r.estado_mes === "en_curso" ? (
                                <span className={getStatusClassName("info")}>
                                  Mes en curso
                                </span>
                              ) : !r.estado_mes || r.estado_mes === "cerrado" ? (
                                <span className={getStatusClassName("confirmada")}>
                                  Mes cerrado
                                </span>
                              ) : null}
                            </div>
                            {!r.conteo_validado_mtr_original ? (
                              <div className="mt-2 text-[11px] font-medium text-amber-700">
                                Conteo pendiente de conciliación con MTR original.
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-[var(--cat-text)]">{r.movimientos_total}</td>
                          <td className="px-3 py-2 text-green-600">{r.ingresos_personas ?? r.ingresos}</td>
                          <td className="px-3 py-2 text-red-500">{r.salidas_personas ?? r.salidas}</td>
                          <td className="px-3 py-2 text-[var(--cat-text)]">{r.presion_compra ?? 0}</td>
                          <td className="px-3 py-2 text-[var(--cat-text)]">{r.pct_movimientos_100.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-xs text-[var(--cat-text-muted)]">
                            <ExpandableMonthlySummaryClient row={r} compact />
                            {r.estado_mes === "en_curso" && getVisibleUpdatedAt(r) ? (
                              <div className="mt-2 text-[11px] text-[var(--cat-primary)]">
                                Acumulado visible al {fmtIsoDate(getVisibleUpdatedAt(r))}.
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )) : (
                        <tr className="catastro-row">
                          <td className="p-4 text-[var(--cat-text-muted)]" colSpan={7}>
                            No hay movimientos mensuales visibles para el período actual.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="catastro-panel rounded-3xl p-6">
                <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Top clientes ingresos</h2>
                <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
                  Participación sobre ingresos del período {periodoClientes || "visible"}.
                </p>
                <div className="catastro-table-shell mt-5 overflow-hidden rounded-2xl">
                  <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="catastro-table-head">
                      <tr className="border-b border-[color:var(--cat-border)]">
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesIngresos.length ? clientesIngresos.map((r) => (
                        <tr key={`ing-${r.cliente}`} className="catastro-row">
                          <td className="p-3 text-[var(--cat-text)]">{r.cliente}</td>
                          <td className="p-3 text-[var(--cat-text)]">{r.total}</td>
                          <td className="p-3 text-[var(--cat-primary)]">{r.pct}%</td>
                        </tr>
                      )) : (
                        <tr className="catastro-row">
                          <td className="p-4 text-[var(--cat-text-muted)]" colSpan={3}>
                            No hay ingresos visibles para este período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              <div className="catastro-panel rounded-3xl p-6">
                <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Top clientes salidas</h2>
                <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
                  Participación sobre salidas del período {periodoClientes || "visible"}.
                </p>
                <div className="catastro-table-shell mt-5 overflow-hidden rounded-2xl">
                  <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="catastro-table-head">
                      <tr className="border-b border-[color:var(--cat-border)]">
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesSalidas.length ? clientesSalidas.map((r) => (
                        <tr key={`sal-${r.cliente}`} className="catastro-row">
                          <td className="p-3 text-[var(--cat-text)]">{r.cliente}</td>
                          <td className="p-3 text-[var(--cat-text)]">{r.total}</td>
                          <td className="p-3 text-[var(--cat-primary)]">{r.pct}%</td>
                        </tr>
                      )) : (
                        <tr className="catastro-row">
                          <td className="p-4 text-[var(--cat-text-muted)]" colSpan={3}>
                            No hay salidas visibles para este período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </section>

            <section className="catastro-panel mt-8 rounded-3xl p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Rotación por SKU</h2>
                  <p className="mt-2 text-[var(--cat-text-muted)]">
                    Equipos con mayor rotación histórica según eventos deduplicados.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {rotResumen.map((r) => (
                  <div
                    key={r.bucket_rotacion}
                    className="catastro-panel-soft rounded-2xl px-4 py-3 text-sm"
                  >
                    <div className="text-[var(--cat-text-soft)]">{r.bucket_rotacion}</div>
                    <div className="text-xl font-bold text-[var(--cat-text)]">{r.total}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <MiniTable
                  headers={[
                    "SKU",
                    "Índice",
                    "Bucket",
                    "Eventos 12m",
                    "Salidas 12m",
                    "Personas 12m",
                    "Último evento",
                  ]}
                  rows={rotTop.map((r) => [
                    r.id_equipo,
                    r.indice_rotacion,
                    r.bucket_rotacion,
                    r.eventos_12m,
                    r.salidas_12m,
                    r.personas_distintas_12m,
                    r.ultima_fecha_evento,
                  ])}
                />
              </div>
            </section>
          </>
        ) : (
          <section className="catastro-panel mt-8 rounded-3xl p-8 text-[var(--cat-text-muted)]">
            No hay datos disponibles para mostrar estadísticas.
          </section>
        )}
      </div>
    </main>
  );
}
