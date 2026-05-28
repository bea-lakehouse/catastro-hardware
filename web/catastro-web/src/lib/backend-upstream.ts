export function backendBaseCandidates() {
  return [
    process.env.INTERNAL_API_BASE,
    process.env.API_BASE_INTERNAL,
    process.env.API_BASE,
    process.env.API_URL,
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_BASE,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://backend:8000",
    "http://catastro-backend:8000",
  ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index);
}

export async function fetchBackendResponse(path: string, init: RequestInit = {}) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  let lastError: Error | null = null;

  for (const base of backendBaseCandidates()) {
    const upstream = `${base}${cleanPath}`;

    try {
      const response = await fetch(upstream, {
        cache: "no-store",
        ...init,
      });
      return { response, upstream };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Backend unavailable for ${cleanPath}`);
}

export async function fetchBackendJson<T>(path: string, init: RequestInit = {}) {
  const { response, upstream } = await fetchBackendResponse(path, init);
  const text = await response.text();

  try {
    return {
      ok: response.ok,
      status: response.status,
      upstream,
      json: JSON.parse(text) as T,
      text,
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      upstream,
      json: null as T | null,
      text,
    };
  }
}
