export type Severidad = "CRITICAL" | "WARN" | "INFO" | "NORMAL";

export type EquipoRow = {
  id_equipo: string;
  estado: string | null;
  asignado_a: string | null;

  severidad: Severidad;

  alertas_resumen: string | null;
  alertas_codigos: string[] | null;
  alertas_json: Record<string, unknown> | null;

  jira_open_count: number;

  ml_score: number | null;
  ml_risk_level: "Alta" | "Media" | "Baja" | "Normal" | null;
  ml_motivo_principal: string | null;
  ml_score_v2?: number | null;
  ml_score_v3?: number | null;
  ml_risk_level_v3?: "Alta" | "Media" | "Baja" | "Normal" | null;
  ml_alert_code_v3?: string | null;
  ml_version?: "v2" | "v3" | null;

  priority_final_rank: number;
  priority_final_sort_key: number;
};

export type EquipoDetalle = EquipoRow & {
  pais?: string | null;
  cliente?: string | null;
  persona?: string | null;

  antiguedad_dias?: number | null;
  dias_desde_ultimo_evento?: number | null;
  movimientos_12m?: number | null;

  timeline?: Array<{
    tipo: "INGRESO" | "SALIDA" | "ASIGNACION" | "OTRO";
    fecha: string;
    detalle?: string | null;
    cliente?: string | null;
    pais?: string | null;
    persona?: string | null;
  }>;

  ml_drivers?: string[] | null;
  ml_model_version?: string | null;
  ml_model_run_at?: string | null;

  jira?: {
    open_count: number;
    days_open_max?: number | null;
    issues?: Array<{ key: string; summary?: string | null; status?: string | null; url?: string | null }>;
  } | null;
};
