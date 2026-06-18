// ============================================================
// src/types/index.ts
// twobrains-lakehouse — TypeScript type definitions
// Mirrors supabase/migrations/001_create_schemas.sql
// ============================================================

// ── Enums ────────────────────────────────────────────────────
export type MovementType =
  | 'ingreso' | 'salida' | 'compra'
  | 'asignacion' | 'recuperacion' | 'baja';

export type AssetStatus =
  | 'Asignado' | 'Disponible' | 'Por Recuperar'
  | 'Defectuoso' | 'De Baja' | 'Reservado' | 'Stock / Nuevo';

export type AssetCondition = 'Nuevo' | 'Usado' | 'Defectuoso';

export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRÍTICO';

export type SnapshotKind = 'monthly' | 'manual' | 'incident' | 'annual';

export type PipelineStatus = 'running' | 'success' | 'failed' | 'partial';

export type Priority = 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA';

// ── Bronze ────────────────────────────────────────────────────
export interface IngestionBatch {
  batch_id:       string;           // UUID
  source_file:    string;
  source_type:    string;
  loaded_by:      string | null;
  started_at:     string;           // ISO 8601
  finished_at:    string | null;
  status:         PipelineStatus;
  sheets_found:   string[];
  rows_total:     number;
  rows_inserted:  number;
  rows_skipped:   number;
  error_message:  string | null;
  metadata:       Record<string, unknown>;
}

export interface RawExcelRow {
  id:               number;
  batch_id:         string;
  source_file:      string;
  source_sheet:     string;
  sheet_row_number: number;
  raw_data:         Record<string, unknown>;
  row_hash:         string;
  load_timestamp:   string;
  is_header_row:    boolean;
  processing_notes: string | null;
}

// ── Silver ────────────────────────────────────────────────────
export interface DimClient {
  client_id:    number;
  name:         string;
  name_aliases: string[];
  sector:       string | null;
  region:       string | null;
  is_active:    boolean;
  created_at:   string;
  updated_at:   string;
}

export interface DimEmployee {
  employee_id: number;
  full_name:   string;
  rut:         string | null;
  email:       string | null;
  client_id:   number | null;
  is_active:   boolean;
  created_at:  string;
  updated_at:  string;
}

export interface DimAsset {
  serial:                string;
  sku:                   string | null;
  tipo:                  string | null;
  marca:                 string | null;
  modelo:                string | null;
  color:                 string | null;
  anio_fabricacion:      number | null;
  sistema_operativo:     string | null;
  pantalla:              string | null;
  cpu:                   string | null;
  cpu_gen:               number | null;
  ram:                   string | null;
  disco:                 string | null;
  ciclos_bateria:        number | null;
  condicion_bateria:     string | null;
  estado:                AssetStatus | null;
  condicion:             AssetCondition | null;
  client_id:             number | null;
  cliente:               string | null;
  employee_id:           number | null;
  empleado:              string | null;
  tipo_colaborador:      string | null;
  perfil:                string | null;
  ambito_laboral:        string | null;
  localizacion:          string | null;
  ciudad:                string | null;
  propiedad:             string | null;
  fecha_compra:          string | null;
  fecha_mantenimiento:   string | null;
  fecha_asignacion:      string | null;
  precio_nuevo_usd:      number | null;
  valor_dep_usd:         number | null;
  dep_acumulada_usd:     number | null;
  pct_depreciado:        number | null;
  costo_renovacion_usd:  number | null;
  risk_score:            number | null;
  risk_nivel:            RiskLevel | null;
  score_renovacion:      number | null;
  candidato_renovacion:  boolean;
  calidad_dato:          number | null;
  es_duplicado:          boolean;
  fuente_hoja:           string | null;
  batch_id:              string | null;
  load_timestamp:        string;
  updated_at:            string;
}

export interface FactMovement {
  movement_id:             string;
  tipo_movimiento:         MovementType;
  estado_resultante:       AssetStatus | null;
  fecha:                   string | null;
  fecha_retiro_confirmada: string | null;
  tiene_fecha:             boolean;
  empleado:                string | null;
  rut_empleado:            string | null;
  employee_id:             number | null;
  gestionado_por:          string | null;
  serial:                  string | null;
  modelo_raw:              string | null;
  cpu:                     string | null;
  ram:                     string | null;
  anio_fabricacion:        number | null;
  precio_referencia_usd:   number | null;
  tiene_serial:            boolean;
  cliente:                 string | null;
  client_id:               number | null;
  ubicacion:               string | null;
  asset_cpu:               string | null;
  asset_anio:              number | null;
  asset_estado_actual:     AssetStatus | null;
  asset_risk_score:        number | null;
  asset_risk_nivel:        RiskLevel | null;
  asset_valor_dep:         number | null;
  fuente_hoja:             string;
  es_inferido:             boolean;
  riesgo_percibido_it:     RiskLevel | null;
  batch_id:                string | null;
  source_file:             string | null;
  load_timestamp:          string;
}

export interface FactAssetSnapshot {
  snapshot_date:      string;
  snapshot_kind:      SnapshotKind;
  serial:             string | null;
  estado:             AssetStatus | null;
  condicion:          AssetCondition | null;
  cliente:            string | null;
  area:               string | null;
  proyecto:           string | null;
  plataforma:         string | null;
  marca:              string | null;
  modelo:             string | null;
  anio_fabricacion:   number | null;
  ram:                string | null;
  disco:              string | null;
  empleado:           string | null;
  ciudad:             string | null;
  fuente:             string | null;
  valor_depreciado:   number | null;
  precio_nuevo:       number | null;
  costo_renovacion:   number | null;
  score_renovacion:   number | null;
  calidad_dato:       number | null;
  risk_score:         number | null;
  risk_nivel:         RiskLevel | null;
  es_simulado:        boolean;
  batch_id:           string | null;
  load_timestamp:     string;
}

// ── Ops ───────────────────────────────────────────────────────
export interface PipelineRun {
  run_id:               string;
  pipeline_name:        string;
  batch_id:             string | null;
  status:               PipelineStatus;
  snapshot_date:        string | null;
  started_at:           string;
  finished_at:          string | null;
  duration_ms:          number | null;
  assets_processed:     number | null;
  movements_processed:  number | null;
  snapshots_created:    number | null;
  quality_score:        number | null;
  dg_score:             number | null;
  error_message:        string | null;
  metadata:             Record<string, unknown>;
}

export interface IngestionError {
  id:            number;
  run_id:        string | null;
  batch_id:      string | null;
  source_file:   string | null;
  source_sheet:  string | null;
  row_number:    number | null;
  raw_data:      Record<string, unknown> | null;
  error_type:    string;
  error_message: string;
  is_critical:   boolean;
  created_at:    string;
}

export interface QualitySnapshot {
  id:                 number;
  run_id:             string | null;
  snapshot_date:      string;
  quality_score:      number | null;
  dg_score:           number | null;
  dg_level:           number | null;
  total_movements:    number | null;
  real_movements:     number | null;
  records_to_fix:     number | null;
  pct_serial:         number | null;
  pct_fecha:          number | null;
  pct_gestor:         number | null;
  pct_cliente:        number | null;
  pct_riesgo_it:      number | null;
  total_assets:       number | null;
  park_quality_score: number | null;
  created_at:         string;
}

// ── Gold view row types ───────────────────────────────────────
export interface GovernanceSummaryRow {
  snapshot_date:      string;
  quality_score:      number;
  quality_score_real: number;
  dg_score:           number;
  dg_level:           number;
  dg_level_label:     string;
  total_movements:    number;
  real_movements:     number;
  inferred_movements: number;
  records_to_fix:     number;
  main_gap:           string;
  secondary_gap:      string;
}

export interface QualityKpiRow {
  field_name:    string;
  field_label:   string;
  pct_complete:  number;
  count_ok:      number;
  count_total:   number;
  semaphore:     'green' | 'yellow' | 'orange' | 'red';
  is_strategic:  boolean;
}

export interface AssetRiskRow {
  serial:               string;
  marca:                string | null;
  modelo:               string | null;
  anio_fabricacion:     number | null;
  cpu:                  string | null;
  estado:               AssetStatus | null;
  cliente:              string | null;
  empleado:             string | null;
  risk_score:           number | null;
  risk_nivel:           RiskLevel | null;
  calidad_dato:         number | null;
  valor_dep_usd:        number | null;
  costo_renovacion_usd: number | null;
  candidato_renovacion: boolean;
  n_movimientos:        number;
  tiene_baja:           boolean;
  tiene_recuperacion:   boolean;
  riesgo_it_max:        RiskLevel | null;
  risk_score_v2:        number;
  risk_nivel_v2:        RiskLevel;
}

export interface ForecastRow {
  serial:              string;
  marca:               string | null;
  modelo:              string | null;
  anio_fabricacion:    number | null;
  cpu:                 string | null;
  estado:              AssetStatus | null;
  cliente:             string | null;
  empleado:            string | null;
  risk_score:          number | null;
  score_renovacion:    number | null;
  costo_renovacion_usd:number | null;
  renovation_period:   'inmediato' | '6_meses' | '12_meses' | '18_meses' | 'ok';
  months_to_renovation:number;
}

export interface FinancialSummaryRow {
  dimension:            string;
  breakdown_value:      string;
  asset_count:          number;
  valor_nuevo_usd:      number;
  valor_dep_usd:        number;
  dep_acumulada_usd:    number;
  pct_depreciado_avg:   number | null;
  costo_renovacion_usd: number;
}

// ── Pipeline result types (for src/pipeline/*) ────────────────
export interface IngestResult {
  batchId:       string;
  sourceFile:    string;
  sheetsProcessed: string[];
  rowsTotal:     number;
  rowsInserted:  number;
  rowsSkipped:   number;
  errors:        Array<{ sheet: string; row: number; message: string }>;
  durationMs:    number;
}

export interface SilverTransformResult {
  batchId:           string;
  assetsUpserted:    number;
  movementsInserted: number;
  clientsCreated:    number;
  employeesCreated:  number;
  errorsCount:       number;
  durationMs:        number;
}

export interface GoldRefreshResult {
  snapshotDate:       string;
  assetsProcessed:    number;
  movementsProcessed: number;
  qualityScore:       number;
  dgScore:            number;
  durationMs:         number;
}
