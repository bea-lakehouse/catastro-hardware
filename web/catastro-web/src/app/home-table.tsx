"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getStatusClassName } from "@/lib/statusStyles";

type Mlv2Row = {
  equipo_id?: string;
  nivel_riesgo?: string;
  riesgo_total?: number;
};

type HomeRow = {
  id_equipo: string;
  estado_equipo?: string;
  persona_asignada?: string | null;
  prioridad?: string | null;
  alerta?: string | null;
  nivel?: string | null;
  severidad?: string | null;
};

function norm(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default function HomeTable({
  rows,
  mlv2,
}: {
  rows: HomeRow[];
  mlv2: Mlv2Row[];
}) {
  const params = useSearchParams();
  const sev = params?.get("sev") ?? "all";

  const mlById = new Map((mlv2 ?? []).map((m) => [m.equipo_id, m]));

  const rowsView = (rows ?? []).filter((e) => {
    const pr = norm(e?.prioridad || e?.alerta || e?.nivel || e?.severidad);
    if (sev === "all") return true;
    if (sev === "critical") return pr.includes("crit");
    if (sev === "warning") return pr.includes("warn");
    if (sev === "info") return pr.includes("info");
    return true;
  });

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/?sev=all"
          className={
            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] " +
            (sev === "all"
              ? "catastro-pill-active"
              : "catastro-pill")
          }
        >
          Todas
        </Link>
        <Link
          href="/?sev=critical"
          className={
            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] " +
            (sev === "critical"
              ? "catastro-pill-active text-[var(--cat-danger)]"
              : "catastro-pill")
          }
        >
          Críticas
        </Link>
        <Link
          href="/?sev=warning"
          className={
            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] " +
            (sev === "warning"
              ? "catastro-pill-active text-[var(--cat-warning)]"
              : "catastro-pill")
          }
        >
          Warnings
        </Link>
        <Link
          href="/?sev=info"
          className={
            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] " +
            (sev === "info"
              ? "catastro-pill-active text-[var(--cat-primary-strong)]"
              : "catastro-pill")
          }
        >
          Info
        </Link>
      </div>

      <div className="catastro-table-shell overflow-hidden rounded-2xl">
        <table className="w-full">
          <thead className="catastro-table-head">
            <tr className="text-left text-sm">
              <th className="p-4">Equipo</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Persona</th>
              <th className="w-[1%] whitespace-nowrap py-4 pr-3 text-right">Ver</th>
            </tr>
          </thead>

          <tbody>
            {rowsView.map((e) => {
              if (!e) return null;

              const ml = mlById.get(e.id_equipo);

              return (
                <tr key={e.id_equipo} className="catastro-row">
                  <td
                    className="p-4 font-mono text-[var(--cat-text)]"
                    title={
                      ml?.nivel_riesgo
                        ? `${ml.nivel_riesgo}${typeof ml.riesgo_total === "number" ? ` (${ml.riesgo_total})` : ""}`
                        : undefined
                    }
                  >
                    {e.id_equipo}
                  </td>
                  <td className="p-4 text-[var(--cat-text-muted)]">
                    <span className={getStatusClassName(e.estado_equipo)}>
                      {e.estado_equipo ?? "—"}
                    </span>
                  </td>
                  <td className="p-4 text-[var(--cat-text-muted)]">{e.persona_asignada ?? "-"}</td>
                  <td className="whitespace-nowrap py-3 pr-3 pl-2 text-right">
                    <a
                      className="font-medium text-[var(--cat-primary)] hover:underline"
                      href={`/equipos/${encodeURIComponent(e.id_equipo)}`}
                    >
                      Ver →
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
