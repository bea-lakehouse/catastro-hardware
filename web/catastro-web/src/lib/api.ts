type ApiErrorInfo = {
  url: string
  status: number
  statusText: string
  contentType: string | null
  bodySnippet: string
}

type JsonRecord = Record<string, unknown>
type AccionDetalle = JsonRecord & {
  estado?: string
}

const API_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_FRONTEND_API_TIMEOUT_MS ??
    process.env.FRONTEND_API_TIMEOUT_MS ??
    8000
)

function snippet(s: string, n = 300) {
  const t = (s ?? "").trim()
  return t.length > n ? t.slice(0, n) + "…" : t
}

async function readBodyAsText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}

function proxyPath(path: string) {
  return path.startsWith("/api/proxy") ? path : `/api/proxy${path}`
}

function backendCandidates() {
  return [
    process.env.INTERNAL_API_BASE,
    process.env.API_BASE_INTERNAL,
    process.env.NEXT_PUBLIC_API_BASE,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
  ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index)
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timeout de backend tras ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function apiProxyGet<T>(
  path: string,
  options?: { origin?: string; timeoutMs?: number }
): Promise<T> {
  const isServer = typeof window === "undefined"
  const candidates = isServer
    ? [
        ...backendCandidates().map((base) => `${base}${path}`),
        ...(options?.origin ? [`${options.origin}${proxyPath(path)}`] : []),
      ]
    : [proxyPath(path)]
  const requestTimeoutMs = options?.timeoutMs ?? API_TIMEOUT_MS
  const attemptTimeoutMs =
    candidates.length > 1
      ? Math.max(1500, Math.floor(requestTimeoutMs / candidates.length))
      : requestTimeoutMs

  let lastError: Error | null = null

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, { cache: "no-store" }, attemptTimeoutMs)
      const contentType = res.headers.get("content-type")
      const text = await readBodyAsText(res)

      if (!res.ok) {
        const error = new Error(`HTTP ${res.status} ${res.statusText}`)
        if (typeof window !== "undefined") {
          console.error("[apiProxyGet] error:", {
            url,
            status: res.status,
            statusText: res.statusText,
            contentType,
            bodySnippet: snippet(text),
          })
        }
        lastError = error
        continue
      }

      if (!text || !text.trim()) {
        return {} as T
      }

      const looksJson =
        (contentType && contentType.includes("application/json")) ||
        text.trim().startsWith("{") ||
        text.trim().startsWith("[")

      if (looksJson) {
        try {
          return JSON.parse(text) as T
        } catch (e: unknown) {
          if (typeof window !== "undefined") {
            console.error("[apiProxyGet] invalid JSON:", {
              url,
              contentType,
              bodySnippet: snippet(text),
              error: e instanceof Error ? e.message : String(e),
            })
          }
          lastError = new Error("Respuesta inválida del backend")
          continue
        }
      }

      return (text as unknown) as T
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error("Backend no disponible")
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiProxyGet<T>(path)
}

// -----------------------------------------------------------------------------
// Acciones: detalle (usado por AccionDrawer)
// -----------------------------------------------------------------------------
export async function getAccionDetalle(id: string | number): Promise<AccionDetalle> {
  const base =
    process.env.NEXT_PUBLIC_API_BASE ??
    ""; // en prod normalmente vacío (mismo host)

  // Endpoint esperado por el backend (fallbacks típicos)
  const candidates = [
    `${base}/api/acciones/${encodeURIComponent(String(id))}`,
    `${base}/api/acciones/detalle?id=${encodeURIComponent(String(id))}`,
  ];

  let lastErr: Error | null = null;

  for (const url of candidates) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        lastErr = new Error(`HTTP ${r.status} @ ${url}`);
        continue;
      }
      return await r.json();
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }

  throw lastErr ?? new Error("No pude cargar detalle de acción.");
}

export type EstadoAccion = "PENDIENTE" | "EN_PROGRESO" | "RESUELTA" | "DESCARTADA";

// -----------------------------------------------------------------------------
// Acciones: actualizar estado (usado por AccionDrawer)
// -----------------------------------------------------------------------------
export async function setAccionEstado(
  id: string | number,
  estado: EstadoAccion
): Promise<JsonRecord> {
  const base =
    process.env.NEXT_PUBLIC_API_BASE ??
    ""; // en prod normalmente vacío (mismo host)

  const body = { id: String(id), estado };

  // Endpoints candidatos (ajusta si tu backend tiene uno específico)
  const candidates = [
    `${base}/api/acciones/estado`,
    `${base}/api/acciones/${encodeURIComponent(String(id))}/estado`,
  ];

  let lastErr: Error | null = null;

  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!r.ok) {
        lastErr = new Error(`HTTP ${r.status} @ ${url}`);
        continue;
      }
      return await r.json();
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      continue
    }
  }

  throw lastErr ?? new Error("No pude actualizar estado de acción.");
}

// ✅ Type mínimo para UI (evita error TS en imports)
export type Accion = JsonRecord & {
  id: string;
  titulo: string;
  tipo: string;
  prioridad: string;
  mensaje?: string | null;
  created_at?: string | null;
  estado?: string | null;
  dias_a_vencer?: number | null;
};

// re-export acciones (compat)
export * from "./api/acciones";
export * from "./api/anomalias";
