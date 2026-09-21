import { randomBytes, randomInt } from "crypto";
import type { Booking, BookingStatus } from "@prisma/client";
import { prisma, type Db } from "./db";
import { expireStaleHolds, getSlotsForRange, hasConflict } from "./availability";
import { getDefaultProfessional, getSettings } from "./settings";
import { effectivePrice } from "./format";
import { fmt, localToUtc } from "./time";

export class BookingError extends Error {}

/**
 * Trava exclusiva por profissional durante a transação.
 * Duas reservas simultâneas para a mesma agenda são processadas uma de cada vez,
 * e a disponibilidade é verificada novamente dentro da trava.
 */
async function lockAgenda(tx: Db, professionalId: string) {
  await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${"agenda:" + professionalId}))) AS trava`;
}

async function uniqueCode(tx: Db, prefix: string, startsAt: Date) {
  const day = fmt(startsAt, "yyyyMMdd");
  for (let i = 0; i < 10; i++) {
    const code = `${prefix}-${day}-${randomInt(1000, 10000)}`;
    if (!(await tx.booking.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new BookingError("Não foi possível gerar o código da reserva. Tente novamente.");
}

export const newToken = () => randomBytes(24).toString("base64url");

export type NewBookingInput = {
  serviceId: string;
  date: string;
  time: string;
  name: string;
  phone: string; // já normalizado
  email?: string | null;
  isAllergic: boolean;
  allergyDetails?: string | null;
  isPregnant: boolean;
  clientNotes?: string | null;
  healthConsent: boolean;
  source: "SITE" | "MANUAL";
  isEncaixe?: boolean;
  actor: string;
  initialStatus?: BookingStatus;
};

export async function createBooking(input: NewBookingInput): Promise<Booking> {
  const settings = await getSettings();
  const pro = await getDefaultProfessional();
  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service || (!service.active && input.source === "SITE")) {
    throw new BookingError("Serviço não encontrado.");
  }

  const startsAt = localToUtc(input.date, input.time);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const deposit =
    input.source === "SITE" && settings.depositEnabled ? service.depositCents ?? settings.depositCents : 0;
  const status: BookingStatus = input.initialStatus ?? (deposit > 0 ? "AGUARDANDO_PAGAMENTO" : "CONFIRMADO");

  return prisma.$transaction(
    async (tx) => {
      await lockAgenda(tx, pro.id);
      await expireStaleHolds(tx);

      if (input.source === "SITE") {
        const day = await getSlotsForRange(tx, {
          professionalId: pro.id,
          durationMinutes: service.durationMinutes,
          fromDate: input.date,
          toDate: input.date,
          rules: settings,
        });
        const slot = day[input.date]?.find((s) => s.time === input.time);
        if (!slot || !slot.available) {
          throw new BookingError("Esse horário acabou de ficar indisponível. Escolha outro, por favor.");
        }
      } else if (!input.isEncaixe) {
        const conflict = await hasConflict(tx, pro.id, startsAt, endsAt);
        if (conflict) {
          throw new BookingError(
            conflict === "reserva"
              ? "Já existe uma reserva nesse intervalo. Escolha outro horário ou marque como encaixe."
              : "Esse intervalo está bloqueado na agenda. Remova o bloqueio ou marque como encaixe."
          );
        }
      }

      const client = await tx.client.upsert({
        where: { phone: input.phone },
        update: { name: input.name, ...(input.email ? { email: input.email } : {}) },
        create: { name: input.name, phone: input.phone, email: input.email || null },
      });

      const booking = await tx.booking.create({
        data: {
          code: await uniqueCode(tx, settings.bookingCodePrefix, startsAt),
          token: newToken(),
          professionalId: pro.id,
          clientId: client.id,
          serviceId: service.id,
          startsAt,
          endsAt,
          status,
          source: input.source,
          isEncaixe: !!input.isEncaixe,
          priceCents: effectivePrice(service),
          depositCents: deposit,
          isAllergic: input.isAllergic,
          allergyDetails: input.isAllergic ? input.allergyDetails || null : null,
          isPregnant: input.isPregnant,
          clientNotes: input.clientNotes || null,
          healthConsent: input.healthConsent,
          holdExpiresAt:
            status === "AGUARDANDO_PAGAMENTO" ? new Date(Date.now() + settings.holdMinutes * 60_000) : null,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: "CRIADA",
          message:
            input.source === "SITE"
              ? "Reserva feita pelo site."
              : `Reserva criada manualmente${input.isEncaixe ? " (encaixe)" : ""}.`,
          actor: input.actor,
        },
      });

      return booking;
    },
    { timeout: 15_000, maxWait: 10_000 }
  );
}

/** Cliente pode cancelar pelo link se estiver dentro do prazo mínimo. */
export function canClientCancel(
  b: Pick<Booking, "status" | "startsAt">,
  cancelMinHours: number,
  now = new Date()
) {
  return (
    (b.status === "AGUARDANDO_PAGAMENTO" || b.status === "CONFIRMADO") &&
    b.startsAt.getTime() - now.getTime() >= cancelMinHours * 3600_000
  );
}

export async function rescheduleBooking(opts: {
  bookingId: string;
  date: string;
  time: string;
  isEncaixe: boolean;
  actor: string;
}) {
  const booking = await prisma.booking.findUnique({ where: { id: opts.bookingId }, include: { service: true } });
  if (!booking) throw new BookingError("Reserva não encontrada.");
  const startsAt = localToUtc(opts.date, opts.time);
  const endsAt = new Date(startsAt.getTime() + booking.service.durationMinutes * 60_000);

  return prisma.$transaction(
    async (tx) => {
      await lockAgenda(tx, booking.professionalId);
      if (!opts.isEncaixe) {
        const conflict = await hasConflict(tx, booking.professionalId, startsAt, endsAt, booking.id);
        if (conflict) throw new BookingError("O novo horário conflita com outra reserva ou bloqueio.");
      }
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          startsAt,
          endsAt,
          isEncaixe: opts.isEncaixe,
          rescheduleCount: { increment: 1 },
        },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: "REAGENDADA",
          message: `Reagendada de ${fmt(booking.startsAt, "dd/MM HH:mm")} para ${fmt(startsAt, "dd/MM HH:mm")}.`,
          actor: opts.actor,
        },
      });
      return updated;
    },
    { timeout: 15_000, maxWait: 10_000 }
  );
}
