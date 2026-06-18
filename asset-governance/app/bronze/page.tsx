import { getBronze } from '@/services';

const STATUS_LABEL = { ok: 'OK', warning: 'Warning', error: 'Error' };
const STATUS_STYLE = {
  ok:      'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error:   'bg-red-100 text-red-700',
};

export const dynamic = 'force-dynamic';

export default async function BronzePage() {
  const { sources, totalRecords, withWarnings, lastLoad } = getBronze();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Capa Bronze</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Ingestión de datos crudos sin transformación · Inmutable · Trazabilidad completa
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Fuentes activas',   value: sources.length, color:'text-blue-700' },
          { label:'Total registros',   value: totalRecords,   color:'text-slate-700' },
          { label:'Con advertencias',  value: withWarnings,   color:'text-amber-700' },
          { label:'Última carga',      value: lastLoad,       color:'text-emerald-700' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-[13px] font-semibold text-slate-600">Fuentes de datos · {sources.length} hojas Excel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100">
                {['Nombre','Tipo','Hoja origen','Registros','Estado','Última carga','Sin serial','Sin fecha'].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((s, i) => (
                <tr key={s.name} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2?'bg-slate-50/30':''}`}>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.type}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{s.sheet}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{s.records}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.lastLoad}</td>
                  <td className={`px-4 py-3 font-semibold ${s.missingSerial > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{s.missingSerial}</td>
                  <td className={`px-4 py-3 font-semibold ${s.missingDate > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{s.missingDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-3">Campos de trazabilidad — añadidos en ingesta</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { field:'_source_file',    desc:'Nombre del archivo xlsx cargado' },
            { field:'_source_sheet',   desc:'Nombre de la hoja dentro del Excel' },
            { field:'_load_timestamp', desc:'ISO 8601 del momento de ingesta' },
            { field:'_row_number',     desc:'Número de fila en la hoja de origen' },
          ].map(f => (
            <div key={f.field} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="font-mono text-[11px] font-semibold text-orange-700">{f.field}</div>
              <div className="text-[11px] text-slate-500 mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-slate-400 mt-3">
          Bronze es inmutable: los registros no se modifican tras la ingesta. Cada carga genera un nuevo batch_id.
        </p>
      </div>
    </div>
  );
}
