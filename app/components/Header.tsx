import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function Header() {
  return (
    <header className="border-b border-borda bg-card text-tinta">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 md:h-[68px] md:px-6">
        <Link
          href="/"
          className="font-disp flex items-center gap-2.5 text-lg font-bold md:text-[20px]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-tinta">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 17l6-6 4 4 8-8" />
            </svg>
          </span>
          Monitor
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
