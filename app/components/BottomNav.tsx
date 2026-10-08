"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "Rotas",
    icon: <path d="M3 17l6-6 4 4 8-8" />,
    active: (p: string) => p === "/" || p.startsWith("/rota"),
  },
  {
    href: "/promocoes",
    label: "Promoções",
    icon: (
      <>
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7.5" cy="7.5" r="1.5" />
      </>
    ),
    active: (p: string) => p.startsWith("/promocoes"),
  },
  {
    href: "/alertas",
    label: "Alertas",
    icon: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>
    ),
    active: (p: string) => p.startsWith("/alertas"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Seções"
      className="fixed bottom-4 left-4 z-40 md:hidden"
    >
      <div className="flex items-center gap-1 rounded-full border border-borda bg-white/95 p-1 shadow-lg shadow-tinta/10 backdrop-blur">
        {ITEMS.map((item) => {
          const active = item.active(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex w-20 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] ${
                active ? "bg-grade font-semibold text-tinta" : "font-medium text-texto"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
