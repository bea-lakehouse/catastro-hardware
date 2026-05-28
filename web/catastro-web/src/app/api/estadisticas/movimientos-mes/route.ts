import { NextResponse } from "next/server";
import { fetchBackendResponse } from "@/lib/backend-upstream";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "12";
  const path = `/estadisticas/movimientos-mes?limit=${encodeURIComponent(limit)}`;
  let upstream = path;

  try {
    const backend = await fetchBackendResponse(path);
    const r = backend.response;
    upstream = backend.upstream;
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
