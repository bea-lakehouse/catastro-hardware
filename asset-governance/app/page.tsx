import { getResumen } from '@/services';
import { StatusCard, AlertCard, MaturityCard } from '@/components/cards/StatusCard';
import KpiCard from '@/components/cards/KpiCard';
import { StrategicMessage } from '@/components/governance/GovernanceComponents';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { summary: s, completenessKpis, maturityLevels, qualityScoreFormula } = await getResumen();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Resumen Ejecutivo</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Plataforma de gobierno del dato — Arquitectura Lakehouse Bronze / Silver / Gold
        </p>
      </div>

      <div className="space-y-3">
        <AlertCard
          level="warning"
          title={`Estado general: Regular — Nivel ${s.dgLevel} ${s.dgLevelLabel}`}
          message="La arquitectura es correcta. Los datos dentro de ella necesitan trabajo operacional, no código adicional."
        />
        <AlertCard
          level="error"
          title="Principal brecha detectada"
          message={`gestor_it_responsable: solo 15.8% completitud (22 de 139 movimientos). Segunda brecha: ${s.secondaryGap}`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard title="Quality Score — movimientos" value={`${s.qualityScore}`} subtitle="de 100 puntos"
          note={`Fórmula: ${qualityScoreFormula}`} color="amber" size="lg" />
        <StatusCard title="Quality Score — solo reales" value={`${s.qualityScoreReal}`} subtitle="excluyendo 67 inferidos"
          note="72 movimientos reales con al menos un campo incompleto" color="amber" size="lg" />
        <StatusCard title="Data Governance Score" value={`${s.dgScore}`} subtitle={`Nivel ${s.dgLevel} — ${s.dgLevelLabel}`}
          note="Incluye riesgo_percibido_it (actualmente 0%). Sin él: 57.8/100." color="orange" size="lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <MaturityCard levels={maturityLevels} currentLevel={s.dgLevel} score={s.dgScore} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
          <StatusCard title="Total movimientos"     value={s.totalMovements}    subtitle="fact_movements"         color="blue" />
          <StatusCard title="Movimientos reales"    value={s.realMovements}     subtitle="con fuente directa"     color="blue" />
          <StatusCard title="Movimientos inferidos" value={s.inferredMovements} subtitle="derivados del estado"   color="slate" />
          <StatusCard title="Registros a corregir"  value={s.recordsToFix}      subtitle="con campos incompletos" color="red" />
          <StatusCard title="Snapshot"              value="Jun 2026"            subtitle="1 real acumulado"       color="slate" />
          <StatusCard title="Objetivo DG Score"     value="75"                  subtitle="Q3 2026 — Nivel 3"      color="green" />
        </div>
      </div>

      <div>
        <h2 className="text-[13px] font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Completitud por campo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {completenessKpis.map(kpi => (
            <KpiCard key={kpi.field} {...kpi} />
          ))}
        </div>
      </div>

      <StrategicMessage />
    </div>
  );
}
