import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCachedSettings } from "@/lib/settings";
import { firstName } from "@/lib/format";
import { fmt, longDate } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";
import { BrowArc } from "@/components/site/BrowArc";
import { ReviewForm } from "@/components/booking/ReservationActions";

export const metadata: Metadata = { title: "Sua avaliação", robots: { index: false, follow: false } };

// Cada link vale para uma reserva específica.
export const dynamic = "force-dynamic";

/**
 * Página dedicada à avaliação.
 *
 * Existe separada da página da reserva porque o pedido é enviado pela
 * proprietária por WhatsApp: a cliente abre o link já sabendo o que fazer, e
 * encontra a pergunta na primeira tela, em vez de rolar até o fim de uma
 * página cheia de detalhes.
 */
export default async function AvaliarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();

  const b = await prisma.booking.findUnique({
    where: { token },
    include: { service: true, client: true, review: true },
  });
  if (!b) notFound();
  const s = await getCachedSettings();

  const wa = waLink(s.whatsapp, `Olá! Queria falar sobre meu atendimento de ${b.service.name}.`);

  // Já avaliou: agradece e não mostra o formulário de novo.
  if (b.review) {
    return (
      <Moldura titulo="Obrigada pela sua avaliação!">
        <p className="mt-4 text-[17px] leading-relaxed text-marrom-medio">
          {firstName(b.client.name)}, seu retorno já chegou até nós e faz diferença de verdade.
        </p>
        <Acoes wa={wa} />
      </Moldura>
    );
  }

  // Ainda não foi atendida: não é erro, é só cedo.
  if (b.status !== "CONCLUIDO") {
    const futura = b.status === "CONFIRMADO" || b.status === "AGUARDANDO_PAGAMENTO";
    return (
      <Moldura titulo={futura ? "Seu atendimento ainda vai acontecer" : "Avaliação indisponível"}>
        <p className="mt-4 text-[17px] leading-relaxed text-marrom-medio">
          {futura
            ? `Este link fica disponível depois do seu atendimento de ${b.service.name}, ${longDate(b.startsAt)}.`
            : "Esta reserva não chegou a ser realizada, então não há o que avaliar."}
        </p>
        <p className="mt-6">
          <Link href={`/reserva/${b.token}`} className="text-bordo underline underline-offset-4">
            Ver minha reserva
          </Link>
        </p>
        <Acoes wa={wa} />
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Como foi o seu atendimento?">
      <p className="mt-3 text-[17px] leading-relaxed text-marrom-medio">
        {firstName(b.client.name)}, você fez <strong className="text-marrom">{b.service.name.toLowerCase()}</strong>{" "}
        em {fmt(b.startsAt, "dd 'de' MMMM")}. Sua opinião ajuda quem ainda não conhece o estúdio.
      </p>
      <div className="mt-8">
        <ReviewForm token={b.token} />
      </div>
      <p className="mt-8 text-sm text-marrom-claro">
        Sua avaliação aparece no site depois de revisada. Só o seu primeiro nome é publicado.
      </p>
      <Acoes wa={wa} />
    </Moldura>
  );
}

function Moldura({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="container-site max-w-xl py-12 md:py-16">
      <h1 className="text-4xl sm:text-5xl">{titulo}</h1>
      <BrowArc className="mt-2 w-40 text-ouro" />
      {children}
    </div>
  );
}

function Acoes({ wa }: { wa: string | null }) {
  return (
    <div className="mt-10 flex flex-wrap gap-3 border-t border-linha pt-6">
      <Link href="/agendar" className="btn-primario">Agendar novo horário</Link>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-contorno">
          Falar no WhatsApp
        </a>
      )}
    </div>
  );
}
