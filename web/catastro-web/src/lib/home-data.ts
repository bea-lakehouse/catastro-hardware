import { apiGet } from "./api";

export type KPIs = Record<string, number>;

export type EquipoListItem = {
  id_equipo: string;
  modelo?: string | null;
  marca?: string | null;
  asignado_a?: string | null;
  estado?: string | null;
  severidad?: string | null;
  tipo_asignacion?: string | null; // core / staffing (si viene)
};

export type EquipoDetalle = Record<string, unknown>;

export type MlV2ScoreRow = {
  equipo_id: string;
  score: number;
  nivel_riesgo?: string | null;
  motivo_principal?: string | null;
  drivers?: unknown;
};

export async function getKPIs() {
  return apiGet<KPIs>("/home/kpis");
}

export async function getEquipos(limit = 200, offset = 0) {
  // backend: /home/equipos?limit=...&offset=...
  return apiGet<{
    items: EquipoListItem[];
    total?: number;
    limit?: number;
    offset?: number;
  }>(`/home/equipos?limit=${limit}&offset=${offset}`);
}

export async function getMlV2Scores(limit = 200) {
  // backend: /ml/v2/scores?limit=...
  return apiGet<{ items?: MlV2ScoreRow[] } | MlV2ScoreRow[]>(
    `/ml/v2/scores?limit=${limit}`
  );
}
