import Link from "next/link";
import { getStatusClassName } from "@/lib/statusStyles";

const ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

type SearchParams = {
  mes?: string;
  limit?: string;
};

type CompraRow = {
  fecha_compra?: string;
  sku?: string;
  serial?: string;
  modelo?: string;
  cpu?: string;
  ram?: string;
  disco?: string;
  estado?: string;
};

type CompraResp = {
  mes?: string;
  rows?: CompraRow[];
  count?: number;
};

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

async function getCompras(mes: string, limit: number): Promise<CompraResp> {
  const url = `${ORIGIN}/api/estadisticas/compras-equipos-mes?mes=${encodeURIComponent(
    mes.slice(0, 7)
  )}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Error cargando compras: ${r.status}`);
  return r.json();
}

function fmt(v: unknown) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s || "—";
}

export default async function ComprasEquiposPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) || {};
  const mes = sp.mes || currentMonthStart();
  const limit = Number(sp.limit || "500");

  const data = await getCompras(mes, limit);
  const rows = Array.isArray(data?.rows) ? data.rows : [];

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
      <div className="catastro-panel-strong mb-6 flex items-center justify-between rounded-3xl p-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--cat-text)]">🛒 Compras de equipos</h1>
          <p className="mt-2 text-lg text-[var(--cat-text-muted)]">
            Mes: {mes} · Rows: {rows.length}
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
              <th className="px-4 py-4">Fecha compra</th>
              <th className="px-4 py-4">SKU</th>
              <th className="px-4 py-4">Serial</th>
              <th className="px-4 py-4">Modelo</th>
              <th className="px-4 py-4">CPU</th>
              <th className="px-4 py-4">RAM</th>
              <th className="px-4 py-4">Disco</th>
              <th className="px-4 py-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.serial || r.sku || idx}`} className="catastro-row">
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.fecha_compra)}</td>
                <td className="px-4 py-4 text-[var(--cat-text)]">{fmt(r.sku)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.serial)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.modelo)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.cpu)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.ram)}</td>
                <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmt(r.disco)}</td>
                <td className="px-4 py-4">
                  <span className={getStatusClassName(r.estado)}>
                    {fmt(r.estado)}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[var(--cat-text-soft)]">
                  Sin compras para este mes.
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
