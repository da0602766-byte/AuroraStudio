import { NextResponse, type NextRequest } from "next/server";
import { bookingRequestSchema } from "@/lib/validators";
import { BookingError, createBooking } from "@/lib/booking";
import { validarTelefone } from "@/lib/format";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";
import { avisarNovaReserva } from "@/lib/notificacoes";
import { alertarErro } from "@/lib/alerta";

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
  const tel = validarTelefone(d.phone);
  if (!tel.ok) return NextResponse.json({ error: tel.motivo, field: "phone" }, { status: 400 });
  const phone = tel.numero;

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
    // Avisa a proprietária em segundo plano: o e-mail não pode atrasar nem
    // derrubar a resposta para a cliente.
    void avisarNovaReserva(booking.id);

    return NextResponse.json({ token: booking.token, code: booking.code }, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, field: "time" }, { status: 409 });
    await alertarErro("criar reserva", e, { serviço: d.serviceId, data: d.date, hora: d.time });
    return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente em instantes." }, { status: 500 });
  }
}
