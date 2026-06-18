/**
 * QualityService
 *
 * Single source of truth for Park Quality Score data.
 * Sprint 2: replace static imports with DB queries.
 */

import {
  qualityTrend,
  qualityComponents,
  qualityImprovements,
} from '@/lib/data/quality';

import { completenessKpis } from '@/lib/data/governance';

// ─── Response shape ───────────────────────────────────────────
export interface QualityPayload {
  parkQualityScore:    number;
  grade:               string;
  trend:               typeof qualityTrend;
  components:          typeof qualityComponents;
  improvements:        typeof qualityImprovements;
  movementCompleteness:typeof completenessKpis;
  snapshotDate:        string;
}

// ─── Service method ───────────────────────────────────────────
export function getQuality(): QualityPayload {
  return {
    parkQualityScore:    88.5,
    grade:               'B',
    trend:               qualityTrend,
    components:          qualityComponents,
    improvements:        qualityImprovements,
    movementCompleteness:completenessKpis,
    snapshotDate:        '2026-06-17',
  };
}
