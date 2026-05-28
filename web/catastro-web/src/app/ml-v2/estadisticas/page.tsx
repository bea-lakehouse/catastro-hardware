import EstadisticasClient from "./EstadisticasClient";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend:8000";

function monthStartIso(offset = 0) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

const MESES_RECIENTES = [monthStartIso(-2), monthStartIso(-1), monthStartIso(0)];
const MES_ML_DEFAULT = MESES_RECIENTES[MESES_RECIENTES.length - 1];

async function getMLResumen() {
  try {
    const out = await Promise.all(
      MESES_RECIENTES.map(async (mes) => {
        const r = await fetch(
          `${BACKEND_URL}/estadisticas/ml-score-resumen?mes=${encodeURIComponent(mes)}`,
          { cache: "no-store" }
        );
        if (!r.ok) return null;
        return await r.json();
      })
    );
    return out.filter(Boolean);
  } catch {
    return [];
  }
}

async function getMLRiskSummary() {
  try {
    const r = await fetch(
      `${BACKEND_URL}/estadisticas/ml-risk-summary?mes=${encodeURIComponent(MES_ML_DEFAULT)}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function getMLRiskEquipos() {
  try {
    const r = await fetch(
      `${BACKEND_URL}/estadisticas/ml-risk-equipos?mes=${encodeURIComponent(MES_ML_DEFAULT)}&limit=20`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j?.data) ? j.data : [];
  } catch {
    return [];
  }
}

async function getRows() {
  try {
    const r = await fetch(`${BACKEND_URL}/estadisticas/movimientos-mensuales`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j?.rows) ? j.rows : Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const [rows, mlResumen, mlRiskSummary, mlRiskEquipos] = await Promise.all([
    getRows(),
    getMLResumen(),
    getMLRiskSummary(),
    getMLRiskEquipos(),
  ]);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-6xl">
      <div className="catastro-panel-strong mb-6 rounded-3xl p-6">
        <h1 className="text-2xl font-semibold text-[var(--cat-text)]">📊 Estadísticas</h1>
        <div className="text-sm text-[var(--cat-text-muted)]">
          Paneles mensuales, detalle MTR y observabilidad ML con abril 2026 cerrado y mayo 2026 en curso.
        </div>
      </div>

      <EstadisticasClient
        rows={rows}
        mlResumen={mlResumen}
        mlRiskSummary={mlRiskSummary}
        mlRiskEquipos={mlRiskEquipos}
      />
      </div>
    </main>
  );
}
