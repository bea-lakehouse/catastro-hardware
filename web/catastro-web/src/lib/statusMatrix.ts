export type CatastroStatusDomain =
  | "generic"
  | "operacion"
  | "jira"
  | "planeacion"
  | "confianza"
  | "ml";

export type CatastroStatusTone =
  | "neutral"
  | "asignado"
  | "disponible"
  | "reservado"
  | "revision"
  | "por-recuperar"
  | "defectuoso"
  | "baja"
  | "renovar"
  | "sin-asignacion"
  | "resuelta"
  | "confirmada"
  | "cancelada"
  | "core"
  | "staffing"
  | "mac"
  | "windows"
  | "critica"
  | "alta"
  | "media"
  | "info"
  | "observacion"
  | "descartada";

export type CatastroStatusDefinition = {
  key: string;
  label: string;
  tone: CatastroStatusTone;
  domains: CatastroStatusDomain[];
  aliases: string[];
  meaning: string;
};

export function normalizeStatusToken(value?: string | number | null): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const OPERATIONAL_STATUS_MATRIX: CatastroStatusDefinition[] = [
  {
    key: "SIN_ASIGNACION",
    label: "Sin asignacion",
    tone: "sin-asignacion",
    domains: ["generic", "operacion"],
    aliases: ["sin asignacion", "sin dueno", "sin owner"],
    meaning: "Equipo sin persona u owner operativo visible.",
  },
  {
    key: "ASIGNADO",
    label: "Asignado",
    tone: "asignado",
    domains: ["generic", "operacion", "jira"],
    aliases: ["asignado", "asignada"],
    meaning: "Equipo actualmente entregado a un usuario o flujo de asignacion.",
  },
  {
    key: "DISPONIBLE",
    label: "Disponible",
    tone: "disponible",
    domains: ["generic", "operacion"],
    aliases: ["disponible", "stand by", "stand_by", "stand-by"],
    meaning: "Equipo disponible o en espera operativa para ser usado.",
  },
  {
    key: "RESERVADO",
    label: "Reservado",
    tone: "reservado",
    domains: ["generic", "operacion", "jira"],
    aliases: ["reservado", "pendiente"],
    meaning: "Equipo comprometido para una entrega o movimiento proximo.",
  },
  {
    key: "RESGUARDO",
    label: "Resguardo",
    tone: "revision",
    domains: ["generic", "operacion", "jira"],
    aliases: ["resguardo"],
    meaning: "Equipo retenido o protegido mientras se define su siguiente paso.",
  },
  {
    key: "POR_RECUPERAR",
    label: "Por recuperar",
    tone: "por-recuperar",
    domains: ["generic", "operacion", "jira"],
    aliases: ["por recuperar", "por_recuperar", "recuperar"],
    meaning: "Equipo aun no recuperado fisicamente o pendiente de retorno.",
  },
  {
    key: "DEFECTUOSO",
    label: "Defectuoso",
    tone: "defectuoso",
    domains: ["generic", "operacion", "jira"],
    aliases: ["defectuoso", "desperfecto", "reparacion"],
    meaning: "Equipo con falla o desperfecto operativo visible.",
  },
  {
    key: "OBSOLETO",
    label: "Obsoleto",
    tone: "renovar",
    domains: ["generic", "operacion", "jira"],
    aliases: ["obsoleto", "obsolescencia", "descontinuado"],
    meaning: "Equipo en salida por antiguedad, politica o fin de ciclo.",
  },
  {
    key: "BAJA",
    label: "Baja",
    tone: "baja",
    domains: ["generic", "operacion", "jira"],
    aliases: ["baja", "dado de baja"],
    meaning: "Equipo fuera del parque operativo vigente.",
  },
  {
    key: "REVISAR",
    label: "Revisar",
    tone: "revision",
    domains: ["generic", "operacion"],
    aliases: ["revision", "revisar", "en progreso", "en_progreso"],
    meaning: "Caso en revision manual o pendiente de definicion operativa.",
  },
];

const JIRA_BUCKET_MATRIX: CatastroStatusDefinition[] = [
  {
    key: "CREADO",
    label: "Creado",
    tone: "info",
    domains: ["generic", "jira"],
    aliases: ["creado"],
    meaning: "Alta administrativa en Jira aun no necesariamente reflejada como ingreso MTR.",
  },
  {
    key: "EN_PROGRESO",
    label: "En progreso",
    tone: "revision",
    domains: ["generic", "jira"],
    aliases: ["en progreso", "en_progreso"],
    meaning: "Issue Jira en curso dentro del workflow operativo.",
  },
];

const PLANNING_STATUS_MATRIX: CatastroStatusDefinition[] = [
  {
    key: "RENOVAR",
    label: "Renovar",
    tone: "renovar",
    domains: ["generic", "planeacion"],
    aliases: ["renovar"],
    meaning: "Accion de recambio sugerida por politica, riesgo o antiguedad.",
  },
  {
    key: "MANTENER",
    label: "Mantener",
    tone: "info",
    domains: ["generic", "planeacion"],
    aliases: ["mantener", "estable"],
    meaning: "Equipo o familia sin necesidad inmediata de cambio.",
  },
  {
    key: "OBSERVACION",
    label: "Observacion",
    tone: "observacion",
    domains: ["generic", "planeacion"],
    aliases: ["observacion"],
    meaning: "Caso a monitorear antes de definir recambio o salida.",
  },
  {
    key: "REUTILIZABLE",
    label: "Reutilizable",
    tone: "resuelta",
    domains: ["generic", "planeacion"],
    aliases: ["reutilizable", "reutilizacion", "reutilizar"],
    meaning: "Equipo apto para ser reinsertado o reutilizado.",
  },
  {
    key: "BAJA_REQUERIDA",
    label: "Baja requerida",
    tone: "baja",
    domains: ["generic", "planeacion"],
    aliases: ["baja requerida", "retiro", "salida"],
    meaning: "Caso que debe salir del parque o ser dado de baja.",
  },
  {
    key: "CRITICO",
    label: "Critico",
    tone: "critica",
    domains: ["generic", "planeacion"],
    aliases: ["critico"],
    meaning: "Caso prioritario que requiere accion inmediata.",
  },
];

const CONFIDENCE_STATUS_MATRIX: CatastroStatusDefinition[] = [
  {
    key: "ALTA",
    label: "Alta",
    tone: "alta",
    domains: ["generic", "confianza"],
    aliases: ["alta"],
    meaning: "Fuentes concordantes o alto nivel de confianza operacional.",
  },
  {
    key: "MEDIA",
    label: "Media",
    tone: "media",
    domains: ["generic", "confianza"],
    aliases: ["media", "warn", "warning"],
    meaning: "Senal suficiente para operar, pero con validacion pendiente.",
  },
  {
    key: "BAJA",
    label: "Baja",
    tone: "baja",
    domains: ["confianza"],
    aliases: ["baja"],
    meaning: "Lectura debil o inconsistente entre fuentes operativas.",
  },
  {
    key: "CRITICA",
    label: "Critica",
    tone: "critica",
    domains: ["generic", "confianza"],
    aliases: ["critica", "critical"],
    meaning: "Conflicto fuerte o quiebre critico entre fuentes.",
  },
  {
    key: "INFO",
    label: "Info",
    tone: "info",
    domains: ["generic", "confianza"],
    aliases: ["info"],
    meaning: "Informacion complementaria sin urgencia operativa propia.",
  },
  {
    key: "NORMAL",
    label: "Normal",
    tone: "neutral",
    domains: ["generic", "confianza"],
    aliases: ["normal"],
    meaning: "Lectura estable sin senal critica activa.",
  },
];

const ML_STATUS_MATRIX: CatastroStatusDefinition[] = [
  {
    key: "ALTO",
    label: "Alto",
    tone: "critica",
    domains: ["generic", "ml"],
    aliases: ["alto", "critical"],
    meaning: "Riesgo ML alto con prioridad inmediata de revision.",
  },
  {
    key: "MEDIO",
    label: "Medio",
    tone: "media",
    domains: ["generic", "ml"],
    aliases: ["medio", "warn", "warning"],
    meaning: "Riesgo ML intermedio que requiere monitoreo activo.",
  },
  {
    key: "BAJO",
    label: "Bajo",
    tone: "resuelta",
    domains: ["generic", "ml"],
    aliases: ["bajo"],
    meaning: "Riesgo ML bajo o comportamiento estable en el corte actual.",
  },
];

const GENERIC_STATUS_MATRIX: CatastroStatusDefinition[] = [
  {
    key: "RESUELTA",
    label: "Resuelta",
    tone: "resuelta",
    domains: ["generic"],
    aliases: ["resuelta", "recibida"],
    meaning: "Caso cerrado o regularizado.",
  },
  {
    key: "CONFIRMADA",
    label: "Confirmada",
    tone: "confirmada",
    domains: ["generic"],
    aliases: ["confirmada"],
    meaning: "Estado o compra confirmada.",
  },
  {
    key: "CANCELADA",
    label: "Cancelada",
    tone: "cancelada",
    domains: ["generic"],
    aliases: ["cancelada"],
    meaning: "Caso cancelado y fuera de ejecucion.",
  },
  {
    key: "CORE",
    label: "Core",
    tone: "core",
    domains: ["generic"],
    aliases: ["core"],
    meaning: "Perteneciente al parque core.",
  },
  {
    key: "STAFFING",
    label: "Staffing",
    tone: "staffing",
    domains: ["generic"],
    aliases: ["staffing"],
    meaning: "Asociado a staffing o parque no core.",
  },
  {
    key: "MAC",
    label: "Mac",
    tone: "mac",
    domains: ["generic"],
    aliases: ["mac", "macbook"],
    meaning: "Plataforma Apple / macOS.",
  },
  {
    key: "WINDOWS",
    label: "Windows",
    tone: "windows",
    domains: ["generic"],
    aliases: ["windows", "win"],
    meaning: "Plataforma Windows.",
  },
  {
    key: "DESCARTADA",
    label: "Descartada",
    tone: "descartada",
    domains: ["generic"],
    aliases: ["descartada"],
    meaning: "Caso descartado de la accion activa.",
  },
];

export const CATRASTO_STATUS_MATRIX: CatastroStatusDefinition[] = [
  ...OPERATIONAL_STATUS_MATRIX,
  ...JIRA_BUCKET_MATRIX,
  ...PLANNING_STATUS_MATRIX,
  ...CONFIDENCE_STATUS_MATRIX,
  ...ML_STATUS_MATRIX,
  ...GENERIC_STATUS_MATRIX,
];

function matchesAlias(normalizedValue: string, alias: string) {
  const normalizedAlias = normalizeStatusToken(alias);
  return normalizedValue === normalizedAlias || normalizedValue.includes(normalizedAlias);
}

export function getStatusDefinition(
  value?: string | number | null,
  domain: CatastroStatusDomain = "generic",
): CatastroStatusDefinition | null {
  const normalizedValue = normalizeStatusToken(value);
  if (!normalizedValue) return null;

  const candidates = CATRASTO_STATUS_MATRIX.filter((item) =>
    domain === "generic" ? item.domains.includes("generic") : item.domains.includes(domain),
  );

  for (const item of candidates) {
    if (item.aliases.some((alias) => matchesAlias(normalizedValue, alias))) {
      return item;
    }
  }

  if (domain !== "generic") {
    return getStatusDefinition(value, "generic");
  }

  return null;
}

export function prettyJiraBucket(bucket?: string | null) {
  const definition = getStatusDefinition(bucket, "jira");
  if (definition) return definition.label;
  const key = String(bucket ?? "").trim();
  if (!key) return "Sin bucket";
  return key.replaceAll("_", " ");
}

export function prettyOperationalStatus(status?: string | null) {
  const definition = getStatusDefinition(status, "operacion");
  if (definition) return definition.label;
  const key = String(status ?? "").trim();
  if (!key) return "Sin estado";
  return key.replaceAll("_", " ");
}

export function prettyPlanningStatus(status?: string | null) {
  const definition = getStatusDefinition(status, "planeacion");
  if (definition) return definition.label;
  const key = String(status ?? "").trim();
  if (!key) return "Sin decision";
  return key.replaceAll("_", " ");
}

export function prettyMlRisk(status?: string | null) {
  const definition = getStatusDefinition(status, "ml");
  if (definition) return definition.label;
  const key = String(status ?? "").trim();
  if (!key) return "Sin nivel";
  return key.replaceAll("_", " ");
}
