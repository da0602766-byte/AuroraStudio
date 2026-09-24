import type { Booking, Client, Service } from "@prisma/client";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { emailDaProprietaria, enviarEmail, esc, moldura } from "./mail";
import { brl, firstName, formatPhone } from "./format";
import { fmt, localDateOf, longDate, localTimeOf, timeLabel } from "./time";
import { waLink } from "./whatsapp";
import { siteUrl } from "./site-url";
import { alertarErro } from "./alerta";
import { avisarPorPush } from "./push";

type ReservaCompleta = Booking & { client: Client; service: Service };

const quando = (b: Booking) => `${longDate(b.startsAt)} às ${timeLabel(localTimeOf(b.startsAt))}`;

/**
 * Avisa a proprietária que entrou reserva nova.
 *
 * Chamado depois que a reserva já está gravada, e de propósito sem
 * `await` na origem: o agendamento da cliente não pode falhar nem demorar
 * porque o e-mail teve problema.
 */
export async function avisarNovaReserva(bookingId: string) {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { client: true, service: true },
    });
    if (!b) return;

    void avisarPorPush({
      titulo: "Reserva nova pelo site",
      texto: `${firstName(b.client.name)} — ${b.service.name}, ${quando(b)}`,
      href: `/admin/reservas/${b.id}`,
      tag: `reserva:${b.id}`,
    });

    const para = emailDaProprietaria();
    if (!para) return;

    const linhas: string[] = [
      `<tr><td style="padding:4px 0;color:#6B5459">Cliente</td><td style="padding:4px 0;text-align:right"><strong>${esc(b.client.name)}</strong></td></tr>`,
      `<tr><td style="padding:4px 0;color:#6B5459">WhatsApp</td><td style="padding:4px 0;text-align:right">${esc(formatPhone(b.client.phone))}</td></tr>`,
      `<tr><td style="padding:4px 0;color:#6B5459">Serviço</td><td style="padding:4px 0;text-align:right">${esc(b.service.name)}</td></tr>`,
      `<tr><td style="padding:4px 0;color:#6B5459">Quando</td><td style="padding:4px 0;text-align:right">${esc(quando(b))}</td></tr>`,
    ];
    if (b.depositCents > 0) {
      linhas.push(
        `<tr><td style="padding:4px 0;color:#6B5459">Sinal</td><td style="padding:4px 0;text-align:right">${esc(brl(b.depositCents))} — aguardando</td></tr>`
      );
    }

    const alertas: string[] = [];
    if (b.isAllergic) alertas.push(`Alergia: ${esc(b.allergyDetails || "informada, sem detalhes")}`);
    if (b.isPregnant) alertas.push("Cliente gestante.");

    const wa = waLink(b.client.phone, `Olá, ${firstName(b.client.name)}! Recebi sua reserva de ${b.service.name}.`);

    await enviarEmail({
      para: { email: para },
      assunto: `Nova reserva: ${b.client.name} — ${fmt(b.startsAt, "dd/MM 'às' HH:mm")}`,
      texto: `Nova reserva de ${b.client.name} (${formatPhone(b.client.phone)}) — ${b.service.name}, ${quando(b)}.`,
      html: moldura(
        "Nova reserva pelo site",
        `<table style="width:100%;border-collapse:collapse;font-size:15px">${linhas.join("")}</table>
         ${alertas.length ? `<div style="margin-top:16px;padding:12px;background:#FDF3E7;border-radius:8px;font-size:14px"><strong>Atenção antes do procedimento</strong><br>${alertas.join("<br>")}</div>` : ""}
         ${b.clientNotes ? `<p style="margin:16px 0 0;font-size:14px;color:#6B5459">Observação da cliente: “${esc(b.clientNotes)}”</p>` : ""}
         <p style="margin:20px 0 0">
           <a href="${siteUrl()}/admin/reservas/${b.id}" style="display:inline-block;background:#5E1A2C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Abrir no painel</a>
           ${wa ? `<a href="${wa}" style="display:inline-block;margin-left:8px;color:#5E1A2C;text-decoration:none;padding:10px 18px;border-radius:999px;border:1px solid #5E1A2C33;font-size:14px">Falar no WhatsApp</a>` : ""}
         </p>`
      ),
    });
  } catch (e) {
    await alertarErro("avisarNovaReserva", e, { bookingId });
  }
}

/** Mensagem pronta do lembrete, usada tanto no WhatsApp quanto no e-mail. */
function textoLembrete(b: ReservaCompleta, nomeEstudio: string) {
  return `Olá, ${firstName(b.client.name)}! Passando para lembrar do seu horário amanhã, ${timeLabel(localTimeOf(b.startsAt))}, para ${b.service.name.toLowerCase()}. Até lá! — ${nomeEstudio}`;
}

/**
 * Resumo dos atendimentos de amanhã.
 *
 * Vai para a proprietária com um link de WhatsApp pronto por cliente: o
 * e-mail da cliente é opcional no agendamento, então mensagem automática
 * sozinha não alcançaria a maioria. Quem deixou e-mail recebe também.
 *
 * Marca `reminderSentAt` para não repetir se a tarefa rodar duas vezes.
 */
export async function enviarLembretesDeAmanha(): Promise<{ reservas: number; emailsCliente: number }> {
  const s = await getSettings();
  const agora = new Date();
  const amanha = new Date(agora.getTime() + 24 * 60 * 60_000);
  const inicio = new Date(agora.getTime() + 12 * 60 * 60_000);
  const fim = new Date(agora.getTime() + 36 * 60 * 60_000);

  const reservas = await prisma.booking.findMany({
    where: {
      startsAt: { gte: inicio, lt: fim },
      status: { in: ["CONFIRMADO", "AGUARDANDO_PAGAMENTO"] },
      reminderSentAt: null,
    },
    include: { client: true, service: true },
    orderBy: { startsAt: "asc" },
  });
  if (!reservas.length) return { reservas: 0, emailsCliente: 0 };

  let emailsCliente = 0;
  for (const b of reservas) {
    if (!b.client.email) continue;
    const ok = await enviarEmail({
      para: { email: b.client.email, nome: b.client.name },
      assunto: `Lembrete: seu horário amanhã às ${localTimeOf(b.startsAt)}`,
      texto: textoLembrete(b, s.name),
      html: moldura(
        "Seu horário é amanhã",
        `<p style="margin:0 0 12px;font-size:15px">${esc(textoLembrete(b, s.name))}</p>
         ${s.address ? `<p style="margin:0 0 12px;font-size:14px;color:#6B5459">${esc(s.address)}</p>` : ""}
         ${s.bookingInstructions ? `<p style="margin:0 0 12px;font-size:14px;color:#6B5459">${esc(s.bookingInstructions)}</p>` : ""}
         <p style="margin:16px 0 0"><a href="${siteUrl()}/reserva/${b.token}" style="display:inline-block;background:#5E1A2C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Ver minha reserva</a></p>`
      ),
    });
    if (ok) emailsCliente++;
  }

  const para = emailDaProprietaria();
  if (para) {
    const itens = reservas
      .map((b) => {
        const wa = waLink(b.client.phone, textoLembrete(b, s.name));
        const avisos = [b.isAllergic ? "alergia" : null, b.isPregnant ? "gestante" : null].filter(Boolean).join(", ");
        return `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #EFE4E1;font-size:15px">
            <strong>${esc(timeLabel(localTimeOf(b.startsAt)))}</strong> · ${esc(b.client.name)}<br>
            <span style="font-size:13px;color:#6B5459">${esc(b.service.name)}${avisos ? ` · ${esc(avisos)}` : ""}${b.status === "AGUARDANDO_PAGAMENTO" ? " · sinal pendente" : ""}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #EFE4E1;text-align:right">
            ${wa ? `<a href="${wa}" style="color:#5E1A2C;text-decoration:none;font-size:14px;white-space:nowrap">Enviar lembrete →</a>` : esc(formatPhone(b.client.phone))}
          </td>
        </tr>`;
      })
      .join("");

    await enviarEmail({
      para: { email: para },
      assunto: `Amanhã: ${reservas.length} atendimento${reservas.length > 1 ? "s" : ""} — ${fmt(amanha, "dd/MM")}`,
      texto: reservas.map((b) => `${localTimeOf(b.startsAt)} ${b.client.name} — ${b.service.name}`).join("\n"),
      html: moldura(
        `Amanhã, ${longDate(amanha)}`,
        `<table style="width:100%;border-collapse:collapse">${itens}</table>
         <p style="margin:16px 0 0;font-size:14px;color:#6B5459">Toque em “Enviar lembrete” para abrir a conversa com a mensagem pronta.</p>`
      ),
    });
  }

  await prisma.booking.updateMany({
    where: { id: { in: reservas.map((b) => b.id) } },
    data: { reminderSentAt: agora },
  });

  return { reservas: reservas.length, emailsCliente };
}

/**
 * Pede a avaliação de quem foi atendida ontem e deixou e-mail.
 *
 * Só complementa o pedido pelo WhatsApp que a proprietária envia no painel:
 * o e-mail é opcional no agendamento, então isso alcança uma parte das
 * clientes, não todas. `reviewAskedAt` impede insistir com quem já recebeu.
 */
export async function pedirAvaliacoesDeOntem(): Promise<{ pedidos: number }> {
  const s = await getSettings();
  const agora = new Date();
  const de = new Date(agora.getTime() - 36 * 60 * 60_000);
  const ate = new Date(agora.getTime() - 12 * 60 * 60_000);

  const reservas = await prisma.booking.findMany({
    where: {
      startsAt: { gte: de, lt: ate },
      status: "CONCLUIDO",
      reviewAskedAt: null,
      review: null,
      client: { email: { not: null } },
    },
    include: { client: true, service: true },
  });
  if (!reservas.length) return { pedidos: 0 };

  const enviadas: string[] = [];
  for (const b of reservas) {
    if (!b.client.email) continue;
    const ok = await enviarEmail({
      para: { email: b.client.email, nome: b.client.name },
      assunto: `Como foi o seu atendimento no ${s.name}?`,
      texto: `Olá, ${firstName(b.client.name)}! Como foi o seu ${b.service.name.toLowerCase()}? Conte para a gente: ${siteUrl()}/avaliar/${b.token}`,
      html: moldura(
        "Como foi o seu atendimento?",
        `<p style="margin:0 0 12px;font-size:15px">Olá, ${esc(firstName(b.client.name))}! Espero que tenha gostado do resultado do seu ${esc(b.service.name.toLowerCase())}.</p>
         <p style="margin:0 0 12px;font-size:15px">Se puder, deixe sua opinião — leva menos de um minuto e ajuda quem ainda não conhece o estúdio.</p>
         <p style="margin:20px 0 0"><a href="${siteUrl()}/avaliar/${b.token}" style="display:inline-block;background:#5E1A2C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px">Avaliar meu atendimento</a></p>`
      ),
    });
    if (ok) enviadas.push(b.id);
  }

  if (enviadas.length) {
    await prisma.booking.updateMany({ where: { id: { in: enviadas } }, data: { reviewAskedAt: agora } });
  }
  return { pedidos: enviadas.length };
}

/** Reserva recém-feita não é cobrança atrasada. Dá um tempo à cliente. */
const ESPERA_DO_SINAL_MIN = 30;

/**
 * Avisa por push as reservas cujo sinal está atrasado e ainda não geraram
 * aviso. Roda pela tarefa agendada de hora em hora — o sino do painel já
 * mostra isso com o site aberto, mas essa chamada é o que alcança quem
 * fechou tudo.
 *
 * `overduePushSentAt` evita repetir o aviso a cada rodada da tarefa para a
 * mesma reserva: uma vez é o bastante, o painel continua mostrando a
 * pendência até ela ser resolvida.
 */
export async function avisarSinaisAtrasados(): Promise<{ avisos: number }> {
  const agora = new Date();
  const jaPodeCobrar = new Date(agora.getTime() - ESPERA_DO_SINAL_MIN * 60_000);

  const reservas = await prisma.booking.findMany({
    where: {
      status: "AGUARDANDO_PAGAMENTO",
      proofSentAt: null,
      depositCents: { gt: 0 },
      createdAt: { lt: jaPodeCobrar },
      overduePushSentAt: null,
    },
    include: { client: true },
    take: 15,
  });
  if (!reservas.length) return { avisos: 0 };

  for (const b of reservas) {
    void avisarPorPush({
      titulo: "Falta cobrar o sinal",
      texto: `${firstName(b.client.name)} reservou e o sinal de ${brl(b.depositCents)} não chegou`,
      href: `/admin/reservas/${b.id}`,
      tag: `sinal:${b.id}`,
    });
  }

  await prisma.booking.updateMany({
    where: { id: { in: reservas.map((b) => b.id) } },
    data: { overduePushSentAt: agora },
  });

  return { avisos: reservas.length };
}

/** Data local de amanhã, usada nos testes e no resumo. */
export const amanhaLocal = (agora = new Date()) => localDateOf(new Date(agora.getTime() + 24 * 60 * 60_000));
