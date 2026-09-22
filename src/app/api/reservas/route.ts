import { NextResponse, type NextRequest } from "next/server";
import { bookingRequestSchema } from "@/lib/validators";
import { BookingError, createBooking } from "@/lib/booking";
import { normalizePhone } from "@/lib/format";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!(await sharedRateLimit(`reserva:${await clientIp()}`, 6, 10 * 60_000))) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos ou fale pelo WhatsApp." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Confira os dados.", field: issue?.path[0] }, { status: 400 });
  }
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return NextResponse.json({ error: "Informe um WhatsApp com DDD.", field: "phone" }, { status: 400 });

  try {
    const booking = await createBooking({
      serviceId: d.serviceId,
      date: d.date,
      time: d.time,
      name: d.name,
      phone,
      email: d.email || null,
      isAllergic: d.isAllergic,
      allergyDetails: d.allergyDetails,
      isPregnant: d.isPregnant,
      clientNotes: d.notes,
      healthConsent: true,
      source: "SITE",
      actor: "cliente",
    });
    return NextResponse.json({ token: booking.token, code: booking.code }, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, field: "time" }, { status: 409 });
    console.error("Erro ao criar reserva", e);
    return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente em instantes." }, { status: 500 });
  }
}
