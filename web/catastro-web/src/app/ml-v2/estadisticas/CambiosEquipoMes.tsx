"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  fecha?: string;       // YYYY-MM-DD
  persona?: string;
  cliente?: string;
  equipo_anterior?: string | null;
  detalle_anterior?: string | null;
  equipo_nuevo?: string | null;
  detalle_nuevo?: string | null;
  fuente?: string;
};

function fmtFecha(s?: string) {
  if (!s) return "—";
  // YYYY-MM-DD -> DD/MM/YYYY
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(s);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function CambiosEquipoMes() {
  const [mes, setMes] = useState(currentMonthStart());
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        const r = await fetch(`/api/estadisticas/cambios-equipo-mes?mes=${encodeURIComponent(mes)}&limit=500`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (!alive) return;

        const rr = Array.isArray(j?.rows) ? j.rows : [];
        setRows(rr);
      } catch (e: unknown) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : String(e ?? "error"));
        setRows([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mes]);

  const count = rows.length;

  const ordered = useMemo(() => {
    // ordena desc por fecha, luego persona
    const a = [...rows];
    a.sort((x, y) => {
      const fx = String(x?.fecha ?? "");
      const fy = String(y?.fecha ?? "");
      if (fy !== fx) return fy.localeCompare(fx);
      return String(x?.persona ?? "").localeCompare(String(y?.persona ?? ""));
    });
    return a;
  }, [rows]);

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Cambios de equipos del mes</h2>
          <div className="text-xs opacity-70 mt-1">
            Fuente real: secuencia MTR por persona con cambio de SKU respecto del último equipo visible
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs opacity-70">Mes</div>
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            type="date"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
          No pude cargar cambios: {err}
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm opacity-80">
            Total registros: <span className="font-semibold">{count}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950/60">
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-300">
                  <th className="p-4 w-[18%]">Persona</th>
                  <th className="p-4 w-[10%]">Fecha</th>
                  <th className="p-4">Equipo anterior</th>
                  <th className="p-4">Equipo nuevo</th>
                </tr>
              </thead>

              <tbody>
                {ordered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center opacity-60">
                      No hay registros para este mes.
                    </td>
                  </tr>
                )}

                {ordered.map((r, idx) => (
                  <tr key={`${r.persona || "x"}__${r.fecha || "y"}__${idx}`} className="border-t border-neutral-800 align-top">
                    <td className="p-4">
                      <div className="font-medium">{r.persona || "—"}</div>
                      <div className="mt-1 text-[11px] opacity-60">{r.cliente || "Sin cliente"}</div>
                      {r.fuente && <div className="mt-1 text-[11px] opacity-60">{r.fuente}</div>}
                    </td>

                    <td className="p-4 font-mono">{fmtFecha(r.fecha)}</td>

                    <td className="p-4">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="font-mono text-xs opacity-70">{r.equipo_anterior || "—"}</div>
                        <div className="mt-1">{r.detalle_anterior || "Sin detalle"}</div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                        <div className="font-mono text-xs opacity-70">{r.equipo_nuevo || "—"}</div>
                        <div className="mt-1">{r.detalle_nuevo || "Sin detalle"}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
