import { NextResponse } from "next/server";
import { fetchBackendJson } from "@/lib/backend-upstream";

type CountResponse = {
  count?: number | null;
};

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes") || currentMonthStart();

  const qs = `mes=${encodeURIComponent(mes)}`;

  const origin = new URL(req.url).origin;
  const [ing, sal, asig, cambios] = await Promise.all([
    fetchBackendJson<CountResponse>(`/estadisticas/mtr-count?${qs}&tipo=ingresos`).then((r) => r.json ?? {}),
    fetchBackendJson<CountResponse>(`/estadisticas/mtr-count?${qs}&tipo=salidas`).then((r) => r.json ?? {}),

    // Asignaciones: usar endpoint real (ya funciona y trae count)
    fetchBackendJson<CountResponse>(`/estadisticas/asignaciones-mes?${qs}&limit=1`).then((r) => r.json ?? {}),

    // Cambios de equipo: fuente manual (Next API)
    fetch(`${origin}/api/estadisticas/cambios-equipo-mes?${qs}&limit=500`, { cache: "no-store" }).then(r => r.json()),
  ]);

  return NextResponse.json({
    mes,
    ingresos: ing?.count ?? 0,
    salidas: sal?.count ?? 0,
    asignaciones: asig?.count ?? 0,
    cambios_equipo: cambios?.count ?? 0,
  });
}
