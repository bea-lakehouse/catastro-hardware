"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  fecha_evento?: string | null;
  persona?: string | null;
  cliente_asignado?: string | null;
  equipo_asignado_actual?: string | null;
  id_equipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  condicion?: string | null;
  mac_win?: string | null;
  es_nuevo?: boolean | null;
  detalle?: string | null;
  ambito_laboral?: string | null;
};

type Resp = {
  mes: string;
  tipo: "ingresos" | "salidas";
  rows: Row[];
  count: number;
};

function monthStartIso(offset = 0) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

const MESES = [monthStartIso(-2), monthStartIso(-1), monthStartIso(0)];

function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function resumen(rows: Row[]) {
  const total = rows.length;
  const win = rows.filter((r) => (r.mac_win || "").toUpperCase() === "WIN").length;
  const mac = rows.filter((r) => (r.mac_win || "").toUpperCase() === "MAC").length;
  const nuevos = rows.filter((r) => Boolean(r.es_nuevo)).length;
  return { total, win, mac, nuevos };
}

function TableBlock({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: string;
  rows: Row[];
}) {
  const r = resumen(rows);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`text-sm font-semibold ${tone}`}>
          {title} · {rows.length}
        </h3>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-200">
            WIN: {r.win} ({pct(r.win, r.total)})
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            MAC: {r.mac} ({pct(r.mac, r.total)})
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
            NUEVOS: {r.nuevos}
          </span>
        </div>
      </div>

      <div className="catastro-table-shell overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="catastro-table-head">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Equipo</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Persona</th>
              <th className="px-3 py-2">OS</th>
              <th className="px-3 py-2">Condición</th>
              <th className="px-3 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="catastro-row">
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--cat-text-soft)]">
                  — sin datos —
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={`${row.id_equipo || "sin-equipo"}-${row.persona || "sin-persona"}-${i}`} className="catastro-row">
                  <td className="px-3 py-2 text-[var(--cat-text-muted)]">{row.fecha_evento ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-[var(--cat-text)]">
                    {row.id_equipo ?? row.equipo_asignado_actual ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--cat-text-muted)]">{row.cliente_asignado ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--cat-text-muted)]">{row.persona ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--cat-text-soft)]">{row.mac_win ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--cat-text-soft)]">{row.condicion ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--cat-text-soft)]">{row.detalle ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DetalleMesClient() {
  const [mes, setMes] = useState<string>(monthStartIso(0));
  const [ingresos, setIngresos] = useState<Row[]>([]);
  const [salidas, setSalidas] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const tituloMes = useMemo(() => {
    try {
      return new Date(`${mes}T00:00:00`).toLocaleDateString("es-CL", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return mes;
    }
  }, [mes]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const bust = Date.now();

        const [ri, rs] = await Promise.all([
          fetch(`/api/estadisticas/mtr-detalle-mes?mes=${encodeURIComponent(mes)}&tipo=ingresos&limit=500&_=${bust}`, {
            cache: "no-store",
          }),
          fetch(`/api/estadisticas/mtr-detalle-mes?mes=${encodeURIComponent(mes)}&tipo=salidas&limit=500&_=${bust}`, {
            cache: "no-store",
          }),
        ]);

        if (!ri.ok) throw new Error(`ingresos ${ri.status}`);
        if (!rs.ok) throw new Error(`salidas ${rs.status}`);

        const ji: Resp = await ri.json();
        const js: Resp = await rs.json();

        if (cancelled) return;

        setIngresos(Array.isArray(ji.rows) ? ji.rows : []);
        setSalidas(Array.isArray(js.rows) ? js.rows : []);
      } catch (e: unknown) {
        if (cancelled) return;
        setIngresos([]);
        setSalidas([]);
        setError(e instanceof Error ? e.message : "Error cargando detalle del mes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [mes]);

  return (
    <section className="catastro-panel rounded-2xl p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--cat-text)]">Detalle MTR por mes</h2>
          <p className="text-sm text-[var(--cat-text-soft)]">
            Ingresos y salidas reales desde el endpoint mtr-detalle-mes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {MESES.map((m) => {
            const active = mes === m;
            const label = new Date(`${m}T00:00:00`).toLocaleDateString("es-CL", {
              month: "short",
              year: "numeric",
            });
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMes(m)}
                className={
                  active
                    ? "catastro-pill-active rounded-full px-3 py-1.5 text-xs font-medium"
                    : "catastro-pill rounded-full px-3 py-1.5 text-xs font-medium transition"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="catastro-inset mb-4 rounded-xl px-4 py-3">
        <div className="text-lg font-semibold capitalize text-[var(--cat-text)]">{tituloMes}</div>
        <div className="mt-1 text-sm text-[var(--cat-text-soft)]">
          Ingresos {ingresos.length} · Salidas {salidas.length}
        </div>
        {loading ? <div className="mt-2 text-sm text-[var(--cat-primary)]">Cargando detalle...</div> : null}
        {error ? <div className="mt-2 text-sm text-rose-600">Error: {error}</div> : null}
      </div>

      <div className="space-y-6">
        <TableBlock title="📥 INGRESOS (MTR)" tone="text-cyan-300" rows={ingresos} />
        <TableBlock title="📤 SALIDAS (MTR)" tone="text-rose-300" rows={salidas} />
      </div>
    </section>
  );
}
