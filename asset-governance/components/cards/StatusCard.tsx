// ── StatusCard ────────────────────────────────────────────────
interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  note?: string;
  color?: 'blue' | 'amber' | 'orange' | 'red' | 'green' | 'slate';
  size?: 'sm' | 'md' | 'lg';
}

const COLOR_MAP = {
  blue:   'text-blue-700',
  amber:  'text-amber-700',
  orange: 'text-orange-700',
  red:    'text-red-700',
  green:  'text-emerald-700',
  slate:  'text-slate-700',
};

const SIZE_MAP = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-5xl' };

export function StatusCard({ title, value, subtitle, note, color = 'blue', size = 'md' }: StatusCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{title}</div>
      <div className={`${SIZE_MAP[size]} font-bold leading-none ${COLOR_MAP[color]}`}>{value}</div>
      {subtitle && <div className="text-[12px] text-slate-400 mt-1">{subtitle}</div>}
      {note && (
        <p className="text-[11px] text-slate-500 leading-snug border-t border-slate-100 mt-3 pt-3">{note}</p>
      )}
    </div>
  );
}

// ── AlertCard ─────────────────────────────────────────────────
interface AlertCardProps {
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  icon?: string;
}

const ALERT_MAP = {
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'ℹ️',  title: 'text-blue-800',  msg: 'text-blue-700'  },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: '⚠️',  title: 'text-amber-800', msg: 'text-amber-700' },
  error:   { bg: 'bg-red-50',    border: 'border-red-200',    icon: '🔴',  title: 'text-red-800',   msg: 'text-red-700'   },
  success: { bg: 'bg-green-50',  border: 'border-green-200',  icon: '✅',  title: 'text-green-800', msg: 'text-green-700' },
};

export function AlertCard({ level, title, message, icon }: AlertCardProps) {
  const s = ALERT_MAP[level];
  return (
    <div className={`rounded-xl border ${s.bg} ${s.border} p-4 flex gap-3`}>
      <span className="text-xl flex-shrink-0 mt-0.5">{icon ?? s.icon}</span>
      <div>
        <div className={`text-[13px] font-semibold ${s.title}`}>{title}</div>
        <div className={`text-[12px] mt-0.5 leading-relaxed ${s.msg}`}>{message}</div>
      </div>
    </div>
  );
}

// ── MaturityCard ──────────────────────────────────────────────
import type { MaturityInfo } from '@/lib/types';

interface MaturityCardProps {
  levels: MaturityInfo[];
  currentLevel: number;
  score: number;
}

export function MaturityCard({ levels, currentLevel, score }: MaturityCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Data Governance Score</div>
          <div className="text-4xl font-bold text-orange-600 leading-none mt-0.5">{score}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-700">Nivel {currentLevel}</div>
          <div className="text-[13px] text-slate-500">{levels.find(l => l.level === currentLevel)?.label}</div>
        </div>
      </div>

      {/* Step bars */}
      <div className="flex gap-1.5 mb-4">
        {levels.map(l => {
          const done = l.level < currentLevel;
          const cur  = l.level === currentLevel;
          return (
            <div key={l.level} className="flex-1 text-center">
              <div
                className={`h-2 rounded-full mb-1 ${done ? 'bg-blue-500' : cur ? 'bg-orange-500' : 'bg-slate-200'}`}
              />
              <span className={`text-[9px] font-medium ${cur ? 'text-orange-600' : done ? 'text-blue-600' : 'text-slate-400'}`}>
                {l.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scale list */}
      <div className="space-y-1">
        {levels.map(l => {
          const cur = l.level === currentLevel;
          return (
            <div key={l.level} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${cur ? 'bg-orange-50 border border-orange-200' : ''}`}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
              <span className={`text-[11px] font-medium ${cur ? 'text-orange-700' : 'text-slate-600'}`}>
                {l.level} · {l.label}
              </span>
              <span className="text-[10px] text-slate-400 ml-auto">{l.range}</span>
              {cur && <span className="text-[10px] font-semibold text-orange-600">← ahora</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
