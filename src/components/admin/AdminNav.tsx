"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  { href: "/admin/sistema", label: "Sistema" },
];

export function AdminNav({ pendingReviews }: { pendingReviews: number }) {
  const path = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navigating = pendingHref !== null && pendingHref !== path;

  return (
    /*
     * O menu tem 9 itens e não cabe na largura de um celular. Quando ele rolava
     * na horizontal, o navegador o arrastava sozinho a cada navegação para
     * mostrar o item ativo — uma animação de cerca de dois segundos que
     * acontecia depois de a página já estar pronta e parecia lentidão.
     * Quebrando em linhas, não há o que rolar.
     */
    <nav aria-label="Painel" aria-busy={navigating ? true : undefined}>
      {navigating && (
        <span className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-white/25" role="status">
          <span className="block h-full w-1/3 animate-pulse rounded-r-full bg-ouro-claro" />
          <span className="sr-only">Abrindo seção…</span>
        </span>
      )}
      <ul className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => {
                  if (!active) setPendingHref(l.href);
                }}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[40px] w-full items-center justify-center whitespace-nowrap rounded-full px-2 text-center text-xs sm:w-auto sm:px-4 sm:text-sm ${
                  active ? "bg-white text-bordo" : "text-white/80 hover:text-white"
                }`}
              >
                {l.label}
                {navigating && pendingHref === l.href && <span className="ml-1.5 h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" aria-hidden="true" />}
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
