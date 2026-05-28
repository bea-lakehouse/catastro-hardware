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
      `/estadisticas/cambios-equipo-mes?mes=${encodeURIComponent(mes)}&limit=${encodeURIComponent(limit)}`
    );
    const rows = Array.isArray(json?.rows)
      ? json.rows.flatMap((row: Record<string, unknown>) => {
          const fecha = row.fecha ?? null;
          const persona = row.persona ?? null;

          return [
            {
              fecha_evento: fecha,
              persona,
              tipo_evento: "DEVUELTO",
              sku: row.equipo_anterior ?? null,
              modelo: row.detalle_anterior ?? null,
              serial: null,
              condicion: null,
              plataforma: null,
            },
            {
              fecha_evento: fecha,
              persona,
              tipo_evento: "ENTREGADO",
              sku: row.equipo_nuevo ?? null,
              modelo: row.detalle_nuevo ?? null,
              serial: null,
              condicion: null,
              plataforma: null,
            },
          ];
        })
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
        error: "mtr-cambios-manual route failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
