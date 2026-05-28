import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id_equipo: string }> }
) {
  const { id_equipo } = await params;

  const base =
    process.env.INTERNAL_API_BASE ??
    process.env.API_BASE_INTERNAL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    "http://127.0.0.1:8000";

  const url = new URL(`${base}/equipos/${encodeURIComponent(id_equipo)}/timeline`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    const res = await fetch(url, { cache: "no-store" });
    const contentType = res.headers.get("content-type") ?? "application/json";
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": contentType },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "timeline_proxy_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
