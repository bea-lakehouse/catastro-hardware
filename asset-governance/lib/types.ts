// ─── Semaphore ────────────────────────────────────────────────
export type Semaphore = 'green' | 'yellow' | 'orange' | 'red';

// ─── Maturity ─────────────────────────────────────────────────
export type MaturityLevel = 1 | 2 | 3 | 4 | 5;
export interface MaturityInfo {
  level: MaturityLevel;
  label: string;
  range: string;
  description: string;
  color: string;
}

// ─── KPI Completeness ─────────────────────────────────────────
export interface CompletenessKpi {
  field: string;
  label: string;
  pct: number;
  ok: number;
  total: number;
  semaphore: Semaphore;
  note: string;
  isStrategic?: boolean;
}

// ─── Gap by Source ────────────────────────────────────────────
export interface GapBySource {
  source: string;
  sourceShort: string;
  total: number;
  missingSerial: number;
  missingDate: number;
  missingClient: number;
  missingManager: number;
  isInferred: boolean;
  pctSerial: number;
  pctDate: number;
  priority: 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  action: string;
}

// ─── Record to Fix ────────────────────────────────────────────
export type IssueType = 'sin_serial' | 'sin_fecha' | 'sin_cliente' | 'sin_gestor' | 'sin_empleado';
export interface RecordToFix {
  movementId: string;
  type: string;
  employee: string | null;
  serial: string | null;
  date: string | null;
  client: string | null;
  manager: string | null;
  source: string;
  issueCount: number;
  issues: IssueType[];
}

// ─── Checklist ────────────────────────────────────────────────
export type ChecklistPhase =
  | 'PREPARACION'
  | 'CARGA'
  | 'TRANSFORMACION'
  | 'GOLD'
  | 'VALIDACION'
  | 'PUBLICACION';

export interface ChecklistStep {
  phase: ChecklistPhase;
  step: string;
  task: string;
  description: string;
  responsible: string;
  time: string;
  successCriteria: string;
}

// ─── Operation Rule ───────────────────────────────────────────
export interface OperationRule {
  type: string;
  icon: string;
  when: string;
  requiredFields: string;
  deadline: string;
  commonError: string;
}

// ─── Template Field ───────────────────────────────────────────
export interface TemplateField {
  field: string;
  required: boolean;
  inputType: string;
  values: string;
  description: string;
  isMLTarget?: boolean;
}

// ─── Bronze ───────────────────────────────────────────────────
export interface BronzeSource {
  name: string;
  type: string;
  sheet: string;
  records: number;
  status: 'ok' | 'warning' | 'error';
  lastLoad: string;
  missingSerial: number;
  missingDate: number;
}

// ─── Silver ───────────────────────────────────────────────────
export interface SilverRule {
  field: string;
  function: string;
  description: string;
}

// ─── Gold Mart ────────────────────────────────────────────────
export interface GoldMart {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'partial' | 'designed';
  source: string;
  businessValue: string;
  recordCount?: number;
  lastUpdated?: string;
}

// ─── Governance summary ───────────────────────────────────────
export interface GovernanceSummary {
  qualityScore: number;
  qualityScoreReal: number;
  dgScore: number;
  dgLevel: MaturityLevel;
  dgLevelLabel: string;
  totalMovements: number;
  realMovements: number;
  inferredMovements: number;
  mainGap: string;
  secondaryGap: string;
  recordsToFix: number;
}
