"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { formatMonthLabelFromIso, getOperationalMonthSummary } from "@/lib/operationalMonth";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyMlRisk } from "@/lib/statusMatrix";

type EstadisticaRow = {
  mes?: string | null;
  estado_mes?: "cerrado" | "en_curso" | null;
  fecha_ultima_actualizacion?: string | null;
  fuente?: string | null;
  is_mes_en_curso?: boolean | null;
  hasta_fecha?: string | null;
  movimientos_total?: number | null;
  asignaciones?: number | null;
  movimientos_internos?: number | null;
  cambios_equipo_real?: number | null;
  ingresos_hardware?: number | null;
  reasignaciones_hardware?: number | null;
  salidas_hardware?: number | null;
  total_ingresos?: number | null;
  total_salidas?: number | null;
  presion_compra?: number | null;
  stock_disponible?: number | null;
  gap?: number | null;
  insight_mtr?: string | null;
  ingresos_clientes_pct?: string | ClientePct[] | null;
  extranjeros_total?: number | null;
  extranjeros_core?: number | null;
  extranjeros_staffing?: number | null;
  extranjeros_mac?: number | null;
  extranjeros_win?: number | null;
  compras_mac_nuevos?: number | null;
  cambios_equipo_mes?: number | null;
  salidas_extranjeros_total?: number | null;
  salidas_extranjeros_con_equipo?: number | null;
  salidas_extranjeros_sin_equipo?: number | null;
  pct_salidas_extranjeros_100?: number | null;
};

type ClientePct = {
  cliente?: string | null;
  ingresos?: number | null;
  pct?: number | null;
};

type MLRiskSummary = {
  alto?: number | null;
  medio?: number | null;
  bajo?: number | null;
  score_promedio?: number | null;
};

type MLRiskEquipo = {
  id_equipo?: string | null;
  cliente_ref?: string | null;
  persona_ref?: string | null;
  score_riesgo_rotacion?: number | null;
  bucket_riesgo?: string | null;
  explicacion_corta?: string | null;
};

type MLResumenRow = {
  mes?: string | null;
  score_promedio?: number | null;
  equipos_scoreados?: number | null;
  bajo?: number | null;
  medio?: number | null;
  alto?: number | null;
  score_max?: number | null;
};

type DetalleRow = {
  fecha_evento?: string | null;
  equipo_asignado_actual?: string | null;
  id_equipo?: string | null;
  cliente_asignado?: string | null;
  cliente?: string | null;
  persona?: string | null;
  mac_win?: string | null;
  plataforma?: string | null;
  sistema_operativo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  detalle?: string | null;
  pais_regla?: string | null;
  location_ingreso?: string | null;
  condicion?: string | null;
  es_nuevo?: boolean | null;
};

type ResumenPlataforma = {
  win: number;
  mac: number;
  unknown: number;
  total: number;
  nuevo: number;
  pctWin: string;
  pctMac: string;
};

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct100(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part * 100) / total);
}

function monthTone(mesISO: string) {
  const { operationalMonthIso, previousMonthIso } = getOperationalMonthSummary();

  if (mesISO.startsWith(operationalMonthIso.slice(0, 7))) {
    return {
      card: "border-amber-400/30",
      chip: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      title: "text-amber-100",
    };
  }
  if (mesISO.startsWith(previousMonthIso.slice(0, 7))) {
    return {
      card: "border-emerald-400/30",
      chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      title: "text-emerald-100",
    };
  }
  return {
    card: "border-sky-400/20",
    chip: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    title: "text-sky-200",
  };
}

function monthLabel(mesISO: string) {
  return formatMonthLabelFromIso(mesISO);
}

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${cls}`}>{children}</span>;
}

function renderExtranjerosChips(r: EstadisticaRow) {
  const total = num(r?.extranjeros_total);
  const core = num(r?.extranjeros_core);
  const staffing = num(r?.extranjeros_staffing);
  const mac = num(r?.extranjeros_mac);
  const win = num(r?.extranjeros_win);

  if (!total) {
    return (
      <div className="mt-2 text-xs opacity-50">
        Extranjeros: —
      </div>
    );
  }

  // Chip grande (resumen)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span
        className="px-2 py-1 rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200 whitespace-nowrap"
        title="Extranjeros = movimientos internos (Core/Staffing)"
      >
        Extranjeros: <b>{total}</b> mov. internos
        <span className="opacity-90">
          {" "}({core} core, {staffing} staffing · {mac} mac, {win} win)
        </span>
      </span>

      {/* chips chicos (para lectura rápida) */}
      <span className="px-2 py-1 rounded-lg border border-violet-400/20 bg-violet-400/10 text-violet-200 whitespace-nowrap">
        Core: <b>{core}</b> ({pct100(core, total)}%)
      </span>
      <span className="px-2 py-1 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200 whitespace-nowrap">
        Staffing: <b>{staffing}</b> ({pct100(staffing, total)}%)
      </span>
      <span className="px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 whitespace-nowrap">
        MAC: <b>{mac}</b>
      </span>
      <span className="px-2 py-1 rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-200 whitespace-nowrap">
        WIN: <b>{win}</b>
      </span>
    </div>
  );
}

function inferOS(row: DetalleRow): "MAC" | "WIN" | null {
  const macWin = String(row?.mac_win ?? row?.plataforma ?? "").trim().toUpperCase();
  if (macWin === "MAC") return "MAC";
  if (macWin === "WIN" || macWin === "WINDOWS") return "WIN";

  const so = String(row?.sistema_operativo ?? "").trim().toLowerCase();
  if (so.includes("mac") || so.includes("osx") || so.includes("sonoma") || so.includes("sequoia") || so.includes("tahoe")) {
    return "MAC";
  }
  if (so.includes("windows")) {
    return "WIN";
  }

  const marca = String(row?.marca ?? "").trim().toLowerCase();
  if (marca.includes("apple")) return "MAC";
  if (["dell", "hp", "lenovo", "asus", "acer"].some(x => marca.includes(x))) return "WIN";

  const modelo = String(row?.modelo ?? "").trim().toLowerCase();
  if (modelo.includes("macbook") || modelo.includes("ipad")) return "MAC";
  if (
    modelo.includes("latitude") ||
    modelo.includes("elitebook") ||
    modelo.includes("thinkpad") ||
    modelo.includes("zenbook") ||
    modelo.includes("vostro") ||
    modelo.includes("probook")
  ) return "WIN";

  return null;
}

function OsBadge({ row }: { row: DetalleRow }) {
  const os = inferOS(row);
  if (!os) return null;
  const cls = os === "MAC" ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200";
  return <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${cls}`}>{os}</span>;
}

function PaisBadge({ row }: { row: DetalleRow }) {
  const pais = String(row?.pais_regla ?? row?.location_ingreso ?? "").trim().toLowerCase();
  if (!pais) return null;

  const esChile =
    pais === "chile" ||
    pais === "nacional";

  const label = esChile ? "NACIONAL" : "EXTRANJERO";
  const cls = esChile
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : "border-amber-400/30 bg-amber-400/10 text-amber-200";

  return <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${cls}`}>{label}</span>;
}

function CondicionBadge({ condicion, es_nuevo }: { condicion?: string | null; es_nuevo?: boolean | null }) {
  const c = (condicion ?? "").toString().trim();
  const isNuevo = Boolean(es_nuevo) || /nuevo/i.test(c);

  const label = isNuevo ? "NUEVO" : (c ? c.toUpperCase() : "—");
  const klass = isNuevo
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : "border-neutral-500/30 bg-neutral-500/10 text-neutral-200";

  return (
    <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium whitespace-nowrap ${klass}`}>
      {label}
    </span>
  );
}


export default function EstadisticasClient({
  rows,
  mlResumen = [],
  mlRiskSummary = null,
  mlRiskEquipos = [],
}: {
  rows: EstadisticaRow[]
  mlResumen?: MLResumenRow[]
  mlRiskSummary?: MLRiskSummary | null
  mlRiskEquipos?: MLRiskEquipo[]
}) {
  const data = useMemo(() => {
    return (rows || [])
      .filter((r) => String(r?.mes ?? "") >= "2026-01-01")
      .sort((a, b) => String(a?.mes ?? "").localeCompare(String(b?.mes ?? "")));
  }, [rows]);

  const [openMes, setOpenMes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [det, setDet] = useState<{ ingresos: DetalleRow[]; salidas: DetalleRow[] }>({ ingresos: [], salidas: [] });
  const [err, setErr] = useState("");

  async function loadDetalle(mes: string) {
    try {
      setErr("");
      setLoading(true);

      const bust = Date.now();

      const urlIngresos =
        `/api/estadisticas/mtr-detalle-mes?mes=${encodeURIComponent(mes)}&tipo=ingresos&limit=500&_=${bust}`;
      const urlSalidas =
        `/api/estadisticas/mtr-detalle-mes?mes=${encodeURIComponent(mes)}&tipo=salidas&limit=500&_=${bust}`;

      const [a, b] = await Promise.all([
        fetch(urlIngresos, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        }),
        fetch(urlSalidas, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        }),
      ]);

      if (!a.ok || !b.ok) {
        const ta = await a.text().catch(() => "");
        const tb = await b.text().catch(() => "");
        throw new Error(`HTTP ${a.status}/${b.status} :: ${ta.slice(0,120)} :: ${tb.slice(0,120)}`);
      }

      const ja = await a.json();
      const jb = await b.json();

      setDet({
        ingresos: Array.isArray(ja?.rows) ? ja.rows : Array.isArray(ja?.data) ? ja.data : [],
        salidas: Array.isArray(jb?.rows) ? jb.rows : Array.isArray(jb?.data) ? jb.data : [],
      });
      } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e ?? "error"));
      setDet({ ingresos: [], salidas: [] });
    } finally {
      setLoading(false);
    }
  }

  function toggleMes(mes: string) {
    const next = openMes === mes ? null : mes;
    setOpenMes(next);
    if (next) loadDetalle(next);
  }

  return (
    <div className="grid grid-cols-1 gap-4">

      {mlRiskSummary && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold">
            🤖 Panel ML v2 · Observabilidad de hardware
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className={`rounded-xl border p-3 ${getStatusClassName("alto", { domain: "ml" })}`}>
              <div className="text-xs text-rose-200/80">🔴 Alto riesgo</div>
              <div className="mt-1 text-2xl font-semibold text-rose-100">{mlRiskSummary?.alto ?? 0}</div>
            </div>
            <div className={`rounded-xl border p-3 ${getStatusClassName("medio", { domain: "ml" })}`}>
              <div className="text-xs text-amber-200/80">🟡 Riesgo medio</div>
              <div className="mt-1 text-2xl font-semibold text-amber-100">{mlRiskSummary?.medio ?? 0}</div>
            </div>
            <div className={`rounded-xl border p-3 ${getStatusClassName("bajo", { domain: "ml" })}`}>
              <div className="text-xs text-emerald-200/80">🟢 Bajo riesgo</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-100">{mlRiskSummary?.bajo ?? 0}</div>
            </div>
            <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-3">
              <div className="text-xs text-sky-200/80">Score promedio</div>
              <div className="mt-1 text-2xl font-semibold text-sky-100">{mlRiskSummary?.score_promedio ?? 0}</div>
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/70">
                <tr>
                  <th className="p-2 text-left font-medium">Equipo</th>
                  <th className="p-2 text-left font-medium">Cliente</th>
                  <th className="p-2 text-left font-medium">Persona</th>
                  <th className="p-2 text-left font-medium">Score</th>
                  <th className="p-2 text-left font-medium">Riesgo</th>
                  <th className="p-2 text-left font-medium">Explicación</th>
                </tr>
              </thead>
              <tbody>
                {(mlRiskEquipos || []).map((r, idx: number) => {
                  const bucket = String(r?.bucket_riesgo ?? "BAJO").toUpperCase();
                  const riskCls = getStatusClassName(bucket, { domain: "ml" });

                  return (
                    <tr key={`${r?.id_equipo ?? "row"}-${idx}`} className="border-t border-white/10">
                      <td className="p-2 font-mono whitespace-nowrap">
                        <a
                          href={`/ml-v2/explain/${encodeURIComponent(String(r?.id_equipo ?? ""))}`}
                          className="underline decoration-dotted underline-offset-2 hover:text-sky-300"
                        >
                          {r?.id_equipo ?? "—"}
                        </a>
                      </td>
                      <td className="p-2 whitespace-nowrap">{r?.cliente_ref ?? "—"}</td>
                      <td className="p-2 max-w-[260px] truncate" title={r?.persona_ref ?? ""}>{r?.persona_ref ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{r?.score_riesgo_rotacion ?? 0}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${riskCls}`}>
                          {prettyMlRisk(bucket)}
                        </span>
                      </td>
                      <td className="p-2 text-xs opacity-80 max-w-[420px] truncate" title={r?.explicacion_corta ?? ""}>
                        {r?.explicacion_corta ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {(!mlRiskEquipos || mlRiskEquipos.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-sm opacity-60">— sin equipos scoreados —</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      
      <div className="mb-4 flex justify-end">
        <Link
          href="/activos"
          className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
        >
          Ir a Home Activos
        </Link>
      </div>

{mlResumen && mlResumen.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold">
            🤖 Riesgo de rotación (ML)
          </div>



          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {mlResumen.map((r) => (
              <div
                key={String(r?.mes ?? "")}
                className="rounded-xl border border-white/10 bg-black/10 p-3"
              >
                <div className="text-xs opacity-70">
                  {monthLabel(String(r?.mes ?? ""))}
                </div>

                <div className="mt-1 text-lg font-semibold">
                  score {r?.score_promedio ?? 0}
                </div>

                <div className="mt-1 text-xs opacity-80">
                  equipos {r?.equipos_scoreados ?? 0}
                </div>

                <div className="mt-1 text-xs opacity-70">
                  bajo {r?.bajo ?? 0} · medio {r?.medio ?? 0} · alto {r?.alto ?? 0}
                </div>

                <div className="mt-1 text-xs opacity-60">
                  max {r?.score_max ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm opacity-70">
          No hay paneles mensuales cargados todavía para esta vista.  
          El bloque ML ya está conectado y visible arriba.
        </div>
      )}

      {data.map((r) => {
        const mes = String(r?.mes ?? "");
        const isOpen = openMes === mes;

        const tone = monthTone(mes);

        return (
          <div key={mes} className={`rounded-2xl border bg-white/5 p-4 ${tone.card}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-lg font-semibold ${tone.title}`}>{monthLabel(mes)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {r?.is_mes_en_curso ? (
                    <Badge cls="border-amber-400/30 bg-amber-400/10 text-amber-200">
                      Mes en curso · al {String(r?.hasta_fecha ?? r?.fecha_ultima_actualizacion ?? "").slice(0, 10)}
                    </Badge>
                  ) : (
                    <Badge cls="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                      Mes cerrado
                    </Badge>
                  )}

                  <Badge cls="border-sky-400/30 bg-sky-400/10 text-sky-200">
                    Ingresos: <b className="ml-1">{r?.total_ingresos ?? 0}</b>
                  </Badge>

                  <Badge cls="border-violet-400/30 bg-violet-400/10 text-violet-200">
                    Salidas: <b className="ml-1">{r?.total_salidas ?? 0}</b>
                  </Badge>

                  <Badge cls="border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                    Mov. internos: <b className="ml-1">{r?.movimientos_internos ?? 0}</b>
                  </Badge>

                  <Badge cls="border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200">
                    Presión: <b className="ml-1">{r?.presion_compra ?? 0}</b>
                  </Badge>
                </div>
              </div>

              <button
                onClick={() => toggleMes(mes)}
                className="px-3 py-1.5 rounded-xl text-sm border border-white/10 bg-white/5 hover:bg-white/10 transition"
                title="Ver detalle de ingresos/salidas del MTR (por equipo)"
              >
                {isOpen ? "Ocultar detalle" : "Ver detalle"}
              </button>
            </div>

            <div className="mt-3 text-sm leading-relaxed">
              <div className="opacity-90">{r?.insight_mtr || "—"}</div>

              {(() => {
                const arr = parseIngresosClientesPct(r?.ingresos_clientes_pct);
                if (!arr.length) return null;

                const top = arr.slice(0, 6);
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="opacity-70">Clientes (ingresos):</span>
                    {top.map((x) => (
                      <span
                        key={String(x?.cliente ?? "")}
                        className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 whitespace-nowrap"
                        title="Porcentaje sobre ingresos del mes"
                      >
                        {String(x?.cliente ?? "—")}: <b>{Number(x?.ingresos ?? 0)}</b> ({Number(x?.pct ?? 0).toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                );
              })()}

              {renderExtranjerosChips(r)}

              {!!Number(r?.extranjeros_core ?? 0) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-lg border border-violet-400/20 bg-violet-400/10 text-violet-200 whitespace-nowrap">
                    Extranjeros CORE: <b>{Number(r?.extranjeros_core ?? 0)}</b>
                  </span>
                  <span className="px-2 py-1 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200 whitespace-nowrap">
                    Extranjeros Staffing: <b>{Number(r?.extranjeros_staffing ?? 0)}</b>
                  </span>
                </div>
              )}

              {!!Number(r?.compras_mac_nuevos ?? 0) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 whitespace-nowrap">
                    Compra MAC mes: <b>{Number(r?.compras_mac_nuevos ?? 0)}</b>
                  </span>
                </div>
              )}

              {!!Number(r?.cambios_equipo_mes ?? 0) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200 whitespace-nowrap">
                    Cambios de equipo: <b>{Number(r?.cambios_equipo_mes ?? 0)}</b>
                  </span>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 whitespace-nowrap">
                  Ingresos HW: <b>{Number(r?.ingresos_hardware ?? 0)}</b>
                </span>
                <span className="px-2 py-1 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200 whitespace-nowrap">
                  Reasignaciones HW: <b>{Number(r?.reasignaciones_hardware ?? 0)}</b>
                </span>
                <span className="px-2 py-1 rounded-lg border border-neutral-500/20 bg-white/5 text-neutral-200 whitespace-nowrap">
                  Devoluciones HW: <b>{Number(r?.salidas_hardware ?? 0)}</b>
                </span>
                <span className="px-2 py-1 rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200 whitespace-nowrap">
                  Cambio equipo real: <b>{Number(r?.cambios_equipo_real ?? r?.cambios_equipo_mes ?? 0)}</b>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 whitespace-nowrap">
                  Stock disponible: <b>{Number(r?.stock_disponible ?? 0)}</b>
                </span>
                <span className="px-2 py-1 rounded-lg border border-rose-400/20 bg-rose-400/10 text-rose-200 whitespace-nowrap">
                  Gap: <b>{Number(r?.gap ?? 0)}</b>
                </span>
                {!!Number(r?.asignaciones ?? 0) && (
                  <span className="px-2 py-1 rounded-lg border border-violet-400/20 bg-violet-400/10 text-violet-200 whitespace-nowrap">
                    Asignaciones: <b>{Number(r?.asignaciones ?? 0)}</b>
                  </span>
                )}
              </div>
              {renderSalidasExtranjerosChips(r)}
            </div>

            {isOpen && (
              <div className="mt-4">
                {err ? <div className="text-xs text-rose-300/90">Error: {err}</div> : null}
                {loading ? <div className="text-xs opacity-70">Cargando detalle…</div> : null}

                {!loading && (
                  <div className="grid grid-cols-1 gap-4">
                    <DetalleTable title="📥 Ingresos (MTR)" rows={det.ingresos} />
                    <DetalleTable title="📤 Salidas (MTR)" rows={det.salidas} />
                    <div className="text-xs opacity-60">
                      Nota: “Extranjeros” son movimientos internos (Core/Staffing), no ingresos.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


type Plataforma = "win" | "mac" | "unknown";

function normalizarPlataforma(r: DetalleRow): Plataforma {
  const macWin = (r?.mac_win ?? "").toString().trim().toLowerCase();
  if (macWin === "win" || macWin === "windows") return "win";
  if (macWin === "mac" || macWin === "macos" || macWin === "osx") return "mac";

  const p = (r?.plataforma ?? "").toString().trim().toLowerCase();
  if (p === "win" || p === "windows") return "win";
  if (p === "mac" || p === "macos" || p === "osx") return "mac";

  const so = (r?.sistema_operativo ?? "").toString().trim().toLowerCase();
  if (so.includes("windows")) return "win";
  if (
    so.includes("mac") ||
    so.includes("osx") ||
    so.includes("sonoma") ||
    so.includes("sequoia")
  ) return "mac";

  const marca = (r?.marca ?? "").toString().trim().toLowerCase();
  if (marca.includes("apple")) return "mac";
  if (["dell", "hp", "lenovo", "asus", "acer"].some(x => marca.includes(x))) return "win";

  const modelo = (r?.modelo ?? "").toString().trim().toLowerCase();
  if (modelo.includes("macbook") || modelo.includes("ipad")) return "mac";
  if (
    modelo.includes("latitude") ||
    modelo.includes("elitebook") ||
    modelo.includes("thinkpad") ||
    modelo.includes("zenbook") ||
    modelo.includes("vostro") ||
    modelo.includes("probook")
  ) return "win";

  return "unknown";
}

const UNIVERSO_EQUIPOS = 310;


  function resumenPlataforma(rows: DetalleRow[]): ResumenPlataforma {
    const acc: ResumenPlataforma = { win: 0, mac: 0, unknown: 0, total: 0, nuevo: 0, pctWin: "0%", pctMac: "0%" };
    for (const r of (rows || [])) {
      const plat = normalizarPlataforma(r);
      acc[plat] += 1;
      acc.total += 1;

      const isNuevo = Boolean(r?.es_nuevo) || /nuevo/i.test(String(r?.condicion ?? ""));
      if (isNuevo) acc.nuevo += 1;
    }
    acc.pctWin = pct(acc.win, acc.total);
    acc.pctMac = pct(acc.mac, acc.total);
    return acc;
  }



  function parseIngresosClientesPct(v: string | ClientePct[] | null | undefined): ClientePct[] {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const j = JSON.parse(v);
        return Array.isArray(j) ? (j as ClientePct[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }


  function renderSalidasExtranjerosChips(r: EstadisticaRow) {
    const total = Number(r?.salidas_extranjeros_total ?? 0);
    const conEq = Number(r?.salidas_extranjeros_con_equipo ?? 0);
    const sinEq = Number(r?.salidas_extranjeros_sin_equipo ?? 0);
    const pct100 = Number(r?.pct_salidas_extranjeros_100 ?? 0);

    if (!total && !conEq && !sinEq) return null;

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="opacity-70">Salidas Extranjeros:</span>

        <span className="px-2 py-1 rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200 whitespace-nowrap">
          TOTAL: <b>{total}</b> ({pct100.toFixed(0)}%)
        </span>

        <span className="px-2 py-1 rounded-lg border border-violet-400/20 bg-violet-400/10 text-violet-200 whitespace-nowrap">
          con equipo: <b>{conEq}</b>
        </span>

        <span className="px-2 py-1 rounded-lg border border-neutral-500/20 bg-white/5 text-neutral-200 whitespace-nowrap">
          sin equipo: <b>{sinEq}</b>
        </span>
      </div>
    );
  }

function pct(n: number, d: number) {
  if (!d) return "0%";
  const v = (n * 100) / d;
  return `${v.toFixed(0)}%`;
}

function DetalleTable({ title, rows }: { title: string; rows: DetalleRow[] }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-xs uppercase tracking-wide opacity-70">
          {title} · {rows?.length ?? 0}
        </div>
        {(() => {
          const r = resumenPlataforma(rows || []);
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-200 whitespace-nowrap">
                WIN: <b>{r.win}</b> ({r.pctWin})
              </span>
              <span className="px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 whitespace-nowrap">
                MAC: <b>{r.mac}</b> ({r.pctMac})
              </span>
              <span className="px-2 py-1 rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200 whitespace-nowrap">
                NUEVOS: <b>{r.nuevo}</b>
              </span>
              <span className="opacity-60 whitespace-nowrap">/ universo {UNIVERSO_EQUIPOS}</span>
            </div>
          );
        })()}
      </div>

      <div className="overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-sky-300/80">
            <tr>
              <th className="p-2 text-left font-medium">Fecha</th>
              <th className="p-2 text-left font-medium">Equipo</th>
              <th className="p-2 text-left font-medium">Cliente</th>
              <th className="p-2 text-left font-medium">Persona</th>
              <th className="p-2 text-left font-medium">OS</th>
              <th className="p-2 text-left font-medium">Ámbito</th>
              <th className="p-2 text-left font-medium">Condición</th>
              <th className="p-2 text-left font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).slice(0, 200).map((r, idx) => {
              const fecha = String(r?.fecha_evento ?? "").slice(0, 10);
              const equipo = r?.equipo_asignado_actual ?? r?.id_equipo ?? "—";
              const cliente = r?.cliente_asignado ?? r?.cliente ?? "—";
              const persona = r?.persona ?? "—";

              const marca = String(r?.marca ?? "").trim();
              const modelo = String(r?.modelo ?? "").trim();
              const detalle = `${marca ? marca + " " : ""}${modelo}`.trim() || r?.detalle || "—";

              return (
                <tr key={idx} className="border-t border-white/10">
                  <td className="p-2 text-xs opacity-80 whitespace-nowrap">{fecha || "—"}</td>
                  <td className="p-2 font-mono whitespace-nowrap">{equipo || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{cliente || "—"}</td>

                  <td className="p-2">
                    <div className="truncate max-w-[280px]">{persona || "—"}</div>
                  </td>

                  <td className="p-2 whitespace-nowrap">
                    <OsBadge row={r} />
                  </td>

                  <td className="p-2 whitespace-nowrap">
                    <PaisBadge row={r} />
                  </td>

                  <td className="p-2 whitespace-nowrap">
                    <CondicionBadge condicion={r?.condicion} es_nuevo={r?.es_nuevo} />
                  </td>

                  <td className="p-2 text-xs opacity-80 whitespace-nowrap truncate max-w-[420px]" title={detalle}>
                    {detalle || "—"}
                  </td>
                </tr>
              );
            })}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-sm opacity-60">
                  — sin datos —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows?.length > 200 ? <div className="mt-1 text-xs opacity-60">Mostrando 200 de {rows.length}…</div> : null}
    </div>
  );
}
