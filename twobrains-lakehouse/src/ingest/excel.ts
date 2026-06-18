// ============================================================
// src/ingest/excel.ts
// Bronze ingest: xlsx file → bronze.ingestion_batches + bronze.raw_excel_rows
// Uses the 'xlsx' (SheetJS) library for parsing.
// ============================================================

import { getDb } from '../utils/db';
import type { IngestResult } from '../types';

interface SheetRow { [key: string]: unknown; }

// Dynamic import of xlsx to avoid bundling issues
async function loadXlsx() {
  return import('xlsx');
}

// ── Header-normalisation map ──────────────────────────────────
// Maps alternate column names found in 2Brains Excel to canonical keys
const HEADER_MAP: Record<string, string> = {
  'nro. serie':             'Nro Serie',
  'n° serie':               'Nro Serie',
  'nro serie':              'Nro Serie',
  'numero de serie':        'Nro Serie',
  'número de serie':        'Nro Serie',
  'nombres y apellidos':    'Nombres y Apellidos',
  'nombre':                 'Nombres y Apellidos',
  'fecha de ingreso':       'Fecha de ingreso',
  'fecha de salida':        'Fecha de Salida',
  'fecha de compra':        'Fecha de Compra',
  'gestionado':             'Gestionado',
  'gestionado por':         'Gestionado',
};

function normalizeHeader(h: string): string {
  return HEADER_MAP[h.toLowerCase().trim()] ?? h.trim();
}

function md5Simple(s: string): string {
  // Lightweight deterministic hash for row dedup
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

// ── Main ingest function ──────────────────────────────────────
export async function ingestExcel(
  fileBuffer: Buffer | ArrayBuffer,
  sourceFileName: string,
  loadedBy?: string
): Promise<IngestResult> {
  const xlsx = await loadXlsx();
  const db   = getDb();
  const startMs = Date.now();
  const errors: IngestResult['errors'] = [];

  // 1. Create Bronze batch
  const { data: batch, error: batchErr } = await db
    .from('bronze.ingestion_batches')
    .insert({
      source_file: sourceFileName,
      source_type: 'xlsx',
      loaded_by:   loadedBy ?? 'api',
      status:      'running',
    })
    .select()
    .single();

  if (batchErr || !batch) {
    throw new Error(`Ingest: failed to create batch — ${batchErr?.message}`);
  }

  const batchId = batch.batch_id;
  let rowsTotal = 0, rowsInserted = 0, rowsSkipped = 0;
  const sheetsProcessed: string[] = [];

  try {
    // 2. Parse workbook
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rawRows: SheetRow[] = xlsx.utils.sheet_to_json(worksheet, {
        raw: false,    // stringify dates
        defval: null,
      });

      if (rawRows.length === 0) continue;
      sheetsProcessed.push(sheetName);

      // Normalize headers
      const normalised: SheetRow[] = rawRows.map(row => {
        const out: SheetRow = {};
        for (const [k, v] of Object.entries(row)) {
          out[normalizeHeader(k)] = v;
        }
        out['_source_sheet'] = sheetName;
        out['_source_file']  = sourceFileName;
        return out;
      });

      // 3. Fetch existing hashes for this sheet (incremental dedup)
      const { data: existingHashes } = await db
        .from('bronze.raw_excel_rows')
        .select('row_hash')
        .eq('source_sheet', sheetName)
        .eq('source_file', sourceFileName);

      const knownHashes = new Set((existingHashes ?? []).map((r: { row_hash: string }) => r.row_hash));

      // 4. Build insert payload, skip duplicates
      const toInsert: Record<string, unknown>[] = [];
      for (let i = 0; i < normalised.length; i++) {
        const rowData = normalised[i];
        const hash    = md5Simple(JSON.stringify(rowData));
        rowsTotal++;

        if (knownHashes.has(hash)) { rowsSkipped++; continue; }

        toInsert.push({
          batch_id:         batchId,
          source_file:      sourceFileName,
          source_sheet:     sheetName,
          sheet_row_number: i + 2,  // +2: 1-based + skip header
          raw_data:         rowData,
          row_hash:         hash,
          is_header_row:    false,
        });
      }

      // 5. Batch insert (chunk to avoid request size limits)
      const CHUNK = 200;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error: insErr } = await db
          .from('bronze.raw_excel_rows')
          .insert(chunk);

        if (insErr) {
          errors.push({ sheet: sheetName, row: i, message: insErr.message });
        } else {
          rowsInserted += chunk.length;
        }
      }
    }

    // 6. Mark batch success
    await db.from('bronze.ingestion_batches').update({
      status:       'success',
      finished_at:  new Date().toISOString(),
      sheets_found: sheetsProcessed,
      rows_total:   rowsTotal,
      rows_inserted: rowsInserted,
      rows_skipped: rowsSkipped,
    }).eq('batch_id', batchId);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from('bronze.ingestion_batches').update({
      status:        'failed',
      finished_at:   new Date().toISOString(),
      error_message: msg,
    }).eq('batch_id', batchId);
    throw err;
  }

  return {
    batchId,
    sourceFile:      sourceFileName,
    sheetsProcessed,
    rowsTotal,
    rowsInserted,
    rowsSkipped,
    errors,
    durationMs: Date.now() - startMs,
  };
}
