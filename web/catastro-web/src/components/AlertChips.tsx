import React from "react";

export function AlertChips({
  alertasResumen,
  jiraOpenCount,
}: {
  alertasResumen: string | null;
  jiraOpenCount: number;
}) {
  const chips: Array<{ label: string; cls: string }> = [];

  if ((jiraOpenCount || 0) > 0) {
    chips.push({ label: `Jira: ${jiraOpenCount}`, cls: "bg-[rgba(0,198,255,0.1)] border-[rgba(0,198,255,0.24)] text-[var(--cat-primary)]" });
  }

  if (alertasResumen && alertasResumen.trim() && alertasResumen !== "Sin alertas") {
    alertasResumen.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3).forEach((s) => {
      chips.push({ label: s, cls: "bg-[rgba(17,24,39,0.78)] border-[rgba(63,98,182,0.22)] text-[var(--cat-text-muted)]" });
    });
  } else {
    chips.push({ label: "Sin alertas", cls: "bg-[rgba(17,24,39,0.7)] border-[rgba(63,98,182,0.18)] text-[var(--cat-text-soft)]" });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <span key={i} className={`inline-flex items-center px-2 py-1 rounded-lg text-xs border ${c.cls}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
}
