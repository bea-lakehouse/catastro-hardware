const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchAccionesGrupos() {
  const res = await fetch(`${API_URL}/acciones/grupos`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error cargando grupos");
  return res.json();
}

export async function fetchAcciones(params: {
  tipo: string;
  prioridad: string;
}) {
  const q = new URLSearchParams({
    tipo: params.tipo,
    prioridad: params.prioridad,
    hide_resueltas: "true",
    order: "urgencia",
    limit: "200",
  });

  const res = await fetch(`${API_URL}/acciones/?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error cargando acciones");
  return res.json();
}

export async function updateAccionEstado(
  id: string,
  estado: "RESUELTA" | "DESCARTADA"
) {
  const res = await fetch(`${API_URL}/acciones/${id}/estado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error("Error actualizando acción");
}

export async function bulkEstado(ids: string[], estado: "RESUELTA" | "DESCARTADA") {
  const res = await fetch(`${API_BASE}/acciones/bulk_estado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, estado }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`bulk_estado failed: ${res.status} ${txt}`);
  }

  return res.json();
}
