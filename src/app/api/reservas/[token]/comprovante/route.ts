import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * A cliente avisa que já enviou o Pix. O horário deixa de expirar sozinho
 * e fica aguardando a conferência da proprietária no painel.
 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  if (!rateLimit(`comprov:${clientIp()}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  }
  const b = await prisma.booking.findUnique({ where: { token: params.token } });
  if (!b || b.status !== "AGUARDANDO_PAGAMENTO") return NextResponse.json({ ok: false }, { status: 404 });
  if (b.holdExpiresAt && b.holdExpiresAt < new Date()) {
    return NextResponse.json({ error: "O prazo desta reserva terminou." }, { status: 409 });
  }
  if (!b.proofSentAt) {
    await prisma.booking.update({ where: { id: b.id }, data: { proofSentAt: new Date(), holdExpiresAt: null } });
    await prisma.bookingEvent.create({
      data: { bookingId: b.id, type: "COMPROVANTE", message: "Cliente informou que enviou o Pix do sinal.", actor: "cliente" },
    });
  }
  return NextResponse.json({ ok: true });
}
