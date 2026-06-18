/**
 * services/quality.service.ts
 * Feature-flag pattern — delegates to getCalidad() to avoid duplicate queries.
 */

import { getCalidad, type CalidadPayload } from './governance.service';

export type { CalidadPayload as QualityPayload };

export async function getQuality(): Promise<CalidadPayload> {
  return getCalidad();
}
