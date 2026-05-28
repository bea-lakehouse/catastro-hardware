"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { getStatusClassName } from "@/lib/statusStyles";
import { prettyOperationalStatus } from "@/lib/statusMatrix";

type ExecutionLink = {
  href: string;
  label: string;
};

export type ExecutionCaseRow = {
  case_id?: number | null;
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
  links: ExecutionLink[];
};

const TRACKING_OWNERS = ["Help Desk", "Daniel Vargas", "Beatriz Herrera"] as const;
type TrackingOwner = (typeof TRACKING_OWNERS)[number];

function fmtIsoDate(value?: string | null) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return value;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

function severityBadge(value: string) {
  return getStatusClassName(value, { domain: "confianza" });
}

function sourceBadge(source: string) {
  const key = String(source ?? "").toUpperCase();
  if (key.includes("JIRA") && key.includes("MTR")) return getStatusClassName("media");
  if (key.includes("JIRA")) return getStatusClassName("observacion");
  if (key.includes("AUDITORIA")) return getStatusClassName("info");
  if (key.includes("PLANEACION")) return getStatusClassName("renovar");
  return getStatusClassName("core");
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

async function postTracking(path: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/proxy${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    try {
      const parsed = JSON.parse(text) as { detail?: string; message?: string };
      throw new Error(parsed.detail || parsed.message || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }

  return res.json().catch(() => ({}));
}

function RowActions({ row }: { row: ExecutionCaseRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialOwner =
    TRACKING_OWNERS.find((owner) => owner === row.owner_real) ??
    TRACKING_OWNERS.find((owner) => owner === row.owner_display) ??
    "Help Desk";
  const [ownerReal, setOwnerReal] = useState(initialOwner);
  const [comment, setComment] = useState(row.comentario_operativo ?? "");
  const [error, setError] = useState<string | null>(null);
  const normalizedComment = comment.trim();

  const basePayload = useMemo(
    () => ({
      case_key: row.case_key,
      case_type: row.case_type,
      source_module: row.source_module,
      source_ref: row.source_ref ?? row.id_equipo,
      id_equipo: row.id_equipo,
      cliente: row.cliente,
      severity: row.severity,
      source: row.source,
      title: row.title,
      summary: row.summary,
      suggested_action: row.suggested_action,
      owner_sugerido: row.owner_sugerido,
    }),
    [row],
  );

  function run(path: string, payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await postTracking(path, payload);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pude guardar el seguimiento.");
      }
    });
  }

  function runStatus(status: "EN_REVISION" | "RESUELTO" | "ESCALADO" | "DESCARTADO") {
    if ((status === "ESCALADO" || status === "DESCARTADO") && !normalizedComment) {
      setError(`Debes dejar un motivo operativo antes de marcar el caso como ${status}.`);
      return;
    }

    run("/ejecucion/cases/status", {
      ...basePayload,
      owner_real: ownerReal,
      estado_seguimiento: status,
      comentario_operativo: comment,
      actor: "Catastro UI",
    });
  }

  return (
    <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_0.95fr]">
      <div className="catastro-inset rounded-2xl p-4">
        <div className="catastro-kpi-label">Seguimiento operativo</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={ownerReal}
            onChange={(event) => setOwnerReal(event.target.value as TrackingOwner)}
            className="w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none"
          >
            {TRACKING_OWNERS.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => run("/ejecucion/cases/assign", { ...basePayload, owner_real: ownerReal, actor: "Catastro UI" })}
            disabled={isPending}
            className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            Asignar
          </button>
        </div>
        <div className="mt-2 text-xs leading-6 text-[var(--cat-text-soft)]">
          Owner real permitido para este flujo: <span className="font-semibold text-[var(--cat-text)]">{TRACKING_OWNERS.join(" · ")}</span>.
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Comentario operativo corto"
          className="mt-3 min-h-[5.4rem] w-full rounded-xl border border-[color:var(--cat-border)] bg-white px-3 py-2 text-sm text-[var(--cat-text)] outline-none"
        />
        <div className="mt-2 text-xs leading-6 text-[var(--cat-text-soft)]">
          Motivo obligatorio para <span className="font-semibold text-[var(--cat-text)]">Escalar</span> o <span className="font-semibold text-[var(--cat-text)]">Descartar</span>.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run("/ejecucion/cases/take", { ...basePayload, owner_real: ownerReal, comentario_operativo: comment, actor: "Catastro UI" })}
            disabled={isPending}
            className="catastro-button-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            Tomar caso
          </button>
          <button
            type="button"
            onClick={() => runStatus("EN_REVISION")}
            disabled={isPending}
            className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            En revisión
          </button>
          <button
            type="button"
            onClick={() => runStatus("RESUELTO")}
            disabled={isPending}
            className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            Resuelto
          </button>
          <button
            type="button"
            onClick={() => runStatus("ESCALADO")}
            disabled={isPending}
            className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            Escalar
          </button>
          <button
            type="button"
            onClick={() => runStatus("DESCARTADO")}
            disabled={isPending}
            className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={() => run("/ejecucion/cases/comment", { ...basePayload, owner_real: ownerReal, comentario_operativo: comment, actor: "Catastro UI" })}
            disabled={isPending}
            className="catastro-button-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            Guardar nota
          </button>
        </div>
        {error ? <div className="mt-3 text-sm text-rose-400">{error}</div> : null}
      </div>

      <div className="catastro-inset rounded-2xl p-4">
        <div className="catastro-kpi-label">Estado actual</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trackingBadge(row.estado_seguimiento)}`}>
            {prettyOperationalStatus(row.estado_seguimiento ?? "PENDIENTE")}
          </span>
          {row.validacion_cierre ? (
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${validationBadge(row.validacion_cierre)}`}>
              {validationLabel(row.validacion_cierre)}
            </span>
          ) : null}
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${sourceBadge(row.source)}`}>
            {row.source}
          </span>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${severityBadge(row.severity)}`}>
            {row.severity}
          </span>
        </div>
        <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
          Owner visible: <span className="font-semibold text-[var(--cat-text)]">{row.owner_display ?? row.owner_sugerido}</span>
        </div>
        <div className="text-sm leading-7 text-[var(--cat-text-muted)]">
          Toma: <span className="font-semibold text-[var(--cat-text)]">{fmtIsoDate(row.fecha_toma)}</span>
        </div>
        <div className="text-sm leading-7 text-[var(--cat-text-muted)]">
          Última actualización: <span className="font-semibold text-[var(--cat-text)]">{fmtIsoDate(row.tracking_updated_at)}</span>
        </div>
        {row.validacion_cierre ? (
          <div className="text-sm leading-7 text-[var(--cat-text-muted)]">
            Validación: <span className="font-semibold text-[var(--cat-text)]">{validationLabel(row.validacion_cierre)}</span>
          </div>
        ) : null}
        {row.comentario_operativo ? (
          <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">
            Última nota: <span className="font-semibold text-[var(--cat-text)]">{row.comentario_operativo}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ExecutionBoardClient({
  rows,
}: {
  rows: ExecutionCaseRow[];
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--cat-border)] p-6 text-sm text-[var(--cat-text-muted)]">
        No hay casos visibles con los filtros actuales.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <article key={row.case_key} className="cat-operacion-card rounded-2xl p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="cat-badge-stack">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${severityBadge(row.severity)}`}>
                  {row.severity}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trackingBadge(row.estado_seguimiento)}`}>
                  {prettyOperationalStatus(row.estado_seguimiento ?? "PENDIENTE")}
                </span>
                {row.validacion_cierre ? (
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${validationBadge(row.validacion_cierre)}`}>
                    {validationLabel(row.validacion_cierre)}
                  </span>
                ) : null}
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${sourceBadge(row.source)}`}>
                  {row.source}
                </span>
                {row.status ? (
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(row.status)}`}>
                    {prettyOperationalStatus(row.status)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <div className="text-xl font-semibold text-[var(--cat-text)]">{row.id_equipo}</div>
                <div className="text-sm uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">{row.cliente}</div>
              </div>

              <div className="mt-2 text-[1.05rem] font-semibold leading-7 text-[var(--cat-text)]">{row.title}</div>
              <div className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cat-text-muted)]">{row.summary}</div>
            </div>

            <div className="cat-operacion-meta-shield">
              <div className="catastro-kpi-label">Owner sugerido</div>
              <div className="mt-2 text-base font-semibold text-[var(--cat-text)]">{row.owner_sugerido}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--cat-text-soft)]">
                {row.age_days != null ? `${row.age_days}d abiertos` : row.freshness ?? "Sin aging"}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_0.8fr]">
            <div className="catastro-inset rounded-2xl p-4">
              <div className="catastro-kpi-label">Acción sugerida</div>
              <div className="mt-3 text-sm leading-7 text-[var(--cat-text-muted)]">{row.suggested_action}</div>
            </div>
            <div className="catastro-inset rounded-2xl p-4">
              <div className="catastro-kpi-label">Accesos</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.links.map((link) => (
                  <a key={`${row.case_key}-${link.href}`} href={link.href} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                    {link.label}
                  </a>
                ))}
                <Link href={`/ejecucion/${encodeURIComponent(row.case_key)}`} className="cat-operacion-link rounded-full px-3 py-2 text-xs font-semibold">
                  Bitácora
                </Link>
              </div>
            </div>
          </div>

          <RowActions row={row} />
        </article>
      ))}
    </div>
  );
}
