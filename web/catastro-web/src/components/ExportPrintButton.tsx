"use client";

export default function ExportPrintButton({
  label = "Imprimir o guardar PDF",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="catastro-button-primary print:hidden rounded-full px-4 py-2 text-sm"
    >
      {label}
    </button>
  );
}
