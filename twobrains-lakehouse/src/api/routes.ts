// ============================================================
// src/api/routes.ts
// API endpoint specifications for twobrains-lakehouse.
// These handlers are called from Next.js route files or
// any HTTP framework adapter (Express, Fastify, etc.)
// ============================================================

import { getDb, DB_ENABLED } from '../utils/db';
import { ingestExcel } from '../ingest/excel';
import { runSilverTransform } from '../pipeline/silver';
import type {
  GovernanceSummaryRow, QualityKpiRow, ForecastRow,
  FinancialSummaryRow, AssetRiskRow,
} from '../types';

// ── Response envelope ─────────────────────────────────────────
export function ok<T>(data: T) {
  return { ok: true, data, timestamp: new Date().toISOString() };
}

export function err(message: string, status = 500) {
  return { ok: false, error: message, status, timestamp: new Date().toISOString() };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/ingest
// Body: FormData { file: xlsx binary, loaded_by?: string }
// ─────────────────────────────────────────────────────────────
export async function handleIngest(
  fileBuffer: Buffer,
  sourceFileName: string,
  loadedBy?: string
) {
  if (!DB_ENABLED) {
    return err('DB not enabled. Set USE_DB=true and configure Supabase credentials.', 503);
  }

  // 1. Bronze ingest
  const ingestResult = await ingestExcel(fileBuffer, sourceFileName, loadedBy);

  // 2. Silver transformation
  const silverResult = await runSilverTransform(ingestResult.batchId);

  // 3. Gold refresh (via SQL function)
  const db = getDb();
  const { error: goldErr } = await db.rpc('gold.refresh_all', {
    p_snapshot_date: new Date().toISOString().slice(0, 10),
  });
  if (goldErr) console.warn('[API] Gold refresh warning:', goldErr.message);

  return ok({ ingest: ingestResult, silver: silverResult });
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/pipeline/status
// ─────────────────────────────────────────────────────────────
export async function handlePipelineStatus() {
  if (!DB_ENABLED) return ok({ status: 'mock', message: 'USE_DB=false' });

  const db = getDb();
  const { data, error } = await db
    .from('ops.pipeline_status')
    .select('*');

  if (error) return err(error.message);
  return ok(data ?? []);
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/snapshot
// Body: { snapshot_kind?: 'monthly' | 'manual' | 'incident' | 'annual' }
// ─────────────────────────────────────────────────────────────
export async function handleSnapshot(
  snapshotKind: 'monthly' | 'manual' | 'incident' | 'annual' = 'manual'
) {
  if (!DB_ENABLED) return err('DB not enabled.', 503);

  const db   = getDb();
  const date = new Date().toISOString().slice(0, 10);

  // Read current dim_asset and write snapshot
  const { data: assets, error: assetErr } = await db
    .from('silver.dim_asset')
    .select('*');

  if (assetErr) return err(assetErr.message);
  if (!assets?.length) return err('No assets found in Silver.', 404);

  const rows = assets.map(a => ({
    snapshot_date:     date,
    snapshot_kind:     snapshotKind,
    serial:            a.serial,
    estado:            a.estado,
    condicion:         a.condicion,
    cliente:           a.cliente,
    marca:             a.marca,
    modelo:            a.modelo,
    anio_fabricacion:  a.anio_fabricacion,
    ram:               a.ram,
    disco:             a.disco,
    empleado:          a.empleado,
    ciudad:            a.ciudad,
    fuente:            a.fuente_hoja,
    valor_depreciado:  a.valor_dep_usd,
    precio_nuevo:      a.precio_nuevo_usd,
    costo_renovacion:  a.costo_renovacion_usd,
    score_renovacion:  a.score_renovacion,
    calidad_dato:      a.calidad_dato,
    risk_score:        a.risk_score,
    risk_nivel:        a.risk_nivel,
    es_simulado:       false,
  }));

  const { error: snapErr } = await db
    .from('silver.fact_asset_snapshot')
    .upsert(rows, { onConflict: 'snapshot_date,serial' });

  if (snapErr) return err(snapErr.message);

  return ok({
    snapshotDate: date,
    snapshotKind,
    recordsCreated: rows.length,
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/gold/governance
// ─────────────────────────────────────────────────────────────
export async function handleGoldGovernance() {
  if (!DB_ENABLED) return ok(MOCK_GOVERNANCE);

  const db = getDb();
  const { data, error } = await db
    .from('gold.governance_summary')
    .select('*')
    .maybeSingle();

  if (error) return err(error.message);
  return ok(data as GovernanceSummaryRow);
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/gold/quality
// ─────────────────────────────────────────────────────────────
export async function handleGoldQuality() {
  if (!DB_ENABLED) return ok(MOCK_QUALITY);

  const db = getDb();
  const [kpisRes, gapsRes, movQualRes] = await Promise.all([
    db.from('gold.quality_kpis').select('*'),
    db.from('gold.movements_quality').select('*'),
    db.from('gold.park_quality').select('*'),
  ]);

  for (const r of [kpisRes, gapsRes, movQualRes]) {
    if (r.error) return err(r.error.message);
  }

  return ok({
    kpis:           kpisRes.data  as QualityKpiRow[],
    gapsBySource:   gapsRes.data,
    parkQuality:    movQualRes.data,
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/gold/forecast
// ─────────────────────────────────────────────────────────────
export async function handleGoldForecast() {
  if (!DB_ENABLED) return ok(MOCK_FORECAST);

  const db = getDb();
  const [forecastRes, finRes, riskRes] = await Promise.all([
    db.from('gold.forecast').select('*'),
    db.from('gold.financial_summary').select('*'),
    db.from('gold.asset_risk').select('*').order('risk_score_v2', { ascending: false }).limit(20),
  ]);

  for (const r of [forecastRes, finRes, riskRes]) {
    if (r.error) return err(r.error.message);
  }

  return ok({
    forecast:         forecastRes.data as ForecastRow[],
    financialSummary: finRes.data      as FinancialSummaryRow[],
    topRisk:          riskRes.data     as AssetRiskRow[],
  });
}

// ── Mock payloads for USE_DB=false ────────────────────────────
const MOCK_GOVERNANCE = {
  snapshot_date: '2026-06-17', quality_score: 61.4, quality_score_real: 68.2,
  dg_score: 49.1, dg_level: 2, dg_level_label: 'Controlado',
  total_movements: 139, real_movements: 72, inferred_movements: 67,
  records_to_fix: 68,
  main_gap: 'gestor_it_responsable (15.8% completitud)',
  secondary_gap: 'riesgo_percibido_it (0% — bloquea ML Dic 2026)',
};

const MOCK_QUALITY = {
  kpis: [
    { field_name: 'serial',             field_label: 'Serial equipo',       pct_complete: 79.1, count_ok: 110, count_total: 139, semaphore: 'yellow', is_strategic: false },
    { field_name: 'fecha',              field_label: 'Fecha movimiento',    pct_complete: 66.9, count_ok:  93, count_total: 139, semaphore: 'orange', is_strategic: false },
    { field_name: 'cliente',            field_label: 'Cliente / Proyecto',  pct_complete: 53.2, count_ok:  74, count_total: 139, semaphore: 'orange', is_strategic: false },
    { field_name: 'empleado',           field_label: 'Empleado',            pct_complete: 87.8, count_ok: 122, count_total: 139, semaphore: 'yellow', is_strategic: false },
    { field_name: 'gestor',             field_label: 'Gestor IT',           pct_complete: 15.8, count_ok:  22, count_total: 139, semaphore: 'red',    is_strategic: false },
    { field_name: 'riesgo_percibido_it',field_label: 'Riesgo percibido IT', pct_complete:  0.0, count_ok:   0, count_total: 139, semaphore: 'red',    is_strategic: true  },
  ],
  gapsBySource: [],
  parkQuality:  [],
};

const MOCK_FORECAST = {
  forecast:         [],
  financialSummary: [
    { dimension: 'total', breakdown_value: 'all', asset_count: 90,
      valor_nuevo_usd: 162800, valor_dep_usd: 55920, dep_acumulada_usd: 106880,
      pct_depreciado_avg: 65.7, costo_renovacion_usd: 77190 },
  ],
  topRisk: [],
};
