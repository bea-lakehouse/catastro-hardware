/**
 * lib/mappers/medallion.mapper.ts
 *
 * DB rows → Medallion service payload types.
 */

import type {
  CfgBronzeSource,
  CfgSilverRule,
  CfgGoldMart,
} from '../db/database.types';

import type { BronzeSource, SilverRule, GoldMart } from '../types';

export function mapBronzeSource(row: CfgBronzeSource): BronzeSource {
  return {
    name:          row.name,
    type:          row.source_type,
    sheet:         row.sheet_name,
    records:       row.records_count,
    status:        row.status,
    lastLoad:      row.last_load_date ?? 'N/A',
    missingSerial: row.missing_serial,
    missingDate:   row.missing_date,
  };
}

export function mapSilverRule(row: CfgSilverRule): SilverRule {
  return {
    field:       row.field_name,
    function:    row.function_name,
    description: row.description,
  };
}

export function mapGoldMart(row: CfgGoldMart): GoldMart {
  return {
    id:            row.id,
    name:          row.name,
    description:   row.description,
    status:        row.status,
    source:        row.source_desc,
    businessValue: row.business_value,
    recordCount:   row.record_count ?? undefined,
    lastUpdated:   row.last_updated ?? undefined,
  };
}
