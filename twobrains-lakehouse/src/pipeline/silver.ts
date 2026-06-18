// ============================================================
// src/pipeline/silver.ts
// Silver transformation: Bronze raw rows → dim_asset + fact_movements
// Called after every successful Bronze ingest.
// ============================================================

import { getDb } from '../utils/db';
import {
  normalizeSerial, normalizeCpu, cpuGen,
  normalizeEstado, normalizeCondicion, normalizeClient,
  normalizeDate, calcQualityScore, calcRiskScore,
  riskNivel, calcRenovationScore, cpuPrecioNuevo, calcValorDep,
} from '../utils/normalize';
import type { SilverTransformResult, RawExcelRow } from '../types';

// ─── Sheet → handler mapping ──────────────────────────────────
const SHEET_HANDLERS: Record<string, (rows: RawExcelRow[], batchId: string) => Promise<void>> = {
  'Equipos Asignados':              transformEquiposAsignados,
  'Equipos disponibles':            transformEquiposDisponibles,
  'Equ. Por RecuperarDefectuosoObs':transformPorRecuperar,
  'Compras 2026':                   transformCompras,
  'Ingresos - Equipos Asignado - 2':transformIngresos,
  'Salidas':                        transformSalidas,
};

// ─── Main entry point ─────────────────────────────────────────
export async function runSilverTransform(batchId: string): Promise<SilverTransformResult> {
  const db = getDb();
  const startMs = Date.now();
  const result: SilverTransformResult = {
    batchId, assetsUpserted: 0, movementsInserted: 0,
    clientsCreated: 0, employeesCreated: 0, errorsCount: 0, durationMs: 0,
  };

  // Fetch all raw rows for this batch
  const { data: rawRows, error } = await db
    .from('bronze.raw_excel_rows')
    .select('*')
    .eq('batch_id', batchId)
    .eq('is_header_row', false);

  if (error) throw new Error(`Silver: failed to load Bronze rows — ${error.message}`);
  if (!rawRows?.length) return { ...result, durationMs: Date.now() - startMs };

  // Group by sheet
  const bySheet = new Map<string, RawExcelRow[]>();
  for (const row of rawRows) {
    const key = row.source_sheet;
    if (!bySheet.has(key)) bySheet.set(key, []);
    bySheet.get(key)!.push(row);
  }

  // Process each sheet
  for (const [sheet, rows] of bySheet.entries()) {
    const handler = SHEET_HANDLERS[sheet];
    if (!handler) {
      console.warn(`[Silver] No handler for sheet: ${sheet}`);
      continue;
    }
    try {
      await handler(rows, batchId);
    } catch (err) {
      console.error(`[Silver] Error processing ${sheet}:`, err);
      result.errorsCount++;
    }
  }

  // Re-compute totals
  const [assetCount, movCount] = await Promise.all([
    db.from('silver.dim_asset').select('serial', { count: 'exact', head: true }),
    db.from('silver.fact_movements').select('movement_id', { count: 'exact', head: true }),
  ]);

  result.assetsUpserted     = assetCount.count ?? 0;
  result.movementsInserted  = movCount.count ?? 0;
  result.durationMs         = Date.now() - startMs;
  return result;
}

// ─── getOrCreateClient ────────────────────────────────────────
async function getOrCreateClient(
  db: ReturnType<typeof getDb>, clientName: string | null
): Promise<number | null> {
  if (!clientName) return null;
  const canonical = normalizeClient(clientName);
  if (!canonical) return null;

  const { data } = await db
    .from('silver.dim_client')
    .select('client_id')
    .eq('name', canonical)
    .maybeSingle();
  if (data) return data.client_id;

  const { data: created, error } = await db
    .from('silver.dim_client')
    .insert({ name: canonical, name_aliases: [clientName] })
    .select('client_id')
    .single();
  if (error) { console.warn(`[Silver] Failed to create client ${canonical}:`, error.message); return null; }
  return created.client_id;
}

// ─── getOrCreateEmployee ──────────────────────────────────────
async function getOrCreateEmployee(
  db: ReturnType<typeof getDb>, fullName: string | null, clientId: number | null
): Promise<number | null> {
  if (!fullName?.trim()) return null;

  const { data } = await db
    .from('silver.dim_employee')
    .select('employee_id')
    .eq('full_name', fullName.trim())
    .maybeSingle();
  if (data) return data.employee_id;

  const { data: created, error } = await db
    .from('silver.dim_employee')
    .insert({ full_name: fullName.trim(), client_id: clientId })
    .select('employee_id')
    .single();
  if (error) { console.warn(`[Silver] Failed to create employee:`, error.message); return null; }
  return created.employee_id;
}

// ─── upsertAsset ─────────────────────────────────────────────
async function upsertAsset(
  db: ReturnType<typeof getDb>,
  data: Record<string, unknown>,
  batchId: string
): Promise<void> {
  const serial = normalizeSerial(data['Nro Serie'] as string ?? data['serial'] as string);
  if (!serial) return;

  const cpu     = normalizeCpu(data['CPU'] as string ?? data['cpu'] as string);
  const anio    = parseYear(data['Año'] as string ?? data['año'] as string);
  const estado  = normalizeEstado(data['Estado'] as string ?? data['estado'] as string);
  const condicion = normalizeCondicion(data['Condición'] as string ?? data['condicion'] as string);
  const precio  = cpuPrecioNuevo(cpu);
  const valDep  = calcValorDep(precio, anio, condicion);
  const dep     = precio - valDep;
  const riskSc  = calcRiskScore({ anio, estado, cpu });
  const riskNv  = riskNivel(riskSc);
  const renSc   = calcRenovationScore({ anio });
  const cand    = renSc >= 50 || estado === 'Defectuoso' || estado === 'De Baja';

  const clienteName = normalizeClient(data['Cliente'] as string ?? null);
  const clientId    = await getOrCreateClient(db, clienteName);
  const empName     = (data['Nombres y Apellidos'] as string) ?? (data['empleado'] as string) ?? null;
  const employeeId  = await getOrCreateEmployee(db, empName, clientId);

  const qualityScore = calcQualityScore({
    serial, marca: data['Marca'] as string, modelo: data['Modelo'] as string,
    anio, cpu, ram: data['Ram'] as string ?? data['ram'] as string,
    disco: data['Disco'] as string, condicion: condicion ?? undefined, estado: estado ?? undefined,
  });

  await db.from('silver.dim_asset').upsert({
    serial,
    tipo:        (data['Tipo'] as string) ?? 'Ordenador',
    marca:       (data['Marca'] as string) ?? null,
    modelo:      (data['Modelo'] as string) ?? null,
    anio_fabricacion: anio,
    cpu, cpu_gen: cpuGen(cpu),
    ram:         (data['Ram'] as string ?? data['ram'] as string) ?? null,
    disco:       (data['Disco'] as string) ?? null,
    estado, condicion,
    client_id:   clientId, cliente: clienteName,
    employee_id: employeeId, empleado: empName?.trim() ?? null,
    fecha_compra:     normalizeDate(data['Fecha de Compra'] as string ?? null),
    fecha_asignacion: normalizeDate(data['Fecha de ingreso'] as string ?? null),
    precio_nuevo_usd: precio,
    valor_dep_usd:    valDep,
    dep_acumulada_usd: dep,
    pct_depreciado:   anio ? Math.min(100, Math.round(((new Date().getFullYear() - anio) / 5) * 100)) : null,
    costo_renovacion_usd: cand ? precio - valDep + 200 : 0,
    risk_score: riskSc, risk_nivel: riskNv,
    score_renovacion: renSc, candidato_renovacion: cand,
    calidad_dato: qualityScore, es_duplicado: false,
    fuente_hoja: data['_source_sheet'] as string ?? null,
    batch_id: batchId,
  }, { onConflict: 'serial' });
}

// ─── Sheet handlers ───────────────────────────────────────────
async function transformEquiposAsignados(rows: RawExcelRow[], batchId: string) {
  const db = getDb();
  for (const row of rows) {
    await upsertAsset(db, row.raw_data, batchId).catch(e =>
      console.warn('[Silver] EquiposAsignados row error:', e.message));
  }
}

async function transformEquiposDisponibles(rows: RawExcelRow[], batchId: string) {
  const db = getDb();
  for (const row of rows) {
    await upsertAsset(db, { ...row.raw_data, Estado: 'Disponible' }, batchId).catch(e =>
      console.warn('[Silver] EquiposDisponibles row error:', e.message));
  }
}

async function transformPorRecuperar(rows: RawExcelRow[], batchId: string) {
  const db = getDb();
  for (const row of rows) {
    await upsertAsset(db, { ...row.raw_data, Estado: row.raw_data['Defectuoso'] ? 'Defectuoso' : 'Por Recuperar' }, batchId)
      .catch(e => console.warn('[Silver] PorRecuperar row error:', e.message));
  }
}

async function transformCompras(rows: RawExcelRow[], batchId: string) {
  const db = getDb();
  for (const row of rows) {
    const d = row.raw_data;
    await upsertAsset(db, {
      ...d,
      Estado: 'Stock / Nuevo',
      Condición: 'Nuevo',
    }, batchId).catch(e => console.warn('[Silver] Compras row error:', e.message));
  }
}

async function transformIngresos(rows: RawExcelRow[], batchId: string) {
  const db = getDb();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const d   = row.raw_data;
    const serial  = normalizeSerial(d['Nro Serie'] as string ?? null);
    const tipo    = 'ingreso';
    const fecha   = normalizeDate(d['Fecha de ingreso'] as string ?? null);
    const emp     = (d['Nombres y Apellidos'] as string)?.trim() ?? null;
    const cli     = normalizeClient(d['Cliente'] as string ?? null);
    const clientId = await getOrCreateClient(db, cli);
    const empId    = await getOrCreateEmployee(db, emp, clientId);

    const mid = `ingreso_${i}_${serial ?? 'noser'}_${fecha ?? 'nodate'}`.slice(0, 50);

    const { error: _ingrErr } = await db.from('silver.fact_movements').upsert({
      movement_id:    mid,
      tipo_movimiento: tipo,
      estado_resultante: 'Asignado',
      fecha, tiene_fecha: fecha !== null,
      empleado: emp, employee_id: empId, gestionado_por: d['Gestionado'] as string ?? null,
      serial, tiene_serial: serial !== null,
      modelo_raw: d['Modelo'] as string ?? null,
      cliente: cli, client_id: clientId,
      fuente_hoja: 'Ingresos', es_inferido: false,
      batch_id: batchId,
    }, { onConflict: 'movement_id' });
    if (_ingrErr) console.warn('[Silver] Ingreso movement error:', _ingrErr.message);
  }
}

async function transformSalidas(rows: RawExcelRow[], batchId: string) {
  const db = getDb();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const d   = row.raw_data;
    const serial = normalizeSerial(d['Nro Serie'] as string ?? null);
    const fecha  = normalizeDate(d['Fecha de Salida'] as string ?? null);
    const emp    = (d['Nombres y Apellidos'] as string)?.trim() ?? null;
    const cli    = normalizeClient(d['Cliente'] as string ?? null);
    const clientId = await getOrCreateClient(db, cli);
    const empId    = await getOrCreateEmployee(db, emp, clientId);

    const mid = `salida_${i}_${serial ?? 'noser'}_${fecha ?? 'nodate'}`.slice(0, 50);

    const { error: _salErr } = await db.from('silver.fact_movements').upsert({
      movement_id: mid, tipo_movimiento: 'salida',
      estado_resultante: 'Disponible',
      fecha, tiene_fecha: fecha !== null,
      empleado: emp, employee_id: empId, gestionado_por: d['Gestionado'] as string ?? null,
      serial, tiene_serial: serial !== null,
      modelo_raw: d['Modelo'] as string ?? null,
      cliente: cli, client_id: clientId,
      fuente_hoja: 'Salidas', es_inferido: false,
      batch_id: batchId,
    }, { onConflict: 'movement_id' });
    if (_salErr) console.warn('[Silver] Salida movement error:', _salErr.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/nan|none/i.test(s)) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  const y = Math.round(n);
  return y >= 2010 && y <= 2030 ? y : null;
}
