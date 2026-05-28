import Link from "next/link";
import ExecutionBoardClient, { type ExecutionCaseRow } from "@/components/ejecucion/ExecutionBoardClient";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import { operationalLabel, operationalMeaning } from "@/lib/operationalDictionary";
import { getRequestOrigin } from "@/lib/request-origin";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ExecutionGroup = {
  label: string;
  count: number;
  criticals: number;
  pendientes?: number;
  en_revision?: number;
  escalados?: number;
  resueltos?: number;
  cierres_manuales?: number;
  reabiertos?: number;
};

type ExecutionQueueResponse = {
  kpis?: {
    total?: number;
    criticas?: number;
    pendientes?: number;
    en_revision?: number;
    escalados?: number;
    sin_owner_real?: number;
    resueltos_manuales?: number;
    validados_cruce?: number;
    reabiertos?: number;
    cierre_pendiente_validacion?: number;
    resueltos_hoy?: number;
    tiempo_medio_resolucion_horas?: number | null;
  };
  owners?: ExecutionGroup[];
  clients?: ExecutionGroup[];
  sources?: ExecutionGroup[];
  total_visible?: number;
  rows?: ExecutionCaseRow[];
};

function pickString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function fmtNumber(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtHours(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 h";
  const rounded = n % 1 === 0 ? n.toString() : n.toFixed(1);
  return `${rounded} h`;
}

function buildHref(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim()) params.set(key, value.trim());
  });
  const qs = params.toString();
  return qs ? `/ejecucion?${qs}` : "/ejecucion";
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
      <div className="catastro-kpi-value text-[clamp(1.8rem,3.2vw,3rem)]">{value}</div>
      {helper ? <div className="catastro-kpi-helper">{helper}</div> : null}
    </div>
  );
}

export default async function EjecucionPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const q = pickString(params.q) ?? "";
  const owner = pickString(params.owner) ?? "";
  const cliente = pickString(params.cliente) ?? "";
  const severidad = pickString(params.severidad) ?? "";
  const fuente = pickString(params.fuente) ?? "";
  const estado = pickString(params.estado) ?? "";
  const origin = await getRequestOrigin();
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (owner) qs.set("owner", owner);
  if (cliente) qs.set("cliente", cliente);
  if (severidad) qs.set("severidad", severidad);
  if (fuente) qs.set("fuente", fuente);
  if (estado) qs.set("estado", estado);
  qs.set("limit", "60");

  const queue = await apiProxyGet<ExecutionQueueResponse>(`/ejecucion/queue?${qs.toString()}`, { origin }).catch(
    () =>
      ({
        kpis: {},
        owners: [],
        clients: [],
        sources: [],
        rows: [],
        total_visible: 0,
      }) as ExecutionQueueResponse,
  );

  const kpis = queue.kpis ?? {};
  const rows = queue.rows ?? [];

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Mesa de ejecución
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-card-text)]">Seguimiento y cierre de casos</h1>
              <p className="mt-3 max-w-4xl text-lg text-[var(--cat-card-muted)]">
                Cola operativa viva para tomar, asignar, escalar y cerrar casos sin perder la trazabilidad de quién se hizo cargo y qué cambió.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link href="/excepciones" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]">
                Volver a Excepciones
              </Link>
              <div className="text-sm text-[var(--cat-card-muted)]">Casos visibles: {fmtNumber(queue.total_visible ?? rows.length)}</div>
            </div>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer Ejecución"
          description="Ejecución no crea una nueva verdad del parque: toma los casos ya visibles en Catastro y les agrega seguimiento humano, responsable y estado de cierre."
          items={[
            {
              label: "Fuente dominante",
              value: "Excepciones + Operación + Planeación + Auditoría",
              hint: "La cola nace desde fricciones operativas ya validadas en otros módulos.",
              tone: "cyan",
            },
            {
              label: "Corte visible",
              value: "Casos vivos del refresh actual",
              hint: "Si un caso vuelve a aparecer tras un cierre manual, debe reabrirse por validación de cruce en la siguiente fase.",
              tone: "green",
            },
            {
              label: "Cobertura",
              value: "Owner real + estado de seguimiento + comentario operativo",
              hint: `${operationalMeaning("parqueVisible")} ${operationalMeaning("conciliacionMtrJira")}`,
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: "Mesa de trabajo activa",
              hint: "Aquí ya no solo importa detectar el caso: importa quién lo tomó, en qué estado va y si quedó efectivamente resuelto.",
              tone: "amber",
            },
          ]}
          badges={[
            { label: operationalLabel("parqueVisible"), tone: "green" },
            { label: operationalLabel("conciliacionMtrJira"), tone: "cyan" },
            { label: "Seguimiento humano", tone: "purple" },
          ]}
          note="El objetivo de esta mesa es simple: que Catastro no solo detecte excepciones, sino que también acompañe su resolución."
        />

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Casos visibles" value={fmtNumber(kpis.total)} helper="Cola activa del filtro actual" tone="cyan" />
          <KpiCard title="Críticas" value={fmtNumber(kpis.criticas)} helper="Máxima prioridad operacional" tone="red" />
          <KpiCard title="Pendientes" value={fmtNumber(kpis.pendientes)} helper="Sin toma formal todavía" tone="orange" />
          <KpiCard title="En revisión" value={fmtNumber(kpis.en_revision)} helper="Ya tienen seguimiento vivo" tone="green" />
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Escalados" value={fmtNumber(kpis.escalados)} helper="Requieren apoyo o destrabe" tone="purple" />
          <KpiCard title="Sin owner real" value={fmtNumber(kpis.sin_owner_real)} helper="Todavía viven solo con owner sugerido" tone="yellow" />
          <KpiCard title="Cierres manuales" value={fmtNumber(kpis.resueltos_manuales)} helper="Marcados resueltos, aún pendientes de validación" tone="orange" />
          <KpiCard title="Validados por cruce" value={fmtNumber(kpis.validados_cruce)} helper="Ya desaparecieron de la fuente activa" tone="green" />
          <KpiCard title="Reabiertos" value={fmtNumber(kpis.reabiertos)} helper="Volvieron a aparecer tras un cierre" tone="red" />
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <KpiCard title="Resueltos hoy" value={fmtNumber(kpis.resueltos_hoy)} helper="Casos que hoy pasaron a resuelto manual" tone="cyan" />
          <KpiCard
            title="Tiempo medio de resolución"
            value={fmtHours(kpis.tiempo_medio_resolucion_horas)}
            helper="Promedio entre apertura y cierre de los casos resueltos"
            tone="green"
          />
        </section>

        <section className="mt-6 catastro-panel rounded-3xl p-5">
          <h2 className="text-xl font-semibold text-[var(--cat-text)]">Filtros</h2>
          <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Buscar</div>
              <input name="q" defaultValue={q} placeholder="SKU, caso, owner..." className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Owner</div>
              <input name="owner" defaultValue={owner} placeholder="Mesa Jira, Operación TI..." className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Cliente</div>
              <input name="cliente" defaultValue={cliente} placeholder="Acid Labs, MacOnline..." className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none" />
            </label>
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Severidad</div>
              <select name="severidad" defaultValue={severidad} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todas</option>
                <option value="CRITICA">CRITICA</option>
                <option value="ALTA">ALTA</option>
                <option value="MEDIA">MEDIA</option>
                <option value="BAJA">BAJA</option>
              </select>
            </label>
            <label className="catastro-inset rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Estado seguimiento</div>
              <select name="estado" defaultValue={estado} className="mt-3 w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none">
                <option value="">Todos</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN_REVISION">EN_REVISION</option>
                <option value="RESUELTO">RESUELTO</option>
                <option value="ESCALADO">ESCALADO</option>
                <option value="DESCARTADO">DESCARTADO</option>
              </select>
            </label>
            <div className="flex items-end gap-3">
              <button type="submit" className="catastro-button-primary rounded-full px-5 py-3 text-sm font-semibold">
                Aplicar filtros
              </button>
              <Link href="/ejecucion" className="catastro-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Limpiar
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <section className="catastro-panel rounded-3xl p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Casos activos</h2>
                <p className="mt-2 text-[var(--cat-text-muted)]">
                  La cola combina owner sugerido, owner real, estado de seguimiento y accesos a los módulos fuente.
                </p>
              </div>
              <div className="text-sm text-[var(--cat-text-soft)]">{fmtNumber(queue.total_visible ?? rows.length)} visibles</div>
            </div>
            <div className="mt-5">
              <ExecutionBoardClient rows={rows} />
            </div>
          </section>

          <div className="space-y-6">
            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Carga por owner</h2>
              <div className="mt-4 space-y-3">
                {(queue.owners ?? []).length ? (
                  queue.owners?.map((group) => (
                    <Link key={`owner-${group.label}`} href={buildHref({ owner: group.label })} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--cat-text)]">{group.label}</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                            {fmtNumber(group.criticals)} críticas · {fmtNumber(group.pendientes)} pendientes · {fmtNumber(group.en_revision)} en revisión.
                          </div>
                          <div className="mt-1 text-xs leading-6 text-[var(--cat-text-soft)]">
                            {fmtNumber(group.escalados)} escalados · {fmtNumber(group.resueltos)} resueltos · {fmtNumber(group.cierres_manuales)} cierres manuales.
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(group.count)}</div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-[var(--cat-text-muted)]">No hay owners visibles con el filtro actual.</div>
                )}
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Concentración por cliente</h2>
              <div className="mt-4 space-y-3">
                {(queue.clients ?? []).length ? (
                  queue.clients?.map((group) => (
                    <Link key={`client-${group.label}`} href={buildHref({ cliente: group.label })} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--cat-text)]">{group.label}</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                            {fmtNumber(group.criticals)} críticas visibles en este cliente.
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(group.count)}</div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-[var(--cat-text-muted)]">No hay clientes visibles con el filtro actual.</div>
                )}
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Fuentes dominantes</h2>
              <div className="mt-4 space-y-3">
                {(queue.sources ?? []).length ? (
                  queue.sources?.map((group) => (
                    <Link key={`source-${group.label}`} href={buildHref({ fuente: group.label })} className="catastro-inset block rounded-2xl p-4 transition hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--cat-text)]">{group.label}</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--cat-text-muted)]">
                            {fmtNumber(group.criticals)} críticas nacen desde esta fuente.
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-[var(--cat-text)]">{fmtNumber(group.count)}</div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-[var(--cat-text-muted)]">No hay fuentes visibles con el filtro actual.</div>
                )}
              </div>
            </section>

            <section className="catastro-panel-soft rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-[var(--cat-text)]">Validación de cierre</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--cat-text-muted)]">
                <div className="catastro-inset rounded-2xl p-4">
                  <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(kpis.cierre_pendiente_validacion)}</span> cierres siguen manuales y todavía no desaparecen de la fuente activa.
                </div>
                <div className="catastro-inset rounded-2xl p-4">
                  <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(kpis.validados_cruce)}</span> ya quedaron confirmados por cruce real del refresh.
                </div>
                <div className="catastro-inset rounded-2xl p-4">
                  <span className="font-semibold text-[var(--cat-text)]">{fmtNumber(kpis.reabiertos)}</span> reaparecieron y se marcaron otra vez para seguimiento.
                </div>
                <div className="catastro-inset rounded-2xl p-4">
                  <span className="font-semibold text-[var(--cat-text)]">{fmtHours(kpis.tiempo_medio_resolucion_horas)}</span> es el tiempo medio visible entre apertura y cierre de los casos ya resueltos.
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={buildHref({ estado: "RESUELTO" })} className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                  Ver resueltos
                </Link>
                <Link href="/ejecucion" className="catastro-chip-blue rounded-full px-3 py-2 text-xs transition hover:-translate-y-0.5">
                  Volver a la cola viva
                </Link>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
