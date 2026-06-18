import { getForecast } from '@/services';

const ML_STATUS_STYLES = {
  done:    'bg-emerald-50 border-emerald-200',
  next:    'bg-blue-50 border-blue-200',
  planned: 'bg-amber-50 border-amber-200',
  future:  'bg-slate-50 border-slate-200',
};
const ML_PILL_STYLES = {
  done:    'bg-emerald-100 text-emerald-700',
  next:    'bg-blue-100 text-blue-700',
  planned: 'bg-amber-100 text-amber-700',
  future:  'bg-slate-100 text-slate-500',
};
const ML_PILL_LABELS = { done:'Operativo', next:'Próximo', planned:'Planificado', future:'Futuro' };

export const dynamic = 'force-dynamic';

export default async function ForecastPage() {
  const { renovation, summary, growth, mlRoadmap } = await getForecast();
  const maxEq = Math.max(...growth.map(p => p.eq));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Forecast</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">gold_forecast_v2 · Reglas de negocio explicables · Roadmap ML</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {renovation.map(r => (
          <div key={r.period} className={`rounded-xl border p-4 ${r.bg}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60">{r.period}</div>
            <div className={`text-3xl font-bold ${r.color} leading-none mb-1`}>{r.count}</div>
            <div className={`text-[14px] font-semibold ${r.color}`}>
              {r.cost > 0 ? `$${r.cost.toLocaleString()}` : '$0'}
            </div>
            <div className="text-[11px] opacity-60 mt-1">{r.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Presupuesto total 12m', value:`$${(summary.budget12mUSD/1000).toFixed(1)}K`,   color:'text-red-700' },
          { label:'Parque proy. 6m',       value:String(summary.projectedPark6m),                  color:'text-blue-700' },
          { label:'Parque proy. 12m',      value:String(summary.projectedPark12m),                 color:'text-emerald-700' },
          { label:'Crecimiento neto',      value:`+${summary.netGrowthPerMonth}`,                  color:'text-slate-700' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Proyección de crecimiento del parque</h2>
        <div className="flex items-end gap-2 overflow-x-auto pb-1">
          {growth.map((p, i) => {
            const h = Math.round(((p.eq - 88) / (maxEq - 88)) * 120) + 30;
            return (
              <div key={p.mes} className="flex flex-col items-center gap-1.5 flex-shrink-0 flex-1 min-w-[48px]">
                <div className="text-[11px] font-semibold text-blue-700">{p.eq}</div>
                <div className="w-full rounded-t-lg bg-blue-500 transition-all"
                  style={{ height:`${h}px`, opacity: 0.7 + i * 0.025 }} />
                <div className="text-[10px] text-slate-400 text-center">{p.mes}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Roadmap hacia ML</h2>
        <div className="space-y-3">
          {mlRoadmap.map(m => (
            <div key={m.phase}
              className={`flex gap-4 items-start p-3 rounded-lg border ${ML_STATUS_STYLES[m.status]}`}>
              <div className="flex-shrink-0 text-center w-20">
                <div className="text-[10px] font-bold text-slate-400 uppercase">{m.phase}</div>
                <div className="text-[11px] text-slate-500">{m.date}</div>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-slate-800 mb-0.5">{m.label}</div>
                <div className="text-[12px] text-slate-500">{m.desc}</div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${ML_PILL_STYLES[m.status]}`}>
                {ML_PILL_LABELS[m.status]}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-700">
          <strong>Prerrequisito crítico:</strong> completar riesgo_percibido_it en los 139 movimientos (3h) y ejecutar el checklist mensual desde julio 2026.
        </div>
      </div>
    </div>
  );
}
