import type { Semaphore } from '@/lib/types';

const SEMAPHORE_STYLES: Record<Semaphore, { bar: string; value: string; border: string }> = {
  green:  { bar: 'bg-emerald-600', value: 'text-emerald-700', border: 'border-l-emerald-500' },
  yellow: { bar: 'bg-amber-500',   value: 'text-amber-700',   border: 'border-l-amber-500'   },
  orange: { bar: 'bg-orange-600',  value: 'text-orange-700',  border: 'border-l-orange-500'  },
  red:    { bar: 'bg-red-600',     value: 'text-red-700',     border: 'border-l-red-500'     },
};

interface KpiCardProps {
  label: string;
  pct: number;
  ok: number;
  total: number;
  semaphore: Semaphore;
  note: string;
  isStrategic?: boolean;
}

export default function KpiCard({ label, pct, ok, total, semaphore, note, isStrategic }: KpiCardProps) {
  const s = SEMAPHORE_STYLES[semaphore];
  return (
    <div className={[
      'bg-white rounded-xl border border-slate-200 p-4 border-l-4',
      s.border,
      isStrategic ? 'ring-2 ring-amber-300 ring-offset-1' : '',
    ].join(' ')}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
        {isStrategic && (
          <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">🎯 ML</span>
        )}
      </div>
      <div className={`text-3xl font-bold leading-none mb-0.5 ${s.value}`}>{pct}%</div>
      <div className="text-[11px] text-slate-400 mb-2">{ok} de {total} completos</div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
      </div>

      <p className="text-[11px] text-slate-500 leading-snug border-t border-slate-100 pt-2">{note}</p>
    </div>
  );
}
