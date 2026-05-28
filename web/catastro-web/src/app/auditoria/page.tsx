import Link from "next/link";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { getRequestOrigin } from "@/lib/request-origin";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type AuditRow = {
  audit_id: string;
  id_equipo: string;
  campo_modificado?: string | null;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  fecha_cambio?: string | null;
  origen?: string | null;
  actor?: string | null;
  tipo_cambio?: string | null;
  criticidad?: string | null;
  confianza?: string | null;
};

type AuditSummaryEquipo = {
  id_equipo: string;
  ultimo_cambio_auditado?: string | null;
  origen_ultimo_cambio?: string | null;
  campo_ultimo_cambio?: string | null;
  tipo_ultimo_cambio?: string | null;
  cambios_30d?: number | null;
  cambios_totales?: number | null;
  campos_mas_modificados?: Array<{
    campo_modificado?: string | null;
    cambios?: number | null;
  }> | null;
};

type AuditSummaryResponse = {
  kpis?: {
    total_cambios_auditados?: number;
    equipos_con_cambios?: number;
    cambios_criticos?: number;
    cambios_sin_actor_humano_identificado?: number;
    ultimo_cambio_global?: string | null;
  };
  cambios_por_origen?: Array<{
    origen?: string | null;
    cambios?: number | null;
  }>;
  equipos?: AuditSummaryEquipo[];
  available_filters?: {
    origenes?: string[];
    tipos_cambio?: string[];
    campos_modificados?: string[];
    criticidades?: string[];
  };
};

type AuditListResponse = {
  rows?: AuditRow[];
  count?: number;
};

const EMPTY_SUMMARY: AuditSummaryResponse = {
  kpis: {},
  cambios_por_origen: [],
  equipos: [],
  available_filters: {},
};

const EMPTY_LIST: AuditListResponse = {
  rows: [],
  count: 0,
};

function pickString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function fmtIsoDate(value?: string | null) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function sourceClasses(origin?: string | null) {
  const key = (origin ?? "").toUpperCase();
  if (key === "MTR") return "border-sky-300/60 bg-sky-100/80 text-sky-800";
  if (key === "JIRA") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "GOOGLE SHEETS") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (key === "EXCEL REPARADOS") return "border-violet-300/60 bg-violet-100/80 text-violet-800";
  if (key === "CATASTRO") return "border-slate-300/60 bg-slate-100/80 text-slate-700";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

function criticidadClasses(value?: string | null) {
  const key = (value ?? "").toUpperCase();
  if (key === "CRITICA") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  if (key === "ALTA") return "border-orange-300/70 bg-orange-100/80 text-orange-800";
  if (key === "MEDIA") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "BAJA") return "border-sky-300/60 bg-sky-100/80 text-sky-800";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

function confidenceClasses(value?: string | null) {
  const key = (value ?? "").toUpperCase();
  if (key === "ALTA") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (key === "MEDIA") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (key === "BAJA") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

function fieldLabel(value?: string | null) {
  const key = (value ?? "").toLowerCase();
  if (key === "persona_asignada") return "Persona asignada";
  if (key === "estado_jira") return "Estado Jira";
  if (key === "ubicacion") return "Ubicación";
  return value ?? "Campo";
}

function safeValue(value?: string | null) {
  const text = (value ?? "").trim();
  return text || "—";
}

function KpiCard({
  title,
  value,
  helper,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  helper?: string;
  tone?: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
}) {
  return (
    <div className={`cat-kpi-card kpi-${tone} p-6`}>
      <div className="catastro-kpi-label">{title}</div>
      <div className="catastro-kpi-value text-[clamp(1.85rem,3.6vw,3rem)]">{value}</div>
      {helper ? <div className="catastro-kpi-helper">{helper}</div> : null}
    </div>
  );
}

function BeforeAfter({ before, after }: { before?: string | null; after?: string | null }) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div className="rounded-xl border border-[color:var(--cat-border)] bg-slate-50/80 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">Antes</div>
        <div className="mt-1 text-sm text-[var(--cat-text-muted)]">{safeValue(before)}</div>
      </div>
      <div className="hidden text-center text-sm font-semibold text-[var(--cat-text-soft)] md:block">→</div>
      <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">Después</div>
        <div className="mt-1 text-sm text-[var(--cat-text)]">{safeValue(after)}</div>
      </div>
    </div>
  );
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const q = pickString(params.q) ?? "";
  const origen = pickString(params.origen) ?? "";
  const tipoCambio = pickString(params.tipo_cambio) ?? "";
  const campoModificado = pickString(params.campo_modificado) ?? "";
  const criticidad = pickString(params.criticidad) ?? "";
  const desde = pickString(params.desde) ?? "";
  const hasta = pickString(params.hasta) ?? "";
  const origin = await getRequestOrigin();

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (origen) qs.set("origen", origen);
  if (tipoCambio) qs.set("tipo_cambio", tipoCambio);
  if (campoModificado) qs.set("campo_modificado", campoModificado);
  if (criticidad) qs.set("criticidad", criticidad);
  if (desde) qs.set("desde", desde);
  if (hasta) qs.set("hasta", hasta);
  qs.set("limit", "250");

  const [summary, audit] = await Promise.all([
    apiProxyGet<AuditSummaryResponse>(`/auditoria/resumen?${qs.toString()}`, { origin }).catch(() => EMPTY_SUMMARY),
    apiProxyGet<AuditListResponse>(`/auditoria?${qs.toString()}`, { origin }).catch(() => EMPTY_LIST),
  ]);

  const rows = audit.rows ?? [];
  const kpis = summary.kpis ?? {};
  const origenes = summary.available_filters?.origenes ?? [];
  const tipos = summary.available_filters?.tipos_cambio ?? [];
  const campos = summary.available_filters?.campos_modificados ?? [];
  const criticidades = summary.available_filters?.criticidades ?? [];
  const equipos = summary.equipos ?? [];
  const auditoriaContractCutoff = fmtIsoDate(kpis.ultimo_cambio_global);

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Auditoría formal
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-card-text)]">Auditoría</h1>
              <p className="mt-3 max-w-3xl text-lg text-[var(--cat-card-muted)]">
                Cambios formales por equipo con before/after, fuente, actor, criticidad y confianza. El timeline sigue intacto; esta vista sólo mejora lectura y control.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link href="/" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]">
                Volver al Home
              </Link>
              <div className="text-sm text-[var(--cat-card-muted)]">Último cambio global: {fmtIsoDate(kpis.ultimo_cambio_global)}</div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer Auditoría"
          description="Auditoría registra cambios formales visibles por equipo y los separa del timeline operativo. Aquí importan trazabilidad, actor, before/after y criticidad documental."
          items={[
            {
              label: "Fuente dominante",
              value: "Auditoría formal multi-fuente",
              hint: "Cruza cambios provenientes de MTR, Jira, Google Sheets y capas internas de Catastro cuando existe registro auditado.",
              tone: "cyan",
            },
            {
              label: "Corte visible",
              value: auditoriaContractCutoff,
              hint: "Corresponde al último cambio auditado visible para los filtros actuales.",
              tone: "green",
            },
            {
              label: "Cobertura",
              value: "Before/after + actor + origen + criticidad + confianza",
              hint: "No reemplaza la ficha ni el timeline del equipo; conserva la historia formal de cambios auditable.",
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: "Trazabilidad formal",
              hint: `${operationalMeaning("parqueVisible")} ${operationalMeaning("conciliacionMtrJira")}`,
              tone: "amber",
            },
          ]}
          badges={[
            { label: "Before / after", tone: "cyan" },
            { label: "Actor visible", tone: "green" },
            { label: "Cambio formal", tone: "purple" },
          ]}
          note="Auditoría responde qué cambió, cuándo y desde qué fuente. Timeline responde cómo evolucionó el equipo en operación. Son complementarios, no equivalentes."
        />

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Cambios auditados" value={Number(kpis.total_cambios_auditados ?? 0)} helper="Total visible para los filtros actuales" tone="cyan" />
          <KpiCard title="Equipos con cambios" value={Number(kpis.equipos_con_cambios ?? 0)} helper="Equipos distintos con auditoría" tone="green" />
          <KpiCard title="Cambios críticos" value={Number(kpis.cambios_criticos ?? 0)} helper="Criticidad CRITICA" tone="red" />
          <KpiCard title="Sin actor humano" value={Number(kpis.cambios_sin_actor_humano_identificado ?? 0)} helper="Quedaron sólo con actor sistema" tone="purple" />
        </section>

        <section className="mt-4 rounded-3xl border border-[rgba(50,76,194,0.14)] bg-white/72 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Lectura rápida de origen</h2>
              <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
                Distribución visible de cambios para entender rápido si el ruido nace desde MTR, Jira, Google Sheets o capas internas de Catastro.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(summary.cambios_por_origen ?? []).map((item) => (
                <span
                  key={`${item.origen}-${item.cambios}`}
                  className={`inline-flex rounded-full border px-3 py-2 text-sm font-semibold ${sourceClasses(item.origen)}`}
                >
                  {item.origen ?? "Sin origen"} · {Number(item.cambios ?? 0)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 catastro-panel rounded-3xl p-6">
          <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Filtros</h2>
          <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Buscar equipo</div>
              <input name="q" defaultValue={q} placeholder="SKU-602" className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Origen</div>
              <select name="origen" defaultValue={origen} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todos</option>
                {origenes.map((value: string) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Tipo cambio</div>
              <select name="tipo_cambio" defaultValue={tipoCambio} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todos</option>
                {tipos.map((value: string) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Campo</div>
              <select name="campo_modificado" defaultValue={campoModificado} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todos</option>
                {campos.map((value: string) => (
                  <option key={value} value={value}>
                    {fieldLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Criticidad</div>
              <select name="criticidad" defaultValue={criticidad} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todas</option>
                {criticidades.map((value: string) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Desde</div>
              <input type="date" name="desde" defaultValue={desde} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Hasta</div>
              <input type="date" name="hasta" defaultValue={hasta} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>

            <div className="flex items-end gap-3">
              <button type="submit" className="rounded-full bg-[var(--cat-primary)] px-5 py-3 text-sm font-semibold text-white">
                Aplicar filtros
              </button>
              <Link href="/auditoria" className="rounded-full border border-[color:var(--cat-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--cat-text)]">
                Limpiar
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.3fr]">
          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Equipos con más cambios</h2>
            <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
              Top compacto para detectar dónde conviene abrir la ficha de auditoría antes de bajar al detalle completo.
            </p>
            <div className="mt-5 space-y-3">
              {equipos.slice(0, 8).map((equipo) => (
                <div key={equipo.id_equipo} className="catastro-inset rounded-2xl p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-[var(--cat-text)]">{equipo.id_equipo}</div>
                      <div className="mt-1 text-sm text-[var(--cat-text-muted)]">
                        Último cambio: {fmtIsoDate(equipo.ultimo_cambio_auditado)} · {equipo.tipo_ultimo_cambio ?? "Sin tipo"}
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${sourceClasses(equipo.origen_ultimo_cambio)}`}>
                      {equipo.origen_ultimo_cambio ?? "Sin origen"}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-[var(--cat-text-muted)]">
                    30 días: {Number(equipo.cambios_30d ?? 0)} · Total: {Number(equipo.cambios_totales ?? 0)} · Campos:{" "}
                    {(equipo.campos_mas_modificados ?? [])
                      .map((item) => `${fieldLabel(item.campo_modificado)} (${Number(item.cambios ?? 0)})`)
                      .join(" · ") || "Sin detalle"}
                  </div>
                  <div className="mt-3">
                    <Link href={`/equipos/${encodeURIComponent(equipo.id_equipo)}#auditoria`} className="text-sm font-medium text-[var(--cat-primary)] hover:underline">
                      Ver ficha de auditoría →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="catastro-panel rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Cambios auditados</h2>
            <p className="mt-2 text-[var(--cat-text-muted)]">Resultados visibles: {Number(audit.count ?? rows.length)}. Ordenados por `fecha_cambio DESC`.</p>
            <div className="mt-5 space-y-4">
              {rows.length ? (
                rows.map((row) => (
                  <article key={row.audit_id} className="rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">{fmtIsoDate(row.fecha_cambio)}</div>
                        <div className="mt-1 text-lg font-semibold text-[var(--cat-text)]">
                          <Link href={`/equipos/${encodeURIComponent(row.id_equipo)}#auditoria`} className="hover:underline">
                            {row.id_equipo}
                          </Link>{" "}
                          · {fieldLabel(row.campo_modificado)}
                        </div>
                        <div className="mt-1 text-sm text-[var(--cat-text-muted)]">{row.tipo_cambio ?? "Sin tipo visible"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${sourceClasses(row.origen)}`}>
                          {row.origen ?? "Sin origen"}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${criticidadClasses(row.criticidad)}`}>
                          {row.criticidad ?? "—"}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${confidenceClasses(row.confianza)}`}>
                          {row.confianza ?? "—"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <BeforeAfter before={row.valor_anterior} after={row.valor_nuevo} />
                    </div>
                    <div className="mt-4 text-sm text-[var(--cat-text-muted)]">Actor: {safeValue(row.actor)}</div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-4 text-sm text-[var(--cat-text-muted)]">
                  No hay cambios de auditoría para los filtros actuales.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
