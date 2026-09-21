"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentKind, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertSlotFree, BookingError, createBooking, lockAgenda, rescheduleBooking } from "@/lib/booking";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { brl, normalizePhone, parseMoney } from "@/lib/format";
import { isDateStr, isTimeStr, localToUtc, addDaysLocal } from "@/lib/time";

type FormResult = { error?: string; ok?: string } | undefined;

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

const isAction = (v: string): v is keyof typeof ACTIONS => Object.prototype.hasOwnProperty.call(ACTIONS, v);

export async function changeBookingStatus(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const action = String(form.get("action") ?? "");
  // Só as cinco ações declaradas passam: sem isto, nomes herdados de Object
  // (como "constructor") atravessariam a verificação abaixo.
  if (!isAction(action)) return { error: "Ação desconhecida." };
  const cfg = ACTIONS[action];
  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) return { error: "Reserva não encontrada." };

  const s = await getSettings();
  const lateCancel =
    action === "cancelar" && b.startsAt.getTime() - Date.now() < s.cancelMinHours * 3600_000;
  const reason = String(form.get("reason") ?? "").trim();

  try {
    await prisma.$transaction(
      async (tx) => {
        // Reabrir devolve a reserva à agenda, então o horário precisa estar
        // livre de novo: enquanto esteve cancelada, outra cliente pode tê-lo
        // ocupado.
        if (action === "reabrir") {
          await lockAgenda(tx, b.professionalId);
          await assertSlotFree(tx, b);
        }
        await tx.booking.update({
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
        await tx.bookingEvent.create({
          data: {
            bookingId: id,
            type: action.toUpperCase(),
            message: cfg.label + (lateCancel ? " (fora do prazo)" : "") + (reason ? ` Motivo: ${reason}` : ""),
            actor: admin.name,
          },
        });
      },
      { timeout: 15_000, maxWait: 10_000 }
    );
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }

  await audit(admin.id, `RESERVA_${action.toUpperCase()}`, "reserva", id, { code: b.code });
  revalidatePath("/admin", "layout");
  return undefined;
}

/** Confirma o recebimento do sinal (Pix manual) e confirma a reserva. */
export async function confirmDeposit(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) return { error: "Reserva não encontrada." };
  if (b.depositCents <= 0) return { error: "Esta reserva não tem sinal a receber." };
  const revive = b.status === "AGUARDANDO_PAGAMENTO" || b.status === "CANCELADO";

  try {
    await prisma.$transaction(
      async (tx) => {
        // Confirmar o sinal de uma reserva cancelada a devolve à agenda, então
        // vale a mesma checagem da reabertura.
        if (b.status === "CANCELADO") {
          await lockAgenda(tx, b.professionalId);
          await assertSlotFree(tx, b);
        }
        await tx.payment.create({
          data: { bookingId: id, amountCents: b.depositCents, method: "PIX", kind: "SINAL", status: "PAGO" },
        });
        await tx.booking.update({
          where: { id },
          data: {
            paidCents: { increment: b.depositCents },
            status: revive ? "CONFIRMADO" : b.status,
            holdExpiresAt: null,
            ...(b.status === "CANCELADO" ? { cancelledAt: null, cancelReason: null } : {}),
          },
        });
        await tx.bookingEvent.create({
          data: { bookingId: id, type: "SINAL_PAGO", message: `Sinal de ${brl(b.depositCents)} recebido via Pix.`, actor: admin.name },
        });
      },
      { timeout: 15_000, maxWait: 10_000 }
    );
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }

  await audit(admin.id, "PAGAMENTO_MANUAL", "reserva", id, { valor: b.depositCents, tipo: "SINAL" });
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function registerPayment(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const amount = parseMoney(form.get("amount"));
  const method = String(form.get("method") ?? "PIX") as PaymentMethod;
  const kind = String(form.get("kind") ?? "RESTANTE") as PaymentKind;
  if (!amount || amount <= 0) return { error: "Informe um valor maior que zero." };
  if (!["PIX", "CARTAO", "DINHEIRO", "OUTRO"].includes(method)) return { error: "Forma de pagamento inválida." };
  if (!["SINAL", "RESTANTE", "INTEGRAL"].includes(kind)) return { error: "Tipo de pagamento inválido." };
  // Sem esta conferência, um id inexistente derruba a página com erro 500.
  if (!(await prisma.booking.findUnique({ where: { id }, select: { id: true } }))) {
    return { error: "Reserva não encontrada." };
  }
  await prisma.$transaction([
    prisma.payment.create({ data: { bookingId: id, amountCents: amount, method, kind, status: "PAGO" } }),
    prisma.booking.update({ where: { id }, data: { paidCents: { increment: amount } } }),
    prisma.bookingEvent.create({
      data: { bookingId: id, type: "PAGAMENTO", message: `Pagamento de ${brl(amount)} registrado.`, actor: admin.name },
    }),
  ]);
  await audit(admin.id, "PAGAMENTO_MANUAL", "reserva", id, { valor: amount, method, kind });
  revalidatePath("/admin", "layout");
  return undefined;
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
