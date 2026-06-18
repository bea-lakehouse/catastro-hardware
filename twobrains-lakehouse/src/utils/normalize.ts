// ============================================================
// src/utils/normalize.ts
// TypeScript mirrors of the SQL normalisation functions
// defined in 003_silver_tables.sql.
// Used by the ingest pipeline before writing to Silver.
// ============================================================

import type { AssetStatus, AssetCondition, RiskLevel } from '../types';

const CLIENT_MAP: Record<string, string> = {
  'banco de chile': 'Banco de Chile',
  bancochile:       'Banco de Chile',
  bci:              'BCI',
  bupa:             'Bupa',
  latam:            'Latam',
  alv:              'Alv',
  'parque arauco':  'Parque Arauco',
  chilexpress:      'Chilexpress',
  redsalud:         'Redsalud',
  afore:            'Afore Coppel',
  '2brains':        '2Brains',
  acidlabs:         '2Brains',
};

/** Normalize serial: strip whitespace, uppercase. */
export function normalizeSerial(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, '').toUpperCase();
  return s || null;
}

/** Normalize CPU to canonical family string. */
export function normalizeCpu(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/M5/i.test(v)) return 'Apple M5';
  if (/M4/i.test(v)) return 'Apple M4';
  if (/M3/i.test(v)) return 'Apple M3';
  if (/M2/i.test(v)) return 'Apple M2';
  if (/M1/i.test(v)) return 'Apple M1';
  if (/i9/i.test(v)) return 'Intel Core i9';
  if (/i7/i.test(v)) return 'Intel Core i7';
  if (/i5/i.test(v)) return 'Intel Core i5';
  if (/i3/i.test(v)) return 'Intel Core i3';
  return v || null;
}

/** CPU generation index: 0=Intel, 1=M1 … 5=M5. */
export function cpuGen(cpu: string | null | undefined): number | null {
  if (!cpu) return null;
  if (/M5/i.test(cpu)) return 5;
  if (/M4/i.test(cpu)) return 4;
  if (/M3/i.test(cpu)) return 3;
  if (/M2/i.test(cpu)) return 2;
  if (/M1/i.test(cpu)) return 1;
  if (/intel/i.test(cpu)) return 0;
  return null;
}

/** Normalize asset status to canonical enum value. */
export function normalizeEstado(raw: string | null | undefined): AssetStatus | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v.includes('asignad'))     return 'Asignado';
  if (v.includes('disponib'))    return 'Disponible';
  if (v.includes('recuperar'))   return 'Por Recuperar';
  if (v.includes('defectu'))     return 'Defectuoso';
  if (v.includes('baja'))        return 'De Baja';
  if (v.includes('reservad'))    return 'Reservado';
  if (v.includes('stock') || v.includes('nuevo')) return 'Stock / Nuevo';
  return null;
}

/** Normalize condition to canonical enum value. */
export function normalizeCondicion(raw: string | null | undefined): AssetCondition | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v.includes('nuevo'))    return 'Nuevo';
  if (v.includes('defectu'))  return 'Defectuoso';
  if (v.includes('usado') || v.includes('use')) return 'Usado';
  return null;
}

/** Normalize client name to canonical form. */
export function normalizeClient(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (!v) return null;
  for (const [key, canonical] of Object.entries(CLIENT_MAP)) {
    if (v.includes(key)) return canonical;
  }
  return raw.trim().replace(/^\w/, c => c.toUpperCase());
}

/** Parse a date string (various formats) → 'YYYY-MM-DD' or null. */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (['nan', 'nat', 'none', ''].includes(s.toLowerCase())) return null;

  // ISO with time component
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Excel numeric date
  const n = Number(s);
  if (!isNaN(n) && n > 40000 && n < 55000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return null;
}

/** Compute quality score 0-100 for a dim_asset record (9 critical fields). */
export function calcQualityScore(fields: {
  serial?: string | null;
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  cpu?: string | null;
  ram?: string | null;
  disco?: string | null;
  condicion?: string | null;
  estado?: string | null;
}): number {
  const score = [
    fields.serial, fields.marca, fields.modelo,
    fields.anio, fields.cpu, fields.ram, fields.disco,
    fields.condicion, fields.estado,
  ].filter(v => v != null && String(v).trim() !== '').length;
  return Math.round((score / 9) * 100);
}

/** Compute asset risk score 0-100. Same formula as SQL function. */
export function calcRiskScore(fields: {
  anio?: number | null;
  estado?: AssetStatus | null;
  ciclos?: number | null;
  cpu?: string | null;
  ram?: string | null;
}): number {
  let score = 0;
  const age = new Date().getFullYear() - (fields.anio ?? 2024);

  score += age >= 6 ? 30 : age >= 5 ? 22 : age >= 4 ? 12 : age >= 3 ? 5 : 0;

  if (fields.estado === 'Defectuoso')    score += 25;
  else if (fields.estado === 'De Baja')  score += 20;
  else if (fields.estado === 'Por Recuperar') score += 15;

  const ciclos = fields.ciclos ?? 0;
  score += ciclos > 900 ? 20 : ciclos > 700 ? 12 : ciclos > 500 ? 6 : 0;

  if (/intel/i.test(fields.cpu ?? ''))  score += 15;
  else if (/M1/i.test(fields.cpu ?? '')) score += 5;

  if (/8\s*gb/i.test(fields.ram ?? '')) score += 8;

  return Math.min(100, score);
}

/** Classify risk score → level. */
export function riskNivel(score: number): RiskLevel {
  if (score >= 70) return 'CRÍTICO';
  if (score >= 50) return 'ALTO';
  if (score >= 25) return 'MEDIO';
  return 'BAJO';
}

/** Compute renovation score 0-100. */
export function calcRenovationScore(fields: {
  anio?: number | null;
  ciclos?: number | null;
  condicionBateria?: string | null;
}): number {
  let score = 0;
  const age = new Date().getFullYear() - (fields.anio ?? 2024);
  score += age >= 5 ? 50 : age >= 4 ? 35 : age >= 3 ? 20 : 0;
  const c = fields.ciclos ?? 0;
  score += c > 900 ? 25 : c > 700 ? 15 : c > 500 ? 8 : 0;
  if (/defect|nornal/i.test(fields.condicionBateria ?? '')) score += 8;
  return Math.min(100, score);
}

/** Reference price by CPU generation. */
export function cpuPrecioNuevo(cpu: string | null | undefined): number {
  if (!cpu) return 1500;
  if (/M5/i.test(cpu)) return 2200;
  if (/M4/i.test(cpu)) return 2000;
  if (/M3/i.test(cpu)) return 1900;
  if (/M2/i.test(cpu)) return 1800;
  if (/M1/i.test(cpu)) return 1700;
  if (/i7/i.test(cpu)) return 1600;
  if (/i5/i.test(cpu)) return 1400;
  return 1500;
}

/** Compute depreciated value (linear 5-year, 10% residual). */
export function calcValorDep(
  precioNuevo: number,
  anio: number | null | undefined,
  condicion: AssetCondition | null | undefined
): number {
  const age   = new Date().getFullYear() - (anio ?? 2024);
  const pct   = Math.min(1, age / 5);
  let val     = precioNuevo * Math.max(0.10, 1 - pct);
  if (condicion === 'Defectuoso') val *= 0.5;
  return Math.round(val * 100) / 100;
}

/** Deterministic movement_id from key fields (matches SQL pipeline). */
export function movementId(
  tipo: string, fecha: string | null, empleado: string | null,
  serial: string | null, rowIdx: number
): string {
  const key = `${tipo}|${fecha ?? ''}|${empleado ?? ''}|${serial ?? ''}|${rowIdx}`;
  // Simple hash for TS (real MD5 in Python pipeline)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(12, '0');
}
