import Link from "next/link";

type PaisBreakdown = {
  pais?: string;
  n?: number;
  pct?: number;
};

type MovRow = {
  fecha?: string;
  id_equipo?: string | null;
  tipo?: string;
  persona?: string | null;
  marca?: string | null;
  modelo?: string | null;
  os_familia?: string | null;
  condicion?: string | null;
  cliente_destino?: string | null;
  ubicacion_destino?: string | null;
};

type MovimientosResponse = {
  kpis?: {
    total?: number;
    pct_nuevo?: number;
    pct_usado?: number;
    nuevo?: number;
    usado?: number;
    pais_breakdown?: PaisBreakdown[];
  };
  rows?: MovRow[];
  source?: string | null;
};

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ mes?: string; limit?: string }>;
}) {
  const sp = (await searchParams) || {};
  const mes = sp?.mes ?? currentMonthStart();
  const limit = Number(sp?.limit ?? "500");

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = `${base}/api/estadisticas/movimientos-internos-core-extranjeros-mes?mes=${encodeURIComponent(
    mes
  )}&limit=${limit}`;

  const r = await fetch(url, { cache: "no-store" });
  const data: MovimientosResponse = r.ok
    ? ((await r.json()) as MovimientosResponse)
    : { kpis: { total: 0 }, rows: [], source: null };

  const k = data?.kpis ?? {};
  const rows: MovRow[] = Array.isArray(data?.rows) ? data.rows : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-3xl">🧩</span> Movimientos internos (Core Extranjeros)
          </h1>
          <p className="mt-2 opacity-80">
            Mes: <span className="font-mono">{mes}</span> · Rows: {rows.length} · Fuente:{" "}
            <span className="font-mono">{String(data?.source ?? "—")}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="text-sm px-3 py-2 rounded-md border border-white/10 hover:bg-white/10"
            href="/ml-v2/estadisticas"
          >
            Volver
          </Link>
          <Link
            className="text-sm px-3 py-2 rounded-md border border-white/10 hover:bg-white/10"
            href="/"
          >
            Home
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs opacity-70">Movimientos</div>
            <div className="text-2xl font-semibold">{k.total ?? 0}</div>
          </div>
<div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs opacity-70">% Nuevo</div>
            <div className="text-2xl font-semibold">{(k.pct_nuevo ?? 0)}%</div>
            <div className="text-xs opacity-60 mt-1">{k.nuevo ?? 0} de {k.total ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs opacity-70">% Usado</div>
            <div className="text-2xl font-semibold">{(k.pct_usado ?? 0)}%</div>
            <div className="text-xs opacity-60 mt-1">{k.usado ?? 0} de {k.total ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">País (top)</div>
          <div className="text-xs opacity-70">Distribución</div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Array.isArray(k.pais_breakdown) ? k.pais_breakdown : []).slice(0, 9).map((p, i: number) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
              <div className="text-sm">{p.pais ?? "—"}</div>
              <div className="text-xs opacity-80 font-mono">{p.n ?? 0} · {p.pct ?? 0}%</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm font-semibold">Detalle</div>
          <div className="text-xs opacity-70">limit={limit}</div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold opacity-80">FECHA</th>
                <th className="px-4 py-3 font-semibold opacity-80">EQUIPO</th>
                <th className="px-4 py-3 font-semibold opacity-80">TIPO</th>
                <th className="px-4 py-3 font-semibold opacity-80">PERSONA</th>
                <th className="px-4 py-3 font-semibold opacity-80">MARCA</th>
                <th className="px-4 py-3 font-semibold opacity-80">MODELO</th>
                <th className="px-4 py-3 font-semibold opacity-80">WIN/MAC</th>
                <th className="px-4 py-3 font-semibold opacity-80">COND.</th>
                <th className="px-4 py-3 font-semibold opacity-80">CLIENTE DEST</th><th className="px-4 py-3 font-semibold opacity-80">UBI DEST</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 opacity-70" colSpan={9}>
                    — sin resultados —
                  </td>
                </tr>
              ) : (
                rows.map((x, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono">{x.fecha ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{x.id_equipo ?? "—"}</td>
                    <td className="px-4 py-3">{x.tipo ?? "—"}</td>
                    <td className="px-4 py-3">{x.persona ?? "—"}</td>
                    <td className="px-4 py-3">{x.marca ?? "—"}</td>
                    <td className="px-4 py-3">{x.modelo ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{x.os_familia ?? "—"}</td>
                    <td className="px-4 py-3">{x.condicion ?? "—"}</td>
                    <td className="px-4 py-3">{x.cliente_destino ?? "—"}</td><td className="px-4 py-3">{x.ubicacion_destino ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
