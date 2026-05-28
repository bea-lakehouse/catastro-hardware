import Link from "next/link";
import { apiProxyGet } from "@/lib/api";
import { getRequestOrigin } from "@/lib/request-origin";

type MlScoreRow = {
  id_equipo?: string;
  equipo?: string;
  nivel_riesgo?: string;
  riesgo_total?: number;
  motivos_resumen?: string;
  resumen?: string;
  motivos?: string;
};

async function getMlScores(limit: number) {
  const origin = await getRequestOrigin();

  try {
    const j = await apiProxyGet<{ rows?: MlScoreRow[]; items?: MlScoreRow[] } | MlScoreRow[]>(
      `/ml/v2/scores?limit=${limit}`,
      { origin, timeoutMs: 5000 }
    );
    const rows = Array.isArray(j)
      ? j
      : Array.isArray(j.rows)
      ? j.rows
      : Array.isArray(j.items)
      ? j.items
      : [];
    return { rows, error: null as string | null };
  } catch (error) {
    return {
      rows: [] as MlScoreRow[],
      error: error instanceof Error ? error.message : "No fue posible leer /ml/v2/scores.",
    };
  }
}

export default async function MlPage() {
  const { rows, error } = await getMlScores(200);

  const top = rows
    .slice()
    .sort((a, b) => Number(b?.riesgo_total ?? 0) - Number(a?.riesgo_total ?? 0))
    .slice(0, 30);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">🤖 ML — Scores</h1>
          <div className="text-sm text-muted-foreground mt-1">
            Top equipos por riesgo_total (limit 200, mostramos 30)
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ml-v2/estadisticas"
            className="text-sm px-3 py-2 rounded-md border border-white/10 hover:bg-white/10"
          >
            Volver
          </Link>
          <Link
            href="/home/kpis"
            className="text-sm px-3 py-2 rounded-md border border-white/10 hover:bg-white/10"
          >
            Home
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {error ? (
          <div className="border-b border-amber-300/30 bg-amber-100/10 p-4 text-sm text-amber-200">
            ML no respondió con scores actuales. {error}
          </div>
        ) : null}
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-sky-300/80">
            <tr>
              <th className="p-2 text-left font-medium">Equipo</th>
              <th className="p-2 text-left font-medium">Nivel</th>
              <th className="p-2 text-left font-medium">Riesgo</th>
              <th className="p-2 text-left font-medium">Motivos</th>
              <th className="p-2 text-center font-medium w-[1%] whitespace-nowrap">Link</th>
            </tr>
          </thead>
          <tbody>
            {top.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center opacity-60">—</td>
              </tr>
            )}
            {top.map((r, idx) => (
              <tr key={String(r?.id_equipo ?? r?.equipo ?? `row-${idx}`)} className="border-t border-white/10">
                <td className="p-2 font-mono">{String(r?.id_equipo ?? r?.equipo ?? "—")}</td>
                <td className="p-2">{String(r?.nivel_riesgo ?? "—")}</td>
                <td className="p-2">{String(r?.riesgo_total ?? "—")}</td>
                <td className="p-2 opacity-80">
                  {String(r?.motivos_resumen ?? r?.resumen ?? r?.motivos ?? "—")}
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  {r?.id_equipo ? (
                    <Link href={`/equipos/${r.id_equipo}`} className="text-blue-400 hover:underline">
                      Ver →
                    </Link>
                  ) : (
                    <span className="opacity-50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
