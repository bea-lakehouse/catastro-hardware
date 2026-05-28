"use client";

import Link from "next/link";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyOperationalStatus } from "@/lib/statusMatrix";

export type PlanningDrilldownRow = {
  id_equipo: string;
  cliente?: string | null;
  modelo?: string | null;
  focusLabel: string;
  action: string;
  reason?: string | null;
  ownerDisplay?: string | null;
  trackingStatus?: string | null;
  caseKey?: string | null;
};

function trackingBadge(status?: string | null) {
  const key = String(status ?? "PENDIENTE").toUpperCase();
  if (key === "EN_REVISION") return getStatusClassName("observacion");
  if (key === "RESUELTO") return getStatusClassName("confirmada");
  if (key === "ESCALADO") return getStatusClassName("critica");
  if (key === "DESCARTADO") return getStatusClassName("neutral");
  return getStatusClassName("sin asignacion");
}

export default function PlanningDrilldownSection({
  rows,
  title = "Drilldown operativo",
  subtitle = "Entrada rápida a los equipos que hoy más empujan decisión, seguimiento o regularización desde Planeación.",
}: {
  rows: PlanningDrilldownRow[];
  title?: string;
  subtitle?: string;
}) {
  if (!rows.length) return null;

  return (
    <section className="catastro-panel rounded-[2rem] p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="catastro-tag inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
            Drilldown cruzado
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--cat-text)]">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <article key={`${row.focusLabel}-${row.id_equipo}`} className="rounded-[1.5rem] border border-[color:var(--cat-border)] bg-white/75 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="catastro-chip-blue rounded-full px-3 py-2 text-[11px] font-semibold uppercase">
                    {row.focusLabel}
                  </span>
                  {row.trackingStatus ? (
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trackingBadge(row.trackingStatus)}`}>
                      {prettyOperationalStatus(row.trackingStatus)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 text-xl font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                <div className="mt-1 text-sm uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                  {row.cliente ?? "SIN_CLIENTE"} · {row.modelo ?? "SIN_MODELO"}
                </div>
                <div className="mt-3 text-base font-semibold text-[var(--cat-text)]">{row.action}</div>
                <div className="mt-2 text-sm leading-7 text-[var(--cat-text-muted)]">
                  {row.reason ?? "Sin motivo operativo visible para este foco."}
                </div>
                {row.ownerDisplay ? (
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                    Owner visible: <span className="font-semibold text-[var(--cat-text)]">{row.ownerDisplay}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/equipos/${encodeURIComponent(row.id_equipo)}`} className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold">
                  Ficha
                </Link>
                <Link href={`/activos?q=${encodeURIComponent(row.id_equipo)}`} className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold">
                  Activos
                </Link>
                <Link href={`/ejecucion?q=${encodeURIComponent(row.id_equipo)}`} className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold">
                  Ejecución
                </Link>
                <Link href={`/excepciones?q=${encodeURIComponent(row.id_equipo)}`} className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold">
                  Excepciones
                </Link>
                {row.caseKey ? (
                  <Link href={`/ejecucion/${encodeURIComponent(row.caseKey)}`} className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold">
                    Bitácora
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
