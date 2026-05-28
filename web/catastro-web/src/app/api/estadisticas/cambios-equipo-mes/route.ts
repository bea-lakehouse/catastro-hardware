import { NextResponse } from "next/server";
import { fetchBackendResponse } from "@/lib/backend-upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mes = url.searchParams.get("mes") || currentMonthStart();
  const limit = url.searchParams.get("limit") || "500";

  const path = `/estadisticas/cambios-equipo-mes?mes=${encodeURIComponent(mes)}&limit=${encodeURIComponent(limit)}`;

  try {
    const { response: r, upstream } = await fetchBackendResponse(path);
    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
      },
    });
  } catch (e: unknown) {
    console.error("[cambios-equipo-mes] fetch error", {
      target: path,
      message: e instanceof Error ? e.message : String(e),
      cause: e instanceof Error ? e.cause : undefined,
    });

    return NextResponse.json(
      {
        error: "Backend unreachable",
        target: path,
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
