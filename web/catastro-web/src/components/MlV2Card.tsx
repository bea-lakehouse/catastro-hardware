import type { MlSignal } from "@/lib/mlv2_simulation";

type MlCardProps = {
  signal: MlSignal | null;
};

type SignalWithExtras = MlSignal & {
  extra_features?: Record<string, unknown> | null;
  extraFeatures?: Record<string, unknown> | null;
  equipo_id?: string | null;
  id?: string | null;
  serial?: string | null;
};

export function MlV2Card({ signal }: MlCardProps) {
  const signalWithExtras = signal as SignalWithExtras | null;
  const extraFeatures =
    signalWithExtras?.extra_features ?? signalWithExtras?.extraFeatures ?? null;

  const s = signal;
  const drivers = Array.isArray(s?.drivers) ? s.drivers : [];

  return (
    <section className="catastro-panel rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h3 className="text-base font-semibold text-[var(--cat-text)]">Señal ML (v2)</h3>
          </div>
          <p className="mt-1 text-sm text-[var(--cat-text-muted)]">
            Apoyo para priorizar, no reemplaza MTR.
          </p>
        </div>

        <span className="catastro-pill rounded-full px-3 py-1 text-xs">
          {s?.status === "OK" ? "ML" : "Sin ML"}
        </span>
      </div>

      <div className="catastro-inset mt-4 rounded-xl p-3">
        {!s || s.status === "NO_EVALUADO" ? (
          <>
            <div className="text-sm text-[var(--cat-text)]">
              Aún no hay evaluación ML v2.

      {extraFeatures ? (
        <div className="catastro-panel mt-3 rounded-lg p-3">
          <div className="mb-2 text-xs text-[var(--cat-text-soft)]">Features Jira (para ML v2)</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(extraFeatures).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-[var(--cat-text-soft)]">{k}</span>
                <span className="text-[var(--cat-text-muted)]">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

            </div>
            <div className="mt-1 text-xs text-[var(--cat-text-soft)]">
              {s?.status === "NO_EVALUADO"
                ? s.reason
                : "La priorización se basa solo en reglas MTR."}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm text-[var(--cat-text-muted)]">
                Prioridad sugerida:{" "}
                <span className="font-semibold text-[var(--cat-text)]">{s.priority}</span>
              </div>
              <div className="text-xs text-[var(--cat-text-soft)]">score: {s.score}</div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-medium text-[var(--cat-text-soft)]">
                ¿Por qué ML?
              </div>
              <ul className="mt-2 space-y-1">
                {drivers.slice(0, 3).map((d, i) => (
                  <li key={i} className="text-xs text-[var(--cat-text-muted)]">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 text-[11px] text-[var(--cat-text-soft)]">
              ML no genera alertas. Solo ayuda a priorizar casos ya gobernados por MTR.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
