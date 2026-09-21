"use client";

import Link from "next/link";
import { useRef } from "react";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");
  return (
    <details ref={ref} className="relative md:hidden">
      <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-white/25 [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </summary>
      <nav aria-label="Menu" className="absolute right-0 mt-3 w-56 rounded-2xl bg-white p-2 text-marrom shadow-lg">
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={close} className="block rounded-xl px-4 py-3 hover:bg-po">
            {l.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
