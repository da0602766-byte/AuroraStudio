import Link from "next/link";
import { MobileMenu } from "./MobileMenu";

const LINKS = [
  { href: "/#servicos", label: "Serviços" },
  { href: "/galeria", label: "Trabalhos" },
  { href: "/#avaliacoes", label: "Avaliações" },
  { href: "/#duvidas", label: "Dúvidas" },
  { href: "/consultar", label: "Minha reserva" },
];

export function Header({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bordo text-white">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-xl tracking-wide text-white">
          {name}
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 text-[15px] text-white/80 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ouro-claro">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/agendar" className="btn-ouro btn-pequeno">
            Agendar
          </Link>
          <MobileMenu links={LINKS} />
        </div>
      </div>
    </header>
  );
}
