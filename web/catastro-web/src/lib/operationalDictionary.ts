export type OperationalTermKey =
  | "parqueVisible"
  | "boardJiraReal"
  | "conciliacionMtrJira"
  | "proyeccionOperativa"
  | "modoDegradado"
  | "sinPresionCompra"
  | "scoringMl";

type OperationalTerm = {
  label: string;
  short: string;
  meaning: string;
};

export const OPERATIONAL_DICTIONARY: Record<OperationalTermKey, OperationalTerm> = {
  parqueVisible: {
    label: "Parque visible",
    short: "Parque visible",
    meaning: "Equipos que Catastro puede ver hoy en la mart operativa, con estado y contexto suficientes para operar.",
  },
  boardJiraReal: {
    label: "Board Jira real",
    short: "Board Jira real",
    meaning: "Conteo y buckets administrativos tal como vienen del snapshot Jira, aunque parte de esos casos no aparezcan en el parque visible.",
  },
  conciliacionMtrJira: {
    label: "Conciliación MTR/Jira",
    short: "Conciliación",
    meaning: "Cruce entre operación física en MTR y workflow administrativo en Jira para detectar concordancia, faltantes y brechas.",
  },
  proyeccionOperativa: {
    label: "Proyección operativa",
    short: "Proyección",
    meaning: "Lectura estimada del siguiente corte, basada en tendencia reciente y pendientes visibles, no en eventos ya consolidados.",
  },
  modoDegradado: {
    label: "Modo degradado",
    short: "Degradado",
    meaning: "La UI sigue operativa usando fuentes alternativas o parciales porque una fuente principal no respondió o quedó stale.",
  },
  sinPresionCompra: {
    label: "Sin presión de compra",
    short: "Sin presión",
    meaning: "El corte actual no muestra ingresos MTR que obliguen compra inmediata; la continuidad depende de stock disponible y pendientes heredados.",
  },
  scoringMl: {
    label: "Scoring ML",
    short: "Scoring ML",
    meaning: "Priorización probabilística de riesgo operativo. Ayuda a enfocar revisión, pero no reemplaza ni MTR ni la lógica validada del sistema.",
  },
};

export function operationalMeaning(key: OperationalTermKey) {
  return OPERATIONAL_DICTIONARY[key].meaning;
}

export function operationalLabel(key: OperationalTermKey) {
  return OPERATIONAL_DICTIONARY[key].label;
}

export function operationalShort(key: OperationalTermKey) {
  return OPERATIONAL_DICTIONARY[key].short;
}
