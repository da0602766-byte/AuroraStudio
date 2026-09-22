import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { getCachedSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import type { Metadata } from "next";

/**
 * As páginas públicas passam a ser geradas uma vez e servidas prontas pelo
 * CDN, em vez de montadas no servidor a cada clique — a navegação deixa de
 * esperar por uma função e por uma consulta ao banco.
 *
 * Toda ação do painel chama `revalidatePath("/", "layout")` ao salvar, então
 * a proprietária vê a mudança imediatamente. Os 5 minutos abaixo são só a
 * rede de segurança. Páginas que dependem da hora ou de dados de uma cliente
 * específica continuam dinâmicas, cada uma declarando isso no próprio arquivo.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getCachedSettings();
  return {
    title: { default: s.slogan ? `${s.name} — ${s.slogan}` : s.name, template: `%s · ${s.name}` },
    description: s.about ?? undefined,
    openGraph: { title: s.name, description: s.about ?? undefined, images: s.heroImageUrl ? [s.heroImageUrl] : [] },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getCachedSettings();
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Pular para o conteúdo
      </a>
      <Header name={s.name} />
      <main id="conteudo">{children}</main>
      <Footer s={s} />
      <WhatsAppFloat href={waLink(s.whatsapp, `Olá! Vim pelo site da ${s.name} e gostaria de tirar uma dúvida.`)} />
    </>
  );
}
