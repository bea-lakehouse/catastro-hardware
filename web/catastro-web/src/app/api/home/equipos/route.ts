import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://backend:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = (searchParams.get("limit") || "200").trim();
    const offset = (searchParams.get("offset") || "0").trim();

    const r = await fetch(
      `${BACKEND_URL}/home/equipos?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
      { cache: "no-store" }
    );

    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { rows: [], count: 0, error: e instanceof Error ? e.message : String(e ?? "fetch failed") },
      { status: 200 }
    );
  }
}
