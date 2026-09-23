import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { brl, firstName, formatPhone } from "@/lib/format";
import { fmt, localDateOf, localTimeOf } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/Buttons";
import { ActionForm } from "@/components/admin/ActionForm";
import { BotaoPedirAvaliacao } from "@/components/admin/BotaoPedirAvaliacao";
import { changeBookingStatus, confirmDeposit, registerPayment, reschedule } from "../../../actions/bookings";
import { siteUrl } from "@/lib/site-url";

const METHOD: Record<string, string> = { PIX: "Pix", CARTAO: "Cartão", DINHEIRO: "Dinheiro", OUTRO: "Outro" };
const KIND: Record<string, string> = { SINAL: "Sinal", RESTANTE: "Restante", INTEGRAL: "Integral" };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: true,
      service: true,
      payments: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
      review: true,
    },
  });
  if (!b) notFound();
  const s = await getSettings();
  const base = siteUrl();
  const remaining = Math.max(0, b.priceCents - b.paidCents);
  const active = b.status === "AGUARDANDO_PAGAMENTO" || b.status === "CONFIRMADO";
  const when = fmt(b.startsAt, "EEEE, dd/MM 'às' HH:mm");

  const msgs = [
    { label: "Lembrete", text: `Olá, ${firstName(b.client.name)}! Passando para lembrar do seu horário de ${b.service.name} ${when}. Até lá!` },
    { label: "Confirmação", text: `Olá, ${firstName(b.client.name)}! Sua reserva de ${b.service.name} ${when} está confirmada. Detalhes: ${base}/reserva/${b.token}` },
    ...(b.status === "AGUARDANDO_PAGAMENTO"
      ? [{ label: "Cobrar sinal", text: `Olá, ${firstName(b.client.name)}! Para confirmar seu horário de ${b.service.name} ${when}, falta o sinal de ${brl(b.depositCents)} via Pix${s.pixKey ? ` (chave: ${s.pixKey})` : ""}.` }]
      : []),
  ];

  const waAvaliacao = waLink(
    b.client.phone,
    `Olá, ${firstName(b.client.name)}! Espero que tenha gostado do resultado. Se puder, deixe sua avaliação aqui: ${base}/avaliar/${b.token}`
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reservas" className="text-sm text-marrom-medio hover:text-bordo">Reservas</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{b.client.name}</h1>
          <StatusBadge status={b.status} proof={!!b.proofSentAt} />
        </div>
        <p className="mt-1 capitalize text-marrom-medio">{b.service.name} · {when} até {fmt(b.endsAt, "HH:mm")}</p>
        <p className="text-sm text-marrom-claro">
          {b.code} · {b.source === "SITE" ? "feita pelo site" : "criada no painel"}
          {b.isEncaixe ? " · encaixe" : ""}
          {b.rescheduleCount ? ` · reagendada ${b.rescheduleCount}x` : ""}
        </p>
      </div>

      {(b.isAllergic || b.isPregnant) && (
        <div role="note" className="rounded-2xl border border-bordo/30 bg-bordo/5 p-4">
          <p className="font-medium text-bordo">Atenção antes do procedimento</p>
          {b.isAllergic && <p className="mt-1">Alergia: {b.allergyDetails || "informada, sem detalhes"}</p>}
          {b.isPregnant && <p className="mt-1">Cliente gestante.</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {/* Ações principais */}
          {/*
            * O pedido de avaliação fica aqui, e não junto das mensagens lá
            * embaixo, porque é o que a proprietária quer fazer no instante
            * seguinte a concluir o atendimento — rolar a página inteira até
            * achar o botão faria o passo ser esquecido.
            */}
          {b.status === "CONCLUIDO" && !b.review && waAvaliacao && (
            <section className="rounded-2xl border border-ouro/50 bg-ouro-palido/40 p-5">
              <h2 className="text-xl">Peça a avaliação</h2>
              <p className="mt-1 text-[15px] text-marrom-medio">
                {b.reviewAskedAt
                  ? `Você já pediu em ${fmt(b.reviewAskedAt, "dd/MM 'às' HH:mm")}. A cliente ainda não respondeu.`
                  : "Atendimento concluído. Envie o link para a cliente contar como foi."}
              </p>
              <div className="mt-4">
                <BotaoPedirAvaliacao bookingId={b.id} href={waAvaliacao} jaPedido={!!b.reviewAskedAt} />
              </div>
            </section>
          )}

          {b.status === "CONCLUIDO" && b.review && (
            <section className="painel-bloco">
              <h2 className="text-xl">Avaliação da cliente</h2>
              <p className="mt-2 text-lg text-ouro">
                {"★".repeat(b.review.rating)}
                <span className="text-marrom-claro">{"☆".repeat(5 - b.review.rating)}</span>
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-marrom-medio">“{b.review.comment}”</p>
              <p className="mt-3 text-sm text-marrom-claro">
                {b.review.status === "PENDENTE"
                  ? "Aguardando sua aprovação para aparecer no site."
                  : b.review.status === "APROVADO"
                    ? "Publicada no site."
                    : "Rejeitada — não aparece no site."}{" "}
                <Link href="/admin/avaliacoes" className="text-bordo underline underline-offset-4">
                  Ver em Avaliações
                </Link>
              </p>
            </section>
          )}

          <section className="painel-bloco space-y-4">
            <h2 className="text-xl">Ações</h2>
            <div className="flex flex-wrap gap-2">
              {b.status === "AGUARDANDO_PAGAMENTO" && b.depositCents > 0 && (
                <ActionForm action={confirmDeposit}>
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton className="btn-primario btn-pequeno" pendingText="Confirmando…">Recebi o sinal de {brl(b.depositCents)}</SubmitButton>
                </ActionForm>
              )}
              {b.status === "AGUARDANDO_PAGAMENTO" && (
                <StatusForm id={b.id} action="confirmar" label="Confirmar sem sinal" />
              )}
              {b.status === "CONFIRMADO" && (
                <>
                  <StatusForm id={b.id} action="concluir" label="Marcar como concluído" primary />
                  <StatusForm id={b.id} action="falta" label="Não compareceu" confirm="Registrar que a cliente não compareceu?" />
                </>
              )}
              {(b.status === "CANCELADO" || b.status === "NAO_COMPARECEU" || b.status === "CONCLUIDO") && (
                <StatusForm id={b.id} action="reabrir" label="Reabrir reserva" confirm="Reabrir esta reserva como confirmada?" />
              )}
            </div>

            {active && (
              <ActionForm action={changeBookingStatus} className="flex flex-col gap-2 border-t border-linha pt-4 sm:flex-row sm:items-end">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="action" value="cancelar" />
                <div className="flex-1">
                  <label htmlFor="reason" className="rotulo">Cancelar reserva</label>
                  <input id="reason" name="reason" className="campo" placeholder="Motivo (opcional)" maxLength={200} />
                </div>
                <SubmitButton className="btn-contorno btn-pequeno" pendingText="Cancelando…" confirm="Cancelar esta reserva e liberar o horário?">
                  Cancelar
                </SubmitButton>
              </ActionForm>
            )}
          </section>

          {/* Reagendar */}
          {active && (
            <section className="painel-bloco">
              <h2 className="text-xl">Reagendar</h2>
              <ActionForm action={reschedule} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={b.id} />
                <div>
                  <label htmlFor="rdate" className="rotulo">Nova data</label>
                  <input id="rdate" name="date" type="date" defaultValue={localDateOf(b.startsAt)} className="campo" required />
                </div>
                <div>
                  <label htmlFor="rtime" className="rotulo">Horário</label>
                  <input id="rtime" name="time" type="time" defaultValue={localTimeOf(b.startsAt)} className="campo" required />
                </div>
                <SubmitButton className="btn-primario btn-pequeno" pendingText="Salvando…">Reagendar</SubmitButton>
                <label className="flex items-center gap-2 text-sm sm:col-span-3">
                  <input type="checkbox" name="isEncaixe" className="h-4 w-4 accent-bordo" /> Permitir encaixe (ignora conflitos)
                </label>
              </ActionForm>
            </section>
          )}

          {/* Pagamentos */}
          <section className="painel-bloco">
            <h2 className="text-xl">Pagamentos</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-marrom-medio">Valor</dt><dd className="font-medium">{brl(b.priceCents)}</dd></div>
              <div><dt className="text-marrom-medio">Sinal</dt><dd className="font-medium">{brl(b.depositCents)}</dd></div>
              <div><dt className="text-marrom-medio">Pago</dt><dd className="font-medium">{brl(b.paidCents)}</dd></div>
              <div><dt className="text-marrom-medio">Restante</dt><dd className="font-medium">{brl(remaining)}</dd></div>
            </dl>
            {b.payments.length > 0 && (
              <ul className="mt-4 divide-y divide-linha text-sm">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex justify-between py-2">
                    <span>{KIND[p.kind]} · {METHOD[p.method]} · {fmt(p.createdAt, "dd/MM/yy HH:mm")}</span>
                    <span className="font-medium">{brl(p.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={registerPayment} className="mt-4 grid gap-3 border-t border-linha pt-4 sm:grid-cols-4 sm:items-end">
              <input type="hidden" name="id" value={b.id} />
              <div>
                <label htmlFor="amount" className="rotulo">Valor recebido</label>
                <input id="amount" name="amount" inputMode="decimal" className="campo" defaultValue={remaining ? (remaining / 100).toFixed(2).replace(".", ",") : ""} required />
              </div>
              <div>
                <label htmlFor="method" className="rotulo">Forma</label>
                <select id="method" name="method" className="campo">
                  {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="kind" className="rotulo">Referente a</label>
                <select id="kind" name="kind" className="campo" defaultValue="RESTANTE">
                  {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <SubmitButton className="btn-contorno btn-pequeno" pendingText="Registrando…">Registrar pagamento</SubmitButton>
            </ActionForm>
          </section>
        </div>

        <div className="space-y-6">
          {/* Cliente */}
          <section className="painel-bloco">
            <h2 className="text-xl">Cliente</h2>
            <p className="mt-2 font-medium">{b.client.name}</p>
            <p className="text-sm text-marrom-medio">{formatPhone(b.client.phone)}{b.client.email ? ` · ${b.client.email}` : ""}</p>
            {b.clientNotes && <p className="mt-3 rounded-xl bg-po p-3 text-sm">“{b.clientNotes}”</p>}
            <Link href={`/admin/clientes/${b.client.id}`} className="mt-3 inline-block text-sm text-bordo underline underline-offset-4">Ver ficha completa</Link>
            <div className="mt-4 space-y-2 border-t border-linha pt-4">
              <p className="text-sm text-marrom-medio">Mensagem pelo WhatsApp</p>
              <div className="flex flex-wrap gap-2">
                {msgs.map((m) => {
                  const href = waLink(b.client.phone, m.text);
                  return href ? (
                    <a key={m.label} href={href} target="_blank" rel="noopener noreferrer" className="btn-contorno btn-pequeno">{m.label}</a>
                  ) : null;
                })}
              </div>
            </div>
          </section>

          {/* Histórico */}
          <section className="painel-bloco">
            <h2 className="text-xl">Histórico</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {b.events.map((e) => (
                <li key={e.id} className="border-l-2 border-ouro/50 pl-3">
                  <p>{e.message}</p>
                  <p className="text-xs text-marrom-claro">{fmt(e.createdAt, "dd/MM/yy HH:mm")} · {e.actor}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-marrom-claro">
              Link da cliente: <span className="break-all">{base}/reserva/{b.token}</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusForm({ id, action, label, primary, confirm }: { id: string; action: string; label: string; primary?: boolean; confirm?: string }) {
  return (
    <ActionForm action={changeBookingStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton className={`${primary ? "btn-primario" : "btn-contorno"} btn-pequeno`} pendingText="Salvando…" confirm={confirm}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
