export async function GET() {
  const base =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://catastro-backend:8000";

  const r = await fetch(`${base}/estadisticas/renovaciones-resumen`, {
    cache: "no-store",
  });

  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") || "application/json" },
  });
}
