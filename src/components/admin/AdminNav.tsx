"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Início" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/portfolio", label: "Trabalhos" },
  { href: "/admin/avaliacoes", label: "Avaliações" },
  { href: "/admin/bloqueios", label: "Folgas e bloqueios" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav({ pendingReviews }: { pendingReviews: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Painel" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 whitespace-nowrap">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[40px] items-center rounded-full px-4 text-sm ${
                  active ? "bg-white text-bordo" : "text-white/80 hover:text-white"
                }`}
              >
                {l.label}
                {l.href === "/admin/avaliacoes" && pendingReviews > 0 && (
                  <span className="ml-1.5 rounded-full bg-ouro-claro px-1.5 text-xs text-bordo-escuro">{pendingReviews}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
