import { KpiCard } from "./KpiCard"

type Props = {
  kpis: {
    equipos: number
    alertas_activas: number
    anomalias_ml_v2: number
    acciones_dbt: number
  }
}

export function KpiGrid({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      <KpiCard title="Equipos" value={kpis.equipos} />
      <KpiCard title="Alertas activas" value={kpis.alertas_activas} />
      <KpiCard title="Anómalos (ML v2)" value={kpis.anomalias_ml_v2} />
      <KpiCard title="Acciones (dbt)" value={kpis.acciones_dbt} />
    </div>
  )
}
