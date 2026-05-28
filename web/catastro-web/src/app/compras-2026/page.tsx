import Link from "next/link";
import { apiGet } from "@/lib/api";
import ModuleContract from "@/components/ModuleContract";

type ComprasSummary = {
  documentos_total?: number;
  proveedores_total?: number;
  modelos_total?: number;
  unidades_facturadas?: number;
  unidades_recibidas?: number;
  unidades_proyectadas?: number;
  unidades_pendientes_recepcion?: number;
  unidades_pendientes_conciliacion?: number;
  documentos_factura_sin_ingreso_stock?: number;
  documentos_guia_sin_match_mtr?: number;
  total_neto_facturado?: number;
  iva_facturado?: number;
  total_facturado?: number;
  presupuesto_neto_proyectado?: number;
  presupuesto_total_proyectado?: number;
};

type ComprasMonthlyRow = {
  mes: string;
  documentos_total?: number;
  total_facturado?: number;
  unidades_facturadas?: number;
  unidades_recibidas?: number;
  unidades_proyectadas?: number;
  macbook_facturadas?: number;
  hp_facturadas?: number;
  macbook_proyectadas?: number;
  hp_proyectadas?: number;
  documentos_factura_sin_ingreso_stock?: number;
  documentos_guia_sin_match_mtr?: number;
};

type ComprasModelRow = {
  marca: string;
  modelo: string;
  categoria_equipo: string;
  unidades_facturadas?: number;
  unidades_recibidas?: number;
  unidades_proyectadas?: number;
  monto_facturado?: number;
  monto_proyectado?: number;
};

type ComprasProviderRow = {
  proveedor: string;
  documentos?: number;
  unidades_facturadas?: number;
  unidades_recibidas?: number;
  unidades_proyectadas?: number;
  total_facturado?: number;
};

type PendingDocumentRow = {
  documento_id: string;
  proveedor: string;
  tipo_documento: string;
  numero_documento: string;
  fecha_emision: string;
  unidades_pendientes_recepcion?: number;
  unidades_pendientes_conciliacion?: number;
};

type PlaneacionCompraRow = {
  mes: string;
  demanda_presion_compra_mes?: number;
  stock_disponible_confirmado_base?: number;
  stock_disponible_total_base?: number;
  compras_documentales_facturadas?: number;
  compras_documentales_recibidas?: number;
  compras_proyectadas?: number;
  stock_esperado_total?: number;
  gap_total_con_compras?: number;
  cobertura_total_con_compras?: number | null;
  lectura_planeacion_con_compras?: string | null;
  lectura_staffing_core?: string | null;
};

type ComprasResumenPayload = {
  summary?: ComprasSummary;
  monthly?: ComprasMonthlyRow[];
  by_model?: ComprasModelRow[];
  by_provider?: ComprasProviderRow[];
  pending_documents?: PendingDocumentRow[];
  planeacion?: PlaneacionCompraRow[];
};

type DocumentoRow = {
  documento_id: string;
  proveedor: string;
  tipo_documento: string;
  numero_documento: string;
  fecha_emision: string;
  orden_compra?: string | null;
  total_neto?: number | null;
  iva?: number | null;
  total?: number | null;
  archivo_origen?: string | null;
  unidades_documentadas?: number | null;
  unidades_facturadas?: number | null;
  unidades_recibidas?: number | null;
  unidades_proyectadas?: number | null;
  unidades_pendientes_recepcion?: number | null;
  unidades_pendientes_conciliacion?: number | null;
};

type DocumentosPayload = {
  rows?: DocumentoRow[];
};

type ForecastSummary = {
  mes?: string;
  unidades_planeadas?: number;
  macbook_planeadas?: number;
  hp_planeadas?: number;
  presupuesto_estimado_clp?: number;
  stock_confirmado_base?: number;
  stock_total_base?: number;
  stock_esperado_confirmado?: number;
  stock_esperado_total?: number;
  demanda_presion_compra_mes?: number;
  gap_confirmado_con_compras?: number;
  gap_total_con_compras?: number;
  cobertura_confirmada_con_compras?: number | null;
  cobertura_total_con_compras?: number | null;
  lectura_planeacion?: string | null;
  lectura_staffing_core?: string | null;
};

type ForecastRow = {
  proveedor: string;
  marca: string;
  modelo: string;
  cantidad_planeada?: number;
  precio_unitario_referencia?: number | null;
  presupuesto_estimado_clp?: number | null;
};

type ForecastPayload = {
  summary?: ForecastSummary;
  rows?: ForecastRow[];
  notes?: string[];
};

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("es-CL").format(Number(value ?? 0));
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthLabel(value?: string | null) {
  if (!value) return "Sin mes";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

function formatRatio(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

function KpiCard({
  title,
  value,
  subtitle,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "cyan" | "green" | "purple" | "yellow" | "red";
}) {
  const cls =
    tone === "green"
      ? "kpi-green"
      : tone === "purple"
      ? "kpi-purple"
      : tone === "yellow"
      ? "kpi-yellow"
      : tone === "red"
      ? "kpi-red"
      : "kpi-cyan";

  return (
    <div className={`cat-kpi-card ${cls} p-6`}>
      <div className="catastro-kpi-label">{title}</div>
      <div className="mt-3 font-mono text-[clamp(1.8rem,3vw,2.8rem)] font-bold leading-none text-[var(--cat-text)]">
        {value}
      </div>
      {subtitle ? <div className="catastro-kpi-helper">{subtitle}</div> : null}
    </div>
  );
}

function SectionTable({
  title,
  subtitle,
  headers,
  rows,
}: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}) {
  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--cat-text)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--cat-text-muted)]">{subtitle}</p>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--cat-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-white/70">
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--cat-text-soft)]">
                {headers.map((header) => (
                  <th key={header} className="p-4">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="border-t border-[color:rgba(132,148,255,0.10)]">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${index}-${cellIndex}`}
                      className={cellIndex === 0 ? "p-4 font-medium text-[var(--cat-text)]" : "p-4 text-[var(--cat-text-muted)]"}
                    >
                      {cell ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="p-5 text-[var(--cat-text-soft)]" colSpan={headers.length}>
                    Sin datos visibles para esta tabla.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default async function Compras2026Page() {
  const [resumen, documentos, forecast] = await Promise.all([
    apiGet<ComprasResumenPayload>("/compras/resumen-2026").catch(() => ({
      summary: {},
      monthly: [],
      by_model: [],
      by_provider: [],
      pending_documents: [],
      planeacion: [],
    })),
    apiGet<DocumentosPayload>("/compras/documentos").catch(() => ({ rows: [] })),
    apiGet<ForecastPayload>("/compras/forecast").catch(() => ({ summary: {}, rows: [], notes: [] })),
  ]);

  const summary: ComprasSummary = resumen.summary ?? {};
  const monthly: ComprasMonthlyRow[] = resumen.monthly ?? [];
  const byModel: ComprasModelRow[] = resumen.by_model ?? [];
  const byProvider: ComprasProviderRow[] = resumen.by_provider ?? [];
  const pending: PendingDocumentRow[] = resumen.pending_documents ?? [];
  const planeacion: PlaneacionCompraRow[] = resumen.planeacion ?? [];
  const docs: DocumentoRow[] = documentos.rows ?? [];
  const forecastSummary: ForecastSummary = forecast.summary ?? {};
  const forecastRows: ForecastRow[] = forecast.rows ?? [];
  const forecastNotes: string[] = forecast.notes ?? [];

  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-panel-strong rounded-3xl p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Módulo documental
              </div>
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--cat-text)]">Compras 2026</h1>
              <p className="mt-3 max-w-4xl text-lg text-[var(--cat-text-muted)]">
                Facturas, guías de despacho y órdenes de compra conectadas con Planeación para leer compra, recepción,
                conciliación y forecast en un solo lugar.
              </p>
            </div>
            <Link href="/planeacion-compra" className="catastro-button-secondary rounded-full px-4 py-2 text-sm">
              Volver a Planeación
            </Link>
          </div>
        </section>

        <ModuleContract
          title="Cómo leer Compras 2026"
          description="Este módulo separa compra confirmada, recepción física y compra proyectada para que Finanzas, Operación y Planeación no lean la misma cifra como si significara lo mismo."
          items={[
            {
              label: "Facturado",
              value: `${formatCurrency(summary.total_facturado)} · ${formatNumber(summary.unidades_facturadas)} equipos`,
              hint: "Una factura confirma compra y presupuesto ejecutado, pero no implica que el equipo ya esté recibido o disponible en stock.",
              tone: "cyan",
            },
            {
              label: "Recibido",
              value: `${formatNumber(summary.unidades_recibidas)} equipos`,
              hint: "La guía de despacho marca recepción documental. Si hay serial y hace match con inventario, la conciliación queda mucho más fuerte.",
              tone: "green",
            },
            {
              label: "Proyectado",
              value: `${formatNumber(forecastSummary.unidades_planeadas)} equipos · ${formatCurrency(forecastSummary.presupuesto_estimado_clp)}`,
              hint: "La compra de junio es escenario planificado. Sirve para forecast y cobertura, pero no debe contarse como stock real hasta que exista recepción.",
              tone: "purple",
            },
            {
              label: "Pendientes",
              value: `${formatNumber(summary.unidades_pendientes_recepcion)} por recibir · ${formatNumber(summary.unidades_pendientes_conciliacion)} por conciliar`,
              hint: "Aquí vive la brecha entre documento, recepción física e inventario visible en MTR/Catastro.",
              tone: "amber",
            },
          ]}
          badges={[
            { label: `${formatNumber(summary.documentos_total)} documentos`, tone: "purple" },
            { label: `${formatNumber(summary.proveedores_total)} proveedores`, tone: "cyan" },
            { label: `${formatMonthLabel(forecastSummary.mes)} forecast`, tone: "green" },
          ]}
          note="Regla de lectura: factura = compra confirmada, guía = recepción visible, orden de compra = presión futura. Si una cifra no tiene respaldo físico o conciliación contra inventario, no debe tratarse como stock disponible."
        />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Facturado 2026"
            value={formatCurrency(summary.total_facturado)}
            subtitle={`${formatNumber(summary.unidades_facturadas)} equipos documentados`}
            tone="cyan"
          />
          <KpiCard
            title="Recepciones visibles"
            value={formatNumber(summary.unidades_recibidas)}
            subtitle={`${formatNumber(summary.documentos_guia_sin_match_mtr)} guía(s) sin match MTR`}
            tone="green"
          />
          <KpiCard
            title="Proyección junio"
            value={formatNumber(forecastSummary.unidades_planeadas)}
            subtitle={`${formatNumber(forecastSummary.macbook_planeadas)} MacBook · ${formatNumber(forecastSummary.hp_planeadas)} HP`}
            tone="purple"
          />
          <KpiCard
            title="Pendientes críticos"
            value={formatNumber(summary.unidades_pendientes_recepcion)}
            subtitle={`${formatNumber(summary.documentos_factura_sin_ingreso_stock)} factura(s) sin ingreso`}
            tone="yellow"
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="catastro-panel rounded-[2rem] p-7">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Forecast de compra conectado a Planeación</h2>
                <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
                  El escenario de junio mezcla compras reales ya documentadas con las órdenes planificadas para medir
                  cobertura, presión de demanda y presupuesto.
                </p>
              </div>
              <div className="catastro-chip-purple rounded-full px-3 py-1 text-xs font-semibold">
                {formatMonthLabel(forecastSummary.mes)}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Presupuesto estimado" value={formatCurrency(forecastSummary.presupuesto_estimado_clp)} tone="purple" />
              <KpiCard title="Stock total base" value={formatNumber(forecastSummary.stock_total_base)} tone="cyan" />
              <KpiCard title="Stock esperado" value={formatNumber(forecastSummary.stock_esperado_total)} tone="green" />
              <KpiCard title="Cobertura proyectada" value={formatRatio(forecastSummary.cobertura_total_con_compras)} tone="yellow" />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--cat-border)] bg-white/75 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Lectura planeación</div>
                <p className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                  {forecastSummary.lectura_planeacion ?? "Sin lectura visible para el mes proyectado."}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--cat-border)] bg-white/75 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Staffing / core</div>
                <p className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
                  {forecastSummary.lectura_staffing_core ?? "Sin lectura específica de mezcla por segmento."}
                </p>
              </div>
            </div>

            {forecastNotes.length ? (
              <div className="mt-6 rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cat-text-soft)]">Notas de control</div>
                <ul className="mt-3 space-y-2 text-sm text-[var(--cat-text-muted)]">
                  {forecastNotes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="catastro-panel rounded-[2rem] p-7">
            <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Documentos pendientes o sin match</h2>
            <p className="mt-2 text-sm text-[var(--cat-text-muted)]">
              Facturas aún no recibidas en stock y guías que no hacen match directo con MTR.
            </p>
            <div className="mt-5 space-y-3">
              {pending.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-4 text-sm text-[var(--cat-text-soft)]">
                  Sin documentos pendientes para esta vista.
                </div>
              ) : null}
              {pending.map((item) => (
                <div key={item.documento_id} className="rounded-2xl border border-[color:var(--cat-border)] bg-white/75 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="catastro-chip-blue rounded-full px-3 py-1 text-xs font-semibold uppercase">{item.tipo_documento}</span>
                    <span className="text-sm font-semibold text-[var(--cat-text)]">{item.proveedor} · {item.numero_documento}</span>
                  </div>
                  <div className="mt-2 text-sm text-[var(--cat-text-muted)]">
                    {formatMonthLabel(item.fecha_emision)} · pendientes recepción {formatNumber(item.unidades_pendientes_recepcion)} · pendientes conciliación {formatNumber(item.unidades_pendientes_conciliacion)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-8">
          <SectionTable
            title="Resumen por mes"
            subtitle="Mes a mes se ve el corte financiero, la recepción visible y la carga proyectada."
            headers={["Mes", "Facturado", "Recibido", "Proyectado", "MacBook vs HP", "Alertas doc."]}
            rows={monthly.map((row) => [
              formatMonthLabel(row.mes),
              `${formatCurrency(row.total_facturado)} · ${formatNumber(row.unidades_facturadas)} eq.`,
              formatNumber(row.unidades_recibidas),
              formatNumber(row.unidades_proyectadas),
              `MBP ${formatNumber(row.macbook_facturadas ?? 0)} / HP ${formatNumber(row.hp_facturadas ?? 0)} · proj ${formatNumber(row.macbook_proyectadas ?? 0)} / ${formatNumber(row.hp_proyectadas ?? 0)}`,
              `facturas sin ingreso ${formatNumber(row.documentos_factura_sin_ingreso_stock)} · guías sin match ${formatNumber(row.documentos_guia_sin_match_mtr)}`,
            ])}
          />

          <SectionTable
            title="Documentos visibles"
            subtitle="Cabecera documental 2026 disponible para consulta y conciliación."
            headers={["Documento", "Proveedor", "Fecha", "Tipo", "Montos", "Estado operativo"]}
            rows={docs.map((row) => [
              row.numero_documento,
              row.proveedor,
              row.fecha_emision,
              row.tipo_documento,
              `${formatCurrency(row.total)} · neto ${formatCurrency(row.total_neto)}`,
              `facturado ${formatNumber(row.unidades_facturadas)} · recibido ${formatNumber(row.unidades_recibidas)} · proyectado ${formatNumber(row.unidades_proyectadas)}`,
            ])}
          />

          <SectionTable
            title="Mix por modelo"
            subtitle="Comparación entre MacBook y HP para compra, recepción y forecast."
            headers={["Modelo", "Categoría", "Facturado", "Recibido", "Proyectado", "Monto"]}
            rows={byModel.map((row) => [
              `${row.marca} ${row.modelo}`,
              row.categoria_equipo,
              formatNumber(row.unidades_facturadas),
              formatNumber(row.unidades_recibidas),
              formatNumber(row.unidades_proyectadas),
              `${formatCurrency(row.monto_facturado)} · proj ${formatCurrency(row.monto_proyectado)}`,
            ])}
          />

          <SectionTable
            title="Proveedores"
            subtitle="Quién concentra documentos, recepción y carga proyectada."
            headers={["Proveedor", "Documentos", "Facturado", "Recibido", "Proyectado", "Total facturado"]}
            rows={byProvider.map((row) => [
              row.proveedor,
              formatNumber(row.documentos),
              formatNumber(row.unidades_facturadas),
              formatNumber(row.unidades_recibidas),
              formatNumber(row.unidades_proyectadas),
              formatCurrency(row.total_facturado),
            ])}
          />

          <SectionTable
            title="Planeación enriquecida con compras"
            subtitle="Diferencia visible entre stock base y stock ajustado cuando entra la capa documental."
            headers={["Mes", "Demanda", "Stock base", "Compras doc.", "Stock esperado", "Gap + lectura"]}
            rows={planeacion.map((row) => [
              formatMonthLabel(row.mes),
              formatNumber(row.demanda_presion_compra_mes),
              `${formatNumber(row.stock_disponible_confirmado_base)} / ${formatNumber(row.stock_disponible_total_base)}`,
              `fact ${formatNumber(row.compras_documentales_facturadas)} · rec ${formatNumber(row.compras_documentales_recibidas)} · proj ${formatNumber(row.compras_proyectadas)}`,
              `${formatNumber(row.stock_esperado_total)} · cobertura ${formatRatio(row.cobertura_total_con_compras)}`,
              `${formatNumber(row.gap_total_con_compras)} · ${row.lectura_planeacion_con_compras ?? "Sin lectura"}`,
            ])}
          />

          <SectionTable
            title="Forecast junio por línea"
            subtitle="Escenario planificado 15 MacBook Pro + 10 HP EliteBook valorizado con referencias reales."
            headers={["Proveedor", "Modelo", "Cantidad", "Precio ref.", "Presupuesto", "Impacto base"]}
            rows={forecastRows.map((row) => [
              row.proveedor,
              `${row.marca} ${row.modelo}`,
              formatNumber(row.cantidad_planeada),
              formatCurrency(row.precio_unitario_referencia),
              formatCurrency(row.presupuesto_estimado_clp),
              `stock base ${formatNumber(forecastSummary.stock_total_base)} · demanda ${formatNumber(forecastSummary.demanda_presion_compra_mes)}`,
            ])}
          />
        </div>
      </div>
    </main>
  );
}
