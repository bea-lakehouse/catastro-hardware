import Link from "next/link";
import type { ReactNode } from "react";

type Row = {
  fecha_asignacion?: string;
  persona?: string;
  cliente?: string;
  id_equipo?: string;
  sistema_operativo?: string;
  condicion?: string;
  tipo_colaborador?: string;
  ubicacion?: string;
  plataforma?: string;
};

type SearchParams = {
  mes?: string;
  limit?: string;
};

type AsignacionesResponse = {
  rows?: Row[];
  data?: Row[];
};

function pick(v: unknown) {
  const s = String(v ?? "").trim();
  return s && s !== "—" && s !== "-" ? s : "";
}

function isCoreExtr(r: Row) {
  const tipo = pick(r.tipo_colaborador).toLowerCase();
  const ubic = pick(r.ubicacion).toLowerCase();
  return tipo === "core" && ubic !== "" && ubic !== "chile";
}

function badgeClass(kind: "core" | "extr" | "mac" | "win" | "nuevo" | "usado") {
  switch (kind) {
    case "core":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "extr":
      return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200";
    case "mac":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "win":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "nuevo":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "usado":
      return "border-white/10 bg-white/5 text-white/80";
  }
}

function Badge({ children, cls }: { children: ReactNode; cls: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${cls}`}>
      {children}
    </span>
  );
}

function topN(rows: Row[], keyFn: (r: Row) => string, n = 8) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = pick(keyFn(r)) || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const mes = String(sp?.mes ?? currentMonthStart());
  const limit = Number(sp?.limit ?? 500);

  const base =
    process.env.API_BASE_INTERNAL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    "http://localhost:8000";

  // usa el proxy /api si lo tienes; si no, pega directo al backend
  const url = `${base}/estadisticas/asignaciones-mes?mes=${encodeURIComponent(mes)}&limit=${limit}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Error asignaciones-mes: ${r.status}`);
  const data = (await r.json()) as AsignacionesResponse;

  const rows: Row[] = Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.data) ? data.data : [];
  const coreExtr = rows.filter(isCoreExtr);

  // KPIs (mismo patrón “Ingresos”: arriba resumen, abajo tabla)
  const total = coreExtr.length;
  const sinEquipo = coreExtr.filter((x) => !pick(x.id_equipo)).length;

  const nNuevo = coreExtr.filter((x) => /nuevo/i.test(pick(x.condicion))).length;
  const nUsado = coreExtr.filter((x) => /usad/i.test(pick(x.condicion)) && !/nuevo/i.test(pick(x.condicion))).length;

  const nMac = coreExtr.filter((x) => pick(x.plataforma).toLowerCase() === "mac").length;
  const nWin = coreExtr.filter((x) => pick(x.plataforma).toLowerCase() === "win").length;

  const topClientes = topN(coreExtr, (x) => String(x?.cliente ?? "—"), 8);
  const topPaises = topN(coreExtr, (x) => String(x?.ubicacion ?? "—"), 8);

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold">Asignaciones — Core Extranjeros</div>
            <div className="text-white/60 text-sm">
              Mes: <span className="text-white/80">{mes}</span> · Fuente: <span className="text-white/80">stg_mtr_equipos_asignados_detalle</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link className="text-xs px-3 py-1 rounded-md border border-white/10 hover:bg-white/10" href="/ml-v2/estadisticas">
              Volver
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-white/60">Core Extranjeros</div>
            <div className="mt-1 text-2xl font-semibold">{total}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge cls={badgeClass("core")}>CORE</Badge>
              <Badge cls={badgeClass("extr")}>EXTRANJERO</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-white/60">Con equipo / Sin equipo</div>
            <div className="mt-1 text-2xl font-semibold">{total - sinEquipo} / {sinEquipo}</div>
            <div className="mt-2 text-xs text-white/60">“Sin equipo” = id_equipo vacío</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-white/60">Plataforma</div>
            <div className="mt-1 text-2xl font-semibold">{nMac} / {nWin}</div>
            <div className="mt-2 flex gap-2">
              <Badge cls={badgeClass("mac")}>MAC</Badge>
              <Badge cls={badgeClass("win")}>WIN</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs text-white/60">Condición</div>
            <div className="mt-1 text-2xl font-semibold">{nNuevo} / {nUsado}</div>
            <div className="mt-2 flex gap-2">
              <Badge cls={badgeClass("nuevo")}>NUEVO</Badge>
              <Badge cls={badgeClass("usado")}>USADO</Badge>
            </div>
          </div>
        </div>

        {/* Tops */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-medium">Top clientes</div>
            <div className="mt-2 flex flex-wrap gap-2">
            {topClientes.map(([k, n]) => (
                <Badge key={k} cls="border-white/10 bg-white/5 text-white/80">
                  {k} · {n}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-medium">Top países</div>
            <div className="mt-2 flex flex-wrap gap-2">
            {topPaises.map(([k, n]) => (
                <Badge key={k} cls="border-white/10 bg-white/5 text-white/80">
                  {k} · {n}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm font-medium">Detalle (Core Extranjeros)</div>
            <div className="text-xs text-white/60">rows: {coreExtr.length}</div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-white/60">
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2">Fecha</th>
                  <th className="text-left px-4 py-2">Persona</th>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">País</th>
                  <th className="text-left px-4 py-2">Equipo</th>
                  <th className="text-left px-4 py-2">OS</th>
                  <th className="text-left px-4 py-2">Condición</th>
                  <th className="text-left px-4 py-2">Plataforma</th>
                </tr>
              </thead>
              <tbody>
                {coreExtr.map((x, i) => {
                  const plat = pick(x.plataforma).toLowerCase();
                  const cond = pick(x.condicion);
                  const isNew = /nuevo/i.test(cond);
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-2 whitespace-nowrap">{pick(x.fecha_asignacion) || "—"}</td>
                      <td className="px-4 py-2">{pick(x.persona) || "—"}</td>
                      <td className="px-4 py-2">{pick(x.cliente) || "—"}</td>
                      <td className="px-4 py-2">{pick(x.ubicacion) || "—"}</td>
                      <td className="px-4 py-2">{pick(x.id_equipo) || "—"}</td>
                      <td className="px-4 py-2">{pick(x.sistema_operativo) || "—"}</td>
                      <td className="px-4 py-2">
                        {cond ? (
                          <Badge cls={isNew ? badgeClass("nuevo") : badgeClass("usado")}>{cond}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {plat ? (
                          <Badge cls={plat === "mac" ? badgeClass("mac") : badgeClass("win")}>{plat.toUpperCase()}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
                {coreExtr.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-white/60" colSpan={8}>
                      No hay asignaciones CORE extranjeras para este mes (o faltan columnas tipo_colaborador/ubicacion en la fuente).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
