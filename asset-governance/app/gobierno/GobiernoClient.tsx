'use client';
import { useState } from 'react';
import type { GobiernoPayload } from '@/services';
import KpiCard from '@/components/cards/KpiCard';
import { AlertCard, MaturityCard } from '@/components/cards/StatusCard';
import {
  GapsBySourceTable, RecordsToFixTable, MonthlyChecklist,
  StrategicMessage, ITTemplate, OperationRulesTable,
} from '@/components/governance/GovernanceComponents';

const TABS = [
  { id:'resumen',   label:'Resumen ejecutivo' },
  { id:'kpis',      label:'KPIs completitud' },
  { id:'gaps',      label:'Gaps por hoja' },
  { id:'criticos',  label:'Registros a corregir' },
  { id:'plantilla', label:'Plantilla IT' },
  { id:'reglas',    label:'Reglas de operación' },
  { id:'checklist', label:'Checklist mensual' },
  { id:'score',     label:'Data Governance Score' },
];

export default function GobiernoClient({ data }: { data: GobiernoPayload }) {
  const [tab, setTab] = useState('resumen');
  const {
    summary: s, completenessKpis, gapsBySource, recordsToFix,
    checklistSteps, operationRules, templateFields,
    maturityLevels, maturityProjection, dgScoreFormula,
  } = data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Gobierno del Dato</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">gold_gobierno_datos · Calidad operacional · fact_movements</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={[
              'px-3 py-2 text-[12px] font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap',
              tab === t.id
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-slate-500 hover:text-blue-600 hover:bg-slate-50',
            ].join(' ')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          <AlertCard level="warning"
            title={`Estado: Regular — Nivel ${s.dgLevel} ${s.dgLevelLabel}`}
            message="La arquitectura es correcta. Los datos necesitan trabajo operacional, no código adicional." />
          <AlertCard level="error"
            title="Principal brecha"
            message={`gestor_it_responsable: 15.8%. Segunda brecha: ${s.secondaryGap}`} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label:'Quality Score movimientos', value:`${s.qualityScore}/100`, color:'text-amber-600' },
              { label:'Quality Score solo reales', value:`${s.qualityScoreReal}/100`, color:'text-amber-600' },
              { label:'Data Governance Score',     value:`${s.dgScore}/100`, color:'text-orange-600' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{k.label}</div>
                <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Completitud por campo</div>
            {completenessKpis.map(k => {
              const c = { green:'#1a7a4a', yellow:'#d97706', orange:'#d35400', red:'#c0392b' }[k.semaphore];
              return (
                <div key={k.field} className="flex items-center gap-3 mb-2 text-[12px]">
                  <div className="w-44 text-right text-slate-500 flex-shrink-0">{k.label}</div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${k.pct}%`, background:c }} />
                  </div>
                  <div className="w-10 font-bold text-right flex-shrink-0" style={{ color:c }}>{k.pct}%</div>
                  <div className="w-20 text-slate-400 text-[11px]">{k.ok}/{k.total}</div>
                </div>
              );
            })}
          </div>
          <StrategicMessage />
        </div>
      )}

      {/* ── KPIS ── */}
      {tab === 'kpis' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-[12px] text-blue-700">
            Semáforo: 🟢 ≥90% · 🟡 70–89% · 🟠 40–69% · 🔴 &lt;40% · Total: {s.totalMovements} movimientos
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completenessKpis.map(kpi => <KpiCard key={kpi.field} {...kpi} />)}
          </div>
        </div>
      )}

      {/* ── GAPS ── */}
      {tab === 'gaps' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] text-slate-500">
            Hojas inferidas tienen prioridad BAJA — sus gaps son estructurales, no operacionales.
          </div>
          <GapsBySourceTable gaps={gapsBySource} />
        </div>
      )}

      {/* ── CRÍTICOS ── */}
      {tab === 'criticos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Total a corregir',  value:s.recordsToFix, color:'text-red-600' },
              { label:'4 issues (crítico)',value: recordsToFix.filter(r=>r.issueCount===4).length, color:'text-red-600' },
              { label:'3 issues (alto)',   value: recordsToFix.filter(r=>r.issueCount===3).length, color:'text-orange-600' },
              { label:'2 issues (medio)',  value: recordsToFix.filter(r=>r.issueCount===2).length, color:'text-amber-600' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{k.label}</div>
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>
          <RecordsToFixTable records={recordsToFix} />
        </div>
      )}

      {/* ── PLANTILLA ── */}
      {tab === 'plantilla' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-[12px] text-blue-700">
            Campos en <strong>azul</strong> = obligatorios · Campo en <strong className="text-amber-700">ámbar</strong> = estratégico para ML
          </div>
          <ITTemplate fields={templateFields} />
          <StrategicMessage />
        </div>
      )}

      {/* ── REGLAS ── */}
      {tab === 'reglas' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] text-slate-500">
            Reglas de operación centralizadas en services/. Cero lógica de negocio en el UI.
          </div>
          <OperationRulesTable rules={operationRules} />
        </div>
      )}

      {/* ── CHECKLIST ── */}
      {tab === 'checklist' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] text-slate-500">
            Ejecutar el primer día hábil de cada mes · Tiempo estimado: ~2 horas
          </div>
          <MonthlyChecklist steps={checklistSteps} />
        </div>
      )}

      {/* ── DG SCORE ── */}
      {tab === 'score' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MaturityCard levels={maturityLevels} currentLevel={s.dgLevel} score={s.dgScore} />
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-[13px] font-semibold text-slate-700 mb-3">Fórmula — centralizada en services/</div>
              <div className="bg-slate-50 rounded-lg p-4 font-mono text-[12px] space-y-1.5">
                <div className="font-bold text-slate-700 mb-2">DG Score =</div>
                {completenessKpis.map(k => {
                  const w = dgScoreFormula[k.field];
                  if (!w) return null;
                  const contrib = +(k.pct * w.weight).toFixed(1);
                  return (
                    <div key={k.field} className="flex items-center gap-2">
                      <code className="text-blue-700 flex-1">{w.label}</code>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-600 w-16 text-right">{k.pct}% × {w.weight}</span>
                      <span className="text-slate-400">=</span>
                      <span className="font-bold text-slate-800 w-10 text-right">{contrib}</span>
                    </div>
                  );
                })}
                <div className="border-t border-slate-200 mt-2 pt-2 flex items-center gap-2">
                  <span className="font-bold text-slate-700 flex-1">Total</span>
                  <span className="font-bold text-orange-600 text-base">{s.dgScore} / 100</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[13px] font-semibold text-slate-700 mb-4">Proyección — si se corrigen los gaps</div>
            <div className="flex items-end gap-3 flex-wrap">
              {maturityProjection.map((p, i) => {
                const h = Math.round((p.score / 100) * 160);
                const color = p.score >= 75 ? '#1a7a4a' : p.score >= 60 ? '#1d6fa5' : p.score >= 50 ? '#b06000' : '#d35400';
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-[70px]">
                    <div className="text-[12px] font-bold" style={{ color }}>{p.score}</div>
                    <div className="w-full rounded-t-lg" style={{ height:`${h}px`, background:color, minHeight:'20px' }} />
                    <div className="text-[10px] text-slate-400 text-center whitespace-pre-line leading-snug">{p.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
