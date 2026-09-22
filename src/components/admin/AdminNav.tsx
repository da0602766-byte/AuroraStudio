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
    /*
     * O menu tem 9 itens e não cabe na largura de um celular. Quando ele rolava
     * na horizontal, o navegador o arrastava sozinho a cada navegação para
     * mostrar o item ativo — uma animação de cerca de dois segundos que
     * acontecia depois de a página já estar pronta e parecia lentidão.
     * Quebrando em linhas, não há o que rolar.
     */
    <nav aria-label="Painel">
      <ul className="flex flex-wrap gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-4 text-sm ${
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
