"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentKind, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { BookingError, createBooking, rescheduleBooking } from "@/lib/booking";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { brl, normalizePhone, parseMoney } from "@/lib/format";
import { isDateStr, isTimeStr, localToUtc, addDaysLocal } from "@/lib/time";

type FormResult = { error?: string } | undefined;

export async function createManualBooking(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!serviceId) return { error: "Escolha o serviço." };
  if (!isDateStr(date) || !isTimeStr(time)) return { error: "Informe data e horário válidos." };
  if (name.length < 2) return { error: "Informe o nome da cliente." };
  if (!phone) return { error: "Informe o WhatsApp com DDD." };

  const allergy = String(form.get("allergyDetails") ?? "").trim();
  let id: string;
  try {
    const b = await createBooking({
      serviceId,
      date,
      time,
      name,
      phone,
      email: String(form.get("email") ?? "").trim() || null,
      isAllergic: form.get("isAllergic") === "on",
      allergyDetails: allergy || null,
      isPregnant: form.get("isPregnant") === "on",
      clientNotes: String(form.get("notes") ?? "").trim() || null,
      healthConsent: true,
      source: "MANUAL",
      isEncaixe: form.get("isEncaixe") === "on",
      actor: admin.name,
      initialStatus: form.get("awaitDeposit") === "on" ? "AGUARDANDO_PAGAMENTO" : "CONFIRMADO",
    });
    id = b.id;
    if (form.get("awaitDeposit") === "on") {
      const s = await getSettings();
      const sv = await prisma.service.findUnique({ where: { id: serviceId } });
      await prisma.booking.update({
        where: { id },
        data: { depositCents: sv?.depositCents ?? s.depositCents, holdExpiresAt: null },
      });
    }
    await audit(admin.id, "RESERVA_CRIADA_MANUAL", "reserva", id, { code: b.code });
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/reservas/${id}`);
}

const ACTIONS = {
  confirmar: { status: "CONFIRMADO", label: "Reserva confirmada." },
  concluir: { status: "CONCLUIDO", label: "Atendimento concluído." },
  falta: { status: "NAO_COMPARECEU", label: "Cliente não compareceu." },
  cancelar: { status: "CANCELADO", label: "Reserva cancelada pela administração." },
  reabrir: { status: "CONFIRMADO", label: "Reserva reaberta." },
} as const;

export async function changeBookingStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const action = String(form.get("action") ?? "") as keyof typeof ACTIONS;
  const cfg = ACTIONS[action];
  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b || !cfg) return;

  const s = await getSettings();
  const lateCancel =
    action === "cancelar" && b.startsAt.getTime() - Date.now() < s.cancelMinHours * 3600_000;
  const reason = String(form.get("reason") ?? "").trim();

  await prisma.booking.update({
    where: { id },
    data: {
      status: cfg.status,
      holdExpiresAt: null,
      ...(action === "cancelar"
        ? { cancelledAt: new Date(), cancelReason: reason || "Cancelada pela administração.", lateCancel }
        : {}),
      ...(action === "reabrir" ? { cancelledAt: null, cancelReason: null, lateCancel: false } : {}),
    },
  });
  await prisma.bookingEvent.create({
    data: {
      bookingId: id,
      type: action.toUpperCase(),
      message: cfg.label + (lateCancel ? " (fora do prazo)" : "") + (reason ? ` Motivo: ${reason}` : ""),
      actor: admin.name,
    },
  });
  await audit(admin.id, `RESERVA_${action.toUpperCase()}`, "reserva", id, { code: b.code });
  revalidatePath("/admin", "layout");
}

/** Confirma o recebimento do sinal (Pix manual) e confirma a reserva. */
export async function confirmDeposit(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b || b.depositCents <= 0) return;
  await prisma.$transaction([
    prisma.payment.create({
      data: { bookingId: id, amountCents: b.depositCents, method: "PIX", kind: "SINAL", status: "PAGO" },
    }),
    prisma.booking.update({
      where: { id },
      data: {
        paidCents: { increment: b.depositCents },
        status: b.status === "AGUARDANDO_PAGAMENTO" || b.status === "CANCELADO" ? "CONFIRMADO" : b.status,
        holdExpiresAt: null,
        ...(b.status === "CANCELADO" ? { cancelledAt: null, cancelReason: null } : {}),
      },
    }),
    prisma.bookingEvent.create({
      data: { bookingId: id, type: "SINAL_PAGO", message: `Sinal de ${brl(b.depositCents)} recebido via Pix.`, actor: admin.name },
    }),
  ]);
  await audit(admin.id, "PAGAMENTO_MANUAL", "reserva", id, { valor: b.depositCents, tipo: "SINAL" });
  revalidatePath("/admin", "layout");
}

export async function registerPayment(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const amount = parseMoney(form.get("amount"));
  const method = String(form.get("method") ?? "PIX") as PaymentMethod;
  const kind = String(form.get("kind") ?? "RESTANTE") as PaymentKind;
  if (!amount || amount <= 0 || !["PIX", "CARTAO", "DINHEIRO", "OUTRO"].includes(method)) return;
  if (!["SINAL", "RESTANTE", "INTEGRAL"].includes(kind)) return;
  await prisma.$transaction([
    prisma.payment.create({ data: { bookingId: id, amountCents: amount, method, kind, status: "PAGO" } }),
    prisma.booking.update({ where: { id }, data: { paidCents: { increment: amount } } }),
    prisma.bookingEvent.create({
      data: { bookingId: id, type: "PAGAMENTO", message: `Pagamento de ${brl(amount)} registrado.`, actor: admin.name },
    }),
  ]);
  await audit(admin.id, "PAGAMENTO_MANUAL", "reserva", id, { valor: amount, method, kind });
  revalidatePath("/admin", "layout");
}

export async function reschedule(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "");
  if (!isDateStr(date) || !isTimeStr(time)) return { error: "Informe data e horário válidos." };
  try {
    await rescheduleBooking({ bookingId: id, date, time, isEncaixe: form.get("isEncaixe") === "on", actor: admin.name });
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  await audit(admin.id, "RESERVA_REAGENDADA", "reserva", id, { date, time });
  revalidatePath("/admin", "layout");
  redirect(`/admin/reservas/${id}`);
}

// ─── Bloqueios de agenda ────────────────────────────────────────────

export async function createBlock(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const pro = await getDefaultProfessional();
  const from = String(form.get("from") ?? "");
  const to = String(form.get("to") ?? "") || from;
  const allDay = form.get("allDay") === "on";
  const startTime = String(form.get("startTime") ?? "");
  const endTime = String(form.get("endTime") ?? "");
  if (!isDateStr(from) || !isDateStr(to) || to < from) return { error: "Confira as datas." };

  let startsAt: Date, endsAt: Date;
  if (allDay) {
    startsAt = localToUtc(from, "00:00");
    endsAt = localToUtc(addDaysLocal(to, 1), "00:00");
  } else {
    if (!isTimeStr(startTime) || !isTimeStr(endTime)) return { error: "Informe o horário inicial e final." };
    startsAt = localToUtc(from, startTime);
    endsAt = localToUtc(to, endTime);
    if (endsAt <= startsAt) return { error: "O horário final precisa ser depois do inicial." };
  }
  const reason = String(form.get("reason") ?? "").trim().slice(0, 120) || null;
  const block = await prisma.timeBlock.create({ data: { professionalId: pro.id, startsAt, endsAt, reason } });
  await audit(admin.id, "BLOQUEIO_CRIADO", "bloqueio", block.id, { from, to, allDay, reason });
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function deleteBlock(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  await prisma.timeBlock.delete({ where: { id } }).catch(() => null);
  await audit(admin.id, "BLOQUEIO_REMOVIDO", "bloqueio", id);
  revalidatePath("/admin", "layout");
}
