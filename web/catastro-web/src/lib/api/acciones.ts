const API_URL = "/api/proxy";
type JsonRecord = Record<string, unknown>;

export type AccionEstado = "RESUELTA" | "DESCARTADA";
export type AccionItem = JsonRecord & {
  id: string;
  titulo: string;
  tipo: string;
  prioridad: string;
  mensaje?: string | null;
  created_at?: string | null;
  estado?: string | null;
  dias_a_vencer?: number | null;
};
type AccionesResponse = {
  rows?: AccionItem[];
  count?: number;
};
type AccionesGruposResponse = {
  groups?: Array<{
    tipo: string;
    prioridad: string;
    count: number;
    vencidas: number;
    dias_min: number | null;
  }>;
};

export type FetchAccionesParams = {
  tipo?: string;
  prioridad?: string;
  hide_resueltas?: boolean | string;
  order?: string;
  limit?: number | string;
};

export async function fetchAccionesGrupos() {
  const res = await fetch(`${API_URL}/acciones/grupos`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error cargando grupos");
  return res.json() as Promise<AccionesGruposResponse>;
}

export async function fetchAcciones(params: FetchAccionesParams) {
  const q = new URLSearchParams({});
  // filtros opcionales
  if (params.tipo) q.set("tipo", String(params.tipo));
  if (params.prioridad) q.set("prioridad", String(params.prioridad));

  // defaults
  q.set("hide_resueltas", String(params.hide_resueltas ?? "true"));
  q.set("order", String(params.order ?? "urgencia"));
  q.set("limit", String(params.limit ?? "200"));
  const res = await fetch(`${API_URL}/acciones/?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error cargando acciones");
  return res.json() as Promise<AccionesResponse>;
}

export async function updateAccionEstado(
  id: string,
  estado: AccionEstado
) {
  const res = await fetch(`${API_URL}/acciones/${id}/estado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error("Error actualizando acción");
}

// BULK: cambia estado de muchas acciones
export async function bulkEstado(
  ids: string[],
  estado: AccionEstado
) {
  const base = "/api/proxy";
  const res = await fetch(`${base}/acciones/bulk_estado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, estado }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`bulk_estado failed: ${res.status} ${txt}`);
  }

  return res.json() as Promise<{ updated: number }>;
}

// === Wrappers esperados por componentes (compat) ===
export async function getAcciones(
  params: FetchAccionesParams = {}
) {
  return fetchAcciones(params);
}
export async function getAccionDetalle(id: string) {
  const res = await fetch(`${API_URL}/acciones/${encodeURIComponent(String(id))}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error cargando detalle de acción");
  return res.json() as Promise<JsonRecord>;
}
export async function setAccionEstado(id: string, estado: AccionEstado) {
  return updateAccionEstado(String(id), estado);
}
