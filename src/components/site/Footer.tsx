import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { formatPhone } from "@/lib/format";

export function Footer({ s }: { s: Settings }) {
  const wa = waLink(s.whatsapp, `Olá! Vim pelo site da ${s.name}.`);
  return (
    <footer className="bg-marrom text-white/80">
      <div className="container-site grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl text-white">{s.name}</p>
          {s.slogan && <p className="mt-2 text-sm">{s.slogan}</p>}
        </div>
        <div className="space-y-1 text-sm">
          {s.address && <p>{s.address}</p>}
          {s.region && <p>{s.region}</p>}
          {s.whatsapp && <p>WhatsApp {formatPhone(s.whatsapp)}</p>}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-ouro-claro">Conversar no WhatsApp</a>}
          {s.instagram && (
            <a href={`https://instagram.com/${s.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-ouro-claro">
              Instagram @{s.instagram.replace(/^@/, "")}
            </a>
          )}
          <Link href="/consultar" className="hover:text-ouro-claro">Consultar minha reserva</Link>
          <Link href="/privacidade" className="hover:text-ouro-claro">Política de privacidade</Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {s.name}
      </div>
    </footer>
  );
}
