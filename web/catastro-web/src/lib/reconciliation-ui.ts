export function prettyReconciliationStatus(status?: string | null) {
  const key = (status ?? "").toUpperCase();

  switch (key) {
    case "CONCILIADO":
      return "Conciliado";
    case "JIRA_SIN_MATCH_MTR":
    case "JIRA_SOLO":
      return "Jira sin respaldo MTR";
    case "MTR_SIN_MATCH_JIRA":
    case "MTR_SOLO":
      return "Equipo operativo sin ticket Jira";
    case "CREADO_JIRA_SIN_INGRESO_MTR":
      return "Ticket creado pendiente de ingreso";
    case "INCONSISTENCIA_OPERATIVA":
      return "Diferencia operacional";
    case "ESTADO_DISTINTO":
    case "ASIGNADO_JIRA_DISPONIBLE_MTR":
    case "RESERVADO_JIRA_ASIGNADO_MTR":
      return "Diferencia operacional";
    case "SIN_FUENTE":
      return "Sin fuente";
    default:
      return key ? key.replaceAll("_", " ") : "Sin conciliación";
  }
}

export function reconciliationHelp(status?: string | null) {
  const key = (status ?? "").toUpperCase();

  switch (key) {
    case "CONCILIADO":
      return "MTR y Jira cuentan la misma historia para este equipo.";
    case "JIRA_SIN_MATCH_MTR":
    case "JIRA_SOLO":
      return "El equipo existe en Jira/EQUIPAMIENTO, pero todavía no aparece en MTR.";
    case "MTR_SIN_MATCH_JIRA":
    case "MTR_SOLO":
      return "El equipo existe en MTR y aún no tiene respaldo administrativo visible en Jira.";
    case "CREADO_JIRA_SIN_INGRESO_MTR":
      return "Jira ya registró la creación del equipo, pero MTR todavía no muestra su ingreso físico.";
    case "INCONSISTENCIA_OPERATIVA":
      return "Jira y MTR no describen el mismo estado operativo o administrativo para este equipo.";
    case "ESTADO_DISTINTO":
      return "MTR y Jira muestran estados distintos entre operación real y workflow administrativo.";
    case "ASIGNADO_JIRA_DISPONIBLE_MTR":
      return "Jira lo muestra asignado, pero MTR aún lo ve disponible o en stand-by.";
    case "RESERVADO_JIRA_ASIGNADO_MTR":
      return "Jira lo deja reservado, mientras MTR ya registra una asignación real.";
    case "SIN_FUENTE":
      return "No hay datos suficientes para clasificar este equipo.";
    default:
      return "Brecha entre fuentes. No implica un error del sistema por sí sola.";
  }
}

export function prettyOrigin(origin?: string | null) {
  const key = (origin ?? "").toLowerCase();

  if (key === "mtr") return "MTR";
  if (key === "jira") return "JIRA";
  if (key === "conciliado") return "CONCILIADO";
  if (key === "excel:reparados") return "excel:reparados";
  return key ? origin ?? "SIN_ORIGEN" : "SIN_ORIGEN";
}

export function originHelp(origin?: string | null) {
  const key = (origin ?? "").toLowerCase();

  if (key === "mtr") return "Movimiento físico u operativo leído desde MTR.";
  if (key === "jira") return "Evento administrativo leído desde Jira/EQUIPAMIENTO.";
  if (key === "conciliado") return "MTR y Jira representan el mismo evento y se muestran conciliados.";
  if (key === "excel:reparados") return "Evento proveniente del histórico de reparaciones cargado por Excel.";
  return "Origen no identificado.";
}

export function isSpotlightSku(id?: string | null) {
  const key = (id ?? "").toUpperCase().trim();
  return /^SKU-(62[3-9]|63[0-2])$/.test(key);
}

export function reconciliationTone(status?: string | null) {
  const key = (status ?? "").toUpperCase();

  if (!key || key === "CONCILIADO") return "success";
  if (key === "CREADO_JIRA_SIN_INGRESO_MTR") return "warning";
  if (
    key === "INCONSISTENCIA_OPERATIVA" ||
    key === "ESTADO_DISTINTO" ||
    key === "ASIGNADO_JIRA_DISPONIBLE_MTR" ||
    key === "RESERVADO_JIRA_ASIGNADO_MTR"
  ) {
    return "attention";
  }
  if (
    key === "JIRA_SIN_MATCH_MTR" ||
    key === "JIRA_SOLO" ||
    key === "MTR_SIN_MATCH_JIRA" ||
    key === "MTR_SOLO"
  ) {
    return "critical";
  }
  return "neutral";
}

export function reconciliationClasses(status?: string | null) {
  const tone = reconciliationTone(status);

  if (tone === "success") return "border-emerald-300/60 bg-emerald-100/80 text-emerald-800";
  if (tone === "warning") return "border-amber-300/60 bg-amber-100/80 text-amber-800";
  if (tone === "attention") return "border-orange-300/70 bg-orange-100/80 text-orange-800";
  if (tone === "critical") return "border-rose-300/60 bg-rose-100/80 text-rose-800";
  return "border-[color:var(--cat-border)] bg-white/70 text-[var(--cat-text-muted)]";
}

export function reconciliationRate(input?: {
  equipos_conciliados?: number | null;
  inconsistencias_mtr_jira?: number | null;
  jira_sin_match_mtr?: number | null;
}) {
  const conciliados = Number(input?.equipos_conciliados ?? 0);
  const inconsistencias = Number(input?.inconsistencias_mtr_jira ?? 0);
  const jiraSinMtr = Number(input?.jira_sin_match_mtr ?? 0);
  const denominator = conciliados + inconsistencias + jiraSinMtr;

  if (!denominator) return 0;
  return (conciliados / denominator) * 100;
}
