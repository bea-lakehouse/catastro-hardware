type Props = {
  title: string
  value: number
  tone?: "cyan" | "green" | "yellow" | "orange" | "red" | "purple"
}

export function KpiCard({ title, value, tone = "cyan" }: Props) {
  return (
    <div className={`cat-kpi-card kpi-${tone} p-6`}>
      <p className="catastro-kpi-label">{title}</p>
      <p className="catastro-kpi-value text-[var(--cat-primary-strong)]">
        {value.toLocaleString()}
      </p>
    </div>
  )
}
