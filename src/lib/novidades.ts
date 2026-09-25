import { prisma } from "./db";
import { brl, firstName } from "./format";
import { fmt } from "./time";
import type { Aviso, Novidades } from "./avisos";

/**
 * O que mudou desde a última olhada do painel.
 *
 * O sino do cabeçalho pergunta isto de tempos em tempos. Duas escolhas
 * valem explicação:
 *
 * - Só reservas feitas pelo site viram aviso. As que a própria
 *   proprietária cria no painel ela acabou de digitar; avisar seria
 *   avisá-la do que ela mesma fez.
 * - Só pagamentos com `reference` viram aviso, e `reference` é o número
 *   da cobrança no Mercado Pago. Ou seja: avisa o que caiu sozinho, não
 *   o que ela registrou à mão um segundo atrás.
 */

/** Na primeira consulta não há "desde": olha o dia de trabalho para trás. */
const JANELA_INICIAL_H = 12;

/** Reserva recém-feita não é cobrança atrasada. Dá um tempo à cliente. */
const ESPERA_DO_SINAL_MIN = 30;

const TETO_POR_TIPO = 15;

export async function buscarNovidades(desde: Date | null): Promise<Novidades> {
  const agora = new Date();
  const corte = desde ?? new Date(agora.getTime() - JANELA_INICIAL_H * 3_600_000);
  const jaPodeCobrar = new Date(agora.getTime() - ESPERA_DO_SINAL_MIN * 60_000);
  const comCliente = { client: true, service: true } as const;

  const [reservas, pagamentos, comprovantes, semSinal] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gt: corte }, source: "SITE" },
      include: comCliente,
      orderBy: { createdAt: "desc" },
      take: TETO_POR_TIPO,
    }),
    prisma.payment.findMany({
      where: { status: "PAGO", reference: { not: null }, updatedAt: { gt: corte } },
      include: { booking: { include: comCliente } },
      orderBy: { updatedAt: "desc" },
      take: TETO_POR_TIPO,
    }),
    prisma.booking.findMany({
      where: { status: "AGUARDANDO_PAGAMENTO", proofSentAt: { not: null } },
      include: comCliente,
      orderBy: { proofSentAt: "desc" },
      take: TETO_POR_TIPO,
    }),
    prisma.booking.findMany({
      where: {
        status: "AGUARDANDO_PAGAMENTO",
        proofSentAt: null,
        depositCents: { gt: 0 },
        createdAt: { lt: jaPodeCobrar },
      },
      include: comCliente,
      orderBy: { createdAt: "asc" },
      take: TETO_POR_TIPO,
    }),
  ]);

  const quando = (d: Date) => fmt(d, "dd/MM 'às' HH:mm");

  const novos: Aviso[] = [
    ...reservas.map((b) => ({
      id: `reserva:${b.id}`,
      tipo: "reserva" as const,
      titulo: "Reserva nova pelo site",
      texto: `${firstName(b.client.name)} — ${b.service.name}, ${quando(b.startsAt)}`,
      href: `/admin/reservas/${b.id}`,
      em: b.createdAt.toISOString(),
    })),
    ...pagamentos.map((p) => ({
      id: `pagamento:${p.id}`,
      tipo: "pagamento" as const,
      titulo: "Pagamento confirmado",
      texto: `${firstName(p.booking.client.name)} pagou ${brl(p.amountCents)} — ${p.booking.service.name}`,
      href: `/admin/reservas/${p.bookingId}`,
      em: p.updatedAt.toISOString(),
    })),
  ];

  const pendentes: Aviso[] = [
    ...comprovantes.map((b) => ({
      id: `comprovante:${b.id}`,
      tipo: "comprovante" as const,
      titulo: "Cliente avisou que pagou o sinal",
      texto: `${firstName(b.client.name)} — confira e confirme os ${brl(b.depositCents)}`,
      href: `/admin/reservas/${b.id}`,
      em: (b.proofSentAt ?? b.createdAt).toISOString(),
    })),
    ...semSinal.map((b) => ({
      id: `sinal:${b.id}`,
      tipo: "sinal" as const,
      titulo: "Falta cobrar o sinal",
      texto:
        `${firstName(b.client.name)} reservou ${quando(b.createdAt)} e o sinal de ${brl(b.depositCents)} não chegou` +
        (b.holdExpiresAt ? `. O horário é liberado ${quando(b.holdExpiresAt)}` : ""),
      href: `/admin/reservas/${b.id}`,
      em: b.createdAt.toISOString(),
    })),
  ];

  return { agora: agora.toISOString(), novos, pendentes };
}
