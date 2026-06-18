/**
 * services/governance.service.ts
 *
 * Feature-flag pattern:
 *   USE_SUPABASE=false → returns lib/data (mock)    ← current
 *   USE_SUPABASE=true  → queries Supabase (real DB)  ← post-setup
 *
 * Pages and API routes call these functions identically in both modes.
 * No page or component ever knows which data source is active.
 */

import { DB_ENABLED, getSupabaseClient } from '@/lib/db/client';
import {
  mapGovernanceSummary,
  mapCompletenessKpi,
  mapGapBySource,
  mapRecordToFix,
  mapQualityTrend,
  mapQualityComponent,
  mapChecklistStep,
  mapOperationRule,
  mapTemplateField,
} from '@/lib/mappers/governance.mapper';

// Mock fallbacks (used when USE_SUPABASE=false)
import {
  governanceSummary  as mockSummary,
  completenessKpis   as mockKpis,
  gapsBySource       as mockGaps,
  recordsToFix       as mockRecords,
  checklistSteps     as mockChecklist,
  operationRules     as mockRules,
  templateFields     as mockTemplate,
  maturityLevels,
  maturityProjection,
  DG_SCORE_FORMULA,
  QUALITY_SCORE_FORMULA,
} from '@/lib/data/governance';

import {
  qualityTrend       as mockTrend,
  qualityComponents  as mockComponents,
  qualityImprovements as mockImprovements,
} from '@/lib/data/quality';

import type {
  GovernanceSummary,
  CompletenessKpi,
  GapBySource,
  RecordToFix,
  ChecklistStep,
  OperationRule,
  TemplateField,
  MaturityInfo,
} from '@/lib/types';

// ─── Payload shapes ───────────────────────────────────────────
export interface ResumenPayload {
  summary:            GovernanceSummary;
  completenessKpis:   CompletenessKpi[];
  maturityLevels:     MaturityInfo[];
  qualityScoreFormula:string;
  dgScoreFormula:     Record<string, { weight: number; label: string }>;
  maturityProjection: { label: string; score: number }[];
  snapshotDate:       string;
}

export interface CalidadPayload {
  completenessKpis:    CompletenessKpi[];
  gapsBySource:        GapBySource[];
  recordsToFix:        RecordToFix[];
  recordsCount:        number;
  trend:               { month: string; parkQuality: number; dgScore: number | null; totalAssets: number }[];
  components:          { component: string; weight: number; score: number; contribution: number }[];
  improvements:        typeof mockImprovements;
  movementCompleteness:CompletenessKpi[];
  parkQualityScore:    number;
  grade:               string;
  snapshotDate:        string;
}

export interface GobiernoPayload {
  summary:            GovernanceSummary;
  completenessKpis:   CompletenessKpi[];
  gapsBySource:       GapBySource[];
  recordsToFix:       RecordToFix[];
  checklistSteps:     ChecklistStep[];
  operationRules:     OperationRule[];
  templateFields:     TemplateField[];
  maturityLevels:     MaturityInfo[];
  maturityProjection: { label: string; score: number }[];
  dgScoreFormula:     Record<string, { weight: number; label: string }>;
  snapshotDate:       string;
}

// ─── Helpers ──────────────────────────────────────────────────
function computeGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

// ─── getResumen ───────────────────────────────────────────────
export async function getResumen(): Promise<ResumenPayload> {
  if (!DB_ENABLED) {
    return {
      summary:             mockSummary,
      completenessKpis:    mockKpis,
      maturityLevels,
      qualityScoreFormula: QUALITY_SCORE_FORMULA,
      dgScoreFormula:      DG_SCORE_FORMULA,
      maturityProjection,
      snapshotDate:        '2026-06-17',
    };
  }

  const db = getSupabaseClient();

  const [summaryRes, kpisRes] = await Promise.all([
    db.from('v_governance_summary').select('*').limit(1).maybeSingle(),
    db.from('v_completeness_kpis').select('*'),
  ]);

  if (summaryRes.error) throw summaryRes.error;
  if (!summaryRes.data) throw new Error('No governance summary found for the current snapshot date.');
  if (kpisRes.error)    throw kpisRes.error;

  return {
    summary:             mapGovernanceSummary(summaryRes.data! as import('../lib/db/database.types').GoldGovernanceSummary),
    completenessKpis:    (kpisRes.data ?? []).map(mapCompletenessKpi),
    maturityLevels,
    qualityScoreFormula: QUALITY_SCORE_FORMULA,
    dgScoreFormula:      DG_SCORE_FORMULA,
    maturityProjection,
    snapshotDate:        (summaryRes.data! as import('../lib/db/database.types').GoldGovernanceSummary).snapshot_date,
  };
}

// ─── getCalidad ───────────────────────────────────────────────
export async function getCalidad(): Promise<CalidadPayload> {
  if (!DB_ENABLED) {
    return {
      completenessKpis:    mockKpis,
      gapsBySource:        mockGaps,
      recordsToFix:        mockRecords,
      recordsCount:        mockRecords.length,
      trend:               mockTrend as CalidadPayload['trend'],
      components:          mockComponents,
      improvements:        mockImprovements,
      movementCompleteness:mockKpis,
      parkQualityScore:    88.5,
      grade:               'B',
      snapshotDate:        '2026-06-17',
    };
  }

  const db = getSupabaseClient();

  const [summaryRes, kpisRes, gapsRes, recordsRes, trendRes, componentsRes] = await Promise.all([
    db.from('v_governance_summary').select('*').limit(1).maybeSingle(),
    db.from('v_completeness_kpis').select('*'),
    db.from('v_gaps_by_source').select('*'),
    db.from('v_records_to_fix').select('*'),
    db.from('v_quality_trend').select('*'),
    db.from('v_quality_components').select('*'),
  ]);

  for (const r of [summaryRes, kpisRes, gapsRes, recordsRes, trendRes, componentsRes]) {
    if (r.error) throw r.error;
  }

  const summary    = mapGovernanceSummary(summaryRes.data!);
  const kpis       = (kpisRes.data ?? []).map(mapCompletenessKpi);
  const trend      = (trendRes.data ?? []).map(mapQualityTrend);
  const components = (componentsRes.data ?? []).map(mapQualityComponent);
  const totalScore = components.reduce((s, c) => s + c.contribution, 0);

  return {
    completenessKpis:    kpis,
    gapsBySource:        (gapsRes.data ?? []).map(mapGapBySource),
    recordsToFix:        (recordsRes.data ?? []).map(mapRecordToFix),
    recordsCount:        (recordsRes.data ?? []).length,
    trend,
    components,
    improvements:        mockImprovements,   // static config; moves to DB in Sprint 3
    movementCompleteness:kpis,
    parkQualityScore:    Math.round(totalScore * 10) / 10,
    grade:               computeGrade(totalScore),
    snapshotDate:        (summaryRes.data! as import('../lib/db/database.types').GoldGovernanceSummary).snapshot_date,
  };
}

// ─── getGobierno ─────────────────────────────────────────────
export async function getGobierno(): Promise<GobiernoPayload> {
  if (!DB_ENABLED) {
    return {
      summary:            mockSummary,
      completenessKpis:   mockKpis,
      gapsBySource:       mockGaps,
      recordsToFix:       mockRecords,
      checklistSteps:     mockChecklist,
      operationRules:     mockRules,
      templateFields:     mockTemplate,
      maturityLevels,
      maturityProjection,
      dgScoreFormula:     DG_SCORE_FORMULA,
      snapshotDate:       '2026-06-17',
    };
  }

  const db = getSupabaseClient();

  const [summaryRes, kpisRes, gapsRes, recordsRes, checklistRes, rulesRes, templateRes] =
    await Promise.all([
      db.from('v_governance_summary').select('*').limit(1).maybeSingle(),
      db.from('v_completeness_kpis').select('*'),
      db.from('v_gaps_by_source').select('*'),
      db.from('v_records_to_fix').select('*'),
      db.from('cfg_checklist_steps').select('*').order('sort_order'),
      db.from('cfg_operation_rules').select('*'),
      db.from('cfg_template_fields').select('*').order('sort_order'),
    ]);

  for (const r of [summaryRes, kpisRes, gapsRes, recordsRes, checklistRes, rulesRes, templateRes]) {
    if (r.error) throw r.error;
  }

  return {
    summary:            mapGovernanceSummary(summaryRes.data!),
    completenessKpis:   (kpisRes.data    ?? []).map(mapCompletenessKpi),
    gapsBySource:       (gapsRes.data    ?? []).map(mapGapBySource),
    recordsToFix:       (recordsRes.data ?? []).map(mapRecordToFix),
    checklistSteps:     (checklistRes.data ?? []).map(mapChecklistStep),
    operationRules:     (rulesRes.data   ?? []).map(mapOperationRule),
    templateFields:     (templateRes.data ?? []).map(mapTemplateField),
    maturityLevels,
    maturityProjection,
    dgScoreFormula:     DG_SCORE_FORMULA,
    snapshotDate:       (summaryRes.data! as import('../lib/db/database.types').GoldGovernanceSummary).snapshot_date,
  };
}
