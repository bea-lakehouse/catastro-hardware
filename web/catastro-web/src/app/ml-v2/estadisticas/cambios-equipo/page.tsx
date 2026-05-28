import Link from "next/link";

const ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

type SearchParams = {
  mes?: string;
  limit?: string;
};

type CambioRow = {
  fecha_evento?: string;
  persona?: string;
  tipo_evento?: string;
  sku?: string | null;
  modelo?: string | null;
  serial?: string | null;
  condicion?: string | null;
  plataforma?: string | null;
};

type CambioResp = {
  mes?: string;
  rows?: CambioRow[];
  count?: number;
};

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

async function getCambios(mes: string, limit: number): Promise<CambioResp> {
  const url = `${ORIGIN}/api/estadisticas/mtr-cambios-manual?mes=${encodeURIComponent(
    mes.slice(0, 7)
  )}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Error cargando cambios: ${r.status}`);
  return r.json();
}

function fmt(v: unknown) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s || "—";
}

export default async function CambiosEquipoPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) || {};
  const mes = sp.mes || currentMonthStart();
  const limit = Number(sp.limit || "500");

  const data = await getCambios(mes, limit);
  const rows = Array.isArray(data?.rows) ? data.rows : [];

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
      <div className="catastro-panel-strong mb-6 flex items-center justify-between rounded-3xl p-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--cat-text)]">Cambios de equipo</h1>
          <p className="mt-2 text-lg text-[var(--cat-text-muted)]">
            Mes: {mes} · Registros: {rows.length}
          </p>
          <p className="mt-1 text-sm text-[var(--cat-text-soft)]">
            Fuente real: secuencia MTR por persona comparando el SKU nuevo contra el último SKU visible previo al corte.
          </p>
        </div>

        <Link
          href="/ml-v2/estadisticas"
          className="catastro-button-secondary rounded-xl px-5 py-3"
        >
          ← Estadísticas
        </Link>
      </div>

      <div className="catastro-table-shell overflow-hidden rounded-2xl">
        <table className="min-w-full text-left">
          <thead className="catastro-table-head text-sm uppercase tracking-wide">
            <tr>
              <th className="px-4 py-4">Fecha</th>
              <th className="px-4 py-4">Persona</th>
              <th className="px-4 py-4">Tipo</th>
              <th className="px-4 py-4">SKU</th>
              <th className="px-4 py-4">Modelo</th>
              <th className="px-4 py-4">Serial</th>
              <th className="px-4 py-4">Condición</th>
              <th className="px-4 py-4">Mac/Win</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={`${r.persona || "row"}-${r.fecha_evento || idx}-${r.tipo_evento || ""}-${idx}`}
                className="catastro-row"
              >
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.fecha_evento)}</td>
                <td className="px-4 py-4 text-[var(--cat-text)]">{fmt(r.persona)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.tipo_evento)}</td>
                <td className="px-4 py-4 text-[var(--cat-text)]">{fmt(r.sku)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.modelo)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.serial)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.condicion)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.plataforma ? String(r.plataforma).toUpperCase() : null)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[var(--cat-text-soft)]">
                  Sin cambios para este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </main>
  );
}
