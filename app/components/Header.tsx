import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function Header() {
  return (
    <header className="bg-tinta text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 md:h-[72px] md:px-6">
        <Link
          href="/"
          className="font-disp flex items-center gap-2.5 text-lg font-bold md:text-[22px]"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F07B3F"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M14 7h7v7" />
          </svg>
          Monitor de Passagens
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
