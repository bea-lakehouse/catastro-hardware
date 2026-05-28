const BASE = "/api/proxy";
export type AccionesKpis = {
  criticas_hoy: number;
  renovaciones_30: number;
  reasignaciones: number;
  pendientes_total: number;
};

export async function fetchAccionesKpis(): Promise<AccionesKpis> {
  const r = await fetch(`${BASE}/acciones/kpis`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Error fetchAccionesKpis: ${r.status}`);
  return r.json();
}
