import Link from "next/link";
import ActivosLegacyView from "@/components/activos/ActivosLegacyView";
import ModuleContract from "@/components/ModuleContract";
import { apiProxyGet } from "@/lib/api";
import {
  prettyReconciliationStatus,
  reconciliationClasses,
  reconciliationHelp,
  reconciliationRate,
} from "@/lib/reconciliation-ui";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStatusClassName } from "@/lib/statusStyles";

type HomeActivosResponse = {
  resumen?: {
    activos_totales?: number;
    asignados?: number;
    disponibles?: number;
    bajas?: number;
    sin_asignacion?: number;
  };
  reconciliacion?: {
    equipos_conciliados?: number;
    inconsistencias_mtr_jira?: number;
    jira_sin_match_mtr?: number;
    mtr_sin_match_jira?: number;
    creados_jira_sin_ingreso_mtr?: number;
    reservas_jira_pendientes?: number;
    asignados_sin_respaldo_cruzado?: number;
  };
  top_clientes?: Array<{
    cliente?: string | null;
    equipos?: number;
  }>;
  jira_board_counts?: Record<string, number>;
  count_tabla?: number;
  activos_total?: number;
  asignados?: number;
  disponibles?: number;
  bajas?: number;
  sin_asignacion?: number;
};

function KpiCard({
  title,
  value,
  subtitle,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "cyan" | "green" | "yellow" | "orange" | "red" | "purple";
}) {
  return (
    <div className={`cat-kpi-card kpi-${tone} p-6`}>
      <div className="catastro-kpi-label">{title}</div>
      <div className="catastro-kpi-value text-[clamp(2rem,3.6vw,3.2rem)]">{value}</div>
      {subtitle ? <div className="catastro-kpi-helper">{subtitle}</div> : null}
    </div>
  );
}

function fmtPercent(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ActivosPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};
  const estado = typeof params.estado === "string" ? params.estado : undefined;
  const jiraBucket = typeof params.jira_bucket === "string" ? params.jira_bucket : undefined;
  const hasJira = typeof params.has_jira === "string" ? params.has_jira : undefined;
  const clase = typeof params.clase === "string" ? params.clase : undefined;

  let homeActivos: HomeActivosResponse = {};
  let kpiError: string | null = null;

  try {
    const origin = await getRequestOrigin();
    homeActivos = await apiProxyGet<HomeActivosResponse>("/estadisticas/home-activos", { origin });
  } catch (error) {
    kpiError = error instanceof Error ? error.message : "No fue posible cargar los KPIs.";
  }

  const resumen = homeActivos.resumen ?? {
    activos_totales: homeActivos.activos_total ?? 0,
    asignados: homeActivos.asignados ?? 0,
    disponibles: homeActivos.disponibles ?? 0,
    bajas: homeActivos.bajas ?? 0,
    sin_asignacion: homeActivos.sin_asignacion ?? 0,
  };
  const topClientes = (homeActivos.top_clientes ?? []).slice(0, 5);
  const reconciliacion = homeActivos.reconciliacion ?? {};
  const operationalReconciliationPct = reconciliationRate(reconciliacion);
  const activosContractMode = kpiError ? "Parcial con KPIs degradados" : "Conciliación operativa";
  const activosContractNote = kpiError
    ? "Los KPIs superiores no cargaron desde /estadisticas/home-activos, pero la tabla de parque visible sigue operativa para no detener la revisión."
    : "Activos separa explícitamente el board Jira real del parque visible en Catastro. Si un bucket existe en Jira y no en la tabla, eso indica una brecha de cobertura o visibilidad, no una falla visual.";

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Módulo
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-card-text)]">Activos</h1>
              <p className="mt-3 max-w-3xl text-lg text-[var(--cat-card-muted)]">
                Parque operativo vivo, con foco en disponibilidad, asignación, issues Jira y revisión priorizada por SKU.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link
                href="/"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-[var(--cat-card-text)]"
              >
                Volver al Home
              </Link>
              <div className="text-sm text-[var(--cat-card-muted)]">
                Top clientes visibles: {topClientes.length ? topClientes.map((x) => `${x.cliente ?? "Sin cliente"} (${x.equipos ?? 0})`).join(" · ") : "Sin dato"}
              </div>
            </div>
          </div>
        </section>

        {kpiError ? (
          <section className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-sm text-amber-950">
            No se pudieron cargar los KPIs principales de Activos. La tabla sigue disponible para no romper la operación.
            <div className="mt-2 text-amber-900/80">{kpiError}</div>
          </section>
        ) : null}

        <ModuleContract
          title="Cómo leer Activos"
          description="Activos es la vista de parque vivo. Aquí manda la visibilidad actual del equipo, pero siempre con la conciliación Jira separada del inventario operativo."
          items={[
            {
              label: "Fuente dominante",
              value: "Parque visible MTR + conciliación Jira",
              hint: "MTR describe el estado operativo del equipo; Jira describe el workflow administrativo asociado.",
              tone: "cyan",
            },
            {
              label: "Corte visible",
              value: "Operación vigente del parque visible",
              hint: "Este endpoint aún no expone timestamp propio. La lectura se toma como estado vivo del parque al momento de cargar la vista.",
              tone: "amber",
            },
            {
              label: "Cobertura",
              value: "Parque visible + board Jira real por bucket",
              hint: "La tabla representa equipos visibles en Activos; las cards Jira representan el board real aunque algunos casos no estén en parque visible.",
              tone: "purple",
            },
            {
              label: "Modo de lectura",
              value: activosContractMode,
              hint: kpiError
                ? "La tabla puede seguir mostrando la verdad operativa aunque el resumen superior no haya cargado."
                : "La prioridad aquí es entender disponibilidad, asignación y brechas MTR/Jira caso a caso.",
              tone: kpiError ? "amber" : "green",
            },
          ]}
          badges={[
            { label: "Parque visible", tone: "green" },
            { label: "Board Jira real", tone: "purple" },
            { label: "Conciliación MTR/Jira", tone: "cyan" },
          ]}
          note={activosContractNote}
        />

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Activos totales" value={resumen.activos_totales ?? 0} subtitle="Parque visible hoy" tone="cyan" />
          <KpiCard title="Asignados" value={resumen.asignados ?? 0} subtitle="Con dueño operativo actual" tone="green" />
          <KpiCard title="Disponibles" value={resumen.disponibles ?? 0} subtitle="Base disponible para operación" tone="yellow" />
          <KpiCard title="Bajas" value={resumen.bajas ?? 0} subtitle="Fuera del parque operativo" tone="red" />
          <KpiCard title="Sin asignación" value={resumen.sin_asignacion ?? 0} subtitle="Casos sin dueño actual" tone="orange" />
        </section>

        <section className="mt-6 rounded-3xl border border-[rgba(50,76,194,0.14)] bg-white/72 p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Salud de conciliación MTR/Jira</h2>
              <p className="mt-2 max-w-3xl text-[var(--cat-text-muted)]">
                MTR manda sobre movimientos físicos reales. Jira manda sobre workflow administrativo.
                Esta capa ya resume concordancia, brechas de cobertura y tickets creados antes del ingreso físico en un solo punto de lectura.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 xl:max-w-[24rem] xl:justify-end">
              <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">
                {fmtPercent(operationalReconciliationPct)} conciliación
              </span>
              <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">
                {reconciliacion.reservas_jira_pendientes ?? 0} reservas pendientes
              </span>
              <span
                title="CONCILIADO: ambas fuentes coinciden. JIRA_SIN_MATCH_MTR: Jira ve el equipo y MTR aún no. MTR_SIN_JIRA: MTR ve el equipo y Jira aún no. CREADO_JIRA_SIN_INGRESO_MTR: Jira creó el equipo antes de que MTR registre el ingreso físico. INCONSISTENCIA_OPERATIVA: Jira y MTR describen estados distintos."
                className="rounded-2xl border border-sky-300/40 bg-sky-100/70 px-4 py-3 text-sm text-sky-900"
              >
                Pasa el cursor por los badges de conciliación para ver la regla aplicada.
              </span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Conciliados" value={reconciliacion.equipos_conciliados ?? 0} subtitle="MTR + Jira concordantes" tone="green" />
            <KpiCard title="Inconsistencias" value={reconciliacion.inconsistencias_mtr_jira ?? 0} subtitle="Cruce administrativo vs operativo" tone="red" />
            <KpiCard title="Jira sin MTR / MTR sin Jira" value={`${reconciliacion.jira_sin_match_mtr ?? 0} / ${reconciliacion.mtr_sin_match_jira ?? 0}`} subtitle="Cobertura cruzada faltante en el cruce visible" tone="purple" />
            <KpiCard title="Ticket creado pendiente de ingreso" value={reconciliacion.creados_jira_sin_ingreso_mtr ?? 0} subtitle="Alta administrativa antes del ingreso físico" tone="yellow" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: "CONCILIADO", status: "CONCILIADO" },
              { label: "JIRA_SIN_MATCH_MTR", status: "JIRA_SIN_MATCH_MTR" },
              { label: "MTR_SIN_JIRA", status: "MTR_SIN_MATCH_JIRA" },
              { label: "CREADO_JIRA_SIN_INGRESO_MTR", status: "CREADO_JIRA_SIN_INGRESO_MTR" },
              { label: "INCONSISTENCIA_OPERATIVA", status: "INCONSISTENCIA_OPERATIVA" },
            ].map((item) => (
              <span
                key={item.label}
                title={reconciliationHelp(item.status)}
                className={`cat-badge-compact inline-flex rounded-full border px-3 py-2 text-xs font-semibold ${reconciliationClasses(item.status)}`}
              >
                {prettyReconciliationStatus(item.status)}
              </span>
            ))}
          </div>
        </section>

        <section className="catastro-panel mt-8 rounded-3xl p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-[var(--cat-text)]">Centro operativo de activos</h2>
              <p className="mt-2 text-[var(--cat-text-muted)]">
                Vista ejecutiva y operativa alineada con el Home, sobre datos reales de parque, filtros vivos y revisión priorizada.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">Parque visible</span>
              <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">Board Jira real</span>
              <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">{reconciliacion.reservas_jira_pendientes ?? 0} reservas pendientes</span>
              <span className="catastro-button-secondary rounded-full px-4 py-2 text-sm">{homeActivos.count_tabla ?? 0} filas visibles</span>
            </div>
          </div>

          {estado || jiraBucket || hasJira || clase ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {estado ? <span className={getStatusClassName(estado)}>Estado: {estado}</span> : null}
              {jiraBucket ? <span className={getStatusClassName(jiraBucket)}>Jira visible: {jiraBucket}</span> : null}
              {hasJira ? <span className="catastro-chip-blue rounded-full px-3 py-2 text-xs">Con issues Jira</span> : null}
              {clase ? <span className="catastro-chip-blue rounded-full px-3 py-2 text-xs">Clase: {clase}</span> : null}
              <Link href="/activos" className="catastro-button-secondary rounded-full px-4 py-2 text-xs">
                Limpiar filtros
              </Link>
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <ActivosLegacyView
            initialEstado={estado}
            initialJiraBucket={jiraBucket}
            initialHasJira={hasJira === "1"}
            initialClase={clase}
            jiraBoardCounts={homeActivos.jira_board_counts ?? {}}
          />
        </section>
      </div>
    </main>
  );
}
