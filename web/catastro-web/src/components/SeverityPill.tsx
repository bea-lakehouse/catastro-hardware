import React from "react";
import type { Severidad } from "@/lib/types";

export function SeverityPill({ sev }: { sev: Severidad }) {
  const cls =
    sev === "CRITICAL"
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : sev === "WARN"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : sev === "INFO"
      ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs border ${cls}`}>
      {sev}
    </span>
  );
}
