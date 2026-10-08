"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Rotas" },
  { href: "/promocoes", label: "Promoções" },
  { href: "/alertas", label: "Meus alertas" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex items-center gap-1 md:gap-2">
      {LINKS.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" || pathname.startsWith("/rota") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`hidden px-3.5 py-3 text-sm font-medium md:inline-block ${
              active
                ? "font-semibold text-white underline underline-offset-[6px]"
                : "text-[#DCE3EE] hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <Link
        href="/alertas"
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-tinta md:px-[18px] md:py-3"
      >
        Entrar
      </Link>
    </nav>
  );
}
