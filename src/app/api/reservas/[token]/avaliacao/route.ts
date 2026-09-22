import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reviewSchema } from "@/lib/validators";
import { firstName } from "@/lib/format";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";
import { revalidateTag } from "next/cache";
import { ADMIN_NAV_TAG } from "@/lib/cache";

/** Avaliação verificada: só a partir de uma reserva concluída, uma por reserva. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await sharedRateLimit(`aval:${await clientIp()}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  }
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const b = await prisma.booking.findUnique({
    where: { token },
    include: { client: true, service: true, review: true },
  });
  if (!b || b.status !== "CONCLUIDO") return NextResponse.json({ error: "Avaliação indisponível para esta reserva." }, { status: 409 });
  if (b.review) return NextResponse.json({ error: "Você já avaliou este atendimento. Obrigada!" }, { status: 409 });

  await prisma.review.create({
    data: {
      bookingId: b.id,
      clientName: firstName(b.client.name),
      serviceName: b.service.name,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      verified: true,
    },
  });
  revalidateTag(ADMIN_NAV_TAG, { expire: 0 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
