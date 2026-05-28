type Props = {
  value: number | null;
  emptyLabel: string;
};

export function KpiValue({ value, emptyLabel }: Props) {
  const has = typeof value === "number" && Number.isFinite(value);

  return (
    <div className="mt-1">
      <div className="text-3xl font-semibold text-white">{has ? value : "—"}</div>
      {!has && <div className="mt-1 text-xs text-neutral-500">{emptyLabel}</div>}
    </div>
  );
}
