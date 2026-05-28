import {
  getStatusDefinition,
  normalizeStatusToken,
  type CatastroStatusDomain,
} from "@/lib/statusMatrix";

export function normalizeStatusValue(value?: string | number | null): string {
  return normalizeStatusToken(value);
}

export function getStatusClassName(
  value?: string | number | null,
  options?: { domain?: CatastroStatusDomain },
): string {
  const normalized = normalizeStatusValue(value);
  if (!normalized) return "cat-status-badge cat-status-neutral";

  const definition = getStatusDefinition(value, options?.domain ?? "generic");
  if (definition) {
    return `cat-status-badge cat-status-${definition.tone}`;
  }

  return "cat-status-badge cat-status-neutral";
}

export function isStatusLikeHeader(header?: string | null): boolean {
  const normalized = normalizeStatusValue(header);
  return /estado|status|accion|decision|criticidad|severidad|bucket|riesgo|plataforma|tipo|scope|prioridad/.test(normalized);
}

export function shouldRenderStatusBadge(header?: string | null, value?: string | number | null): boolean {
  const normalizedValue = normalizeStatusValue(value);
  if (!normalizedValue || normalizedValue === "—") return false;
  if (!isStatusLikeHeader(header)) return false;
  return normalizedValue.length <= 40;
}
