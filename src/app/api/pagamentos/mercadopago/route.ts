import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { assertSlotFree, BookingError, lockAgenda } from "@/lib/booking";
import { brl } from "@/lib/format";
import { assinaturaConfere, consultarPagamento, mercadoPagoConfigurado } from "@/lib/payments/mercadopago";
import { alertarErro } from "@/lib/alerta";

export const dynamic = "force-dynamic";

/**
 * Notificações do Mercado Pago.
 *
 * O corpo desta requisição vem da internet aberta e não é confiável: ele só
 * diz "o pagamento X mudou". Toda decisão é tomada a partir da consulta à
 * API do Mercado Pago, feita com o nosso token — quem forjar uma notificação
 * não consegue confirmar reserva nenhuma.
 *
 * Responde 200 mesmo quando ignora o aviso: erro faz o Mercado Pago reenviar
 * indefinidamente, e reenvio não conserta aviso que não interessa.
 */
export async function POST(req: NextRequest) {
  if (!mercadoPagoConfigurado()) return NextResponse.json({ ok: true });

  const corpo = await req.json().catch(() => null);
  const tipo = corpo?.type ?? corpo?.topic;
  const dataId = corpo?.data?.id ?? corpo?.resource;
  if (tipo !== "payment" || !dataId) return NextResponse.json({ ok: true });

  const idPagamento = String(dataId);

  const confere = assinaturaConfere({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId: idPagamento,
  });
  if (confere === false) {
    console.warn("Webhook do Mercado Pago com assinatura inválida", { idPagamento });
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }
  if (confere === null) {
    // Sem MERCADOPAGO_WEBHOOK_SECRET não dá para verificar a origem. Seguimos
    // porque a consulta abaixo é o que de fato decide, mas registramos.
    console.warn("MERCADOPAGO_WEBHOOK_SECRET ausente: aviso aceito sem verificar a origem.");
  }

  let pagamento;
  try {
    pagamento = await consultarPagamento(idPagamento);
  } catch (e) {
    await alertarErro("consultar pagamento", e, { idPagamento });
    // Aqui vale reenviar: pode ter sido instabilidade momentânea.
    return NextResponse.json({ error: "falha ao consultar" }, { status: 503 });
  }

  if (!pagamento.aprovado || !pagamento.bookingId) return NextResponse.json({ ok: true });

  const b = await prisma.booking.findUnique({ where: { id: pagamento.bookingId } });
  if (!b) {
    console.warn("Pagamento aprovado sem reserva correspondente", { idPagamento });
    return NextResponse.json({ ok: true });
  }

  // O valor precisa bater com o sinal desta reserva.
  if (pagamento.valorCents !== b.depositCents) {
    console.warn("Pagamento com valor diferente do sinal", {
      idPagamento,
      recebido: pagamento.valorCents,
      esperado: b.depositCents,
    });
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // `reference` é único: se este pagamento já foi processado, o
        // updateMany não altera nada e saímos sem duplicar.
        const marcou = await tx.payment.updateMany({
          where: { reference: pagamento.id, status: "PENDENTE" },
          data: { status: "PAGO" },
        });
        if (!marcou.count) {
          const jaExiste = await tx.payment.findUnique({ where: { reference: pagamento.id } });
          if (jaExiste) return; // aviso repetido
          await tx.payment.create({
            data: {
              bookingId: b.id,
              amountCents: pagamento.valorCents,
              method: "PIX",
              kind: "SINAL",
              status: "PAGO",
              reference: pagamento.id,
            },
          });
        }

        if (b.status === "CONFIRMADO" || b.status === "CONCLUIDO") return;

        // A reserva pode ter sido cancelada por falta de pagamento e o
        // horário ocupado por outra cliente nesse meio-tempo.
        if (b.status === "CANCELADO") {
          await lockAgenda(tx, b.professionalId);
          await assertSlotFree(tx, b);
        }

        await tx.booking.update({
          where: { id: b.id },
          data: {
            status: "CONFIRMADO",
            paidCents: { increment: pagamento.valorCents },
            holdExpiresAt: null,
            proofSentAt: new Date(),
            cancelledAt: null,
            cancelReason: null,
          },
        });
        await tx.bookingEvent.create({
          data: {
            bookingId: b.id,
            type: "SINAL_PAGO",
            message: `Sinal de ${brl(pagamento.valorCents)} recebido via Pix e confirmado automaticamente.`,
            actor: "sistema",
          },
        });
      },
      { timeout: 15_000, maxWait: 10_000 }
    );
  } catch (e) {
    if (e instanceof BookingError) {
      // Pagou, mas o horário não está mais livre. A reserva fica como está e
      // a proprietária resolve pelo painel — devolver ou reagendar.
      await alertarErro("sinal pago para horário ocupado", e, { idPagamento, reserva: b.code });
      await prisma.bookingEvent.create({
        data: {
          bookingId: b.id,
          type: "ATENCAO",
          message: `Sinal de ${brl(pagamento.valorCents)} recebido, mas o horário já estava ocupado. Fale com a cliente para reagendar ou devolver.`,
          actor: "sistema",
        },
      }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    await alertarErro("confirmar pagamento", e, { idPagamento, reserva: b.code });
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
