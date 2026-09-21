"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function lookupBooking(_prev: { error?: string } | undefined, form: FormData) {
  if (!rateLimit(`consulta:${clientIp()}`, 8, 10 * 60_000)) {
    return { error: "Muitas tentativas. Aguarde alguns minutos." };
  }
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!code || !phone) return { error: "Informe o código da reserva e o WhatsApp usado no agendamento." };

  const b = await prisma.booking.findFirst({
    where: { code, client: { phone } },
    select: { token: true },
  });
  // Mesma mensagem para qualquer falha, sem revelar se o código existe
  if (!b) return { error: "Não encontramos uma reserva com esses dados. Confira o código e o número." };
  redirect(`/reserva/${b.token}`);
}
