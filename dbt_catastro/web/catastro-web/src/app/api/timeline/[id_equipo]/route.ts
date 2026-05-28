import { NextResponse } from "next/server";

const BASE =
  process.env.INTERNAL_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://backend:8000"; // dentro de docker

export async function GET(
  _req: Request,
  { params }: { params: { id_equipo: string } }
) {
  const { id_equipo } = params;

  const url = `${BASE}/equipos/${id_equipo}/timeline`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  return NextResponse.json(data, { status: res.status });
}
