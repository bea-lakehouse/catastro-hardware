import Link from "next/link";

const ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

type SearchParams = {
  mes?: string;
  limit?: string;
};

type Row = {
  fecha_evento?: string;
  persona?: string;
  cliente?: string;
  pais?: string;
  ciudad?: string;
  equipo_asignado_actual?: string | null;
  modelo_equipo?: string | null;
  serial?: string | null;
  plataforma?: string | null;
  condicion?: string | null;
};

type Resp = {
  mes?: string;
  rows?: Row[];
  count?: number;
};

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

async function getCore(mes: string, limit: number): Promise<Resp> {
  const url = `${ORIGIN}/api/estadisticas/mtr-core-extranjeros-manual?mes=${encodeURIComponent(
    mes.slice(0, 7)
  )}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Error cargando core extranjeros: ${r.status}`);
  return r.json();
}

function fmt(v: unknown) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s || "—";
}

function fmtSku(v: unknown) {
  const s = fmt(v);
  if (s === "—") return s;
  return s.startsWith("SKU-") ? s : `SKU-${s}`;
}

export default async function CoreExtranjerosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) || {};
  const mes = sp.mes || currentMonthStart();
  const limit = Number(sp.limit || "500");

  const data = await getCore(mes, limit);
  const rows = Array.isArray(data?.rows) ? data.rows : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">�� Core extranjeros</h1>
          <p className="mt-2 text-lg text-white/80">
            Mes: {mes} · Rows: {rows.length}
          </p>
        </div>

        <Link
          href="/ml-v2/estadisticas"
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 hover:bg-white/10"
        >
          ← Estadísticas
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <table className="min-w-full text-left">
          <thead className="bg-white/5 text-sm uppercase tracking-wide text-sky-300">
            <tr>
              <th className="px-4 py-4">Fecha</th>
              <th className="px-4 py-4">Persona</th>
              <th className="px-4 py-4">Cliente</th>
              <th className="px-4 py-4">País</th>
              <th className="px-4 py-4">Ciudad</th>
              <th className="px-4 py-4">Equipo</th>
              <th className="px-4 py-4">Modelo</th>
              <th className="px-4 py-4">Condición</th>
              <th className="px-4 py-4">Mac/Win</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.persona || "row"}-${r.fecha_evento || idx}-${idx}`} className="border-t border-white/10">
                <td className="px-4 py-4">{fmt(r.fecha_evento)}</td>
                <td className="px-4 py-4">{fmt(r.persona)}</td>
                <td className="px-4 py-4">{fmt(r.cliente)}</td>
                <td className="px-4 py-4">{fmt(r.pais)}</td>
                <td className="px-4 py-4">{fmt(r.ciudad)}</td>
                <td className="px-4 py-4">{fmtSku(r.equipo_asignado_actual)}</td>
                <td className="px-4 py-4">{fmt(r.modelo_equipo)}</td>
                <td className="px-4 py-4">{fmt(r.condicion)}</td>
                <td className="px-4 py-4">{fmt(r.plataforma ? String(r.plataforma).toUpperCase() : null)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-white/50">
                  Sin movimientos para este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
