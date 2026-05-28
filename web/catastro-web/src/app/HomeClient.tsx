"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getStatusClassName } from "@/lib/statusStyles";

type Sev = "ALL" | "CRITICAL" | "ALTA" | "MEDIA" | "NORMAL";
type MlRisk = "ALL" | "Alta" | "Media" | "Baja" | "Normal" | "SIN_ML";

// Severidad backend -> severidad UI (negocio)
const SEV_MAP = {
  CRITICAL: "CRITICAL",
  WARN: "ALTA",
  INFO: "MEDIA",
  NORMAL: "NORMAL",
} as const;

type RawSev = keyof typeof SEV_MAP;
type UiSev = (typeof SEV_MAP)[RawSev];

type AlertRecord = {
  code?: string;
  codigo?: string;
  id?: string;
  label?: string;
  titulo?: string;
  why?: string;
  porque?: string;
};

type HomeEquipo = {
  id_equipo: string;
  estado_equipo?: string | null;
  tipo_ultimo_evento?: string | null;
  persona_asignada?: string | null;
  last_event_persona?: string | null;
  alertas_codigos?: string[] | string | null;
  alertas_reglas?: string[] | string | null;
  alertas_explicadas?: AlertRecord[] | null;
  alertas?: AlertRecord[] | null;
  alertas_codigos_str?: string | null;
  alertas_str?: string | null;
  alertas_json?: string | AlertRecord[] | Record<string, AlertRecord> | null;
  alertas_resumen?: string | null;
  alertas_severidad?: string | null;
  movimientos_12m?: number | null;
  dias_desde_ultimo_evento?: number | null;
  priority_rank?: number | null;
  alertas_severidad_ui?: UiSev;
};

type MlEquipo = {
  nivel_riesgo?: string | null;
  ml_risk_level?: string | null;
  ml_score?: number | string | null;
  score?: number | string | null;
  ml_total?: number | string | null;
};

type HomeKpis = {
  criticos?: number | null;
  warn?: number | null;
  info?: number | null;
  con_ml?: number | null;
};

type HomeClientProps = {
  equipos?: HomeEquipo[] | { rows?: HomeEquipo[] } | null;
  mlById?: Map<string, MlEquipo>;
  kpis?: HomeKpis | null;
};

function priorityFallback(e: HomeEquipo, mlById?: Map<string, MlEquipo>) {
  let p = 0;
  const sevUi = toUiSev(e?.alertas_severidad);
  if (sevUi === "CRITICAL") p += 100;
  if (sevUi === "ALTA") p += 60;
  if (sevUi === "MEDIA") p += 20;

  const ml = mlById?.get?.(e.id_equipo);
  if (ml?.nivel_riesgo === "Alta") p += 30;
  if (ml?.nivel_riesgo === "Media") p += 20;
  if (ml?.nivel_riesgo === "Baja") p += 10;

  if ((e.movimientos_12m ?? 0) >= 12) p += 10;
  if ((e.dias_desde_ultimo_evento ?? 0) >= 120) p += 5;

  return p;
}

function toUiSev(raw: unknown): UiSev {
  const k = String(raw ?? "").toUpperCase() as RawSev;
  return SEV_MAP[k] ?? "NORMAL";
}

// Mini resumen ML (motivo) basado en datos del equipo + ML
function isEquipoActual(e: HomeEquipo) {
  return e?.estado_equipo === "ASIGNADO" && e?.tipo_ultimo_evento === "ASIGNACION";
}



// Extrae códigos de alertas MTR desde distintos formatos posibles
function getAlertCodes(e: HomeEquipo): string[] {
  // Casos comunes que pueden venir del backend:
  // - e.alertas_codigos: ["JIRA_OPEN", "RENOVAR", ...]
  // - e.alertas_reglas: ["JIRA_OPEN", ...]
  // - e.alertas: [{codigo:"JIRA_OPEN"}, ...]
  // - e.alertas_explicadas: [{codigo:"JIRA_OPEN"}, ...]
  // - e.alertas_codigos_str: "JIRA_OPEN,RENOVAR"
  const raw =
    e?.alertas_codigos ??
    e?.alertas_reglas ??
    e?.alertas_explicadas ??
    e?.alertas ??
    e?.alertas_codigos_str ??
    e?.alertas_str ??
    [];

  let arr: Array<string | AlertRecord> = [];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    arr = raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  } else {
    arr = [];
  }

  // Normaliza a strings
  const codes = arr
    .map((x) => (typeof x === "string" ? x : x?.codigo ?? x?.code ?? x?.id ?? ""))
    .map((x) => String(x).toUpperCase().trim())
    .filter(Boolean);

  // uniq
  return Array.from(new Set(codes));
}

// Devuelve un mapa { CODE -> {label, why, severity, ...} } desde alertas_json (objeto o array)
function getAlertObj(e: HomeEquipo): Record<string, AlertRecord> {
  let aj = e?.alertas_json;
  if (!aj) return {};

  // Si viene como string, parseamos
  if (typeof aj === "string") {
    try {
      aj = JSON.parse(aj);
    } catch {
      return {};
    }
  }

  const out: Record<string, AlertRecord> = {};

  // Caso 1: alertas_json como ARRAY [{code,...}, ...]
  if (Array.isArray(aj)) {
    for (const it of aj) {
      const code = String(it?.code ?? it?.codigo ?? "").toUpperCase().trim();
      if (code) out[code] = it;
    }
    return out;
  }

  // Caso 2: alertas_json como OBJETO { renovar:{code,...}, jira:{code,...} }
  if (aj && typeof aj === "object") {
    for (const k of Object.keys(aj)) {
      const it = aj[k];
      const code = String(it?.code ?? it?.codigo ?? "").toUpperCase().trim();
      if (code) out[code] = it;
    }
  }

  return out;
}

function getAlertWhy(e: HomeEquipo, code: string): string {
  const m = getAlertObj(e);
  const it = m[String(code).toUpperCase().trim()];
  const why = String(it?.why ?? it?.porque ?? "").trim();
  const label = String(it?.label ?? it?.titulo ?? "").trim();

  if (why && label) return `${label}: ${why}`;
  if (why) return why;
  if (label) return label;

  const resumen = String(e?.alertas_resumen ?? "").trim();
  if (resumen) return resumen;

  return code;
}

function miniWhy(raw: string): string {
  const t = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";

  // Jira: "Tickets abiertos = 1 (máx días abierto: 364)" -> "= 1 (máx 364d)"
  let m = t.match(/tickets abiertos\s*=\s*(\d+)/i);
  const n = m?.[1];
  const m2 = t.match(/máx\s*d[ií]as\s*abierto\s*:\s*(\d+)/i);
  const maxd = m2?.[1];
  if (n) return `= ${n}${maxd ? ` (máx ${maxd}d)` : ""}`;

  // Renovación: "Ya venció hace 1044 días." / "Vence en 12 días."
  m = t.match(/venc(i[oó]|e)\s*(?:en)?\s*(\d+)\s*d[ií]as/i);
  if (m) return `vence en ${m[2]}d`;
  m = t.match(/venci[oó]\s*hace\s*(\d+)\s*d[ií]as/i);
  if (m) return `venció hace ${m[1]}d`;
  m = t.match(/ya\s*venci[oó]\s*hace\s*(\d+)\s*d[ií]as/i);
  if (m) return `venció hace ${m[1]}d`;

  // Rotación: "Movimientos últimos 12 meses = 4 (umbral 4)." -> "movs 4 (umbral 4)"
  const mov = t.match(/movimientos.*?=\s*(\d+)/i)?.[1];
  const umb = t.match(/umbral\s*(\d+)/i)?.[1];
  if (mov) return `movs ${mov}${umb ? ` (umbral ${umb})` : ""}`;

  // Sin asignación: "... último evento fue hace 237 días." -> "últ. evento 237d"
  const ult = t.match(/hace\s*(\d+)\s*d[ií]as/i)?.[1];
  if (ult) return `últ. evento ${ult}d`;

  // fallback: corta a 28 chars
  return t.length > 28 ? t.slice(0, 28) + "…" : t;
}

function AlertIcons({ e }: { e: HomeEquipo }) {
  const codes = getAlertCodes(e);
  const has = (c: string) => codes.includes(c);

  const items: Array<{ code: string; emoji: string; label: string; cls: string }> = [];

  if (has("JIRA_OPEN")) {
    items.push({
      code: "JIRA_OPEN",
      emoji: "🎫",
      label: "Jira",
      cls: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    });
  }
  if (has("RENOVAR")) {
    items.push({
      code: "RENOVAR",
      emoji: "🗓️",
      label: "Antigüedad",
      cls: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    });
  }
  if (has("SIN_ASIGNACION")) {
    items.push({
      code: "SIN_ASIGNACION",
      emoji: "👤",
      label: "Sin asig.",
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    });
  }
  if (has("ROTACION_ALTA_12M") || has("ROTACION_ALTA")) {
    items.push({
      code: has("ROTACION_ALTA_12M") ? "ROTACION_ALTA_12M" : "ROTACION_ALTA",
      emoji: "🔁",
      label: "Rotación",
      cls: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    });
  }

  if (items.length === 0) return <span className="opacity-40">—</span>;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((it) => {
        const full = getAlertWhy(e, it.code);
        const mini = miniWhy(full);
        return (
          <span
            key={it.code}
            title={full}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${it.cls}`}
          >
            <span className="text-[12px]">{it.emoji}</span>
            <span className="leading-none">{it.label}</span>
            {mini && <span className="opacity-80 leading-none">· {mini}</span>}
          </span>
        );
      })}
    </div>
  );
}

/* ===========================
   Acciones (/acciones/grupos)
=========================== */
type AccGrupo = { tipo_accion: string; prioridad: string; total: number };

function accionKind(tipo: string): "ALERTA" | "ACCION" | "OK" {
  const t = String(tipo ?? "").toUpperCase();
  if (t.startsWith("ALERTA_")) return "ALERTA";
  if (t.startsWith("ACCION_")) return "ACCION";
  return "OK";
}

function accionEmoji(tipo: string) {
  const k = accionKind(tipo);
  if (k === "ALERTA") return "🔴";
  if (k === "ACCION") return "🟠";
  return "🟢";
}

function accionLabel(tipo: string) {
  const t = String(tipo ?? "");
  return t
    .replace(/^ALERTA_/, "")
    .replace(/^ACCION_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

function accionSortKey(tipo: string) {
  const k = accionKind(tipo);
  if (k === "ALERTA") return 0;
  if (k === "ACCION") return 1;
  return 2;
}

export default function HomeClient({ equipos, mlById, kpis }: HomeClientProps) {
  const [sevFilter, setSevFilter] = useState<Sev>("ALL");
  const [mlRiskFilter, setMlRiskFilter] = useState<MlRisk>("ALL");

  // Acciones (endpoint)
  const [acciones, setAcciones] = useState<AccGrupo[]>([]);
  const [accionesTotal, setAccionesTotal] = useState<number>(0);
  const [accionesErr, setAccionesErr] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setAccionesErr("");
        const r = await fetch("/api/acciones/grupos", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;

        const rows: AccGrupo[] = Array.isArray(j?.rows) ? j.rows : [];
        const count = Number(j?.count ?? rows.reduce((a, x) => a + Number(x?.total ?? 0), 0));

        setAcciones(rows);
        setAccionesTotal(count);
      } catch (e: unknown) {
        if (!alive) return;
        setAccionesErr(e instanceof Error ? e.message : String(e ?? "error"));
        setAcciones([]);
        setAccionesTotal(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ------------------------------------------------------------
  // FIX: NORMAL = sin alertas (alertas_codigos vacío)
  // ------------------------------------------------------------
  const normalizeSev = (e: HomeEquipo): UiSev => {
    const hasCodes = getAlertCodes(e).length > 0;
    return hasCodes ? toUiSev(e?.alertas_severidad) : "NORMAL";
  };

  // 1) Normaliza rows (agrega severidad UI)
  const rows = useMemo(() => {
    const src =
      Array.isArray(equipos)
        ? equipos
        : equipos && typeof equipos === "object" && Array.isArray(equipos.rows)
        ? equipos.rows
        : [];

    return src.map((e) => ({
      ...e,
      alertas_severidad_ui: normalizeSev(e),
    }));
  }, [equipos]);

  // 2) Ordena UNA sola vez
  const rowsSorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const ra = Number(a?.priority_rank ?? 999999);
      const rb = Number(b?.priority_rank ?? 999999);
      if (ra !== rb) return ra - rb;

      const pa = priorityFallback(a, mlById);
      const pb = priorityFallback(b, mlById);
      if (pb !== pa) return pb - pa;

      return String(a?.id_equipo ?? "").localeCompare(String(b?.id_equipo ?? ""));
    });
    return arr;
  }, [rows, mlById]);

  // 3) Conteo para chips
  const sevCounts = useMemo(() => {
    const acc: Record<Sev, number> = {
      ALL: rows.length,
      CRITICAL: 0,
      ALTA: 0,
      MEDIA: 0,
      NORMAL: 0,
    };

    for (const e of rows) {
      const s = (e?.alertas_severidad_ui ?? "NORMAL") as Sev;
      if (s !== "ALL") acc[s] = (acc[s] || 0) + 1;
    }
    return acc;
  }, [rows]);

  // 4) Filtrado final
  const filteredRows = useMemo(() => {
    let out = rowsSorted;

    if (sevFilter !== "ALL") {
      out = out.filter((e) => e?.alertas_severidad_ui === sevFilter);
    }

    if (mlRiskFilter !== "ALL") {
      out = out.filter((e) => {
        const ml = mlById?.get?.(e.id_equipo);
        const risk = String(ml?.nivel_riesgo ?? ml?.ml_risk_level ?? "").trim();

        if (mlRiskFilter === "SIN_ML") return !risk;
        return risk === mlRiskFilter;
      });
    }

    return out;
  }, [rowsSorted, sevFilter, mlRiskFilter, mlById]);

  // Conteo por motivo ML (para resumen tipo: ⏰ Antigüedad (x) · 📈 Movimientos (y) · 🔁 Rotación (z))
  

  return (
    <>

      
<section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Críticos" value={kpis?.criticos} color="red" />
        <Card title="Warnings" value={kpis?.warn} color="yellow" />
        <Card title="Info" value={kpis?.info} color="blue" />
        <Card title="Con ML" value={kpis?.con_ml} color="violet" />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Equipos</h2>

          {/* Botón Estadísticas (lee otro endpoint) */}
          <Link
            href="/ml-v2/estadisticas"
            className="inline-flex items-center gap-2 px-3 py-1.5
                       rounded-xl text-sm border border-white/10
                       bg-white/5 hover:bg-white/10 transition"
            title="Ver estadísticas de asignaciones, salidas y reasignaciones"
          >
            📊 Estadísticas
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["ALL", "CRITICAL", "ALTA", "MEDIA", "NORMAL"] as Sev[]).map((sev) => {
            const count = sev === "ALL" ? rows.length : sevCounts?.[sev] ?? 0;
            return (
              <button
                key={sev}
                onClick={() => setSevFilter(sev)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  sevFilter === sev ? "bg-white/10 border-white/30" : "border-white/10 opacity-70 hover:opacity-100"
                }`}
              >
                {sev} ({count})
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["ALL", "Alta", "Media", "Baja", "Normal", "SIN_ML"] as MlRisk[]).map((risk) => {
            const count =
              risk === "ALL"
                ? rows.length
                : rows.filter((e) => {
                    const ml = mlById?.get?.(e.id_equipo);
                    const val = String(ml?.nivel_riesgo ?? ml?.ml_risk_level ?? "").trim();
                    if (risk === "SIN_ML") return !val;
                    return val === risk;
                  }).length;

            return (
              <button
                key={risk}
                onClick={() => setMlRiskFilter(risk)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  mlRiskFilter === risk ? "bg-violet-500/10 border-violet-400/40 text-violet-200" : "border-white/10 opacity-70 hover:opacity-100"
                }`}
              >
                ML {risk} ({count})
              </button>
            );
          })}
        </div>

        {/* Acciones (MTR / estado) */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide opacity-70">Acciones</div>
            <div className="text-xs opacity-70">
              Total: <span className="font-semibold">{accionesTotal || 0}</span>
            </div>
          </div>

          {accionesErr ? (
            <div className="mt-2 text-xs text-rose-300/90">No pude cargar acciones: {accionesErr}</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {acciones
                .slice()
                .sort((a, b) => {
                  const ka = accionSortKey(a.tipo_accion);
                  const kb = accionSortKey(b.tipo_accion);
                  if (ka !== kb) return ka - kb;
                  // secundario: orden alfabético por tipo
                  const t = String(a.tipo_accion).localeCompare(String(b.tipo_accion));
                  if (t !== 0) return t;
                  // terciario: por "prioridad" (estado)
                  return String(a.prioridad).localeCompare(String(b.prioridad));
                })
                .map((g) => (
                  <span
                    key={`${g.tipo_accion}__${g.prioridad}`}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-white/10 bg-white/5"
                    title={`${g.tipo_accion} · ${g.prioridad}`}
                  >
                    <span className="text-sm">{accionEmoji(g.tipo_accion)}</span>
                    <span className="font-medium">{accionLabel(g.tipo_accion)}</span>
                    <span className="opacity-70">·</span>
                    <span className="opacity-80">{g.prioridad}</span>
                    <span className="opacity-70">·</span>
                    <span className="font-semibold">{g.total}</span>
                  </span>
                ))}
              {acciones.length === 0 && <span className="text-xs opacity-50">—</span>}
            </div>
          )}
        </div>

        

        <table className="w-full border border-neutral-800 rounded-xl text-sm">
          <thead>
            <tr className="bg-white/5 text-xs uppercase tracking-wide text-sky-300/80">
              <th className="p-2 text-left font-medium">Equipo</th>
              <th className="p-2 text-left font-medium">Estado</th>
              <th className="p-2 text-left font-medium">Asignado a</th>
              <th className="p-2 text-left font-medium">Severidad</th>
              <th className="p-2 text-left font-medium">Alertas</th>
              <th className="p-2 text-left font-medium">ML</th>
              <th className="p-2 text-center font-medium w-[1%] whitespace-nowrap"></th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm opacity-60">
                  No hay equipos con severidad <b>{sevFilter}</b>
                </td>
              </tr>
            )}

            {filteredRows.map((e) => {
              const ml = mlById?.get?.(e.id_equipo);
              return (
                <tr key={e.id_equipo} className="border-t border-neutral-800">
                  <td className="p-2 font-mono">
  {e.id_equipo}
  {isEquipoActual(e) && (
    <span
      className="ml-2 text-[11px] px-2 py-0.5 rounded-full
                 bg-emerald-500/10 text-emerald-300
                 border border-emerald-400/30"
    >
      actual
    </span>
  )}
</td>
                  <td className="p-2">
  <div className="flex flex-col">
    <span className={getStatusClassName(e.estado_equipo)}>
      {e.estado_equipo ?? "—"}
    </span>

    {e?.tipo_ultimo_evento && (
      <span className="text-[11px] opacity-60">
        Último: {String(e.tipo_ultimo_evento).toLowerCase()}
        {e?.dias_desde_ultimo_evento != null && (
          <> · hace {e.dias_desde_ultimo_evento}d</>
        )}
      </span>
    )}
  </div>
</td>
                  <td className="p-2">{(e.persona_asignada || e.last_event_persona) || "—"}</td>

                  <td className="p-2">
                    <Badge severity={e.alertas_severidad_ui} />
                  </td>

                  <td className="p-2">
                    <AlertIcons e={e} />
                  </td>

                  

                  <td className="p-2">
                    {ml?.ml_score != null || ml?.score != null || ml?.nivel_riesgo || ml?.ml_risk_level ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-200 whitespace-nowrap">
                          {(ml?.nivel_riesgo ?? ml?.ml_risk_level ?? "ML")}
                          {" · "}
                          {String(ml?.ml_score ?? ml?.score ?? ml?.ml_total ?? "—")}
                        </div>
                        <Link
                          href={`/ml-v2/explain/${encodeURIComponent(e.id_equipo)}`}
                          className="text-violet-300 hover:underline text-xs whitespace-nowrap"
                          title="Ver explicación ML v2"
                        >
                          Explain →
                        </Link>
                      </div>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>

                  <td className="py-2 px-2 text-center whitespace-nowrap">
                    <Link href={`/equipos/${e.id_equipo}`} className="inline-block text-blue-400 hover:underline">
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: number | string | null | undefined;
  color: "red" | "yellow" | "blue" | "violet";
}) {
  const map: Record<"red" | "yellow" | "blue" | "violet", string> = {
    red: "border-red-500 text-red-400",
    yellow: "border-yellow-500 text-yellow-400",
    blue: "border-blue-500 text-blue-400",
    violet: "border-violet-500 text-violet-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${map[color]}`}>
      <div className="text-sm opacity-80">{title}</div>
      <div className="text-2xl font-bold">{value ?? "—"}</div>
    </div>
  );
}

function Badge({ severity }: { severity: UiSev }) {
  const sev = severity;
  const cls =
    sev === "CRITICAL"
      ? "bg-red-600"
      : sev === "ALTA"
      ? "bg-amber-600"
      : sev === "MEDIA"
      ? "bg-sky-600"
      : "bg-neutral-700";

  return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{sev}</span>;
}
