import { getGold } from '@/services';

const STATUS_STYLES = {
  operational: { pill:'bg-emerald-100 text-emerald-700', dot:'bg-emerald-500', label:'Operativo' },
  partial:     { pill:'bg-amber-100 text-amber-700',     dot:'bg-amber-500',   label:'Parcial'   },
  designed:    { pill:'bg-blue-100 text-blue-700',       dot:'bg-blue-500',    label:'Diseñado'  },
};

export const dynamic = 'force-dynamic';

export default async function GoldPage() {
  const { marts, operational, partial, apiEndpoints } = getGold();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Capa Gold</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          7 marts analíticos · APIs diseñadas · Preparación para ML Dic 2026
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Marts operativos', value: operational, color:'text-emerald-700' },
          { label:'Marts parciales',  value: partial,     color:'text-amber-700'   },
          { label:'APIs diseñadas',   value: 8,           color:'text-blue-700'    },
          { label:'ML readiness',     value: '1/6',       color:'text-orange-700'  },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {marts.map(m => {
          const s = STATUS_STYLES[m.status];
          return (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-300 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className="font-mono text-[13px] font-bold text-amber-700">{m.name}</span>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.pill}`}>{s.label}</span>
                </div>
                {m.recordCount != null && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-slate-700">{m.recordCount}</div>
                    <div className="text-[10px] text-slate-400">registros</div>
                  </div>
                )}
              </div>
              <p className="text-[12px] text-slate-600 leading-relaxed mb-3">{m.description}</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex gap-2">
                  <span className="text-slate-400 w-16 flex-shrink-0">Fuente:</span>
                  <span className="font-mono text-slate-600">{m.source}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-16 flex-shrink-0">Valor:</span>
                  <span className="text-slate-600">{m.businessValue}</span>
                </div>
                {m.lastUpdated && (
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-16 flex-shrink-0">Actualiz.:</span>
                    <span className="text-slate-500">{m.lastUpdated}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-[13px] font-semibold text-slate-600">API REST — endpoints Gold</h2>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100">
              {['Método','Endpoint','Mart','Parámetros','Estado'].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apiEndpoints.map((r, i) => (
              <tr key={r.path} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2?'bg-slate-50/30':''}`}>
                <td className="px-4 py-2.5">
                  <span className={`font-mono text-[11px] font-bold ${r.method === 'GET' ? 'text-emerald-700' : 'text-blue-700'}`}>{r.method}</span>
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-blue-700">{r.path}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-amber-700">{r.mart}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.params}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    r.status === 'designed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {r.status === 'designed' ? 'Diseñado' : 'Pendiente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
