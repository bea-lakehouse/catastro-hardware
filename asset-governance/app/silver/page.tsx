import { getSilver, getQuality } from '@/services';
import KpiCard from '@/components/cards/KpiCard';

export const dynamic = 'force-dynamic';

export default async function SilverPage() {
  const { rules } = await getSilver();
  const { movementCompleteness: completenessKpis } = await getQuality();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Capa Silver</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Normalización · Estandarización · Reglas de negocio centralizadas · dim_asset + fact_movements
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-3">dim_asset — esquema unificado · PK: serial</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { group:'Identidad',    fields:['serial (PK)','marca','modelo','año','tipo','color'],                     highlight:false },
            { group:'Hardware',     fields:['cpu','ram','disco','pantalla','so'],                                      highlight:false },
            { group:'Estado',       fields:['estado','condicion','estado_resultante'],                                 highlight:false },
            { group:'Asignación',   fields:['empleado','cliente','perfil','ambito','ciudad'],                          highlight:false },
            { group:'Fechas',       fields:['fecha_compra','fecha_mantenimiento','fecha_asignacion'],                  highlight:false },
            { group:'Financiero ★', fields:['valor_nuevo_usd','valor_dep_usd','dep_acumulada_usd','costo_renovacion_usd'], highlight:true },
            { group:'Riesgo ★',     fields:['risk_score','risk_nivel','score_renovacion','candidato_renovacion'],      highlight:true },
            { group:'Calidad',      fields:['calidad_dato','es_duplicado','serial_vacio','sin_cliente'],               highlight:false },
          ].map(g => (
            <div key={g.group} className={`p-3 rounded-lg border ${g.highlight ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${g.highlight ? 'text-blue-600' : 'text-slate-400'}`}>{g.group}</div>
              {g.fields.map(f => (
                <div key={f} className={`font-mono text-[11px] py-0.5 ${g.highlight ? 'text-blue-700 font-semibold' : 'text-slate-500'}`}>{f}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-[13px] font-semibold text-slate-600">Reglas de normalización — centralizadas en Silver</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Cero lógica de negocio en el frontend.</p>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100">
              {['Campo','Función','Transformación'].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.field} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2?'bg-slate-50/30':''}`}>
                <td className="px-4 py-3 font-semibold text-slate-700">{r.field}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-emerald-700">{r.function}</td>
                <td className="px-4 py-3 text-slate-500">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-[13px] font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Calidad por campo en fact_movements
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {completenessKpis.map(kpi => (
            <KpiCard key={kpi.field} {...kpi} />
          ))}
        </div>
      </div>
    </div>
  );
}
