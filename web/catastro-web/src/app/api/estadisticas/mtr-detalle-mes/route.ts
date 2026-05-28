import { NextRequest, NextResponse } from "next/server";
import { fetchBackendResponse } from "@/lib/backend-upstream";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mes = searchParams.get("mes") ?? "";
    const tipo = searchParams.get("tipo") ?? "ingresos";
    const limit = searchParams.get("limit") ?? "500";

    const path =
      `/estadisticas/mtr-detalle-mes` +
      `?mes=${encodeURIComponent(mes)}` +
      `&tipo=${encodeURIComponent(tipo)}` +
      `&limit=${encodeURIComponent(limit)}`;

    const { response: r } = await fetchBackendResponse(path);
    const txt = await r.text();

    return new NextResponse(txt, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "mtr-detalle-mes route failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
