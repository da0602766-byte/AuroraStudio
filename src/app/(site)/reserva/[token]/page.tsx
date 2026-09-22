import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { canClientCancel } from "@/lib/booking";
import { brl, firstName } from "@/lib/format";
import { fmt, longDate, timeLabel, localTimeOf } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";
import { BrowArc } from "@/components/site/BrowArc";
import { CancelButton, CopyButton, ProofButton, ReviewForm } from "@/components/booking/ReservationActions";
import { PixPayment } from "@/components/booking/PixPayment";
import { mercadoPagoConfigurado } from "@/lib/payments/mercadopago";

export const metadata: Metadata = { title: "Sua reserva", robots: { index: false, follow: false } };

// Dados de uma reserva específica, incluindo ficha de saúde: nunca cacheada.
export const dynamic = "force-dynamic";

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ nova?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const b = await prisma.booking.findUnique({
    where: { token },
    include: { service: true, client: true, review: true },
  });
  if (!b) notFound();
  const s = await getSettings();

  const now = new Date();
  const expired = b.status === "AGUARDANDO_PAGAMENTO" && b.holdExpiresAt != null && b.holdExpiresAt < now;
  const status = expired ? "CANCELADO" : b.status;
  const when = `${longDate(b.startsAt)} às ${timeLabel(localTimeOf(b.startsAt))}`;
  const whenShort = fmt(b.startsAt, "dd/MM 'às' HH:mm");
  const remaining = Math.max(0, b.priceCents - b.paidCents);
  const isNew = query.nova === "1";

  const waDuvida = waLink(s.whatsapp, `Olá! Tenho uma dúvida sobre minha reserva ${b.code} (${b.service.name}, ${whenShort}).`);
  const waRemarcar = waLink(s.whatsapp, `Olá! Gostaria de remarcar minha reserva ${b.code} (${b.service.name}, ${whenShort}).`);
  const waComprovante = waLink(
    s.whatsapp,
    `Olá! Segue o comprovante do sinal de ${brl(b.depositCents)} da reserva ${b.code} (${b.service.name}, ${whenShort}).`
  );

  const title = {
    AGUARDANDO_PAGAMENTO: b.proofSentAt ? "Comprovante recebido" : "Falta só o sinal",
    CONFIRMADO: "Reserva confirmada",
    CONCLUIDO: "Atendimento concluído",
    CANCELADO: "Reserva cancelada",
    NAO_COMPARECEU: "Atendimento não realizado",
  }[status];

  const canCancel = !expired && canClientCancel(b, s.cancelMinHours, now);
  const pagamentoAutomatico = mercadoPagoConfigurado();
  const active = status === "AGUARDANDO_PAGAMENTO" || status === "CONFIRMADO";

  return (
    <div className="container-site max-w-2xl py-10 md:py-14">
      <p className="text-sm text-marrom-medio">Reserva {b.code}</p>
      <h1 className="mt-1 text-4xl sm:text-5xl">{title}</h1>
      <BrowArc className="mt-2 w-48 text-ouro" />

      {isNew && (
        <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-[15px] leading-relaxed">
          {firstName(b.client.name)}, guarde este link: por ele você acompanha, cancela ou pede para remarcar a sua reserva.
        </p>
      )}

      {/* Sinal via Pix */}
      {status === "AGUARDANDO_PAGAMENTO" && !b.proofSentAt && (
        <section className="mt-6 rounded-3xl border border-ouro/50 bg-ouro-palido/40 p-5">
          <h2 className="text-2xl">Pague o sinal de {brl(b.depositCents)} via Pix</h2>
          {b.holdExpiresAt && (
            <p className="mt-2 text-[15px] text-marrom-medio">
              O horário fica reservado para você até <strong className="text-marrom">{fmt(b.holdExpiresAt, "HH:mm")}</strong>.
              Depois disso, ele volta a ficar disponível.
            </p>
          )}
          {/*
            * Com o Mercado Pago configurado, o Pix é gerado na hora e a
            * reserva confirma sozinha. Sem ele, continua valendo o fluxo
            * manual: chave Pix mais comprovante pelo WhatsApp.
            */}
          {pagamentoAutomatico ? (
            <PixPayment token={b.token} expiraEmTexto={b.holdExpiresAt ? fmt(b.holdExpiresAt, "HH:mm") : null} />
          ) : (
            <>
              {s.pixKey ? (
                <div className="mt-4 rounded-2xl bg-white p-4">
                  <p className="text-sm text-marrom-medio">Chave Pix{s.pixKeyType ? ` (${s.pixKeyType})` : ""}</p>
                  <p className="mt-1 break-all font-medium">{s.pixKey}</p>
                  {s.pixHolderName && <p className="mt-1 text-sm text-marrom-medio">Em nome de {s.pixHolderName}</p>}
                  <div className="mt-3"><CopyButton text={s.pixKey} label="Copiar chave Pix" /></div>
                </div>
              ) : (
                <p className="mt-4 text-[15px]">A chave Pix será enviada pelo WhatsApp.</p>
              )}
              <p className="mt-4 text-[15px] text-marrom-medio">Depois de pagar, envie o comprovante:</p>
              {waComprovante && <div className="mt-3"><ProofButton token={b.token} href={waComprovante} /></div>}
            </>
          )}
        </section>
      )}
      {status === "AGUARDANDO_PAGAMENTO" && b.proofSentAt && (
        <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-[15px] leading-relaxed">
          Assim que o pagamento for conferido, sua reserva aparece aqui como confirmada.
        </p>
      )}
      {expired && (
        <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-[15px] leading-relaxed">
          O prazo para o sinal terminou e o horário foi liberado.{" "}
          <Link href="/agendar" className="text-bordo underline underline-offset-4">Fazer nova reserva</Link>
        </p>
      )}

      {/* Detalhes */}
      <dl className="mt-8 divide-y divide-linha rounded-3xl border border-linha bg-white px-5">
        <Item label="Nome" value={b.client.name} />
        <Item label="Serviço" value={b.service.name} />
        <Item label="Data e horário" value={<span className="first-letter:uppercase">{when}</span>} />
        <Item label="Valor" value={b.priceCents > 0 ? brl(b.priceCents) : "A combinar"} />
        <Item label="Pago" value={brl(b.paidCents)} />
        {b.priceCents > 0 && <Item label="Restante no dia" value={brl(remaining)} />}
        {(s.address || s.region) && <Item label="Local" value={[s.address, s.region].filter(Boolean).join(" — ")} />}
      </dl>

      {active && s.bookingInstructions && (
        <section className="mt-8">
          <h2 className="text-2xl">Antes de vir</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-marrom-medio">{s.bookingInstructions}</p>
        </section>
      )}

      {active && s.cancellationPolicy && (
        <section className="mt-8">
          <h2 className="text-2xl">Cancelamento e remarcação</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-marrom-medio">{s.cancellationPolicy}</p>
        </section>
      )}

      {active && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {waRemarcar && (
            <a href={waRemarcar} target="_blank" rel="noopener noreferrer" className="btn-contorno">Pedir para remarcar</a>
          )}
          {waDuvida && (
            <a href={waDuvida} target="_blank" rel="noopener noreferrer" className="btn-contorno">Tirar dúvida no WhatsApp</a>
          )}
          {canCancel ? (
            <CancelButton token={b.token} />
          ) : (
            <p className="text-sm text-marrom-medio sm:basis-full">
              Faltam menos de {s.cancelMinHours} horas: para cancelar, fale pelo WhatsApp.
            </p>
          )}
        </div>
      )}

      {status === "CONCLUIDO" && (
        <section className="mt-10">
          <h2 className="text-2xl">Como foi o seu atendimento?</h2>
          <div className="mt-4">
            {b.review ? (
              <p className="text-marrom-medio">Você já avaliou este atendimento. Obrigada!</p>
            ) : (
              <ReviewForm token={b.token} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3.5">
      <dt className="text-marrom-medio">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
