import { getQuality } from '@/services';
import KpiCard from '@/components/cards/KpiCard';

export const dynamic = 'force-dynamic';

export default async function CalidadPage() {
  const { parkQualityScore, grade, trend, components, improvements, movementCompleteness } = await getQuality();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Calidad de datos</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Park Quality Score · gold_park_quality · Tendencia histórica</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Park Quality Score', value:`${parkQualityScore}/100`, color:'text-blue-700',   note:`Jun 2026 · Grado ${grade}` },
          { label:'Grado',             value:grade,                      color:'text-blue-700',   note:'Rango A: ≥90' },
          { label:'Snapshots reales',  value:'1',                        color:'text-amber-700',  note:'Jun 26 real, anteriores simulados' },
          { label:'Quality movimientos',value:'61.4',                    color:'text-orange-700', note:'fact_movements' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-slate-400 mt-1">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Componentes del Park Quality Score</h2>
        <div className="space-y-3">
          {components.map(c => {
            const color = c.score >= 95 ? '#1a7a4a' : c.score >= 80 ? '#1d6fa5' : c.score >= 60 ? '#b06000' : '#c0392b';
            return (
              <div key={c.component} className="flex items-center gap-3">
                <div className="w-36 text-[12px] text-slate-600 text-right flex-shrink-0">
                  {c.component} ({Math.round(c.weight * 100)}%)
                </div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width:`${c.score}%`, background:color }} />
                </div>
                <div className="w-10 text-[12px] font-bold text-right flex-shrink-0" style={{ color }}>{c.score}</div>
                <div className="w-20 text-[11px] text-slate-400 text-right">→ {c.contribution} pts</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <span className="text-[12px] text-slate-500">Score total:</span>
          <span className="text-lg font-bold text-blue-700">
            {components.reduce((a, c) => a + c.contribution, 0).toFixed(1)} / 100
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Tendencia histórica — Park Quality Score</h2>
        <div className="flex items-end gap-6 flex-wrap">
          {trend.map((t, i) => {
            const h = Math.round((t.parkQuality / 100) * 140);
            const color = t.parkQuality >= 90 ? '#1a7a4a' : t.parkQuality >= 85 ? '#1d6fa5' : '#b06000';
            const isReal = i === trend.length - 1;
            return (
              <div key={t.month} className="flex flex-col items-center gap-2 flex-1 min-w-[80px]">
                <div className="text-[13px] font-bold" style={{ color }}>{t.parkQuality}</div>
                <div className="relative w-full">
                  <div className="w-full rounded-t-lg" style={{ height:`${h}px`, background:color }} />
                  {!isReal && (
                    <div className="absolute inset-0 bg-white/40 rounded-t-lg flex items-center justify-center">
                      <span className="text-[9px] text-white font-bold">sim.</span>
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 text-center">{t.month}</div>
                <div className="text-[10px] text-slate-400">{t.totalAssets} eq.</div>
                {isReal && <div className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Real</div>}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">Sep 25, Dic 25, Mar 26: snapshots simulados. Jun 26: primer snapshot real.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-[13px] font-semibold text-slate-600">Oportunidades de mejora — quick wins priorizados</h2>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100">
              {['Problema','N°','Impacto score','Acción en Silver','Esfuerzo'].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {improvements.map((q, i) => (
              <tr key={q.problem} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2?'bg-slate-50/30':''}`}>
                <td className="px-4 py-2.5 font-medium text-slate-700">{q.problem}</td>
                <td className="px-4 py-2.5 text-slate-600">{q.count}</td>
                <td className="px-4 py-2.5">
                  {q.impact != null
                    ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">{q.impact} pts</span>
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{q.action}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    q.effort === 'Bajo' ? 'bg-emerald-100 text-emerald-700' :
                    q.effort === 'Medio' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>{q.effort}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-[13px] font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Calidad de fact_movements — completitud por campo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {movementCompleteness.map(kpi => <KpiCard key={kpi.field} {...kpi} />)}
        </div>
      </div>
    </div>
  );
}
