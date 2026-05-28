const API_URL = "/api/proxy";

export type Anomalia = {
  id?: string | number | null;
  tipo?: string | null;
  mensaje?: string | null;
  score?: string | number | null;
  sku?: string | number | null;
  nro_serie?: string | null;
  persona_actual?: string | null;
  ciudad_actual?: string | null;
};

/**
 * Wrapper usado por MlPanel.tsx
 * Intenta pegarle a un endpoint razonable. Si tu backend tiene otro,
 * cambia el path aquí y listo.
 */
export async function getAnomalias(params: { limit?: number | string } = {}) {
  const q = new URLSearchParams({
    limit: String(params.limit ?? "200"),
  });

  // endpoints candidatos (por si en tu backend varía)
  const candidates = [
    `${API_URL}/ml/anomalias?${q}`,
    `${API_URL}/anomalias?${q}`,
    `${API_URL}/ml/v2/anomalias?${q}`,
  ];

  let lastErr: Error | null = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error(`${res.status} ${res.statusText} @ ${url}`);
        continue;
      }
      const json = (await res.json()) as { rows?: Anomalia[] } | Anomalia[];
      if (Array.isArray(json)) return { rows: json };
      return { rows: json.rows ?? [] };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastErr ?? new Error("Error cargando anomalias");
}
