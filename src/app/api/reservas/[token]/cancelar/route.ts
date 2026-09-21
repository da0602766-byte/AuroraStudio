import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { canClientCancel } from "@/lib/booking";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  if (!rateLimit(`cancel:${clientIp()}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const s = await getSettings();
  const b = await prisma.booking.findUnique({ where: { token: params.token } });
  if (!b) return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  if (!canClientCancel(b, s.cancelMinHours)) {
    return NextResponse.json(
      { error: `O cancelamento pelo site é possível até ${s.cancelMinHours} horas antes. Fale pelo WhatsApp.` },
      { status: 409 }
    );
  }
  const res = await prisma.booking.updateMany({
    where: { id: b.id, status: { in: ["AGUARDANDO_PAGAMENTO", "CONFIRMADO"] } },
    data: { status: "CANCELADO", cancelledAt: new Date(), cancelReason: "Cancelada pela cliente." },
  });
  if (res.count) {
    await prisma.bookingEvent.create({
      data: { bookingId: b.id, type: "CANCELADA", message: "Cancelada pela cliente pelo link da reserva.", actor: "cliente" },
    });
  }
  return NextResponse.json({ ok: true });
}
