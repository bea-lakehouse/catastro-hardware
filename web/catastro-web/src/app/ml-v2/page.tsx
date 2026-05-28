import Link from "next/link";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyMlRisk } from "@/lib/statusMatrix";

type MlV2PageSearchParams = {
  equipo?: string;
  q?: string;
  risk?: string;
};

type MlScoreApiRow = {
  id_equipo?: string | null;
  equipo_id?: string | null;
  equipo?: string | null;
  nivel_riesgo?: string | null;
  ml_risk_level?: string | null;
  ml_risk_level_v2?: string | null;
  ml_risk_level_v3?: string | null;
  riesgo_total?: number | string | null;
  score?: number | string | null;
  ml_score?: number | string | null;
  ml_score_v2?: number | string | null;
  ml_score_v3?: number | string | null;
  motivos_resumen?: string | null;
  resumen?: string | null;
  motivos?: string | null;
  motivo_principal?: string | null;
  alerta_ml_v2?: string | null;
  ml_risk_reason_v3?: string | null;
  ml_main_driver_v3?: string | null;
  pca1?: number | string | null;
  pca2?: number | string | null;
  model_version?: string | null;
  ml_version?: string | null;
  scored_at?: string | null;
  ml_scored_at?: string | null;
  model_run_at?: string | null;
  drivers?: unknown;
  drivers_json?: unknown;
};

type MlScoreRow = {
  id: string;
  nivel: string;
  score: number;
  resumen: string;
  pca1: number | null;
  pca2: number | null;
  modelVersion: string | null;
  scoredAt: string | null;
  drivers: string[];
};

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return String(value).replace("T", " ").slice(0, 16);
}

function normalizeDrivers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[|•]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeRow(row: MlScoreApiRow): MlScoreRow | null {
  const id = String(row.id_equipo ?? row.equipo_id ?? row.equipo ?? "").trim();
  if (!id) return null;

  const score =
    asNumber(
      row.ml_score_v3 ??
      row.ml_score_v2 ??
      row.riesgo_total ??
      row.score ??
      row.ml_score
    ) ?? 0;
  const pca1 = asNumber(row.pca1);
  const pca2 = asNumber(row.pca2);
  const nivel =
    String(
      row.ml_risk_level_v3 ??
      row.ml_risk_level_v2 ??
      row.nivel_riesgo ??
      row.ml_risk_level ??
      "Sin nivel"
    ).trim() || "Sin nivel";
  const resumen =
    String(
      row.ml_risk_reason_v3 ??
        row.ml_main_driver_v3 ??
      row.motivos_resumen ??
        row.resumen ??
        row.motivos ??
        row.motivo_principal ??
        row.alerta_ml_v2 ??
        "Sin explicación resumida disponible."
    ).trim() || "Sin explicación resumida disponible.";

  return {
    id,
    nivel,
    score,
    resumen,
    pca1,
    pca2,
    modelVersion: row.ml_version ?? row.model_version ?? (row.ml_score_v3 != null ? "v3" : row.ml_score_v2 != null ? "v2" : null),
    scoredAt: row.ml_scored_at ?? row.model_run_at ?? row.scored_at ?? null,
    drivers: normalizeDrivers(row.drivers ?? row.drivers_json),
  };
}

function riskTone(nivel?: string, score?: number) {
  const text = String(nivel ?? "").toLowerCase();
  const value = Number(score ?? 0);

  if (text.includes("alta") || text.includes("critical") || value >= 8) {
    return {
      card: "kpi-red",
      badge: getStatusClassName("alto", { domain: "ml" }),
      label: "Riesgo alto",
    };
  }
  if (text.includes("media") || text.includes("warn") || value >= 4) {
    return {
      card: "kpi-orange",
      badge: getStatusClassName("medio", { domain: "ml" }),
      label: "Riesgo medio",
    };
  }
  return {
    card: "kpi-green",
    badge: getStatusClassName("bajo", { domain: "ml" }),
    label: "Riesgo bajo",
  };
}

async function getScores(limit = 48): Promise<{ rows: MlScoreRow[]; error: string | null }> {
  const origin = await getRequestOrigin();
  try {
    const json = await apiProxyGet<
      MlScoreApiRow[] | { rows?: MlScoreApiRow[]; items?: MlScoreApiRow[] }
    >(`/ml/v2/scores?limit=${limit}`, {
      origin,
      timeoutMs: 5000,
    });

    const rawRows = Array.isArray(json)
      ? json
      : Array.isArray(json.rows)
        ? json.rows
        : Array.isArray(json.items)
          ? json.items
          : [];

    return {
      rows: rawRows
        .map((row) => normalizeRow(row))
        .filter((row): row is MlScoreRow => row !== null)
        .sort((a, b) => b.score - a.score),
      error: null,
    };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "No fue posible leer /ml/v2/scores.",
    };
  }
}

function PcaBadge({ row }: { row: MlScoreRow | null }) {
  if (!row || (row.pca1 == null && row.pca2 == null)) {
    return <span className="cat-status-badge cat-status-neutral">PCA no disponible</span>;
  }

  return (
    <span className="cat-status-badge cat-status-info">
      PCA {fmtNumber(row.pca1)} / {fmtNumber(row.pca2)}
    </span>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<MlV2PageSearchParams>;
}) {
  const sp = await searchParams;
  const { rows, error } = await getScores(48);
  const query = String(sp?.q ?? "").trim().toLowerCase();
  const risk = String(sp?.risk ?? "all").trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    const matchesQuery =
      !query ||
      row.id.toLowerCase().includes(query) ||
      row.resumen.toLowerCase().includes(query) ||
      row.drivers.some((driver) => driver.toLowerCase().includes(query));
    const tone = riskTone(row.nivel, row.score).label.toLowerCase();
    const matchesRisk =
      risk === "all" ||
      (risk === "alto" && tone.includes("alto")) ||
      (risk === "medio" && tone.includes("medio")) ||
      (risk === "bajo" && tone.includes("bajo"));
    return matchesQuery && matchesRisk;
  });
  const selectedId = String(sp?.equipo ?? "").trim();
  const selected = visibleRows.find((row) => row.id === selectedId) ?? visibleRows[0] ?? rows[0] ?? null;
  const selectedTone = riskTone(selected?.nivel, selected?.score);
  const avgScore = visibleRows.length ? visibleRows.reduce((sum, row) => sum + row.score, 0) / visibleRows.length : 0;
  const highRisk = visibleRows.filter((row) => riskTone(row.nivel, row.score).label === "Riesgo alto").length;
  const mediumRisk = visibleRows.filter((row) => riskTone(row.nivel, row.score).label === "Riesgo medio").length;
  const lowRisk = Math.max(visibleRows.length - highRisk - mediumRisk, 0);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-panel-strong rounded-3xl p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                ML v2
              </div>
              <h1 className="mt-4 text-[clamp(2rem,3vw,3rem)] font-semibold text-[var(--cat-text)]">Vista explicativa</h1>
              <p className="mt-3 max-w-3xl text-[var(--cat-text-muted)]">
                ML v2 apoya la priorización operacional con scores reales, resumen de riesgo y lectura PCA.
                No reemplaza MTR ni genera alertas por sí mismo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">
              <div className="cat-kpi-card kpi-cyan p-5">
                <div className="catastro-kpi-label">Equipos scoreados</div>
                <div className="mt-3 text-4xl font-bold text-[var(--cat-text)]">{visibleRows.length}</div>
              </div>
              <div className="cat-kpi-card kpi-red p-5">
                <div className="catastro-kpi-label">Riesgo alto</div>
                <div className="mt-3 text-4xl font-bold text-[var(--cat-text)]">{highRisk}</div>
              </div>
              <div className="cat-kpi-card kpi-purple p-5">
                <div className="catastro-kpi-label">Score promedio</div>
                <div className="mt-3 text-4xl font-bold text-[var(--cat-text)]">{fmtNumber(avgScore)}</div>
              </div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer ML v2"
          description="ML v2 prioriza revisión operativa con scores y explicaciones resumidas. No altera la verdad física del parque ni reemplaza decisiones validadas por negocio."
          items={[
            {
              label: "Fuente dominante",
              value: operationalLabel("scoringMl"),
              hint: operationalMeaning("scoringMl"),
              tone: "purple",
            },
            {
              label: "Corte visible",
              value: selected?.scoredAt ? fmtDate(selected.scoredAt) : "Sin scoring visible",
              hint: "La vista usa la última corrida visible que entregue /ml/v2/scores para el equipo filtrado.",
              tone: "cyan",
            },
            {
              label: "Cobertura",
              value: `${visibleRows.length} equipos scoreados con explain navegable`,
              hint: "El score convive con PCA, drivers y resumen de riesgo, pero debe leerse junto con contexto MTR y Activos.",
              tone: "green",
            },
            {
              label: "Modo de lectura",
              value: error ? "Score parcial o vacio" : "Priorización ML explicativa",
              hint: error
                ? "Si el endpoint falla, la vista conserva navegación y deja visible el quiebre sin inventar scores."
                : "El objetivo es ordenar riesgo operativo, no emitir una orden automatica.",
              tone: error ? "amber" : "red",
            },
          ]}
          badges={[
            { label: `${highRisk} alto`, tone: "red" },
            { label: `${mediumRisk} medio`, tone: "amber" },
            { label: `${lowRisk} bajo`, tone: "green" },
          ]}
          note={`${operationalMeaning("parqueVisible")} ${operationalMeaning("scoringMl")}`}
        />

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="catastro-panel rounded-3xl p-5">
            <h2 className="text-lg font-semibold text-[var(--cat-text)]">Cómo leer el score</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--cat-text-muted)]">
              <li>Score cercano a 1.0 o superior según corte operativo = mayor señal de comportamiento anómalo.</li>
              <li>Riesgo alto: foco inmediato para revisión, recambio o validación de contexto.</li>
              <li>Riesgo medio: monitoreo activo y contraste con historial del equipo.</li>
            </ul>
          </div>

          <div className="catastro-panel rounded-3xl p-5">
            <h2 className="text-lg font-semibold text-[var(--cat-text)]">PCA</h2>
            <p className="mt-3 text-sm text-[var(--cat-text-muted)]">
              pca1 / pca2 son coordenadas de proyección para clustering y depuración visual. No explican por sí
              solas la causa del score.
            </p>
          </div>
        </div>

        <section className="catastro-panel mt-6 rounded-3xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Equipos scoreados</h2>
              <p className="mt-2 text-[var(--cat-text-muted)]">
                Selecciona una card para enfocar el resumen y abrir la vista `explain`.
              </p>
            </div>
            <div className="cat-badge-stack">
              <span className={getStatusClassName("alto", { domain: "ml" })}>Alto {highRisk}</span>
              <span className={getStatusClassName("medio", { domain: "ml" })}>Medio {mediumRisk}</span>
              <span className={getStatusClassName("bajo", { domain: "ml" })}>Bajo {lowRisk}</span>
            </div>
          </div>

          <form className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
            <label className="catastro-inset rounded-2xl px-4 py-3">
              <div className="catastro-kpi-label">Buscar equipo o explain</div>
              <input
                name="q"
                defaultValue={sp?.q ?? ""}
                placeholder="SKU-602, rotación, batería..."
                className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] px-3 py-2 text-sm"
              />
            </label>
            <label className="catastro-inset rounded-2xl px-4 py-3">
              <div className="catastro-kpi-label">Riesgo</div>
              <select name="risk" defaultValue={sp?.risk ?? "all"} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] px-3 py-2 text-sm">
                <option value="all">Todos</option>
                <option value="alto">Alto</option>
                <option value="medio">Medio</option>
                <option value="bajo">Bajo</option>
              </select>
            </label>
            <div className="flex items-end gap-3">
              <button type="submit" className="catastro-button-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
                Filtrar
              </button>
              <Link href="/ml-v2" className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
                Limpiar
              </Link>
            </div>
          </form>

          {error ? (
            <div className="catastro-inset mt-6 rounded-2xl p-6 text-sm text-[var(--cat-text-muted)]">
              ML v2 no pudo cargar scores actuales desde `/ml/v2/scores`.
              <div className="mt-2 text-[var(--cat-text-soft)]">{error}</div>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="catastro-inset mt-6 rounded-2xl p-6 text-sm text-[var(--cat-text-muted)]">
              No hay equipos visibles con los filtros actuales o no llegaron scores desde `/ml/v2/scores`.
              La vista ya quedó conectada al endpoint actual y mantiene navegación explain cuando hay respuesta disponible.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {visibleRows.map((row) => {
                const tone = riskTone(row.nivel, row.score);
                const isSelected = selected?.id === row.id;

                return (
                  <div
                    key={row.id}
                    className={`cat-kpi-card ${tone.card} rounded-3xl p-4 ${isSelected ? "ring-2 ring-[rgba(0,198,255,0.32)]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="catastro-kpi-label">Equipo</div>
                        <div className="mt-2 break-all text-xl font-semibold text-[var(--cat-text)]">{row.id}</div>
                      </div>
                      <span className={tone.badge}>{prettyMlRisk(row.nivel)}</span>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="catastro-kpi-label">Score</div>
                        <div className="mt-2 text-4xl font-bold text-[var(--cat-text)]">{fmtNumber(row.score)}</div>
                      </div>
                      <PcaBadge row={row} />
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[var(--cat-text-muted)]">
                      {row.resumen}
                    </p>

                    {row.drivers.length > 0 ? (
                      <div className="mt-3 cat-badge-stack">
                        {row.drivers.slice(0, 3).map((driver) => (
                          <span key={`${row.id}-${driver}`} className="cat-status-badge cat-status-neutral">
                            {driver}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/ml-v2?equipo=${encodeURIComponent(row.id)}${query ? `&q=${encodeURIComponent(query)}` : ""}${risk !== "all" ? `&risk=${encodeURIComponent(risk)}` : ""}`}
                        className="rounded-full border border-[rgba(63,98,182,0.24)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cat-text-muted)] transition hover:border-[rgba(0,198,255,0.32)] hover:text-[var(--cat-text)]"
                      >
                        Seleccionar
                      </Link>
                      <Link
                        href={`/ml-v2/explain/${encodeURIComponent(row.id)}`}
                        className="rounded-full border border-[rgba(0,198,255,0.24)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cat-primary)] transition hover:border-[rgba(0,198,255,0.4)] hover:text-[var(--cat-text)]"
                      >
                        Ver explain
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="catastro-panel mt-6 rounded-3xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Equipo seleccionado</h2>
              <p className="mt-2 text-[var(--cat-text-muted)]">
                {selected ? (
                  <>
                    Mostrando lectura resumida para <span className="font-semibold text-[var(--cat-text)]">{selected.id}</span>.
                  </>
                ) : (
                  "Selecciona un equipo desde la card."
                )}
              </p>
            </div>
            {selected ? <span className={selectedTone.badge}>{selectedTone.label}</span> : null}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className={`cat-kpi-card ${selectedTone.card} p-5`}>
              <div className="catastro-kpi-label">Equipo</div>
              <div className="mt-3 break-all text-2xl font-bold text-[var(--cat-text)]">{selected?.id ?? "—"}</div>
              <div className="mt-5 catastro-kpi-label">Score actual</div>
              <div className="mt-3 text-5xl font-bold text-[var(--cat-text)]">{fmtNumber(selected?.score ?? null)}</div>
              <div className="mt-4 text-sm text-[var(--cat-text-muted)]">
                {selected?.nivel ?? "Sin nivel"} · versión {selected?.modelVersion ?? "—"} · scoreado {fmtDate(selected?.scoredAt)}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="catastro-inset rounded-2xl p-5">
                <div className="catastro-kpi-label">Resumen / explicación</div>
                <p className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{selected?.resumen ?? "—"}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="catastro-inset rounded-2xl p-5">
                  <div className="catastro-kpi-label">PCA</div>
                  <div className="mt-3 text-2xl font-semibold text-[var(--cat-text)]">
                    {fmtNumber(selected?.pca1 ?? null)} / {fmtNumber(selected?.pca2 ?? null)}
                  </div>
                </div>
                <div className="catastro-inset rounded-2xl p-5">
                  <div className="catastro-kpi-label">Nivel de riesgo</div>
                  <div className="mt-3">
                    {selected ? <span className={selectedTone.badge}>{prettyMlRisk(selected.nivel)}</span> : <span className="cat-status-badge cat-status-neutral">Sin selección</span>}
                  </div>
                </div>
              </div>

              <div className="catastro-inset rounded-2xl p-5">
                <div className="catastro-kpi-label">Drivers visibles</div>
                <div className="mt-4 cat-badge-stack">
                  {(selected?.drivers?.length ? selected.drivers : ["Sin drivers estructurados en la respuesta actual."]).map((driver) => (
                    <span key={`${selected?.id ?? "ml"}-${driver}`} className="cat-status-badge cat-status-neutral">
                      {driver}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
