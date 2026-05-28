import TopNav from "@/components/TopNav";
import { getUiVisualUpdatedAtLabel } from "@/lib/ui-version";
import "./globals.css";

export const metadata = {
  title: "Catastro ",
  description: "Centro operativo del parque TI, presión de stock, movimientos MTR y señales críticas del ecosistema operativo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const uiUpdatedAtLabel = getUiVisualUpdatedAtLabel();

  return (
    <html lang="es">
      <body>
        <div className="min-h-screen">
          <div
            className="catastro-shell-header sticky top-0 z-40 border-b backdrop-blur"
            style={{
              borderColor: "rgba(47, 103, 214, 0.32)",
              background: "linear-gradient(180deg, rgba(7,11,20,0.94) 0%, rgba(9,14,26,0.92) 100%)",
              boxShadow:
                "0 20px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 28px rgba(0,198,255,0.05)",
            }}
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="h-8 w-8 shrink-0 rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(0,198,255,0.22) 0%, rgba(168,85,247,0.28) 100%)",
                    border: "1px solid rgba(0,198,255,0.24)",
                    boxShadow: "0 0 22px rgba(0,198,255,0.16)",
                  }}
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--cat-text-soft)]">
                    Catastro // Command Center
                  </div>
                  <div className="truncate font-semibold text-[var(--cat-text)]">Catastro Command Center</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <span className="catastro-chip-blue hidden rounded-full px-3 py-1 text-[10px] font-semibold sm:inline-flex">
                  UI {uiUpdatedAtLabel}
                </span>
                <TopNav />
              </div>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
