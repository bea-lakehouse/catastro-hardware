import React from "react";

type Props = {
  mesLabel: string;
  movimientosTotal: number;
  ingresosTotal: number;
  salidasTotal: number;
  cambiosTotal: number;
  macMes: number;
  winMes: number;
  equiposNuevos: number;
  equiposUsados: number;
  extranjerosCore: number;
  extranjerosStaffing: number;
  equiposRotacion: number;
  impactoPctParque: number;
  insightOperativo?: string;
};

function fmt(n: number) {
  return Number(n || 0).toLocaleString("es-CL");
}

export default function MtrMonthCard({
  mesLabel,
  movimientosTotal,
  ingresosTotal,
  salidasTotal,
  cambiosTotal,
  macMes,
  winMes,
  equiposNuevos,
  equiposUsados,
  extranjerosCore,
  extranjerosStaffing,
  equiposRotacion,
  impactoPctParque,
  insightOperativo,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <h3 className="text-lg font-semibold text-white">{mesLabel}</h3>

      <div className="mt-3 text-sm text-white/70">
        {fmt(movimientosTotal)} movimientos · {fmt(ingresosTotal)} ingresos · {fmt(salidasTotal)} salidas · {fmt(cambiosTotal)} cambios
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">

        <div>
          <span className="text-white/50">Mix HW</span>
          <div className="text-white">
            MAC {fmt(macMes)} · WIN {fmt(winMes)}
          </div>
        </div>

        <div>
          <span className="text-white/50">Condición</span>
          <div className="text-white">
            Nuevos {fmt(equiposNuevos)} · Usados {fmt(equiposUsados)}
          </div>
        </div>

        <div>
          <span className="text-white/50">Extranjeros</span>
          <div className="text-white">
            Core {fmt(extranjerosCore)} · Staffing {fmt(extranjerosStaffing)}
          </div>
        </div>

        <div>
          <span className="text-white/50">Gobierno</span>
          <div className="text-white">
            Rotación {fmt(equiposRotacion)} · Impacto {impactoPctParque}%
          </div>
        </div>

      </div>

      {insightOperativo && (
        <div className="mt-4 text-xs text-white/60">
          {insightOperativo}
        </div>
      )}
    </div>
  );
}
