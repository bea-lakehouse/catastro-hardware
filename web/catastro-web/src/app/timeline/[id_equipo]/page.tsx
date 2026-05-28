import Link from "next/link";
import { apiProxyGet } from "@/lib/api";
import { originHelp, prettyOrigin } from "@/lib/reconciliation-ui";
import { getRequestOrigin } from "@/lib/request-origin";

type TimelineRow = {
  id_equipo?: string;
  equipo_id?: string;
  historia_id: number;
  fecha_evento: string;
  tipo_evento: string;
  detalle_evento: string;
  usuario_evento: string;
  origen_evento: string;
  dias_hasta_siguiente_evento: number | null;
};

type MlV2Row = {
  id_equipo?: string;
  equipo_id?: string;
  riesgo_total?: number;
  nivel_riesgo?: string;
  alerta_ml_v2?: string;
  model_version?: string;
  scored_at?: string;
  ml_score?: number;
  ml_risk_level?: string;
  ml_alert_code?: string;
  ml_scored_at?: string;
  ml_explain_summary?: string | null;
};

type AuditAvailability = {
  count?: number;
};

function originClasses(origin?: string | null) {
  const key = (origin ?? "").toUpperCase();
  if (key === "CONCILIADO") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (key === "JIRA") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "MTR") return "border-sky-300/60 bg-sky-100/80 text-sky-800";
  if (key === "EXCEL:REPARADOS") return "border-violet-300/60 bg-violet-100/80 text-violet-800";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

async function getMlV2Explain(origin: string, id_equipo: string): Promise<MlV2Row | null> {
  try {
    return await apiProxyGet<MlV2Row>(`/estadisticas/equipos/${encodeURIComponent(id_equipo)}`, { origin });
  } catch {
    return null;
  }
}

async function getTimelineWithMl(origin: string, id_equipo: string) {
  const [timeline, ml, audit] = await Promise.all([
    apiProxyGet<{ rows: TimelineRow[]; count: number }>(
      `/equipos/${encodeURIComponent(id_equipo)}/timeline?limit=1000`,
      { origin }
    ).catch((error: unknown) => ({
      rows: [],
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    })),
    getMlV2Explain(origin, id_equipo),
    apiProxyGet<AuditAvailability>(`/equipos/${encodeURIComponent(id_equipo)}/audit?limit=1`, { origin }).catch(
      () => ({ count: 0 })
    ),
  ]);

  return { ...timeline, ml, audit_count: Number(audit.count ?? 0) };
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id_equipo: string }>;
}) {
  const { id_equipo } = await params;
  const id = decodeURIComponent(id_equipo);
  const origin = await getRequestOrigin();

  let data: { rows: TimelineRow[]; count: number; ml: MlV2Row | null; audit_count: number } = {
    rows: [],
    count: 0,
    ml: null,
    audit_count: 0,
  };
  let err: string | null = null;

  try {
    const result = await getTimelineWithMl(origin, id);
    data = result;
    err =
      "error" in result && typeof result.error === "string" && result.error.trim()
        ? result.error
        : null;
  } catch (e: unknown) {
    err = e instanceof Error ? e.message : String(e);
  }

  const ml = data.ml;
  const hasAudit = data.audit_count > 0;

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-6xl">
      {ml?.ml_risk_level || ml?.nivel_riesgo ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-100/80 px-3 py-1 text-sm text-violet-700">
          🤖 ML v2: <span className="font-semibold">{ml.ml_risk_level ?? ml.nivel_riesgo}</span>
          {typeof ml.ml_score === "number" ? (
            <span className="text-xs text-[var(--cat-text-soft)]">({ml.ml_score})</span>
          ) : typeof ml.riesgo_total === "number" ? (
            <span className="text-xs text-[var(--cat-text-soft)]">({ml.riesgo_total})</span>
          ) : null}
          <span className="text-xs text-[var(--cat-text-soft)]">{ml.ml_explain_summary || ml.ml_alert_code || ml.alerta_ml_v2 || ""}</span>
        </div>
      ) : (
        <div className="catastro-pill mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm">
          🤖 ML v2: <span className="text-[var(--cat-text-soft)]">Sin evaluación</span>
        </div>
      )}

      <div className="catastro-panel-strong mb-6 rounded-3xl p-6">
        <div className="text-sm text-[var(--cat-text-soft)]">Timeline</div>
        <div className="mt-1 text-xl font-semibold text-[var(--cat-text)]">{id}</div>
        <div className="mt-2 text-[var(--cat-text-muted)]">Eventos visibles: {data.count}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["MTR", "JIRA", "CONCILIADO", "excel:reparados"].map((originLabel) => (
            <span
              key={originLabel}
              title={originHelp(originLabel)}
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${originClasses(originLabel)}`}
            >
              {originLabel}
            </span>
          ))}
        </div>
        <div className="mt-3 text-sm text-[var(--cat-text-muted)]">
          MTR representa movimientos físicos y operativos. Jira representa workflow administrativo.
          Cuando ambos describen el mismo evento, se muestra como <span className="font-semibold">CONCILIADO</span>.
        </div>
        {err ? (
          <div className="mt-3 rounded-lg border border-red-300/50 bg-red-100/75 p-3 text-sm text-red-700">
            No se pudo cargar el timeline completo. {err}
          </div>
        ) : null}
      </div>

      {data.rows.length === 0 ? (
        <div className="text-[var(--cat-text-muted)]">Sin eventos</div>
      ) : (
        <ol className="space-y-4">
          {data.rows.map((e) => (
            <li
              key={`${e.id_equipo ?? e.equipo_id ?? id}-${e.historia_id}-${e.fecha_evento}`}
              className="catastro-panel rounded-xl p-4"
            >
              <time className="mb-1 block text-sm text-[var(--cat-text-soft)]">
                {e.fecha_evento}
              </time>
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-[var(--cat-text)]">{e.tipo_evento}</div>
                <span
                  title={originHelp(e.origen_evento)}
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${originClasses(e.origen_evento)}`}
                >
                  {prettyOrigin(e.origen_evento)}
                </span>
              </div>
              <div className="text-sm text-[var(--cat-text-muted)]">{e.detalle_evento}</div>
              <div className="mt-1 text-xs text-[var(--cat-text-soft)]">
                {e.usuario_evento} · {prettyOrigin(e.origen_evento)}
                {typeof e.dias_hasta_siguiente_evento === "number" ? (
                  <> · Δ {e.dias_hasta_siguiente_evento} días</>
                ) : null}
              </div>
              {hasAudit ? (
                <div className="mt-3">
                  <Link
                    href={`/equipos/${encodeURIComponent(id)}#auditoria`}
                    className="text-sm font-medium text-[var(--cat-primary)] hover:underline"
                  >
                    Ver auditoría del cambio →
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      </div>
    </main>
  );
}
