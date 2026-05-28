import { NextRequest, NextResponse } from "next/server";
import { fetchBackendJson } from "@/lib/backend-upstream";

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function normalizeMes(raw: string | null) {
  const value = (raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return currentMonthStart();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mes = normalizeMes(searchParams.get("mes"));
    const limit = (searchParams.get("limit") || "500").trim();

    const { ok, status, json } = await fetchBackendJson<{ rows?: Record<string, unknown>[] }>(
      `/estadisticas/core-extranjeros-mes?mes=${encodeURIComponent(mes)}&limit=${encodeURIComponent(limit)}`
    );
    const rows = Array.isArray(json?.rows)
      ? json.rows.map((row: Record<string, unknown>) => ({
          fecha_evento: row.fecha ?? null,
          persona: row.persona ?? null,
          cliente: row.cliente_destino ?? row.cliente_origen ?? null,
          pais: null,
          ciudad: null,
          equipo_asignado_actual: row.id_equipo ?? null,
          modelo_equipo: null,
          serial: null,
          plataforma: null,
          condicion: null,
        }))
      : [];

    return NextResponse.json(
      {
        mes,
        count: rows.length,
        rows,
      },
      { status: ok ? 200 : status },
    );
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "mtr-core-extranjeros-manual route failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
