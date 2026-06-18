'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',           label: 'Resumen' },
  { href: '/medallion',  label: 'Medallion' },
  { href: '/bronze',     label: 'Bronze' },
  { href: '/silver',     label: 'Silver' },
  { href: '/gold',       label: 'Gold' },
  { href: '/gobierno',   label: 'Gobierno del Dato' },
  { href: '/calidad',    label: 'Calidad' },
  { href: '/forecast',   label: 'Forecast' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-[#1b2a4a] sticky top-0 z-50 shadow-md">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold text-base tracking-tight">
              2<span className="text-blue-300">Brains</span> Asset Governance
            </span>
            <span className="hidden sm:inline text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-blue-200 tracking-wide">
              Gold v3 · 5 Marts
            </span>
          </div>
          <span className="text-[11px] text-blue-300/80">
            Snapshot: 17 Jun 2026
          </span>
        </div>
        {/* Sub nav */}
        <nav className="bg-white border-b border-slate-200">
          <div className="max-w-screen-xl mx-auto px-6 flex overflow-x-auto">
            {NAV.map(({ href, label }) => {
              const active = href === '/' ? path === '/' : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors',
                    active
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-blue-600',
                  ].join(' ')}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Page content */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
