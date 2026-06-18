/**
 * services/medallion.service.ts
 *
 * Feature-flag pattern — USE_SUPABASE controls data source.
 */

import { DB_ENABLED, getSupabaseClient } from '@/lib/db/client';
import { mapBronzeSource, mapSilverRule, mapGoldMart } from '@/lib/mappers/medallion.mapper';

import {
  bronzeSources  as mockBronze,
  silverRules    as mockSilver,
  goldMarts      as mockGold,
  governancePillars,
} from '@/lib/data/medallion';

import type { BronzeSource, SilverRule, GoldMart } from '@/lib/types';

// ─── Payload shapes ───────────────────────────────────────────
export interface MedallionPayload {
  bronze:       BronzeSource[];
  silver:       SilverRule[];
  gold:         GoldMart[];
  pillars:      { icon: string; title: string; desc: string }[];
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
  rules:        SilverRule[];
  snapshotDate: string;
}

export interface GoldPayload {
  marts:        GoldMart[];
  operational:  number;
  partial:      number;
  apiEndpoints: {
    method: string; path: string; mart: string; params: string; status: string;
  }[];
  snapshotDate: string;
}

const API_ENDPOINTS = [
  { method:'GET',  path:'/v1/snapshot',              mart:'fact_asset_snapshot',      params:'date, serial, estado, cliente',  status:'designed' },
  { method:'GET',  path:'/v1/financial',             mart:'gold_financiero',           params:'group_by (cpu|cliente|año)',      status:'designed' },
  { method:'GET',  path:'/v1/quality',               mart:'gold_park_quality',         params:'snapshot_date',                  status:'designed' },
  { method:'GET',  path:'/v1/risk',                  mart:'gold_risk_v2',              params:'nivel, score_min, cliente',      status:'designed' },
  { method:'GET',  path:'/v1/forecast',              mart:'gold_forecast_v2',          params:'periodo, cliente',               status:'designed' },
  { method:'GET',  path:'/v1/assets/:serial/history',mart:'fact_snapshot',             params:'from, to',                       status:'designed' },
  { method:'POST', path:'/v1/ingest',                mart:'Bronze pipeline',            params:'multipart/xlsx',                 status:'pending' },
  { method:'GET',  path:'/v1/movements',             mart:'gold_movimientos_metricas', params:'type, from, to',                 status:'pending' },
];

// ─── getMedallion ─────────────────────────────────────────────
export async function getMedallion(): Promise<MedallionPayload> {
  if (!DB_ENABLED) {
    return { bronze:mockBronze, silver:mockSilver, gold:mockGold, pillars:governancePillars, snapshotDate:'2026-06-17' };
  }

  const db = getSupabaseClient();
  const [bronzeRes, silverRes, goldRes] = await Promise.all([
    db.from('cfg_bronze_sources').select('*').order('id'),
    db.from('cfg_silver_rules').select('*').order('id'),
    db.from('cfg_gold_marts').select('*').order('name'),
  ]);

  for (const r of [bronzeRes, silverRes, goldRes]) {
    if (r.error) throw r.error;
  }

  return {
    bronze:       (bronzeRes.data ?? []).map(mapBronzeSource),
    silver:       (silverRes.data ?? []).map(mapSilverRule),
    gold:         (goldRes.data   ?? []).map(mapGoldMart),
    pillars:      governancePillars,
    snapshotDate: '2026-06-17',
  };
}

// ─── getBronze ───────────────────────────────────────────────
export async function getBronze(): Promise<BronzePayload> {
  if (!DB_ENABLED) {
    return {
      sources:      mockBronze,
      totalRecords: mockBronze.reduce((a, s) => a + s.records, 0),
      withWarnings: mockBronze.filter(s => s.status !== 'ok').length,
      lastLoad:     '2026-06-17',
      snapshotDate: '2026-06-17',
    };
  }

  const db = getSupabaseClient();
  const { data, error } = await db.from('cfg_bronze_sources').select('*').order('id');
  if (error) throw error;

  const sources = (data ?? []).map(mapBronzeSource);
  return {
    sources,
    totalRecords: sources.reduce((a, s) => a + s.records, 0),
    withWarnings: sources.filter(s => s.status !== 'ok').length,
    lastLoad:     sources[0]?.lastLoad ?? 'N/A',
    snapshotDate: '2026-06-17',
  };
}

// ─── getSilver ───────────────────────────────────────────────
export async function getSilver(): Promise<SilverPayload> {
  if (!DB_ENABLED) {
    return { rules: mockSilver, snapshotDate: '2026-06-17' };
  }

  const db = getSupabaseClient();
  const { data, error } = await db.from('cfg_silver_rules').select('*').order('id');
  if (error) throw error;

  return { rules: (data ?? []).map(mapSilverRule), snapshotDate: '2026-06-17' };
}

// ─── getGold ─────────────────────────────────────────────────
export async function getGold(): Promise<GoldPayload> {
  if (!DB_ENABLED) {
    return {
      marts:       mockGold,
      operational: mockGold.filter(m => m.status === 'operational').length,
      partial:     mockGold.filter(m => m.status === 'partial').length,
      apiEndpoints: API_ENDPOINTS,
      snapshotDate: '2026-06-17',
    };
  }

  const db = getSupabaseClient();
  const { data, error } = await db.from('cfg_gold_marts').select('*').order('name');
  if (error) throw error;

  const marts = (data ?? []).map(mapGoldMart);
  return {
    marts,
    operational: marts.filter(m => m.status === 'operational').length,
    partial:     marts.filter(m => m.status === 'partial').length,
    apiEndpoints: API_ENDPOINTS,
    snapshotDate: '2026-06-17',
  };
}
