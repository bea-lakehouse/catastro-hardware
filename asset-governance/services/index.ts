/**
 * services/index.ts
 *
 * Barrel export for all service modules.
 * Import services through this file to keep imports clean.
 *
 * Usage:
 *   import { getGobierno } from '@/services';
 *   import type { GobiernoPayload } from '@/services';
 */

export * from './governance.service';
export * from './medallion.service';
export * from './quality.service';
export * from './forecast.service';
