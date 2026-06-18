'use client';
import { useState } from 'react';
import type { GapBySource, RecordToFix, ChecklistStep, ChecklistPhase, TemplateField, OperationRule } from '@/lib/types';

// ── Priority pill ─────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, string> = {
  CRÍTICA: 'bg-red-100 text-red-700',
  ALTA:    'bg-orange-100 text-orange-700',
  MEDIA:   'bg-amber-100 text-amber-700',
  BAJA:    'bg-slate-100 text-slate-600',
};
const TYPE_STYLES: Record<string, string> = {
  ingreso:     'bg-emerald-100 text-emerald-700',
  salida:      'bg-red-100 text-red-700',
  compra:      'bg-blue-100 text-blue-700',
  asignacion:  'bg-amber-100 text-amber-700',
  recuperacion:'bg-orange-100 text-orange-700',
  baja:        'bg-slate-100 text-slate-600',
};

function Pill({ label, style }: { label: string; style: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${style}`}>{label}</span>;
}

// ── IBar ──────────────────────────────────────────────────────
function IBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold w-9 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// GapsBySourceTable
// ════════════════════════════════════════════════════════════════
export function GapsBySourceTable({ gaps }: { gaps: GapBySource[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Hoja origen','Movs.','Sin serial','Sin fecha','Sin cliente','Sin gestor','Serial OK','Fecha OK','Inferido','Prioridad','Acción'].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-3 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gaps.map((g, i) => (
              <tr key={g.source} className={[
                'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                g.isInferred ? 'bg-slate-50/50' : '',
                i % 2 === 1 && !g.isInferred ? 'bg-white' : '',
              ].join(' ')}>
                <td className="px-3 py-2.5 font-medium text-slate-700">
                  {g.sourceShort}
                  {g.isInferred && <span className="ml-1 text-[10px] text-slate-400">(inferido)</span>}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-600">{g.total}</td>
                <td className={`px-3 py-2.5 text-center font-semibold ${g.missingSerial > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{g.missingSerial}</td>
                <td className={`px-3 py-2.5 text-center font-semibold ${g.missingDate > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{g.missingDate}</td>
                <td className={`px-3 py-2.5 text-center ${g.missingClient > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{g.missingClient}</td>
                <td className={`px-3 py-2.5 text-center ${g.missingManager > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{g.missingManager}</td>
                <td className="px-3 py-2.5 min-w-[100px]"><IBar pct={g.pctSerial} color="#1d6fa5" /></td>
                <td className="px-3 py-2.5 min-w-[100px]"><IBar pct={g.pctDate}   color="#b06000" /></td>
                <td className="px-3 py-2.5 text-center">
                  {g.isInferred ? <Pill label="Sí" style="bg-slate-100 text-slate-500" /> : <Pill label="No" style="bg-blue-100 text-blue-700" />}
                </td>
                <td className="px-3 py-2.5"><Pill label={g.priority} style={PRIORITY_STYLES[g.priority] ?? ''} /></td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500">{g.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// RecordsToFixTable
// ════════════════════════════════════════════════════════════════
const ISSUE_DOT: Record<number, string> = {
  4: 'bg-red-600 text-white',
  3: 'bg-orange-600 text-white',
  2: 'bg-amber-500 text-white',
  1: 'bg-blue-600 text-white',
};

export function RecordsToFixTable({ records }: { records: RecordToFix[] }) {
  const [typeFilter,     setTypeFilter]     = useState('');
  const [sourceFilter,   setSourceFilter]   = useState('');
  const [issueFilter,    setIssueFilter]    = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search,         setSearch]         = useState('');

  const filtered = records.filter(r => {
    if (typeFilter   && r.type   !== typeFilter)                          return false;
    if (sourceFilter && !r.source.includes(sourceFilter))                 return false;
    if (issueFilter  && !r.issues.includes(issueFilter as RecordToFix['issues'][0])) return false;
    if (priorityFilter && r.issueCount !== parseInt(priorityFilter))     return false;
    if (search) {
      const hay = [r.employee, r.serial, r.client, r.manager, r.type].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Filters */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 items-center">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Filtrar:</span>
        {[
          { value: typeFilter, set: setTypeFilter, opts: [['','Tipo movimiento'],['ingreso','Ingreso'],['salida','Salida'],['compra','Compra'],['asignacion','Asignación']] },
          { value: sourceFilter, set: setSourceFilter, opts: [['','Hoja origen'],['Salidas','Salidas'],['Ingresos','Ingresos'],['Compras','Compras']] },
          { value: issueFilter, set: setIssueFilter, opts: [['','Issue'],['sin_serial','Sin serial'],['sin_fecha','Sin fecha'],['sin_cliente','Sin cliente'],['sin_gestor','Sin gestor']] },
          { value: priorityFilter, set: setPriorityFilter, opts: [['','N° issues'],['4','4 (crítico)'],['3','3 (alto)'],['2','2 (medio)'],['1','1']] },
        ].map((f, i) => (
          <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] bg-white text-slate-600 focus:outline-none focus:border-blue-400">
            {f.opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar empleado, serial, cliente…"
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-400" />
        <span className="ml-auto text-[12px] font-semibold text-blue-600">{filtered.length} registros</span>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[440px]">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              {['Issues','Tipo','Empleado','Serial','Fecha','Cliente','Gestor IT','Fuente','Campos faltantes'].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-3 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.movementId} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2?'':'bg-white'}`}>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${ISSUE_DOT[Math.min(r.issueCount, 4)] ?? 'bg-slate-200 text-slate-600'}`}>
                    {r.issueCount}
                  </span>
                </td>
                <td className="px-3 py-2"><Pill label={r.type} style={TYPE_STYLES[r.type] ?? 'bg-slate-100 text-slate-500'} /></td>
                <td className="px-3 py-2 font-medium text-slate-700">{r.employee ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.serial ?? <span className="text-red-500">—</span>}</td>
                <td className="px-3 py-2 text-slate-600">{r.date ?? <span className="text-red-500">—</span>}</td>
                <td className="px-3 py-2 text-slate-500">{r.client ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-slate-500">{r.manager ?? <span className="text-red-500">—</span>}</td>
                <td className="px-3 py-2 text-[11px] text-slate-400">{r.source}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.issues.map(iss => (
                      <span key={iss} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                        {iss.replace('sin_', '').replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-[13px]">Sin registros con esos filtros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MonthlyChecklist
// ════════════════════════════════════════════════════════════════
const PHASE_STYLES: Record<ChecklistPhase, { bg: string; text: string; icon: string }> = {
  PREPARACION:  { bg:'bg-amber-100',  text:'text-amber-800',  icon:'📋' },
  CARGA:        { bg:'bg-blue-100',   text:'text-blue-800',   icon:'📤' },
  TRANSFORMACION:{ bg:'bg-emerald-100',text:'text-emerald-800',icon:'⚙️' },
  GOLD:         { bg:'bg-purple-100', text:'text-purple-800', icon:'🏅' },
  VALIDACION:   { bg:'bg-red-100',    text:'text-red-800',    icon:'✅' },
  PUBLICACION:  { bg:'bg-teal-100',   text:'text-teal-800',   icon:'🚀' },
};

export function MonthlyChecklist({ steps }: { steps: ChecklistStep[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (step: string) => setDone(prev => {
    const next = new Set(prev);
    next.has(step) ? next.delete(step) : next.add(step);
    return next;
  });

  const phases = [...new Set(steps.map(s => s.phase))];
  const total  = steps.length;
  const completed = done.size;

  return (
    <div className="space-y-1">
      {/* Progress header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Progreso del cierre</div>
          <div className="text-2xl font-bold text-blue-700">{completed} / {total} pasos</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(completed/total)*100}%` }} />
          </div>
          <button onClick={() => setDone(new Set())}
            className="text-[11px] px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
            Resetear
          </button>
        </div>
      </div>

      {phases.map(phase => {
        const phaseSteps = steps.filter(s => s.phase === phase);
        const ps = PHASE_STYLES[phase];
        return (
          <div key={phase} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{ps.icon}</span>
              <span className={`px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${ps.bg} ${ps.text}`}>
                {phase}
              </span>
              <span className="text-[11px] text-slate-400">{phaseSteps.length} pasos</span>
            </div>
            <div className="space-y-1">
              {phaseSteps.map(s => {
                const isDone = done.has(s.step);
                return (
                  <div key={s.step}
                    className={`grid grid-cols-[36px_1fr_120px_80px_1fr_36px] gap-3 items-center px-4 py-2.5 rounded-lg border transition-all cursor-pointer ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'}`}
                    onClick={() => toggle(s.step)}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${isDone ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
                      {isDone ? '✓' : s.step}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-slate-800">{s.task}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{s.description}</div>
                    </div>
                    <div className="text-[11px] font-medium text-blue-600 text-center">{s.responsible}</div>
                    <div className="text-[11px] text-slate-400 text-center">{s.time}</div>
                    <div className="text-[11px] text-emerald-600 leading-snug">{s.successCriteria}</div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isDone ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                      {isDone && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// StrategicMessage
// ════════════════════════════════════════════════════════════════
export function StrategicMessage() {
  return (
    <div className="bg-[#1b2a4a] rounded-xl p-6">
      <h3 className="text-[12px] font-bold uppercase tracking-widest text-blue-300 mb-3">
        🎯 Mensaje estratégico — Por qué riesgo_percibido_it es la decisión más importante ahora
      </h3>
      <p className="text-[13px] text-blue-100 leading-relaxed">
        El campo <strong className="text-white">riesgo_percibido_it</strong> no es solo para completar un formulario.
        Es la columna que construye las <strong className="text-white">etiquetas supervisadas</strong> para el modelo ML de Asset Risk.
        Cada movimiento completado con una evaluación BAJO / MEDIO / ALTO / CRÍTICO es un registro de entrenamiento.
        Sin este dato, el modelo solo puede hacer clustering no supervisado en diciembre 2026 — menos preciso y no accionable.
      </p>
      <p className="text-[13px] text-blue-100 leading-relaxed mt-3">
        Con 6 meses de evaluaciones completas (julio a noviembre 2026), el dataset tendrá 139+ registros etiquetados
        por el gestor IT que conoce físicamente los equipos.{' '}
        <strong className="text-white">
          Completar riesgo_percibido_it en los 139 movimientos existentes cuesta 3 horas de operación
          y habilita 6 meses de inversión en ML.
        </strong>
      </p>
      <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-400/20 border border-blue-400/40 text-[12px] font-semibold text-blue-200">
        🗓 Target ML: Diciembre 2026
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ITTemplate
// ════════════════════════════════════════════════════════════════
export function ITTemplate({ fields }: { fields: TemplateField[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {fields.map(f => (
        <div key={f.field} className={[
          'rounded-xl border p-4 relative',
          f.isMLTarget ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200 ring-offset-1' :
          f.required   ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50',
        ].join(' ')}>
          <span className={`absolute top-3 right-3 px-1.5 py-0.5 rounded text-[10px] font-bold ${f.required ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
            {f.required ? '* Obligatorio' : 'Opcional'}
          </span>
          <div className={`font-mono text-[12px] font-semibold mb-1 ${f.isMLTarget ? 'text-amber-700' : 'text-blue-800'}`}>
            {f.field}
          </div>
          <div className="text-[10px] text-slate-400 mb-2">Tipo: {f.inputType}</div>
          <div className={`text-[11px] font-mono rounded px-2 py-1.5 mb-2 ${f.isMLTarget ? 'bg-amber-100 text-amber-900' : 'bg-white text-slate-700'} border border-slate-200`}>
            {f.values}
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">{f.description}</p>
          {f.isMLTarget && (
            <div className="mt-2 text-[10px] font-bold text-amber-700">🎯 Base del ML supervisado Dic 2026</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// OperationRulesTable
// ════════════════════════════════════════════════════════════════
export function OperationRulesTable({ rules }: { rules: OperationRule[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Tipo','¿Cuándo registrar?','Campos obligatorios','Deadline','Error común'].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.type} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2?'bg-slate-50/50':'bg-white'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{r.icon}</span>
                    <Pill label={r.type} style={TYPE_STYLES[r.type] ?? 'bg-slate-100 text-slate-500'} />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-[200px]">{r.when}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-blue-700 max-w-[200px]">{r.requiredFields}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">{r.deadline}</span>
                </td>
                <td className="px-4 py-3 text-red-600 text-[11px] max-w-[220px]">{r.commonError}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
