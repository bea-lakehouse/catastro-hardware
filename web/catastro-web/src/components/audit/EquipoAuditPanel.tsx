import Link from "next/link";

export type AuditRow = {
  audit_id: string;
  id_equipo: string;
  campo_modificado?: string | null;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  fecha_cambio?: string | null;
  origen?: string | null;
  source_table?: string | null;
  source_run_id?: string | null;
  actor?: string | null;
  tipo_cambio?: string | null;
  criticidad?: string | null;
  confianza?: string | null;
};

export type AuditFieldCount = {
  campo_modificado?: string | null;
  cambios?: number | null;
};

export type AuditEquipoSummary = {
  id_equipo: string;
  ultimo_cambio_auditado?: string | null;
  origen_ultimo_cambio?: string | null;
  campo_ultimo_cambio?: string | null;
  tipo_ultimo_cambio?: string | null;
  cambios_30d?: number | null;
  cambios_totales?: number | null;
  cambios_criticos?: number | null;
  cambios_sin_actor_humano_identificado?: number | null;
  campos_mas_modificados?: AuditFieldCount[] | null;
};

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

function CompactCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="catastro-inset rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">{title}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--cat-text)]">{value}</div>
      {helper ? <div className="mt-2 text-sm text-[var(--cat-text-muted)]">{helper}</div> : null}
    </div>
  );
}

export default function EquipoAuditPanel({
  idEquipo,
  rows,
  summary,
}: {
  idEquipo: string;
  rows: AuditRow[];
  summary?: AuditEquipoSummary | null;
}) {
  const totalCambios = Number(summary?.cambios_totales ?? rows.length ?? 0);
  const hasAudit = totalCambios > 0;

  return (
    <section id="auditoria" className="catastro-panel rounded-3xl p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--cat-text)]">Auditoría de cambios</h2>
          <p className="mt-2 text-[var(--cat-text-muted)]">Cambios formales detectados campo a campo.</p>
        </div>
        {hasAudit ? (
          <Link
            href={`/auditoria?q=${encodeURIComponent(idEquipo)}`}
            className="inline-flex rounded-full bg-[var(--cat-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            Ver auditoría completa
          </Link>
        ) : null}
      </div>

      {hasAudit ? (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <CompactCard
            title="Total cambios auditados"
            value={totalCambios}
            helper="Cambios formales visibles en fuentes históricas"
          />
          <CompactCard
            title="Último cambio auditado"
            value={fmtIsoDate(summary?.ultimo_cambio_auditado)}
            helper={summary?.tipo_ultimo_cambio ?? "Sin tipo visible"}
          />
          <div className="catastro-inset rounded-2xl p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--cat-text-soft)]">Origen último cambio</div>
            <div className="mt-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${sourceClasses(summary?.origen_ultimo_cambio)}`}>
                {summary?.origen_ultimo_cambio ?? "Sin origen"}
              </span>
            </div>
            {summary?.campo_ultimo_cambio ? (
              <div className="mt-2 text-sm text-[var(--cat-text-muted)]">{summary.campo_ultimo_cambio}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-[color:var(--cat-border)] bg-white/70 p-4 text-sm text-[var(--cat-text-muted)]">
          No hay cambios auditados para este equipo en las fuentes históricas disponibles.
        </div>
      )}
    </section>
  );
}
