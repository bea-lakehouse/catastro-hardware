import { NextResponse } from "next/server";

export async function GET() {
  const base =
    process.env.INTERNAL_API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://backend:8000";

  try {
    const r = await fetch(`${base}/acciones/grupos`, { cache: "no-store" });
    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
      },
    });
  } catch (e: unknown) {
    // No mates el Home por acciones: devolvemos payload vacío OK para que el UI se degrade bien.
    return NextResponse.json(
      { rows: [], count: 0, error: e instanceof Error ? e.message : String(e ?? "fetch failed") },
      { status: 200 }
    );
  }
}
