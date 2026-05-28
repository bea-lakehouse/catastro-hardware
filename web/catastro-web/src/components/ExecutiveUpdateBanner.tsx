export default function ExecutiveUpdateBanner() {
  return (
    <div
      className="border-b"
      style={{
        borderColor: "rgba(132, 148, 255, 0.16)",
        background: "linear-gradient(135deg, rgba(237, 246, 241, 0.92) 0%, rgba(255, 250, 229, 0.96) 100%)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cat-text-soft)]">
            Actualización ejecutiva
          </div>
          <div className="mt-1 text-sm text-[var(--cat-text)]">
            Abril 2026 quedó tratado como cierre final y mayo 2026 se muestra como avance parcial con datos reales del corte disponible.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-900">
            Abril 2026 · cierre final
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-950">
            Mayo 2026 · avance parcial
          </span>
        </div>
      </div>
    </div>
  );
}
