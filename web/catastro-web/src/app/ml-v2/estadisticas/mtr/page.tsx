import Link from "next/link";

const ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

type SearchParams = {
  mes?: string;
  tipo?: "ingresos" | "salidas";
  limit?: string;
};

type DashboardResumen = {
  mes: string;
  estado_mes?: "cerrado" | "en_curso";
  fecha_ultima_actualizacion?: string | null;
  fuente?: string | null;
  ingresos_total: number;
  ingresos_chile: number;
  ingresos_extranjero: number;
  ingresos_con_equipo: number;
  ingresos_sin_equipo: number;
  ingresos_mac: number;
  ingresos_win: number;
  ingresos_nuevo: number;
  ingresos_usado: number;
  ingresos_internos: number;
  ingresos_nuevos_total: number;
  ingresos_nuevos_con_equipo: number;
  ingresos_nuevos_sin_equipo: number;
  ingresos_presion_compra: number;
  pct_ingresos_chile: number;
  pct_ingresos_extranjero: number;
  pct_ingresos_nuevo: number;
  pct_ingresos_usado: number;
  salidas_total: number;
  salidas_chile: number;
  salidas_extranjero: number;
  salidas_con_equipo: number;
  salidas_sin_equipo: number;
  salidas_mac: number;
  salidas_win: number;
  salidas_nuevo: number;
  salidas_usado: number;
  pct_salidas_chile: number;
  pct_salidas_extranjero: number;
  pct_salidas_nuevo: number;
  pct_salidas_usado: number;
  movimientos_core_extranjeros: number;
  core_ext_mac: number;
  core_ext_win: number;
  core_ext_nuevo: number;
  core_ext_usado: number;
  movimientos_internos?: number;
  asignaciones?: number;
  ingresos_hardware?: number;
  reasignaciones_hardware?: number;
  salidas_hardware?: number;
  cambios_equipo_mes?: number;
  presion_compra?: number;
  mix_clientes_salidas: string | null;
};

type DashboardRow = {
  fecha_evento?: string;
  persona?: string;
  cliente?: string;
  cliente_asignado?: string;
  pais?: string;
  ciudad?: string;
  equipo_asignado_actual?: string | null;
  modelo_equipo?: string | null;
  serial?: string | null;
  plataforma?: string | null;
  mac_win?: string | null;
  condicion?: string | null;
  condicion_equipo?: string | null;
  es_nuevo?: boolean | null;
  tipo_ingreso?: "nuevo" | "interno";
  ingreso_con_equipo?: boolean;
  ingreso_presiona_compra?: boolean;
  extranjero?: boolean | null;
  id_equipo_anterior_persona?: string | null;
  cliente_anterior_persona?: string | null;
  es_cambio_equipo_real?: boolean;
  es_movimiento_interno_persona_cliente?: boolean;
};

type DashboardResponse = {
  mes: string;
  estado_mes?: "cerrado" | "en_curso";
  fecha_ultima_actualizacion?: string | null;
  fuente?: string | null;
  resumen: DashboardResumen | null;
  ingresos: DashboardRow[];
  salidas: DashboardRow[];
  core_extranjeros: DashboardRow[];
  cambios: unknown[];
};

async function getDashboard(mes: string, limit: number): Promise<DashboardResponse> {
  const url = `${ORIGIN}/api/estadisticas/mtr-dashboard?mes=${encodeURIComponent(mes.slice(0, 7))}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    throw new Error(`Error cargando dashboard: ${r.status}`);
  }
  return r.json();
}

function chipClass(idx: number) {
  const styles = [
    "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
    "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
    "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30",
    "bg-amber-500/15 text-amber-200 border-amber-500/30",
    "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  ];
  return styles[idx % styles.length];
}

function pct(n?: number | null) {
  if (n == null || Number.isNaN(Number(n))) return "0%";
  return `${Number(n).toFixed(1)}%`;
}

function fmtCell(v: unknown) {
  if (v == null) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

function currentMonthIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "04";
  return `${year}-${month}-01`;
}

function ingresoBadge(tipoIngreso?: "nuevo" | "interno") {
  if (tipoIngreso === "interno") {
    return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  }
  return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
}

function monthBadgeLabel(mes: string, estadoMes?: "cerrado" | "en_curso", fechaUltima?: string | null) {
  if (estadoMes === "en_curso") {
    return `Mes en curso${fechaUltima ? ` · al ${String(fechaUltima).slice(0, 10)}` : ""}`;
  }
  return "Mes cerrado";
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) || {};
  const mes = sp.mes || currentMonthIso();
  const tipo = sp.tipo === "salidas" ? "salidas" : "ingresos";
  const limit = Number(sp.limit || "500");

  const data = await getDashboard(mes, limit);
  const resumen = data.resumen;
  const rows = tipo === "salidas" ? (data.salidas || []) : (data.ingresos || []);
  const chipsClientes =
    tipo === "salidas"
      ? (resumen?.mix_clientes_salidas || "")
          .split("|")
          .map((x) => x.trim())
          .filter(Boolean)
      : (() => {
          const counts = new Map<string, number>();
          for (const r of rows) {
            const k = (r.cliente || r.cliente_asignado || "Sin cliente").trim();
            counts.set(k, (counts.get(k) || 0) + 1);
          }
          const total = rows.length || 1;
          return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k, n]) => `${k} · ${((n / total) * 100).toFixed(0)}%`);
        })();

  const pctNuevo = tipo === "salidas" ? resumen?.pct_salidas_nuevo : resumen?.pct_ingresos_nuevo;
  const pctUsado = tipo === "salidas" ? resumen?.pct_salidas_usado : resumen?.pct_ingresos_usado;
  const pctChile = tipo === "salidas" ? resumen?.pct_salidas_chile : resumen?.pct_ingresos_chile;
  const pctExtranjero =
    tipo === "salidas" ? resumen?.pct_salidas_extranjero : resumen?.pct_ingresos_extranjero;

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
      <div className="catastro-panel-strong mb-6 flex items-center justify-between rounded-3xl p-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="text-4xl">📦</div>
            <h1 className="text-3xl font-bold text-[var(--cat-text)]">MTR</h1>
            <span className="rounded-full border border-emerald-300/70 bg-emerald-100/80 px-3 py-1 text-sm font-semibold text-emerald-700">
              {tipo === "ingresos" ? "Ingresos" : "Salidas"}
            </span>
          </div>
          <p className="mt-2 text-lg text-[var(--cat-text-muted)]">
            Mes: {mes} · Rows: {rows.length}
          </p>
          <div className="mt-3">
            <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${
              data.estado_mes === "en_curso"
                ? "border-amber-300/70 bg-amber-100/80 text-amber-900"
                : "border-emerald-300/70 bg-emerald-100/80 text-emerald-800"
            }`}>
              {monthBadgeLabel(mes, data.estado_mes, data.fecha_ultima_actualizacion)}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/ml-v2/estadisticas"
            className="catastro-button-secondary rounded-xl px-5 py-3"
          >
            Volver
          </Link>
          <Link
            href={`/ml-v2/estadisticas/mtr?mes=${mes}&tipo=ingresos&limit=${limit}`}
            className={`rounded-xl px-5 py-3 ${
              tipo === "ingresos"
                ? "catastro-pill-active"
                : "catastro-pill"
            }`}
          >
            Ingresos
          </Link>
          <Link
            href={`/ml-v2/estadisticas/mtr?mes=${mes}&tipo=salidas&limit=${limit}`}
            className={`rounded-xl px-5 py-3 ${
              tipo === "salidas"
                ? "catastro-pill-active"
                : "catastro-pill"
            }`}
          >
            Salidas
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="catastro-panel rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--cat-text-soft)]">
            Distribución clientes (top)
          </h2>
          <div className="flex flex-wrap gap-3">
            {chipsClientes.length ? (
              chipsClientes.map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${chipClass(i)}`}
                >
                  {c}
                </span>
              ))
            ) : (
              <span className="text-[var(--cat-text-soft)]">Sin datos</span>
            )}
          </div>
        </section>

        <section className="catastro-panel rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--cat-text-soft)]">
            Condición equipo
          </h2>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200">
              Nuevo · {pct(pctNuevo)}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-200">
              Usado · {pct(pctUsado)}
            </span>
          </div>
          <div className="mt-3 text-sm text-[var(--cat-text-soft)]">
            base: {tipo === "salidas" ? resumen?.salidas_total ?? 0 : resumen?.ingresos_total ?? 0}
          </div>
        </section>

        <section className="catastro-panel rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--cat-text-soft)]">
            Chile vs extranjeros
          </h2>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-200">
              Chile · {pct(pctChile)}
            </span>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-200">
              Extranjero · {pct(pctExtranjero)}
            </span>
          </div>
        </section>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <section className="catastro-panel rounded-2xl p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--cat-text-soft)]">
            Personas
          </h2>
          <div className="space-y-2 text-sm text-[var(--cat-text)]">
            <div>Ingresos MTR: <b>{resumen?.ingresos_total ?? 0}</b></div>
            <div>Salidas MTR: <b>{resumen?.salidas_total ?? 0}</b></div>
          </div>
        </section>

        <section className="catastro-panel rounded-2xl p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--cat-text-soft)]">
            Cliente / persona
          </h2>
          <div className="space-y-2 text-sm text-[var(--cat-text)]">
            <div>Mov. internos: <b>{resumen?.movimientos_internos ?? 0}</b></div>
            <div>Presión compra: <b>{resumen?.presion_compra ?? 0}</b></div>
          </div>
        </section>

        <section className="catastro-panel rounded-2xl p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--cat-text-soft)]">
            Hardware
          </h2>
          <div className="space-y-2 text-sm text-[var(--cat-text)]">
            <div>Asignaciones HW: <b>{resumen?.asignaciones ?? 0}</b></div>
            <div>Ingresos HW: <b>{resumen?.ingresos_hardware ?? 0}</b></div>
            <div>Reasignaciones HW: <b>{resumen?.reasignaciones_hardware ?? 0}</b></div>
            <div>Devoluciones HW: <b>{resumen?.salidas_hardware ?? 0}</b></div>
          </div>
        </section>

        <section className="catastro-panel rounded-2xl p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--cat-text-soft)]">
            Cambio real
          </h2>
          <div className="space-y-2 text-sm text-[var(--cat-text)]">
            <div>Cambios de equipo: <b>{resumen?.cambios_equipo_mes ?? 0}</b></div>
            <div>Core extranjeros: <b>{resumen?.movimientos_core_extranjeros ?? 0}</b></div>
          </div>
        </section>
      </div>

      {tipo === "ingresos" && (resumen?.ingresos_internos ?? 0) > 0 ? (
        <section className="catastro-panel mb-6 rounded-2xl border border-amber-300/60 bg-amber-100/70 p-5 text-amber-950">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Lectura operativa del mes</h2>
          <p className="mt-2 text-sm">
            Los ingresos clasificados como internos cuentan en el movimiento mensual, pero no aumentan la demanda proyectada de compra.
            La vista mantiene separado ese volumen para no sobreestimar presión en el corte del mes.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-amber-950">
            <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1">Ingresos del corte · {resumen?.ingresos_total ?? 0}</span>
            <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1">Internos sin impacto · {resumen?.ingresos_internos ?? 0}</span>
            <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1">Nuevos · {resumen?.ingresos_nuevos_total ?? 0}</span>
            <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1">Nuevos con equipo · {resumen?.ingresos_nuevos_con_equipo ?? 0}</span>
            <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1">Nuevos sin equipo · {resumen?.ingresos_nuevos_sin_equipo ?? 0}</span>
            <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1">Presionan compra · {resumen?.ingresos_presion_compra ?? 0}</span>
          </div>
        </section>
      ) : null}

      <div className="catastro-table-shell overflow-hidden rounded-2xl">
        <table className="min-w-full text-left">
          <thead className="catastro-table-head text-sm uppercase tracking-wide">
            <tr>
              <th className="px-4 py-4">Fecha</th>
              <th className="px-4 py-4">Persona</th>
              <th className="px-4 py-4">Cliente asignado</th>
              {tipo === "ingresos" ? <th className="px-4 py-4">Tipo ingreso</th> : null}
              <th className="px-4 py-4">Equipo actual</th>
              <th className="px-4 py-4">Condición</th>
              <th className="px-4 py-4">Mac/Win</th>
              <th className="px-4 py-4">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const cliente = fmtCell(r.cliente_asignado ?? r.cliente);
              const equipo = fmtCell(r.equipo_asignado_actual);
              const condicion = fmtCell(r.condicion_equipo ?? r.condicion);
              const macwin = fmtCell(r.mac_win ? String(r.mac_win).toUpperCase() : r.plataforma ? String(r.plataforma).toUpperCase() : null);
              const detalle = fmtCell(r.modelo_equipo ?? r.serial ?? r.equipo_asignado_actual);

              return (
                <tr key={`${r.persona || "row"}-${r.fecha_evento || idx}-${idx}`} className="catastro-row">
                  <td className="px-4 py-4 text-[var(--cat-text-muted)]">{fmtCell(r.fecha_evento)}</td>
                  <td className="px-4 py-4 text-[var(--cat-text)]">{fmtCell(r.persona)}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full border border-sky-300/70 bg-sky-100/80 px-3 py-1 text-sm text-sky-700">
                      {cliente}
                    </span>
                  </td>
                  {tipo === "ingresos" ? (
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${ingresoBadge(r.tipo_ingreso)}`}>
                          {r.tipo_ingreso === "interno" ? "Interno" : "Nuevo"}
                        </span>
                        {r.es_movimiento_interno_persona_cliente ? (
                          <span className="rounded-full border border-cyan-300/70 bg-cyan-100/80 px-3 py-1 text-xs font-semibold text-cyan-800">
                            Mov. interno cliente
                          </span>
                        ) : null}
                        {r.es_cambio_equipo_real ? (
                          <span className="rounded-full border border-fuchsia-300/70 bg-fuchsia-100/80 px-3 py-1 text-xs font-semibold text-fuchsia-800">
                            Cambio equipo real
                          </span>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                  <td className="px-4 py-4 text-[var(--cat-text-muted)]">{equipo}</td>
                  <td className="px-4 py-4 text-[var(--cat-text-muted)]">{condicion}</td>
                  <td className="px-4 py-4 text-[var(--cat-text-muted)]">{macwin}</td>
                  <td className="px-4 py-4 text-[var(--cat-text-muted)]">{detalle}</td>
                </tr>
              );
            })}

            {!rows.length && (
              <tr>
                <td colSpan={tipo === "ingresos" ? 8 : 7} className="px-4 py-10 text-center text-[var(--cat-text-soft)]">
                  Sin filas para este mes.
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
