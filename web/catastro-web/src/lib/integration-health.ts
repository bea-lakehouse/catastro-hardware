export type IntegrationHealthStatus = "SUCCESS" | "DEGRADED" | "ERROR";

function normalizeStatus(status?: string | null): IntegrationHealthStatus {
  const raw = String(status ?? "").toUpperCase();
  if (raw === "SUCCESS" || raw === "DEGRADED") return raw;
  return "ERROR";
}

export function integrationHealthLabel(status?: string | null): string {
  const normalized = normalizeStatus(status);
  if (normalized === "SUCCESS") return "Operativo";
  if (normalized === "DEGRADED") return "Modo degradado";
  return "No disponible";
}

export function integrationHealthBadgeClasses(status?: string | null): string {
  const normalized = normalizeStatus(status);
  if (normalized === "SUCCESS") {
    return "border-emerald-300/70 bg-emerald-100 text-emerald-900";
  }
  if (normalized === "DEGRADED") {
    return "border-amber-300/70 bg-amber-100 text-amber-950";
  }
  return "border-rose-300/70 bg-rose-100 text-rose-950";
}

export function integrationHealthCardClasses(status?: string | null): string {
  const normalized = normalizeStatus(status);
  if (normalized === "SUCCESS") {
    return "border-emerald-300/50 bg-emerald-50/85";
  }
  if (normalized === "DEGRADED") {
    return "border-amber-300/50 bg-amber-50/90";
  }
  return "border-rose-300/50 bg-rose-50/85";
}

export function integrationHealthDotClasses(status?: string | null): string {
  const normalized = normalizeStatus(status);
  if (normalized === "SUCCESS") return "bg-emerald-500";
  if (normalized === "DEGRADED") return "bg-amber-500";
  return "bg-rose-500";
}
