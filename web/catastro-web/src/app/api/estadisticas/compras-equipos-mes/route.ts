import { NextRequest, NextResponse } from "next/server";
import { fetchBackendJson } from "@/lib/backend-upstream";

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mes = (searchParams.get("mes") || currentMonthStart()).trim();
    const limit = (searchParams.get("limit") || "500").trim();

    const { json, status } = await fetchBackendJson(
      `/estadisticas/mtr-compras-manual?mes=${encodeURIComponent(mes)}&limit=${encodeURIComponent(limit)}`
    );
    return NextResponse.json(json, { status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "compras-equipos-mes route failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
