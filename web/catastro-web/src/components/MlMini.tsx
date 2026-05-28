import React from "react";

export function MlMini({
  motivo,
  nivel,
  score,
}: {
  motivo: string | null;
  nivel: string | null;
  score: number | null;
}) {
  if (!nivel) return <span className="text-neutral-500 text-sm">Sin ML</span>;

  const pill =
    nivel === "Alta"
      ? "bg-fuchsia-500/15 border-fuchsia-500/25 text-fuchsia-200"
      : nivel === "Media"
      ? "bg-purple-500/15 border-purple-500/25 text-purple-200"
      : "bg-neutral-500/10 border-neutral-500/20 text-neutral-200";

  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-300 text-sm">{motivo || "—"}</span>
      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs border ${pill}`}>
        {nivel} {typeof score === "number" ? `(${score})` : ""}
      </span>
    </div>
  );
}
