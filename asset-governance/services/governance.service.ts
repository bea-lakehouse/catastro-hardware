/**
 * GovernanceService
 *
 * Single source of truth for all governance data.
 * Pages and API routes consume this service — never lib/data directly.
 *
 * Sprint 2: swap the static imports below for real fetch() / DB calls
 * inside each method without touching any page or component.
 */

import {
  governanceSummary,
  completenessKpis,
  gapsBySource,
  recordsToFix,
  checklistSteps,
  operationRules,
  templateFields,
  maturityLevels,
  maturityProjection,
  DG_SCORE_FORMULA,
  QUALITY_SCORE_FORMULA,
} from '@/lib/data/governance';

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

// ─── Response shapes ──────────────────────────────────────────
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
  completenessKpis: CompletenessKpi[];
  gapsBySource:     GapBySource[];
  recordsToFix:     RecordToFix[];
  recordsCount:     number;
  snapshotDate:     string;
}

export interface GobiernoPayload {
  summary:           GovernanceSummary;
  completenessKpis:  CompletenessKpi[];
  gapsBySource:      GapBySource[];
  recordsToFix:      RecordToFix[];
  checklistSteps:    ChecklistStep[];
  operationRules:    OperationRule[];
  templateFields:    TemplateField[];
  maturityLevels:    MaturityInfo[];
  maturityProjection:{ label: string; score: number }[];
  dgScoreFormula:    Record<string, { weight: number; label: string }>;
  snapshotDate:      string;
}

// ─── Service methods ──────────────────────────────────────────
export function getResumen(): ResumenPayload {
  return {
    summary:             governanceSummary,
    completenessKpis,
    maturityLevels,
    qualityScoreFormula: QUALITY_SCORE_FORMULA,
    dgScoreFormula:      DG_SCORE_FORMULA,
    maturityProjection,
    snapshotDate:        '2026-06-17',
  };
}

export function getCalidad(): CalidadPayload {
  return {
    completenessKpis,
    gapsBySource,
    recordsToFix,
    recordsCount: recordsToFix.length,
    snapshotDate: '2026-06-17',
  };
}

export function getGobierno(): GobiernoPayload {
  return {
    summary:            governanceSummary,
    completenessKpis,
    gapsBySource,
    recordsToFix,
    checklistSteps,
    operationRules,
    templateFields,
    maturityLevels,
    maturityProjection,
    dgScoreFormula:     DG_SCORE_FORMULA,
    snapshotDate:       '2026-06-17',
  };
}
