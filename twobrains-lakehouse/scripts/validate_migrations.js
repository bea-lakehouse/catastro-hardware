#!/usr/bin/env node
/**
 * scripts/validate_migrations.js
 * Quick sanity check on migration files before running against Supabase.
 * Run: node scripts/validate_migrations.js
 */

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const REQUIRED = [
  '001_create_schemas.sql',
  '002_bronze_tables.sql',
  '003_silver_tables.sql',
  '004_gold_views.sql',
  '005_ops_tables.sql',
  '006_seed_initial_data.sql',
];

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('\n2Brains Lakehouse — Migration Validator\n');

// 1. All required files exist
console.log('[ Files ]');
for (const file of REQUIRED) {
  const exists = fs.existsSync(path.join(MIGRATIONS_DIR, file));
  check(file, exists, 'file missing');
}

// 2. Per-file content checks
console.log('\n[ Content ]');
for (const file of REQUIRED) {
  const p = path.join(MIGRATIONS_DIR, file);
  if (!fs.existsSync(p)) continue;
  const sql = fs.readFileSync(p, 'utf8');

  switch (file) {
    case '001_create_schemas.sql':
      check('001 creates bronze schema', /create schema.+bronze/i.test(sql));
      check('001 creates silver schema', /create schema.+silver/i.test(sql));
      check('001 creates gold schema',   /create schema.+gold/i.test(sql));
      check('001 creates ops schema',    /create schema.+ops/i.test(sql));
      check('001 defines movement enum', /tb_movement_type/i.test(sql));
      check('001 defines risk enum',     /tb_risk_level/i.test(sql));
      break;

    case '002_bronze_tables.sql':
      check('002 has ingestion_batches',  /bronze\.ingestion_batches/i.test(sql));
      check('002 has raw_excel_rows',     /bronze\.raw_excel_rows/i.test(sql));
      check('002 has row_hash column',    /row_hash/i.test(sql));
      check('002 has JSONB raw_data',     /raw_data.*jsonb|jsonb.*raw_data/i.test(sql));
      break;

    case '003_silver_tables.sql':
      check('003 has normalize_serial',   /normalize_serial/i.test(sql));
      check('003 has normalize_client',   /normalize_client/i.test(sql));
      check('003 has normalize_estado',   /normalize_estado/i.test(sql));
      check('003 has calc_risk_score',    /calc_risk_score/i.test(sql));
      check('003 has calc_quality_score', /calc_quality_score/i.test(sql));
      check('003 has dim_asset',          /silver\.dim_asset/i.test(sql));
      check('003 has fact_movements',     /silver\.fact_movements/i.test(sql));
      check('003 has dim_client',         /silver\.dim_client/i.test(sql));
      check('003 has dim_employee',       /silver\.dim_employee/i.test(sql));
      check('003 has fact_asset_snapshot',/silver\.fact_asset_snapshot/i.test(sql));
      check('003 has riesgo_percibido_it',/riesgo_percibido_it/i.test(sql));
      break;

    case '004_gold_views.sql':
      check('004 has governance_summary', /gold\.governance_summary/i.test(sql));
      check('004 has quality_kpis',       /gold\.quality_kpis/i.test(sql));
      check('004 has asset_risk',         /gold\.asset_risk/i.test(sql));
      check('004 has financial_summary',  /gold\.financial_summary/i.test(sql));
      check('004 has forecast',           /gold\.forecast/i.test(sql));
      check('004 has park_quality',       /gold\.park_quality/i.test(sql));
      check('004 has movements_quality',  /gold\.movements_quality/i.test(sql));
      check('004 has refresh_all()',      /gold\.refresh_all/i.test(sql));
      break;

    case '005_ops_tables.sql':
      check('005 has pipeline_runs',      /ops\.pipeline_runs/i.test(sql));
      check('005 has ingestion_errors',   /ops\.ingestion_errors/i.test(sql));
      check('005 has checkpoints',        /ops\.checkpoints/i.test(sql));
      check('005 has quality_snapshots',  /ops\.quality_snapshots/i.test(sql));
      check('005 has pipeline_status view',/ops\.pipeline_status/i.test(sql));
      break;

    case '006_seed_initial_data.sql':
      check('006 seeds dim_client',       /insert into silver\.dim_client/i.test(sql));
      check('006 seeds dim_employee',     /insert into silver\.dim_employee/i.test(sql));
      check('006 seeds dim_asset',        /insert into silver\.dim_asset/i.test(sql));
      check('006 seeds fact_movements',   /insert into silver\.fact_movements/i.test(sql));
      check('006 seeds fact_snapshot',    /insert into silver\.fact_asset_snapshot/i.test(sql));
      check('006 has Bronze batch',       /bronze\.ingestion_batches/i.test(sql));
      check('006 has Ops run',            /ops\.pipeline_runs/i.test(sql));
      check('006 has quality history',    /ops\.quality_snapshots/i.test(sql));
      check('006 restores FK',            /session_replication_role = default/i.test(sql));
      check('006 has verify block',       /raise notice.*Seed/i.test(sql));
      break;
  }
}

// 3. Execution order
console.log('\n[ Order ]');
const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
const nums  = files.map(f => parseInt(f.split('_')[0]));
const sorted = [...nums].sort((a,b) => a-b);
check('Migrations are sequentially numbered', JSON.stringify(nums) === JSON.stringify(sorted));
check('All 6 migrations present', files.length === 6, `found ${files.length}`);

// Summary
console.log(`\n${'─'.repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) {
  console.error('\n⚠  Fix failing checks before running migrations against Supabase.\n');
  process.exit(1);
} else {
  console.log('\n✓  All checks passed. Ready to run migrations.\n');
}
