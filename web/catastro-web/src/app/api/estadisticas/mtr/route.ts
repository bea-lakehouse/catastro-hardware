import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mes = searchParams.get("mes") ?? "";
  const tipo = searchParams.get("tipo") ?? "ingresos";
  const limit = searchParams.get("limit") ?? "500";

  const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";
  const url = `${BACKEND_URL}/estadisticas/mtr?mes=${encodeURIComponent(mes)}&tipo=${encodeURIComponent(tipo)}&limit=${encodeURIComponent(limit)}`;

  const r = await fetch(url, { cache: "no-store" });
  const txt = await r.text();

  return new NextResponse(txt, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}
