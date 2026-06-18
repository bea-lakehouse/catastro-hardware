import { getMedallion } from '@/services';

const STATUS_STYLES = {
  ok:          'bg-emerald-50 border-emerald-200',
  warning:     'bg-amber-50 border-amber-200',
  error:       'bg-red-50 border-red-200',
  operational: 'bg-emerald-100 text-emerald-700',
  partial:     'bg-amber-100 text-amber-700',
  designed:    'bg-blue-100 text-blue-700',
};

function LayerHeader({ color, label, subtitle }: { color: string; label: string; subtitle: string }) {
  return (
    <div className={`rounded-t-xl px-5 py-3 ${color}`}>
      <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">{subtitle}</div>
      <div className="text-lg font-bold text-white">{label}</div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default async function MedallionPage() {
  const { bronze, silver, gold, pillars } = getMedallion();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Arquitectura Medallion</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Bronze → Silver → Gold · Trazabilidad completa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* BRONZE */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <LayerHeader color="bg-orange-700" label="Bronze" subtitle="Capa 1 · Raw ingestión" />
            <div className="bg-white p-4 space-y-3">
              <p className="text-[12px] text-slate-500">Datos crudos sin transformación. Inmutable y con trazabilidad completa.</p>
              <div className="space-y-1.5">
                {bronze.map(s => (
                  <div key={s.name} className={`p-2.5 rounded-lg border ${STATUS_STYLES[s.status] ?? 'border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-slate-700">{s.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {s.status === 'ok' ? 'OK' : 'Warning'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{s.records} registros · {s.lastLoad}</div>
                    {(s.missingSerial > 0 || s.missingDate > 0) && (
                      <div className="text-[10px] text-amber-600 mt-0.5">
                        {s.missingSerial > 0 && `${s.missingSerial} sin serial `}
                        {s.missingDate > 0 && `${s.missingDate} sin fecha`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-0.5">
                {['_source_file','_source_sheet','_load_timestamp','_row_number'].map(f => (
                  <div key={f} className="text-[10px] font-mono text-slate-400">{f}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SILVER */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <LayerHeader color="bg-emerald-700" label="Silver" subtitle="Capa 2 · Normalizado" />
            <div className="bg-white p-4 space-y-3">
              <p className="text-[12px] text-slate-500">Limpieza, estandarización y reglas de negocio centralizadas.</p>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Reglas de normalización</div>
              <div className="space-y-2">
                {silver.map(r => (
                  <div key={r.field} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="font-mono text-[11px] font-semibold text-blue-700">{r.function}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{r.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* GOLD */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <LayerHeader color="bg-amber-600" label="Gold" subtitle="Capa 3 · Analítico" />
            <div className="bg-white p-4 space-y-2">
              <p className="text-[12px] text-slate-500">Marts analíticos listos para dashboard y API.</p>
              {gold.map(m => (
                <div key={m.id} className="p-2.5 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-amber-700">{m.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[m.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {m.status === 'operational' ? 'Op.' : m.status === 'partial' ? 'Parcial' : 'Dis.'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{m.businessValue}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GOVERNANCE PILLAR */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <LayerHeader color="bg-[#1b2a4a]" label="Gobierno" subtitle="Transversal · Todas las capas" />
            <div className="bg-white p-4 space-y-2">
              <p className="text-[12px] text-slate-500">Aplicado a través de toda la arquitectura.</p>
              {pillars.map(p => (
                <div key={p.title} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{p.icon}</span>
                    <span className="text-[12px] font-semibold text-slate-700">{p.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Flujo de datos — carga incremental</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label:'xlsx', sub:'Fuente', bg:'bg-orange-100 text-orange-800' },
            { label:'→', sub:'', bg:'' },
            { label:'Bronze', sub:'Raw inmutable', bg:'bg-orange-100 text-orange-800' },
            { label:'→', sub:'', bg:'' },
            { label:'Silver', sub:'Normaliza · UPSERT serial', bg:'bg-emerald-100 text-emerald-800' },
            { label:'→', sub:'', bg:'' },
            { label:'Gold', sub:'Recalcula 7 marts', bg:'bg-amber-100 text-amber-800' },
            { label:'→', sub:'', bg:'' },
            { label:'fact_snapshot', sub:'monthly', bg:'bg-blue-100 text-blue-800' },
            { label:'→', sub:'', bg:'' },
            { label:'API / Dashboard', sub:'Publicación', bg:'bg-slate-100 text-slate-700' },
          ].map((step, i) => step.label === '→'
            ? <span key={i} className="text-slate-300 text-lg">→</span>
            : <div key={i} className={`px-3 py-2 rounded-lg text-center ${step.bg}`}>
                <div className="text-[12px] font-bold">{step.label}</div>
                {step.sub && <div className="text-[10px] opacity-70">{step.sub}</div>}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
