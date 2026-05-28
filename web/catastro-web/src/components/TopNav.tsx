"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home", match: (pathname: string) => pathname === "/" },
  { href: "/activos", label: "Activos", match: (pathname: string) => pathname.startsWith("/activos") },
  { href: "/estadisticas", label: "Estadísticas", match: (pathname: string) => pathname.startsWith("/estadisticas") },
  { href: "/historico-catastro", label: "Histórico", match: (pathname: string) => pathname.startsWith("/historico-catastro") },
  { href: "/operacion", label: "Operación", match: (pathname: string) => pathname.startsWith("/operacion") },
  { href: "/excepciones", label: "Excepciones", match: (pathname: string) => pathname.startsWith("/excepciones") },
  { href: "/ejecucion", label: "Ejecución", match: (pathname: string) => pathname.startsWith("/ejecucion") },
  { href: "/planeacion-compra", label: "Planeación", match: (pathname: string) => pathname.startsWith("/planeacion-compra") },
  { href: "/compras-2026", label: "Compras 2026", match: (pathname: string) => pathname.startsWith("/compras-2026") },
  { href: "/ml-v2", label: "ML", match: (pathname: string) => pathname.startsWith("/ml-v2") },
  { href: "/auditoria", label: "Auditoría", match: (pathname: string) => pathname.startsWith("/auditoria") },
];

export default function TopNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 text-sm">
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${active ? "catastro-pill-active" : "catastro-pill"} shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition duration-200 hover:-translate-y-0.5 hover:text-[var(--cat-primary-strong)]`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
