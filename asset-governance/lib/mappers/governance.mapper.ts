/**
 * lib/mappers/governance.mapper.ts
 *
 * Converts raw Supabase rows → service payload types.
 * Pure functions. No I/O. Testable in isolation.
 */

import type {
  GoldGovernanceSummary,
  GoldCompletenessKpi,
  GoldGapBySource,
  GoldRecordToFix,
  GoldQualityTrend,
  GoldQualityComponent,
  CfgChecklistStep,
  CfgOperationRule,
  CfgTemplateField,
} from '../db/database.types';

import type {
  GovernanceSummary,
  CompletenessKpi,
  GapBySource,
  RecordToFix,
  ChecklistStep,
  OperationRule,
  TemplateField,
} from '../types';

// ─── GovernanceSummary ────────────────────────────────────────
export function mapGovernanceSummary(row: GoldGovernanceSummary): GovernanceSummary {
  return {
    qualityScore:       Number(row.quality_score),
    qualityScoreReal:   Number(row.quality_score_real),
    dgScore:            Number(row.dg_score),
    dgLevel:            row.dg_level as 1 | 2 | 3 | 4 | 5,
    dgLevelLabel:       row.dg_level_label,
    totalMovements:     row.total_movements,
    realMovements:      row.real_movements,
    inferredMovements:  row.inferred_movements,
    mainGap:            row.main_gap ?? '',
    secondaryGap:       row.secondary_gap ?? '',
    recordsToFix:       row.records_to_fix,
  };
}

// ─── CompletenessKpi ─────────────────────────────────────────
export function mapCompletenessKpi(row: GoldCompletenessKpi): CompletenessKpi {
  return {
    field:       row.field_name,
    label:       row.field_label,
    pct:         Number(row.pct_complete),
    ok:          row.count_ok,
    total:       row.count_total,
    semaphore:   row.semaphore as CompletenessKpi['semaphore'],
    note:        row.note ?? '',
    isStrategic: row.is_strategic,
  };
}

// ─── GapBySource ─────────────────────────────────────────────
export function mapGapBySource(row: GoldGapBySource): GapBySource {
  return {
    source:         row.source_name,
    sourceShort:    row.source_short,
    total:          row.total_records,
    missingSerial:  row.missing_serial,
    missingDate:    row.missing_date,
    missingClient:  row.missing_client,
    missingManager: row.missing_manager,
    isInferred:     row.is_inferred,
    pctSerial:      Number(row.pct_serial),
    pctDate:        Number(row.pct_date),
    priority:       row.priority as GapBySource['priority'],
    action:         row.action_text ?? '',
  };
}

// ─── RecordToFix ─────────────────────────────────────────────
export function mapRecordToFix(row: GoldRecordToFix): RecordToFix {
  return {
    movementId: row.movement_id,
    type:       row.tipo ?? '',
    employee:   row.employee,
    serial:     row.serial,
    date:       row.fecha,
    client:     row.client,
    manager:    row.manager,
    source:     row.source ?? '',
    issueCount: row.issue_count,
    issues:     row.issues as RecordToFix['issues'],
  };
}

// ─── Quality trend ────────────────────────────────────────────
export function mapQualityTrend(row: GoldQualityTrend) {
  return {
    month:       formatTrendMonth(row.snapshot_date),
    parkQuality: Number(row.park_quality),
    dgScore:     row.dg_score != null ? Number(row.dg_score) : null,
    totalAssets: row.total_assets,
  };
}

function formatTrendMonth(isoDate: string): string {
  // '2026-06-17' → 'Jun 2026'
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })
           .replace('.', '');
}

// ─── Quality component ────────────────────────────────────────
export function mapQualityComponent(row: GoldQualityComponent) {
  return {
    component:    row.component,
    weight:       Number(row.weight),
    score:        Number(row.score),
    contribution: Number(row.contribution),
  };
}

// ─── ChecklistStep ────────────────────────────────────────────
export function mapChecklistStep(row: CfgChecklistStep): ChecklistStep {
  return {
    phase:           row.phase as ChecklistStep['phase'],
    step:            row.step_code,
    task:            row.task,
    description:     row.description,
    responsible:     row.responsible,
    time:            row.time_estimate,
    successCriteria: row.success_criteria,
  };
}

// ─── OperationRule ───────────────────────────────────────────
export function mapOperationRule(row: CfgOperationRule): OperationRule {
  return {
    type:           row.movement_type,
    icon:           row.icon,
    when:           row.when_to_record,
    requiredFields: row.required_fields,
    deadline:       row.deadline,
    commonError:    row.common_error,
  };
}

// ─── TemplateField ───────────────────────────────────────────
export function mapTemplateField(row: CfgTemplateField): TemplateField {
  return {
    field:       row.field_name,
    required:    row.required,
    inputType:   row.input_type,
    values:      row.valid_values,
    description: row.description,
    isMLTarget:  row.is_ml_target,
  };
}
