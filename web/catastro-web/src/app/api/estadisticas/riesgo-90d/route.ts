import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_INTERNAL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/estadisticas/riesgo-90d`, {
      cache: "no-store",
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "proxy_failed",
        api_base: API_BASE,
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
