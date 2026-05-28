const DEFAULT_OPERATIONAL_HORIZON_DAYS = 7;

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function monthStartIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatMonthLabelFromIso(mesISO: string) {
  const [yearRaw, monthRaw] = mesISO.slice(0, 10).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${months[(month || 1) - 1] ?? mesISO} ${year}`;
}

export function getOperationalMonthSummary(
  referenceDate = new Date(),
  horizonDays = DEFAULT_OPERATIONAL_HORIZON_DAYS,
) {
  const operationalDate = addDays(referenceDate, horizonDays);
  const currentMonth = new Date(operationalDate.getFullYear(), operationalDate.getMonth(), 1);
  const previousMonth = new Date(operationalDate.getFullYear(), operationalDate.getMonth() - 1, 1);

  const operationalMonthIso = monthStartIso(currentMonth);
  const previousMonthIso = monthStartIso(previousMonth);

  return {
    operationalMonthIso,
    previousMonthIso,
    operationalMonthLabel: formatMonthLabelFromIso(operationalMonthIso),
    previousMonthLabel: formatMonthLabelFromIso(previousMonthIso),
  };
}
