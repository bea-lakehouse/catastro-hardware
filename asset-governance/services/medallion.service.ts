/**
 * MedallionService
 *
 * Single source of truth for Bronze / Silver / Gold layer data.
 * Sprint 2: replace static imports with DB queries or external API calls.
 */

import {
  bronzeSources,
  silverRules,
  goldMarts,
  governancePillars,
} from '@/lib/data/medallion';

import type { BronzeSource, SilverRule, GoldMart } from '@/lib/types';

// ─── Response shapes ──────────────────────────────────────────
export interface MedallionPayload {
  bronze:   BronzeSource[];
  silver:   SilverRule[];
  gold:     GoldMart[];
  pillars:  { icon: string; title: string; desc: string }[];
  snapshotDate: string;
}

export interface BronzePayload {
  sources:      BronzeSource[];
  totalRecords: number;
  withWarnings: number;
  lastLoad:     string;
  snapshotDate: string;
}

export interface SilverPayload {
  rules:       SilverRule[];
  snapshotDate:string;
}

export interface GoldPayload {
  marts:       GoldMart[];
  operational: number;
  partial:     number;
  apiEndpoints: {
    method:  string;
    path:    string;
    mart:    string;
    params:  string;
    status:  string;
  }[];
  snapshotDate:string;
}

// ─── Service methods ──────────────────────────────────────────
export function getMedallion(): MedallionPayload {
  return {
    bronze:       bronzeSources,
    silver:       silverRules,
    gold:         goldMarts,
    pillars:      governancePillars,
    snapshotDate: '2026-06-17',
  };
}

export function getBronze(): BronzePayload {
  return {
    sources:      bronzeSources,
    totalRecords: bronzeSources.reduce((acc, s) => acc + s.records, 0),
    withWarnings: bronzeSources.filter(s => s.status !== 'ok').length,
    lastLoad:     '2026-06-17',
    snapshotDate: '2026-06-17',
  };
}

export function getSilver(): SilverPayload {
  return {
    rules:        silverRules,
    snapshotDate: '2026-06-17',
  };
}

export function getGold(): GoldPayload {
  return {
    marts:       goldMarts,
    operational: goldMarts.filter(m => m.status === 'operational').length,
    partial:     goldMarts.filter(m => m.status === 'partial').length,
    apiEndpoints: [
      { method:'GET', path:'/v1/snapshot',              mart:'fact_asset_snapshot',     params:'date, serial, estado, cliente',  status:'designed' },
      { method:'GET', path:'/v1/financial',             mart:'gold_financiero',          params:'group_by (cpu|cliente|año)',      status:'designed' },
      { method:'GET', path:'/v1/quality',               mart:'gold_park_quality',        params:'snapshot_date',                  status:'designed' },
      { method:'GET', path:'/v1/risk',                  mart:'gold_risk_v2',             params:'nivel, score_min, cliente',      status:'designed' },
      { method:'GET', path:'/v1/forecast',              mart:'gold_forecast_v2',         params:'periodo, cliente',               status:'designed' },
      { method:'GET', path:'/v1/assets/:serial/history',mart:'fact_snapshot',            params:'from, to',                       status:'designed' },
      { method:'POST',path:'/v1/ingest',                mart:'Bronze pipeline',           params:'multipart/xlsx',                 status:'pending' },
      { method:'GET', path:'/v1/movements',             mart:'gold_movimientos_metricas',params:'type, from, to',                 status:'pending' },
    ],
    snapshotDate: '2026-06-17',
  };
}
