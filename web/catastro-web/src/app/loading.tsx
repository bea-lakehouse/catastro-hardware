export default function Loading() {
  return (
    <main className="catastro-page">
      <div className="mx-auto max-w-7xl">
        <section className="catastro-card-blue rounded-[32px] px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="catastro-chip-blue inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase">
                Catastro Command Center
              </div>
              <h1 className="catastro-hero-title mt-4 text-[var(--cat-card-text)]">
                Cargando runtime operacional
              </h1>
              <p className="catastro-hero-subtitle mt-3 max-w-3xl">
                Sincronizando focos operativos, stock, MTR, ML y señales críticas del ecosistema.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:w-[30rem]">
              {["Home", "Histórico", "ML v2"].map((label) => (
                <div key={label} className="catastro-inset rounded-2xl px-4 py-3">
                  <div className="catastro-kpi-label">{label}</div>
                  <div className="mt-3 h-3 w-full rounded-full bg-[rgba(255,255,255,0.08)]" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {["Datos operativos", "Conciliación", "Planeación"].map((label) => (
            <div key={label} className="catastro-panel rounded-3xl p-5">
              <div className="catastro-kpi-label">{label}</div>
              <div className="mt-4 h-10 rounded-2xl bg-[rgba(255,255,255,0.05)]" />
              <div className="mt-3 h-3 w-3/4 rounded-full bg-[rgba(255,255,255,0.05)]" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
