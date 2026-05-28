import { NextResponse } from "next/server";

const BACKEND_TIMEOUT_MS = Number(process.env.PROXY_BACKEND_TIMEOUT_MS ?? 12000);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "3";
  const base = process.env.INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://backend:8000";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const r = await fetch(`${base}/ml/v2/scores?limit=${encodeURIComponent(limit)}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        rows: [],
        count: 0,
        error: error instanceof Error ? error.message : String(error ?? "fetch failed"),
      },
      { status: 200 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
