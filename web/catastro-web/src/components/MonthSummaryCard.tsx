import React from "react";

type Props = {
  movimientosTotal: number
  ingresos: number
  salidas: number
  cambios: number
  mac: number
  win: number
  nuevos: number
  usados: number
  extranjerosCore: number
  extranjerosStaffing: number
  impactoParquePct: number
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString("es-CL")
}

export default function MonthSummaryCard({
  movimientosTotal,
  ingresos,
  salidas,
  cambios,
  mac,
  win,
  nuevos,
  usados,
  extranjerosCore,
  extranjerosStaffing,
  impactoParquePct
}: Props) {

  return (
    <div className="catastro-panel mb-5 rounded-xl p-4">

      <div className="mb-2 text-sm text-[var(--cat-text-soft)]">
        Resumen del mes
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

        <div>
          <div className="text-[var(--cat-text-soft)]">Movimientos</div>
          <div className="font-semibold text-[var(--cat-text)]">
            {fmt(movimientosTotal)}
          </div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Ingresos</div>
          <div className="text-[var(--cat-text)]">{fmt(ingresos)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Salidas</div>
          <div className="text-[var(--cat-text)]">{fmt(salidas)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Cambios</div>
          <div className="text-[var(--cat-text)]">{fmt(cambios)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">MAC</div>
          <div className="text-[var(--cat-text)]">{fmt(mac)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">WIN</div>
          <div className="text-[var(--cat-text)]">{fmt(win)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Nuevos</div>
          <div className="text-[var(--cat-text)]">{fmt(nuevos)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Usados</div>
          <div className="text-[var(--cat-text)]">{fmt(usados)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Core extranjeros</div>
          <div className="text-[var(--cat-text)]">{fmt(extranjerosCore)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Staffing extranjeros</div>
          <div className="text-[var(--cat-text)]">{fmt(extranjerosStaffing)}</div>
        </div>

        <div>
          <div className="text-[var(--cat-text-soft)]">Impacto parque</div>
          <div className="text-[var(--cat-text)]">{impactoParquePct}%</div>
        </div>

      </div>
    </div>
  )
}
