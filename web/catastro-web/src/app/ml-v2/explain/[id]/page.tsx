import Link from "next/link";
import ModuleContract from "@/components/ModuleContract";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { apiProxyGet } from "@/lib/api";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyMlRisk, prettyOperationalStatus } from "@/lib/statusMatrix";

type MlVersionEntry = {
  version?: string | null;
  score?: number | null;
  risk_level?: string | null;
  alert_code?: string | null;
  main_driver?: string | null;
  reason?: string | null;
  drivers?: unknown;
  source_available?: boolean | null;
};

type MlVersionsPayload = {
  selected?: string | null;
  v2?: MlVersionEntry | null;
  v3?: MlVersionEntry | null;
  comparison?: {
    score_delta_v3_vs_v2?: number | null;
  } | null;
};

type EquipoDetalle = {
  id_equipo: string;
  estado?: string | null;
  cliente?: string | null;
  marca_modelo?: string | null;
  tipo_colaborador?: string | null;
  alertas_resumen?: string | null;
  severidad?: string | null;
  jira_open_count?: number | null;
  last_event_type?: string | null;
  last_event_date?: string | null;
  localizacion?: string | null;
  ciudad_comuna?: string | null;
  ml_motivo_principal?: string | null;
  ml_risk_level?: string | null;
  ml_score?: number | null;
  ml_alert_code?: string | null;
  ml_scored_at?: string | null;
  ml_explain_summary?: string | null;
  ml_explain_summary_v3?: string | null;
  ml_main_driver_v3?: string | null;
  ml_risk_reason_v3?: string | null;
  ml_score_v2?: number | null;
  ml_risk_level_v2?: string | null;
  ml_alert_code_v2?: string | null;
  ml_score_v3?: number | null;
  ml_risk_level_v3?: string | null;
  ml_alert_code_v3?: string | null;
  ml_scored_at_v3?: string | null;
  ml_version?: string | null;
  ml_versions?: MlVersionsPayload | null;
};

type ActiveMlSignal = {
  version: string;
  score: number;
  riskLevel: string;
  alertCode: string | null;
  summary: string;
  mainDriver: string | null;
  reason: string | null;
  scoredAt: string | null;
  deltaV3VsV2: number | null;
  sourceAvailable: boolean | null;
  drivers: string[];
};

function riskTone(nivel?: string | null, score?: number | null) {
  const v = (nivel ?? "").toUpperCase();
  const s = Number(score ?? 0);

  if (v === "ALTO" || v === "CRITICAL" || s >= 8) {
    return getStatusClassName("alto", { domain: "ml" });
  }
  if (v === "MEDIO" || v === "WARN" || s >= 4) {
    return getStatusClassName("medio", { domain: "ml" });
  }
  return getStatusClassName("bajo", { domain: "ml" });
}

function scoreMeaning(score?: number | null) {
  const s = Number(score ?? 0);
  if (s >= 8) {
    return "Score alto: el equipo requiere revisión inmediata por riesgo operativo, rotación o necesidad de recambio.";
  }
  if (s >= 4) {
    return "Score medio: el equipo no está en estado crítico, pero sí conviene monitorearlo y revisar su contexto.";
  }
  return "Score bajo: el equipo se interpreta como estable dentro de la operación actual.";
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return value;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

function normalizeDrivers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[|•,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveActiveMlSignal(equipo: EquipoDetalle): ActiveMlSignal {
  const versions = equipo.ml_versions ?? {};
  const selectedVersion = String(versions.selected ?? equipo.ml_version ?? "v2").toLowerCase();
  const selectedPayload =
    selectedVersion === "v3"
      ? versions.v3
      : selectedVersion === "v2"
        ? versions.v2
        : null;

  const score = Number(
    selectedPayload?.score ??
      (selectedVersion === "v3" ? equipo.ml_score_v3 : equipo.ml_score_v2) ??
      equipo.ml_score ??
      0,
  );
  const riskLevel = String(
    selectedPayload?.risk_level ??
      (selectedVersion === "v3" ? equipo.ml_risk_level_v3 : equipo.ml_risk_level_v2) ??
      equipo.ml_risk_level ??
      "NORMAL",
  );
  const alertCode =
    selectedPayload?.alert_code ??
    (selectedVersion === "v3" ? equipo.ml_alert_code_v3 : equipo.ml_alert_code_v2) ??
    equipo.ml_alert_code ??
    null;
  const mainDriver =
    selectedPayload?.main_driver ??
    equipo.ml_main_driver_v3 ??
    null;
  const reason =
    selectedPayload?.reason ??
    equipo.ml_risk_reason_v3 ??
    null;
  const summary =
    reason ??
    mainDriver ??
    equipo.ml_explain_summary_v3 ??
    equipo.ml_explain_summary ??
    equipo.ml_motivo_principal ??
    "Sin explicación ML detallada disponible.";
  const scoredAt =
    (selectedVersion === "v3" ? equipo.ml_scored_at_v3 : equipo.ml_scored_at) ??
    equipo.ml_scored_at ??
    null;

  return {
    version: selectedVersion === "v3" ? "v3" : "v2",
    score: Number.isFinite(score) ? score : 0,
    riskLevel: riskLevel.trim() || "NORMAL",
    alertCode,
    summary,
    mainDriver,
    reason,
    scoredAt,
    deltaV3VsV2: versions.comparison?.score_delta_v3_vs_v2 ?? null,
    sourceAvailable: selectedPayload?.source_available ?? null,
    drivers: normalizeDrivers(selectedPayload?.drivers),
  };
}


function locationBadge(loc?: string | null) {
  const v = (loc ?? "").toLowerCase().trim();

  if (!v) {
    return {
      label: "Sin dato",
      cls: "border-white/10 bg-white/5 text-neutral-300",
    };
  }

  if (v.includes("chile")) {
    return {
      label: "Chile",
      cls: "border-green-500/30 bg-green-500/10 text-green-200",
    };
  }

  return {
    label: "Internacional",
    cls: "border-red-500/30 bg-red-500/10 text-red-200",
  };
}

function scopeCards() {
  return [
    {
      title: "Scope operativo",
      text: "Lee el estado actual del equipo, su último evento, señales de asignación y contexto de uso.",
    },
    {
      title: "Scope de riesgo",
      text: "Interpreta score, nivel de riesgo y alertas para identificar equipos con mayor probabilidad de requerir atención.",
    },
    {
      title: "Scope de política",
      text: "Permite cruzar el resultado ML con reglas de negocio como renovación, baja, observación o reutilización.",
    },
  ];
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const origin = await getRequestOrigin();

  const equipo = await apiProxyGet<EquipoDetalle>(`/estadisticas/equipos/${encodeURIComponent(id)}`, {
    origin,
  })
    .catch(
      (): EquipoDetalle => ({
        id_equipo: id,
        cliente: "—",
        marca_modelo: "—",
        tipo_colaborador: "—",
        estado: "—",
        alertas_resumen: "—",
        severidad: "—",
        jira_open_count: 0,
        last_event_type: "—",
        last_event_date: "—",
        localizacion: "—",
        ciudad_comuna: "—",
        ml_motivo_principal: "—",
        ml_risk_level: "NORMAL",
        ml_score: 0,
      })
    );

  const ml = resolveActiveMlSignal(equipo);
  const riskCls = riskTone(ml.riskLevel, ml.score);
  const scoreText = scoreMeaning(ml.score);
  const scopes = scopeCards();
  const locBadge = locationBadge(equipo.localizacion);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/activos" className="font-medium text-[var(--cat-primary)] hover:underline">
            ← Volver a Activos
          </Link>

          <Link href={`/equipos/${encodeURIComponent(id)}`} className="font-medium text-[var(--cat-primary)] hover:underline">
            Ver equipo →
          </Link>
        </div>

        <section className="catastro-panel-strong rounded-3xl p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                ML v2 · Explain
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-text)]">{equipo.id_equipo}</h1>

              <div className="mt-4 space-y-2 text-[var(--cat-text-muted)]">
                <div><span className="text-[var(--cat-text-soft)]">Cliente:</span> {equipo.cliente ?? "—"}</div>
                <div><span className="text-[var(--cat-text-soft)]">Modelo:</span> {equipo.marca_modelo ?? "—"}</div>
                <div>
                  <span className="text-[var(--cat-text-soft)]">Tipo:</span>{" "}
                  <span className={getStatusClassName(equipo.tipo_colaborador)}>
                    {equipo.tipo_colaborador ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--cat-text-soft)]">Estado:</span>{" "}
                  <span className={getStatusClassName(equipo.estado, { domain: "operacion" })}>
                    {prettyOperationalStatus(equipo.estado)}
                  </span>
                </div>
                <div><span className="text-[var(--cat-text-soft)]">Alerta:</span> {equipo.alertas_resumen ?? "—"}</div>
                <div><span className="text-[var(--cat-text-soft)]">Motivo ML:</span> {ml.summary}</div>
              </div>
            </div>

            <div className={`rounded-2xl border px-6 py-5 text-right ${riskCls}`}>
              <div className="text-sm uppercase tracking-wide opacity-80">ML risk level</div>
              <div className="mt-2 text-3xl font-bold">{prettyMlRisk(ml.riskLevel)}</div>
              <div className="mt-3 text-6xl font-bold">{ml.score}</div>
              <div className="text-sm opacity-80">score</div>
              <div className="mt-4 text-xs uppercase tracking-[0.18em] opacity-80">
                modelo {ml.version} · {fmtDateTime(ml.scoredAt)}
              </div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer explain ML"
          description="Explain abre la señal ML activa del equipo y la aterriza sobre el contexto operativo visible para que el score tenga trazabilidad."
          items={[
            {
              label: "Fuente dominante",
              value: operationalLabel("scoringMl"),
              hint: operationalMeaning("scoringMl"),
              tone: "purple",
            },
            {
              label: "Corte visible",
              value: fmtDateTime(ml.scoredAt),
              hint: "Timestamp del scoring activo seleccionado para este equipo.",
              tone: "cyan",
            },
            {
              label: "Cobertura",
              value: `${operationalLabel("parqueVisible")} + explain ML`,
              hint: "La explicación se apoya en el equipo visible de Catastro y no inventa contexto fuera del parque actual.",
              tone: "green",
            },
            {
              label: "Modo de lectura",
              value: `Versión ${ml.version.toUpperCase()} activa`,
              hint: "Si existe comparación, el explain muestra drivers y delta respecto de la versión anterior.",
              tone: ml.score >= 8 ? "red" : ml.score >= 4 ? "amber" : "green",
            },
          ]}
          badges={[
            { label: prettyMlRisk(ml.riskLevel), tone: ml.score >= 8 ? "red" : ml.score >= 4 ? "amber" : "green" },
            { label: `Score ${ml.score}`, tone: "purple" },
          ]}
          note={`${operationalMeaning("parqueVisible")} ${operationalMeaning("conciliacionMtrJira")}`}
        />

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Cómo leer este resultado</h2>
            <div className="catastro-inset mt-4 rounded-2xl p-5 text-[var(--cat-text-muted)]">
              {scoreText}
            </div>

            <div className="mt-6 space-y-3 text-[var(--cat-text-muted)]">
              <div>🟢 <strong>0–3</strong> → comportamiento estable o sin señal fuerte inmediata.</div>
              <div>🟡 <strong>4–7</strong> → seguimiento recomendado, revisar contexto operativo y asignación.</div>
              <div>🔴 <strong>8+</strong> → prioridad alta, posible revisión inmediata, recambio o escalamiento.</div>
            </div>
          </div>

          <div className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Resumen del caso</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Versión ML activa</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{ml.version.toUpperCase()}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Alert code</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{ml.alertCode ?? "—"}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Severidad</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{equipo.severidad ?? "—"}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Jira open</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{equipo.jira_open_count ?? 0}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Último evento</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{equipo.last_event_type ?? "—"}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Fecha último evento</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{equipo.last_event_date ?? "—"}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Último scoring ML</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{fmtDateTime(ml.scoredAt)}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Delta v3 vs v2</div>
                <div className="mt-2 text-xl text-[var(--cat-text)]">{ml.deltaV3VsV2 == null ? "—" : ml.deltaV3VsV2}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="catastro-panel mt-8 rounded-3xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Lectura ML activa</h2>
              <p className="mt-2 text-[var(--cat-text-muted)]">
                Esta vista prioriza la misma versión ML activa que se usa en las cards del módulo.
              </p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${riskCls}`}>
              {ml.riskLevel} · {ml.version.toUpperCase()}
            </span>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="catastro-inset rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Driver principal</div>
              <div className="mt-3 text-xl text-[var(--cat-text)]">{ml.mainDriver ?? "Sin driver principal estructurado."}</div>
              <div className="mt-5 text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Razón operativa</div>
              <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{ml.reason ?? ml.summary}</div>
            </div>
            <div className="catastro-inset rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Drivers visibles</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(ml.drivers.length ? ml.drivers : [ml.alertCode ?? "Sin drivers estructurados en la versión activa."]).map((driver) => (
                  <span key={`${equipo.id_equipo}-${driver}`} className="cat-status-badge cat-status-neutral">
                    {driver}
                  </span>
                ))}
              </div>
              <div className="mt-5 text-sm text-[var(--cat-text-muted)]">
                Fuente disponible: {ml.sourceAvailable == null ? "Sin señal explícita" : ml.sourceAvailable ? "Sí" : "No"}
              </div>
            </div>
          </div>
        </section>

        <section className="catastro-panel mt-8 rounded-3xl p-6">
          <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Scopes de lectura</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {scopes.map((scope) => (
              <div key={scope.title} className="catastro-inset rounded-2xl p-5">
                <div className="text-lg font-semibold text-[var(--cat-text)]">{scope.title}</div>
                <div className="mt-3 text-[var(--cat-text-muted)]">{scope.text}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="catastro-panel mt-8 rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Ubicación y contexto</h2>
            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${locBadge.cls}`}>
              {locBadge.label}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">País / localización</div>
              <div className="mt-2 text-xl text-[var(--cat-text)]">{equipo.localizacion ?? "—"}</div>
            </div>
            <div className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">Ciudad / comuna</div>
              <div className="mt-2 text-xl text-[var(--cat-text)]">{equipo.ciudad_comuna ?? "—"}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
