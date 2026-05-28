import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "36";

  const base =
    process.env.API_BASE_INTERNAL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    "http://backend:8000";

  // backend expone /estadisticas/* (sin /api)
  const upstream = `${base}/estadisticas/asignaciones-extranjeros-mes?limit=${encodeURIComponent(limit)}`;

  try {
    const r = await fetch(upstream, { cache: "no-store" });
    const text = await r.text();
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: r.status });
    } catch {
      return NextResponse.json(
        { error: "Upstream no devolvió JSON", upstream, body: text.slice(0, 600) },
        { status: 502 }
      );
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "fetch failed", upstream, detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
