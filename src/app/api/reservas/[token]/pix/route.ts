import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { criarCobrancaPix, mercadoPagoConfigurado, PagamentoError } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Devolve o Pix do sinal desta reserva, criando a cobrança na primeira vez.
 *
 * Reaproveita a cobrança que já existe: recarregar a página não gera Pix
 * novo, senão a cliente ficaria com vários códigos válidos ao mesmo tempo.
 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  if (!rateLimit(`pix:${clientIp()}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ error: "Pagamento automático não configurado." }, { status: 503 });
  }

  const b = await prisma.booking.findUnique({
    where: { token: params.token },
    include: { client: true, service: true },
  });
  if (!b) return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  if (b.status !== "AGUARDANDO_PAGAMENTO" || b.depositCents <= 0) {
    return NextResponse.json({ error: "Esta reserva não tem sinal a pagar." }, { status: 409 });
  }

  const agora = new Date();

  const existente = await prisma.payment.findFirst({
    where: { bookingId: b.id, kind: "SINAL", status: "PENDENTE", pixCode: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (existente && (!existente.expiresAt || existente.expiresAt > agora)) {
    return NextResponse.json({
      copiaECola: existente.pixCode,
      qrCodeBase64: existente.pixQrBase64,
      expiraEm: existente.expiresAt,
      valorCents: existente.amountCents,
    });
  }

  const s = await getSettings();
  // A cobrança vence junto com a reserva, ou em 30 minutos se não houver prazo.
  const expiraEm = b.holdExpiresAt && b.holdExpiresAt > agora
    ? b.holdExpiresAt
    : new Date(agora.getTime() + Math.max(5, s.holdMinutes) * 60_000);

  try {
    const cobranca = await criarCobrancaPix({
      bookingId: b.id,
      valorCents: b.depositCents,
      descricao: `Sinal — ${b.service.name} — reserva ${b.code}`,
      nome: b.client.name,
      email: b.client.email,
      expiraEm,
      notificationUrl: `${siteUrl()}/api/pagamentos/mercadopago`,
    });

    await prisma.payment.create({
      data: {
        bookingId: b.id,
        amountCents: b.depositCents,
        method: "PIX",
        kind: "SINAL",
        status: "PENDENTE",
        reference: cobranca.id,
        pixCode: cobranca.copiaECola,
        pixQrBase64: cobranca.qrCodeBase64,
        expiresAt: cobranca.expiraEm ?? expiraEm,
      },
    });

    return NextResponse.json({
      copiaECola: cobranca.copiaECola,
      qrCodeBase64: cobranca.qrCodeBase64,
      expiraEm: cobranca.expiraEm ?? expiraEm,
      valorCents: b.depositCents,
    });
  } catch (e) {
    if (e instanceof PagamentoError) return NextResponse.json({ error: e.message }, { status: 502 });
    console.error("Erro ao gerar o Pix", e);
    return NextResponse.json({ error: "Não foi possível gerar o Pix agora." }, { status: 500 });
  }
}
