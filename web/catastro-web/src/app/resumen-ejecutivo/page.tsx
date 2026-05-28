import Link from "next/link";
import ExportPrintButton from "@/components/ExportPrintButton";
import { apiProxyGet } from "@/lib/api";
import { getRequestOrigin } from "@/lib/request-origin";
import { getUiVisualUpdatedAtLabel } from "@/lib/ui-version";

type DashboardResponse = {
  overview?: {
    activos_totales?: number;
    asignados?: number;
    disponibles?: number;
    bajas?: number;
    sin_asignacion?: number;
    alertas_criticas?: number;
    riesgo_alto?: number;
    mart_actualizado_at?: string | null;
    inconsistencias_mtr_jira?: number;
    equipos_conciliados?: number;
  } | null;
  planning?: {
    resumen?: {
      renovar_mart?: number;
      salida_legacy?: number;
      presion_alta?: number;
    };
    acciones_sugeridas?: Array<{ titulo?: string; detalle?: string }>;
  } | null;
};

type ExecutionQueueResponse = {
  kpis?: {
    pendientes?: number;
    en_revision?: number;
    escalados?: number;
    resueltos_hoy?: number;
    validados_cruce?: number;
  };
  rows?: Array<{
    case_key: string;
    id_equipo: string;
    source: string;
    title: string;
    owner_display?: string | null;
    estado_seguimiento?: string | null;
  }>;
};

type SyncHealth = {
  sync_runs?: {
    google_sheets_mtr?: { finished_at?: string | null; status?: string | null };
    jira_issue_snapshot_backfill?: { finished_at?: string | null; status?: string | null };
  };
};

function fmtNumber(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtDateTime(value?: string | null) {
  if (!value) return "Sin dato";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return value;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

export default async function ResumenEjecutivoPage() {
  const uiUpdatedAtLabel = getUiVisualUpdatedAtLabel();
  const origin = await getRequestOrigin();
  const [dashboard, execution, syncHealth] = await Promise.all([
    apiProxyGet<DashboardResponse>("/home/dashboard", { origin }).catch(() => ({}) as DashboardResponse),
    apiProxyGet<ExecutionQueueResponse>("/ejecucion/queue?limit=10", { origin }).catch(() => ({ rows: [], kpis: {} }) as ExecutionQueueResponse),
    apiProxyGet<SyncHealth>("/api/sync/health/details", { origin }).catch(() => ({}) as SyncHealth),
  ]);

  const overview = dashboard.overview ?? {};
  const planning = dashboard.planning?.resumen ?? {};
  const actions = dashboard.planning?.acciones_sugeridas ?? [];
  const executionKpis = execution.kpis ?? {};
  const executionRows = execution.rows ?? [];
  const googleRun = syncHealth.sync_runs?.google_sheets_mtr;
  const jiraRun = syncHealth.sync_runs?.jira_issue_snapshot_backfill;
  const leadAction = actions[0];
  const decisionTitle = leadAction?.titulo ?? (Number(planning.presion_alta ?? 0) > 0
    ? "Regularizar cobertura y renovación priorizada"
    : "Mantener monitoreo con cobertura suficiente");
  const decisionBody = leadAction?.detalle ?? (Number(planning.presion_alta ?? 0) > 0
    ? "La presión alta visible en planeación pide ejecutar cobertura, renovación o reasignación antes del siguiente corte."
    : "No hay presión extraordinaria de compra; la lectura ejecutiva sigue en monitoreo con foco en continuidad y pendientes.");

  return (
    <main className="catastro-page print:pt-0">
      <div className="mx-auto max-w-5xl">
        <section className="catastro-panel-strong rounded-3xl p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Resumen ejecutivo exportable
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-text)]">Catastro · corte ejecutivo</h1>
              <p className="mt-3 max-w-3xl text-lg text-[var(--cat-text-muted)]">
                Vista corta pensada para imprimir o guardar en PDF con el estado del parque, ejecución, presión y salud del refresh.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="catastro-button-secondary print:hidden rounded-full px-4 py-2 text-sm">
                Volver al Home
              </Link>
              <ExportPrintButton />
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="cat-kpi-card kpi-cyan p-6">
            <div className="catastro-kpi-label">Corte operativo</div>
            <div className="catastro-kpi-value text-[2rem]">{fmtDateTime(overview.mart_actualizado_at)}</div>
            <div className="catastro-kpi-helper">UI {uiUpdatedAtLabel}</div>
          </div>
          <div className="cat-kpi-card kpi-green p-6">
            <div className="catastro-kpi-label">Parque visible</div>
            <div className="catastro-kpi-value text-[2rem]">{fmtNumber(overview.activos_totales)}</div>
            <div className="catastro-kpi-helper">Asignados {fmtNumber(overview.asignados)} · Disponibles {fmtNumber(overview.disponibles)}</div>
          </div>
          <div className="cat-kpi-card kpi-red p-6">
            <div className="catastro-kpi-label">Riesgo inmediato</div>
            <div className="catastro-kpi-value text-[2rem]">{fmtNumber(overview.alertas_criticas)}</div>
            <div className="catastro-kpi-helper">Sin asignación {fmtNumber(overview.sin_asignacion)} · ML alto {fmtNumber(overview.riesgo_alto)}</div>
          </div>
          <div className="cat-kpi-card kpi-purple p-6">
            <div className="catastro-kpi-label">Conciliación</div>
            <div className="catastro-kpi-value text-[2rem]">{fmtNumber(overview.equipos_conciliados)}</div>
            <div className="catastro-kpi-helper">Inconsistencias {fmtNumber(overview.inconsistencias_mtr_jira)}</div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Decisión del día</h2>
            <div className="mt-5 catastro-inset rounded-2xl p-5">
              <div className="catastro-kpi-label">Headline</div>
              <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{decisionTitle}</div>
              <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{decisionBody}</div>
            </div>
            <div className="mt-5 space-y-3">
              {actions.slice(0, 3).map((action, index) => (
                <div key={`${action.titulo}-${index}`} className="catastro-inset rounded-2xl p-4">
                  <div className="text-base font-semibold text-[var(--cat-text)]">{action.titulo}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--cat-text-muted)]">{action.detalle}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Observabilidad del refresh</h2>
            <div className="mt-5 space-y-4">
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Mart principal</div>
                <div className="mt-2 text-base font-semibold text-[var(--cat-text)]">{fmtDateTime(overview.mart_actualizado_at)}</div>
                <div className="mt-1 text-sm text-[var(--cat-text-muted)]">El corte visible del parque se está leyendo desde la mart operativa.</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Google Sheets / MTR</div>
                <div className="mt-2 text-base font-semibold text-[var(--cat-text)]">{fmtDateTime(googleRun?.finished_at)}</div>
                <div className="mt-1 text-sm text-[var(--cat-text-muted)]">Estado {googleRun?.status ?? "Sin dato"}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Jira snapshot</div>
                <div className="mt-2 text-base font-semibold text-[var(--cat-text)]">{fmtDateTime(jiraRun?.finished_at)}</div>
                <div className="mt-1 text-sm text-[var(--cat-text-muted)]">Estado {jiraRun?.status ?? "Sin dato"}</div>
              </div>
            </div>
          </section>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Ejecución operativa</h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Pendientes</div>
                <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(executionKpis.pendientes)}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">En revisión</div>
                <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(executionKpis.en_revision)}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Escalados</div>
                <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(executionKpis.escalados)}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Validados por cruce</div>
                <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(executionKpis.validados_cruce)}</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {executionRows.slice(0, 5).map((row) => (
                <div key={row.case_key} className="catastro-inset rounded-2xl p-4">
                  <div className="text-base font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--cat-text-muted)]">{row.title}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                    {row.owner_display ?? "Sin owner"} · {row.estado_seguimiento ?? "PENDIENTE"} · {row.source}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Planeación y cobertura</h2>
            <div className="mt-5 space-y-4">
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Presión alta</div>
                <div className="mt-2 text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(planning.presion_alta)}</div>
                <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                  Renovar {fmtNumber(planning.renovar_mart)} · Salida legacy {fmtNumber(planning.salida_legacy)}
                </div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Decisiones sugeridas</div>
                <div className="mt-2 space-y-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                  {actions.slice(0, 3).map((action, index) => (
                    <div key={`${action.titulo}-${index}`}>
                      <span className="font-semibold text-[var(--cat-text)]">{action.titulo}:</span> {action.detalle}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
