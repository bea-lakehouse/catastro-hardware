import { NextRequest, NextResponse } from "next/server";

type DashboardRow = {
  fecha_evento?: string;
  persona?: string;
  cliente?: string | null;
  cliente_asignado?: string | null;
  pais?: string | null;
  ciudad?: string | null;
  pais_regla?: string | null;
  location_ingreso?: string | null;
  equipo_asignado_actual?: string | null;
  id_equipo?: string | null;
  modelo_equipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  serial?: string | null;
  plataforma?: string | null;
  mac_win?: string | null;
  condicion?: string | null;
  condicion_equipo?: string | null;
  extranjero?: boolean | null;
  es_nuevo?: boolean | null;
  tipo_ingreso?: "nuevo" | "interno";
  ingreso_con_equipo?: boolean;
  ingreso_presiona_compra?: boolean;
  id_equipo_anterior_persona?: string | null;
  cliente_anterior_persona?: string | null;
  es_cambio_equipo_real?: boolean;
  es_movimiento_interno_persona_cliente?: boolean;
};

type MonthlySummaryRow = {
  mes?: string | null;
  estado_mes?: "cerrado" | "en_curso" | null;
  fecha_ultima_actualizacion?: string | null;
  fecha_ultimo_evento_mtr?: string | null;
  fuente?: string | null;
  total_ingresos?: number | null;
  total_salidas?: number | null;
  movimientos_internos?: number | null;
  cambios_equipo_real?: number | null;
  asignaciones?: number | null;
  ingresos_hardware?: number | null;
  reasignaciones_hardware?: number | null;
  salidas_hardware?: number | null;
  presion_compra?: number | null;
};

type FetchPayload = {
  ok: boolean;
  status: number;
  json: unknown;
};

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://backend:8000";

function chileDateParts(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "2026",
    month: parts.find((part) => part.type === "month")?.value ?? "05",
    day: parts.find((part) => part.type === "day")?.value ?? "25",
  };
}

function todayIso() {
  const { year, month, day } = chileDateParts();
  return `${year}-${month}-${day}`;
}

function currentMonthStart() {
  const { year, month } = chileDateParts();
  return `${year}-${month}-01`;
}

function monthState(mes: string): "cerrado" | "en_curso" {
  return normalizeMes(mes) === currentMonthStart() ? "en_curso" : "cerrado";
}

function currentMonthVisibleUpdate(mes: string, fallback?: string | null): string | null {
  return monthState(mes) === "en_curso" ? todayIso() : fallback ?? null;
}

async function fetchPayload(url: string): Promise<FetchPayload> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const json = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      json,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      json: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function normalizeMes(raw: string | null): string {
  const value = (raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return currentMonthStart();
}

function inferIngresoType(row: DashboardRow): "nuevo" | "interno" {
  if (row.tipo_ingreso === "interno" || row.tipo_ingreso === "nuevo") return row.tipo_ingreso;
  return hasEquipment(row) ? "interno" : "nuevo";
}

function isNewCondition(row: DashboardRow): boolean {
  if (row.es_nuevo != null) return Boolean(row.es_nuevo);
  return /nuevo/i.test(String(row.condicion || row.condicion_equipo || ""));
}

function inferGeo(row: DashboardRow): "chile" | "extranjero" | "sin_dato" {
  const source = `${row.pais_regla || ""} ${row.location_ingreso || ""} ${row.pais || ""} ${row.ciudad || ""}`
    .trim()
    .toLowerCase();
  if (!source) return "sin_dato";
  if (source.includes("chile") || source.includes("nacional") || source.includes("santiago")) return "chile";
  return "extranjero";
}

function inferOs(row: DashboardRow): "MAC" | "WIN" | "UNKNOWN" {
  const source = String(row.mac_win || row.plataforma || "").trim().toUpperCase();
  if (source === "MAC") return "MAC";
  if (source === "WIN" || source === "WINDOWS") return "WIN";
  return "UNKNOWN";
}

function hasEquipment(row: DashboardRow): boolean {
  if (row.ingreso_con_equipo != null) return Boolean(row.ingreso_con_equipo);
  return Boolean(String(row.equipo_asignado_actual || row.id_equipo || "").trim());
}

function normalizeRow(row: DashboardRow, includeIngresoType: boolean): DashboardRow {
  const normalized = {
    ...row,
    cliente_asignado: row.cliente_asignado ?? row.cliente ?? null,
    equipo_asignado_actual: row.equipo_asignado_actual ?? row.id_equipo ?? null,
    modelo_equipo:
      row.modelo_equipo ??
      ([row.marca, row.modelo].map((value) => String(value || "").trim()).filter(Boolean).join(" ") || null),
    plataforma: row.plataforma ?? row.mac_win ?? null,
  };

  if (!includeIngresoType) return normalized;

  const tipoIngreso = inferIngresoType(normalized);
  return {
    ...normalized,
    tipo_ingreso: tipoIngreso,
    ingreso_presiona_compra:
      normalized.ingreso_presiona_compra != null
        ? Boolean(normalized.ingreso_presiona_compra)
        : !hasEquipment(normalized),
  };
}

function topClientMix(rows: DashboardRow[]): string | null {
  if (!rows.length) return null;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.cliente_asignado || row.cliente || "Sin cliente").trim() || "Sin cliente";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([cliente, total]) => `${cliente} · ${total}`)
    .join(" | ");
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function latestDate(values: Array<string | null | undefined>): string | null {
  const sorted = values
    .map((value) => String(value || "").slice(0, 10))
    .filter(Boolean)
    .sort();
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function buildResumen(
  mes: string,
  ingresos: DashboardRow[],
  salidas: DashboardRow[],
  coreRows: DashboardRow[],
  cambiosCount: number,
  monthlySummary?: MonthlySummaryRow | null,
) {
  const ingresosChile = ingresos.filter((row) => inferGeo(row) === "chile").length;
  const ingresosExtranjero = ingresos.filter((row) => inferGeo(row) === "extranjero").length;
  const salidasChile = salidas.filter((row) => inferGeo(row) === "chile").length;
  const salidasExtranjero = salidas.filter((row) => inferGeo(row) === "extranjero").length;
  const ingresosConEquipo = ingresos.filter(hasEquipment).length;
  const ingresosSinEquipo = ingresos.length - ingresosConEquipo;
  const salidasConEquipo = salidas.filter(hasEquipment).length;
  const salidasSinEquipo = salidas.length - salidasConEquipo;
  const ingresosMac = ingresos.filter((row) => inferOs(row) === "MAC").length;
  const ingresosWin = ingresos.filter((row) => inferOs(row) === "WIN").length;
  const salidasMac = salidas.filter((row) => inferOs(row) === "MAC").length;
  const salidasWin = salidas.filter((row) => inferOs(row) === "WIN").length;
  const ingresosNuevo = ingresos.filter(isNewCondition).length;
  const ingresosUsado = ingresos.length - ingresosNuevo;
  const salidasNuevo = salidas.filter(isNewCondition).length;
  const salidasUsado = salidas.length - salidasNuevo;
  const ingresosInternos = ingresos.filter((row) => row.tipo_ingreso === "interno").length;
  const ingresosNuevos = ingresos.filter((row) => row.tipo_ingreso !== "interno").length;
  const ingresosNuevosConEquipo = ingresos.filter(
    (row) => row.tipo_ingreso !== "interno" && hasEquipment(row),
  ).length;
  const ingresosNuevosSinEquipo = ingresosNuevos - ingresosNuevosConEquipo;
  const ingresosPresionCompra = ingresos.filter((row) => row.ingreso_presiona_compra !== false).length;

  return {
    mes,
    estado_mes: monthlySummary?.estado_mes ?? monthState(mes),
    fecha_ultima_actualizacion: currentMonthVisibleUpdate(
      mes,
      monthlySummary?.fecha_ultima_actualizacion ??
        latestDate([...ingresos.map((row) => row.fecha_evento), ...salidas.map((row) => row.fecha_evento)]),
    ),
    fuente: monthlySummary?.fuente ?? "backend/estadisticas/mtr-detalle-mes + core-extranjeros-mes + cambios-equipo-mes",
    ingresos_total: Number(monthlySummary?.total_ingresos ?? ingresos.length),
    ingresos_chile: ingresosChile,
    ingresos_extranjero: ingresosExtranjero,
    ingresos_con_equipo: ingresosConEquipo,
    ingresos_sin_equipo: ingresosSinEquipo,
    ingresos_mac: ingresosMac,
    ingresos_win: ingresosWin,
    ingresos_nuevo: ingresosNuevo,
    ingresos_usado: ingresosUsado,
    ingresos_internos: ingresosInternos,
    ingresos_nuevos_total: ingresosNuevos,
    ingresos_nuevos_con_equipo: ingresosNuevosConEquipo,
    ingresos_nuevos_sin_equipo: ingresosNuevosSinEquipo,
    ingresos_presion_compra: ingresosPresionCompra,
    pct_ingresos_chile: pct(ingresosChile, ingresos.length),
    pct_ingresos_extranjero: pct(ingresosExtranjero, ingresos.length),
    pct_ingresos_nuevo: pct(ingresosNuevo, ingresos.length),
    pct_ingresos_usado: pct(ingresosUsado, ingresos.length),
    salidas_total: Number(monthlySummary?.total_salidas ?? salidas.length),
    salidas_chile: salidasChile,
    salidas_extranjero: salidasExtranjero,
    salidas_con_equipo: salidasConEquipo,
    salidas_sin_equipo: salidasSinEquipo,
    salidas_mac: salidasMac,
    salidas_win: salidasWin,
    salidas_nuevo: salidasNuevo,
    salidas_usado: salidasUsado,
    pct_salidas_chile: pct(salidasChile, salidas.length),
    pct_salidas_extranjero: pct(salidasExtranjero, salidas.length),
    pct_salidas_nuevo: pct(salidasNuevo, salidas.length),
    pct_salidas_usado: pct(salidasUsado, salidas.length),
    movimientos_core_extranjeros: coreRows.length,
    core_ext_mac: coreRows.filter((row) => inferOs(row) === "MAC").length,
    core_ext_win: coreRows.filter((row) => inferOs(row) === "WIN").length,
    core_ext_nuevo: coreRows.filter(isNewCondition).length,
    core_ext_usado: coreRows.filter((row) => !isNewCondition(row)).length,
    movimientos_internos: Number(monthlySummary?.movimientos_internos ?? 0),
    asignaciones: Number(monthlySummary?.asignaciones ?? 0),
    ingresos_hardware: Number(monthlySummary?.ingresos_hardware ?? 0),
    reasignaciones_hardware: Number(monthlySummary?.reasignaciones_hardware ?? 0),
    salidas_hardware: Number(monthlySummary?.salidas_hardware ?? 0),
    cambios_equipo_mes: Number(monthlySummary?.cambios_equipo_real ?? cambiosCount),
    presion_compra: Number(monthlySummary?.presion_compra ?? ingresosPresionCompra),
    mix_clientes_salidas: topClientMix(salidas),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mes = normalizeMes(searchParams.get("mes"));
    const limit = (searchParams.get("limit") || "500").trim();

    const base = `${BACKEND_URL}/estadisticas`;
    const detailParams = new URLSearchParams({ mes, limit });
    const coreParams = new URLSearchParams({ mes, limit });

    const [ingresosPayload, salidasPayload, corePayload, cambiosPayload, monthlyPayload] = await Promise.all([
      fetchPayload(`${base}/mtr-detalle-mes?${new URLSearchParams({ ...Object.fromEntries(detailParams), tipo: "ingresos" })}`),
      fetchPayload(`${base}/mtr-detalle-mes?${new URLSearchParams({ ...Object.fromEntries(detailParams), tipo: "salidas" })}`),
      fetchPayload(`${base}/core-extranjeros-mes?${coreParams}`),
      fetchPayload(`${base}/cambios-equipo-mes?${coreParams}`),
      fetchPayload(`${base}/movimientos-mensuales`),
    ]);

    const ingresosRows = Array.isArray((ingresosPayload.json as { data?: unknown[] } | null)?.data)
      ? ((ingresosPayload.json as { data: DashboardRow[] }).data || []).map((row) => normalizeRow(row, true))
      : [];
    const salidasRows = Array.isArray((salidasPayload.json as { data?: unknown[] } | null)?.data)
      ? ((salidasPayload.json as { data: DashboardRow[] }).data || []).map((row) => normalizeRow(row, false))
      : [];
    const coreRows = Array.isArray((corePayload.json as { rows?: unknown[] } | null)?.rows)
      ? ((corePayload.json as { rows: DashboardRow[] }).rows || []).map((row) => normalizeRow(row, false))
      : [];
    const cambiosRows = Array.isArray((cambiosPayload.json as { rows?: unknown[] } | null)?.rows)
      ? ((cambiosPayload.json as { rows: unknown[] }).rows || [])
      : [];
    const monthlyRows = Array.isArray((monthlyPayload.json as { rows?: unknown[] } | null)?.rows)
      ? ((monthlyPayload.json as { rows: MonthlySummaryRow[] }).rows || [])
      : [];
    const monthlySummary =
      monthlyRows.find((row) => normalizeMes(String(row?.mes || "")) === mes) ?? null;

    if (!ingresosPayload.ok && !salidasPayload.ok) {
      return NextResponse.json(
        {
          error: "No fue posible cargar el detalle MTR desde backend",
          statuses: {
            ingresos: ingresosPayload.status,
            salidas: salidasPayload.status,
          },
        },
        { status: 502 },
      );
    }

    const ingresosMetaDate = (ingresosPayload.json as { fecha_ultima_actualizacion?: string } | null)?.fecha_ultima_actualizacion;
    const salidasMetaDate = (salidasPayload.json as { fecha_ultima_actualizacion?: string } | null)?.fecha_ultima_actualizacion;

    return NextResponse.json({
      mes,
      estado_mes: monthlySummary?.estado_mes ?? monthState(mes),
      fecha_ultima_actualizacion: currentMonthVisibleUpdate(
        mes,
        monthlySummary?.fecha_ultima_actualizacion ??
          latestDate([ingresosMetaDate ? String(ingresosMetaDate) : null, salidasMetaDate ? String(salidasMetaDate) : null]),
      ),
      fuente: monthlySummary?.fuente ?? "backend/estadisticas/mtr-detalle-mes + core-extranjeros-mes + cambios-equipo-mes",
      resumen: buildResumen(mes, ingresosRows, salidasRows, coreRows, cambiosRows.length, monthlySummary),
      ingresos: ingresosRows,
      salidas: salidasRows,
      core_extranjeros: coreRows,
      cambios: cambiosRows,
      warnings: {
        ingresos: ingresosPayload.ok ? null : ingresosPayload.json,
        salidas: salidasPayload.ok ? null : salidasPayload.json,
        core_extranjeros: corePayload.ok ? null : corePayload.json,
        cambios: cambiosPayload.ok ? null : cambiosPayload.json,
        resumen_mensual: monthlyPayload.ok ? null : monthlyPayload.json,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "mtr-dashboard route failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
