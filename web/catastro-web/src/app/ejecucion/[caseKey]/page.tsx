import Link from "next/link";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyOperationalStatus } from "@/lib/statusMatrix";

type ExecutionCaseLink = {
  href: string;
  label: string;
};

type ExecutionCaseRow = {
  case_key: string;
  case_type: string;
  source_module: string;
  source_ref?: string | null;
  id_equipo: string;
  cliente: string;
  severity: string;
  source: string;
  title: string;
  summary: string;
  suggested_action: string;
  owner_sugerido: string;
  owner_real?: string | null;
  owner_display?: string | null;
  estado_seguimiento?: string | null;
  comentario_operativo?: string | null;
  freshness?: string | null;
  age_days?: number | null;
  status?: string | null;
  fecha_toma?: string | null;
  tracking_updated_at?: string | null;
  validacion_cierre?: string | null;
  resolucion_tipo?: string | null;
  links: ExecutionCaseLink[];
};

type TrackingRow = {
  case_id?: number | null;
  owner_real?: string | null;
  owner_sugerido?: string | null;
  estado_seguimiento?: string | null;
  comentario_operativo?: string | null;
  fecha_toma?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  opened_at?: string | null;
  last_seen_at?: string | null;
  validacion_cierre?: string | null;
  resolucion_tipo?: string | null;
};

type EventRow = {
  event_id: number;
  event_type?: string | null;
  actor?: string | null;
  before_payload?: Record<string, unknown> | null;
  after_payload?: Record<string, unknown> | null;
  comment?: string | null;
  created_at?: string | null;
};

type ExecutionCaseDetailResponse = {
  case?: ExecutionCaseRow | null;
  tracking?: TrackingRow | null;
  events?: EventRow[];
};

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return value;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

function trackingBadge(status?: string | null) {
  const key = String(status ?? "PENDIENTE").toUpperCase();
  if (key === "EN_REVISION") return getStatusClassName("observacion");
  if (key === "RESUELTO") return getStatusClassName("confirmada");
  if (key === "ESCALADO") return getStatusClassName("critica");
  if (key === "DESCARTADO") return getStatusClassName("neutral");
  return getStatusClassName("sin asignacion");
}

function validationBadge(status?: string | null) {
  const key = String(status ?? "").toUpperCase();
  if (key === "VALIDADO_CRUCE") return getStatusClassName("confirmada");
  if (key === "REABIERTO") return getStatusClassName("critica");
  if (key === "MANUAL") return getStatusClassName("observacion");
  return getStatusClassName("neutral");
}

function validationLabel(status?: string | null) {
  const key = String(status ?? "").toUpperCase();
  if (key === "VALIDADO_CRUCE") return "Validado por cruce";
  if (key === "REABIERTO") return "Reabierto";
  if (key === "MANUAL") return "Cierre manual";
  return "Sin validación";
}

function sourceBadge(source: string) {
  const key = String(source ?? "").toUpperCase();
  if (key.includes("JIRA") && key.includes("MTR")) return getStatusClassName("media");
  if (key.includes("JIRA")) return getStatusClassName("observacion");
  if (key.includes("AUDITORIA")) return getStatusClassName("info");
  if (key.includes("PLANEACION")) return getStatusClassName("renovar");
  return getStatusClassName("core");
}

function eventTypeLabel(value?: string | null) {
  const key = String(value ?? "").toLowerCase();
  if (key === "take") return "Caso tomado";
  if (key === "assign") return "Owner asignado";
  if (key === "status") return "Estado actualizado";
  if (key === "comment") return "Nota agregada";
  return key ? key.toUpperCase() : "Evento";
}

function safeValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function collectEventChanges(event: EventRow) {
  const before = event.before_payload ?? {};
  const after = event.after_payload ?? {};
  const fields: Array<[string, string]> = [
    ["owner_real", "Owner real"],
    ["estado_seguimiento", "Estado"],
    ["comentario_operativo", "Comentario"],
    ["fecha_toma", "Toma"],
    ["closed_at", "Cierre"],
    ["validacion_cierre", "Validación"],
  ];

  return fields
    .map(([key, label]) => {
      const beforeValue = safeValue(before[key]);
      const afterValue = safeValue(after[key]);
      if (beforeValue === afterValue) return null;
      return { label, beforeValue, afterValue };
    })
    .filter((item): item is { label: string; beforeValue: string; afterValue: string } => Boolean(item));
}

export default async function ExecutionCaseDetailPage({
  params,
}: {
  params: Promise<{ caseKey: string }>;
}) {
  const { caseKey } = await params;
  const origin = await getRequestOrigin();
  const detail = await apiProxyGet<ExecutionCaseDetailResponse>(`/ejecucion/cases/${encodeURIComponent(caseKey)}`, { origin }).catch(
    () =>
      ({
        case: null,
        tracking: null,
        events: [],
      }) as ExecutionCaseDetailResponse,
  );

  const row = detail.case;
  const tracking = detail.tracking;
  const events = detail.events ?? [];

  if (!row) {
    return (
      <main className="catastro-page">
        <div className="mx-auto max-w-5xl">
          <section className="catastro-panel rounded-3xl p-8">
            <h1 className="text-3xl font-semibold text-[var(--cat-text)]">No encontré este caso</h1>
            <p className="mt-3 text-[var(--cat-text-muted)]">
              La clave solicitada no está visible en la mesa actual de ejecución.
            </p>
            <div className="mt-6">
              <Link href="/ejecucion" className="catastro-button-primary rounded-full px-5 py-3 text-sm font-semibold">
                Volver a Ejecución
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-6xl">
        <section className="catastro-card-blue rounded-[32px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Ficha de ejecución
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-card-text)]">{row.id_equipo}</h1>
              <p className="mt-3 max-w-4xl text-lg text-[var(--cat-card-muted)]">
                Bitácora operativa del caso, con owner, estado de seguimiento y secuencia de eventos guardados por Catastro.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${trackingBadge(row.estado_seguimiento)}`}>
                  {prettyOperationalStatus(row.estado_seguimiento ?? "PENDIENTE")}
                </span>
                {row.validacion_cierre ? (
                  <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${validationBadge(row.validacion_cierre)}`}>
                    {validationLabel(row.validacion_cierre)}
                  </span>
                ) : null}
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${sourceBadge(row.source)}`}>
                  {row.source}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${getStatusClassName(row.severity, { domain: "confianza" })}`}>
                  {row.severity}
                </span>
                {row.status ? (
                  <span className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${getStatusClassName(row.status)}`}>
                    {prettyOperationalStatus(row.status)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link href="/ejecucion" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]">
                Volver a Ejecución
              </Link>
              <div className="text-sm text-[var(--cat-card-muted)]">Case key: {row.case_key}</div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer esta ficha"
          description="La ficha del caso separa tres capas: señal operativa original, estado actual del seguimiento y bitácora real de cambios hechos por el equipo."
          items={[
            {
              label: "Fuente original",
              value: row.source,
              hint: "Este caso nace en la fuente ya validada y aquí solo se le agrega seguimiento humano.",
              tone: "cyan",
            },
            {
              label: "Owner visible",
              value: row.owner_display ?? row.owner_sugerido,
              hint: row.owner_real ? "Owner real ya asignado a la ejecución." : "Todavía vive con owner sugerido.",
              tone: row.owner_real ? "green" : "amber",
            },
            {
              label: "Estado de seguimiento",
              value: prettyOperationalStatus(row.estado_seguimiento ?? "PENDIENTE"),
              hint: "Este estado no reemplaza el estado del equipo ni el de Jira; describe la ejecución humana del caso.",
              tone: "purple",
            },
            {
              label: "Validación de cierre",
              value: validationLabel(tracking?.validacion_cierre ?? row.validacion_cierre),
              hint: "Un cierre primero queda manual; luego Catastro valida por cruce o lo reabre si reaparece.",
              tone: tracking?.validacion_cierre === "VALIDADO_CRUCE" ? "green" : tracking?.validacion_cierre === "REABIERTO" ? "red" : "amber",
            },
            {
              label: "Cobertura",
              value: `${events.length} eventos guardados`,
              hint: "La bitácora muestra qué se cambió, quién lo hizo y cuándo.",
              tone: "red",
            },
          ]}
          badges={[
            { label: row.case_type, tone: "purple" },
            { label: row.source_module, tone: "cyan" },
            { label: row.severity, tone: "amber" },
          ]}
          note="Cuando Fase 4 cierre del todo, aquí también vivirá la validación de cierre y la reapertura automática por cruce."
        />

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Resumen del caso</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Título</div>
                <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{row.title}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Cliente</div>
                <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{row.cliente}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4 md:col-span-2">
                <div className="catastro-kpi-label">Resumen operativo</div>
                <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">{row.summary}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4 md:col-span-2">
                <div className="catastro-kpi-label">Acción sugerida</div>
                <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">{row.suggested_action}</div>
              </div>
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Estado actual</h2>
            <div className="mt-5 grid grid-cols-1 gap-4">
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Owner real</div>
                <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{tracking?.owner_real ?? row.owner_sugerido}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Toma</div>
                <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{fmtDateTime(tracking?.fecha_toma ?? row.fecha_toma)}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Última actualización</div>
                <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{fmtDateTime(tracking?.updated_at ?? row.tracking_updated_at)}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Validación de cierre</div>
                <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{validationLabel(tracking?.validacion_cierre ?? row.validacion_cierre)}</div>
              </div>
              <div className="catastro-inset rounded-2xl p-4">
                <div className="catastro-kpi-label">Última nota</div>
                <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">{tracking?.comentario_operativo ?? row.comentario_operativo ?? "Sin nota visible."}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {row.links.map((link) => (
                <Link key={`${row.case_key}-${link.href}`} href={link.href} className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </section>

        <section className="mt-6 catastro-panel rounded-3xl p-6">
          <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Bitácora del caso</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">
            Cada evento conserva actor, timestamp, comentario y los campos clave que cambiaron entre una acción y la siguiente.
          </p>

          <div className="mt-6 space-y-4">
            {events.length ? events.map((event) => {
              const changes = collectEventChanges(event);
              return (
                <article key={event.event_id} className="cat-operacion-card rounded-2xl p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="cat-badge-stack">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trackingBadge((event.after_payload?.estado_seguimiento as string | undefined) ?? row.estado_seguimiento)}`}>
                          {eventTypeLabel(event.event_type)}
                        </span>
                        {event.after_payload?.validacion_cierre ? (
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${validationBadge(event.after_payload?.validacion_cierre as string | undefined)}`}>
                            {validationLabel(event.after_payload?.validacion_cierre as string | undefined)}
                          </span>
                        ) : null}
                        <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-[var(--cat-text-soft)]">
                          {event.actor ?? "Sin actor"}
                        </span>
                      </div>
                      <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                        Registrado el <span className="font-semibold text-[var(--cat-text)]">{fmtDateTime(event.created_at)}</span>
                      </div>
                    </div>
                    {event.comment ? (
                      <div className="catastro-inset rounded-2xl px-4 py-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                        <span className="font-semibold text-[var(--cat-text)]">Comentario:</span> {event.comment}
                      </div>
                    ) : null}
                  </div>

                  {changes.length ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {changes.map((change) => (
                        <div key={`${event.event_id}-${change.label}`} className="catastro-inset rounded-2xl p-4">
                          <div className="catastro-kpi-label">{change.label}</div>
                          <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                            <span className="font-semibold text-[var(--cat-text)]">Antes:</span> {change.beforeValue}
                          </div>
                          <div className="text-sm leading-7 text-[var(--cat-text-muted)]">
                            <span className="font-semibold text-[var(--cat-text)]">Después:</span> {change.afterValue}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 catastro-inset rounded-2xl p-4 text-sm text-[var(--cat-text-muted)]">
                      Este evento no cambió ninguno de los campos clave expuestos en la bitácora.
                    </div>
                  )}
                </article>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--cat-border)] p-6 text-sm text-[var(--cat-text-muted)]">
                Todavía no hay eventos visibles para este caso.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
