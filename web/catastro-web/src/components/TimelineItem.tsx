import React from "react";

type TimelineRow = {
  id_evento?: string | number | null;

  // backend MART (nuevo)
  fecha_evento?: string | null;
  tipo_evento?: string | null;
  detalle_evento?: string | null;
  detalle_titulo?: string | null;
  detalle_subtitulo?: string | null;
  badge_tipo?: string | null;

  // legacy / compat
  fecha?: string | null;
  at?: string | null;
  tipo?: string | null;
  detalle?: string | null;
};

function stableDate(iso?: string | null) {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : String(iso);
}

function badgeClass(badge?: string | null) {
  const k = String(badge || "").toLowerCase().trim();
  if (k === "naranja")
    return "bg-orange-500/15 text-orange-300 border border-orange-400/30";
  if (k === "tenue")
    return "bg-neutral-900 text-neutral-400 border border-neutral-800";
  if (k === "gris")
    return "bg-neutral-800 text-neutral-200 border border-neutral-700";
  return "bg-neutral-900 text-neutral-300 border border-neutral-800";
}

export default function TimelineItem({ row }: { row: TimelineRow }) {
  const iso = row.fecha_evento ?? row.at ?? row.fecha ?? null;
  const fecha = stableDate(iso);

  const tipo =
    String(row.tipo_evento || row.tipo || "").trim().toUpperCase() || "—";

  const titulo =
    String(row.detalle_titulo || "").trim() ||
    (tipo !== "—" ? tipo : "Evento");

  const subtitulo =
    String(row.detalle_subtitulo || "").trim() ||
    String(row.detalle_evento || row.detalle || "").trim() ||
    "—";

  return (
    <tr className="border-t border-white/5">
      <td className="py-2 pr-4 whitespace-nowrap text-sm text-neutral-400">
        {fecha}
      </td>

      <td className="py-2 pr-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass(
            row.badge_tipo
          )}`}
        >
          {tipo}
        </span>
      </td>

      <td className="py-2 pr-4 text-neutral-500">—</td>
      <td className="py-2 pr-4 text-neutral-500">—</td>

      <td className="py-2 text-sm">
        <div className="font-medium text-white">{titulo}</div>
        <div className="text-neutral-400">{subtitulo}</div>
      </td>
    </tr>
  );
}
