import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.slogan ? `${s.name} — ${s.slogan}` : s.name, template: `%s · ${s.name}` },
    description: s.about ?? undefined,
    openGraph: { title: s.name, description: s.about ?? undefined, images: s.heroImageUrl ? [s.heroImageUrl] : [] },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
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
