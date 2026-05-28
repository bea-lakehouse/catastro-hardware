const UI_TIME_ZONE = "America/Santiago";

function dateParts(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: UI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "2026",
    month: parts.find((part) => part.type === "month")?.value ?? "05",
    day: parts.find((part) => part.type === "day")?.value ?? "25",
  };
}

export function getUiVisualUpdatedAtIso(now: Date = new Date()): string {
  const { year, month, day } = dateParts(now);
  return `${year}-${month}-${day}`;
}

export function getUiVisualUpdatedAtLabel(now: Date = new Date()): string {
  const { year, month, day } = dateParts(now);
  return `${day}-${month}-${year}`;
}
