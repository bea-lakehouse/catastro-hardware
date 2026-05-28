type Equipo = {
  movimientos_12m: number | null;
  dias_desde_ultimo_evento: number | null;
  dias_desde_compra: number | null;
  eventos_mtr_12m: number | null;
  tipo_equipo?: string | null;
  area?: string | null;
};

type GrupoStats = {
  prom_movimientos_12m: number | null;
  prom_dias_ultimo_evento: number | null;
  prom_dias_desde_compra: number | null;
};

export type MlSignal =
  | { status: "NO_EVALUADO"; badge: "Sin ML"; reason: string; drivers: string[] }
  | {
      status: "OK";
      badge: "ML";
      priority: "BAJA" | "MEDIA" | "ALTA";
      score: number;
      drivers: string[];
      ratios: { r_mov: number; r_idle: number; r_age: number };
    };

function safeNum(v: number | null | undefined, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function safeDen(v: number | null | undefined) {
  const n = safeNum(v, 1);
  return n <= 0 ? 1 : n;
}

export function simulateMlV2(equipo: Equipo, grupo: GrupoStats): MlSignal {
  const movimientos_12m = safeNum(equipo.movimientos_12m, 0);
  const dias_ultimo = safeNum(equipo.dias_desde_ultimo_evento, 0);
  const dias_compra = safeNum(equipo.dias_desde_compra, 0);
  const eventos_mtr_12m = safeNum(equipo.eventos_mtr_12m, 0);

  // 1) Gating: decide si aparece ML
  const cumpleA = eventos_mtr_12m >= 2;
  const cumpleB = dias_compra >= 180 || movimientos_12m >= 2 || dias_ultimo >= 90;

  if (!cumpleA || !cumpleB) {
    const reason = !cumpleA
      ? "Historial insuficiente (pocos eventos MTR)."
      : "No hay señales suficientes para priorización ML.";
    return { status: "NO_EVALUADO", badge: "Sin ML", reason, drivers: [] };
  }

  // 2) Ratios vs grupo (o parque)
  const r_mov = movimientos_12m / safeDen(grupo.prom_movimientos_12m);
  const r_idle = dias_ultimo / safeDen(grupo.prom_dias_ultimo_evento);
  const r_age = dias_compra / safeDen(grupo.prom_dias_desde_compra);

  let score = 0;
  const drivers: string[] = [];

  if (r_mov >= 1.8) {
    score += 2;
    drivers.push("Rotaciones altas vs equipos similares.");
  }
  if (r_idle >= 1.8) {
    score += 2;
    drivers.push("Inactividad mayor al promedio del grupo.");
  }
  if (r_age >= 1.5) {
    score += 1;
    drivers.push("Antigüedad mayor al promedio del grupo.");
  }
  if (movimientos_12m >= 4) {
    score += 1;
    drivers.push("Patrón de cambios concentrado (irregular).");
  }
  if (dias_ultimo >= 180) {
    score += 1;
    drivers.push("Inactividad prolongada (≥ 180 días).");
  }

  const priority: "BAJA" | "MEDIA" | "ALTA" = score >= 4 ? "ALTA" : score >= 2 ? "MEDIA" : "BAJA";

  return {
    status: "OK",
    badge: "ML",
    priority,
    score,
    drivers: drivers.length ? drivers : ["Comportamiento dentro de lo esperado."],
    ratios: { r_mov, r_idle, r_age },
  };
}
