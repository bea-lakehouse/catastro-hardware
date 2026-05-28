export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") || "100";

  const base =
    process.env.API_BASE_INTERNAL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://catastro-backend:8000";

  const r = await fetch(`${base}/estadisticas/activos-politica?limit=${limit}`, {
    cache: "no-store",
  });

  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") || "application/json" },
  });
}
