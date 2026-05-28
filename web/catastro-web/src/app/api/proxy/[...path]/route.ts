import { NextRequest } from "next/server";

const BACKEND_TIMEOUT_MS = Number(process.env.PROXY_BACKEND_TIMEOUT_MS ?? 12000);

function backendCandidates() {
  return [
    process.env.INTERNAL_API_BASE,
    process.env.API_BASE_INTERNAL,
    process.env.NEXT_PUBLIC_API_BASE,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
  ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index);
}

async function handler(req: NextRequest) {
  const path = req.nextUrl.pathname.replace("/api/proxy", "");
  const headers = new Headers(req.headers);
  headers.delete("host");

  for (const base of backendCandidates()) {
    const url = `${base}${path}${req.nextUrl.search}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
        cache: "no-store",
        signal: controller.signal,
      });

      const outHeaders = new Headers();
      const ct = res.headers.get("content-type");
      if (ct) outHeaders.set("content-type", ct);

      return new Response(res.body, { status: res.status, headers: outHeaders });
    } catch (e: unknown) {
      console.error("[api/proxy] backend fetch failed", {
        base,
        path,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  try {
    return new Response(
      "Proxy error: backend unavailable",
      { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  } catch (e: unknown) {
    return new Response(
      "Proxy error: backend unavailable",
      { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
