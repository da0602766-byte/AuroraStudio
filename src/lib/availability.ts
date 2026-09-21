import type { Prisma } from "@prisma/client";
import type { Db } from "./db";
import { addDaysLocal, localToUtc, todayLocal, weekdayOf } from "./time";

export type Slot = {
  time: string; // "HH:mm" local
  startsAt: string; // ISO UTC
  available: boolean;
};

export type DaySummary = { date: string; total: number; available: number };

type Rules = { minAdvanceHours: number; bookingWindowDays: number };

/** Reservas que ocupam a agenda: confirmadas e as que ainda aguardam sinal dentro do prazo. */
export function occupyingWhere(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: { in: ["CONFIRMADO", "CONCLUIDO", "NAO_COMPARECEU"] } },
      { status: "AGUARDANDO_PAGAMENTO", OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
    ],
  };
}

/** Cancela reservas cujo prazo para o sinal terminou, liberando o horário. */
export async function expireStaleHolds(db: Db) {
  const now = new Date();
  const stale = await db.booking.findMany({
    where: { status: "AGUARDANDO_PAGAMENTO", holdExpiresAt: { lt: now } },
    select: { id: true },
  });
  if (!stale.length) return;

  // Cada reserva é cancelada individualmente e só gera evento se a atualização
  // realmente aconteceu. Sem isso, uma reserva confirmada no painel entre a
  // consulta e a atualização ganharia um "cancelada automaticamente" falso no
  // histórico.
  const expired: string[] = [];
  for (const { id } of stale) {
    const res = await db.booking.updateMany({
      where: { id, status: "AGUARDANDO_PAGAMENTO", holdExpiresAt: { lt: now } },
      data: { status: "CANCELADO", cancelledAt: now, cancelReason: "O prazo para pagamento do sinal terminou." },
    });
    if (res.count) expired.push(id);
  }

  if (expired.length) {
    await db.bookingEvent.createMany({
      data: expired.map((bookingId) => ({
        bookingId,
        type: "EXPIRADA",
        message: "Reserva cancelada automaticamente: o sinal não foi informado dentro do prazo.",
        actor: "sistema",
      })),
    });
  }
}

/** Verifica se o intervalo conflita com reservas ou bloqueios. */
export async function hasConflict(
  db: Db,
  professionalId: string,
  start: Date,
  end: Date,
  excludeBookingId?: string
): Promise<"reserva" | "bloqueio" | null> {
  const now = new Date();
  const booking = await db.booking.findFirst({
    where: {
      professionalId,
      startsAt: { lt: end },
      endsAt: { gt: start },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      ...occupyingWhere(now),
    },
    select: { id: true },
  });
  if (booking) return "reserva";
  const block = await db.timeBlock.findFirst({
    where: { professionalId, startsAt: { lt: end }, endsAt: { gt: start } },
    select: { id: true },
  });
  return block ? "bloqueio" : null;
}

/**
 * Calcula os horários de cada dia no intervalo [fromDate, toDate].
 * Considera horários de atendimento, antecedência mínima, janela de agendamento,
 * duração do serviço, reservas existentes e bloqueios.
 */
export async function getSlotsForRange(
  db: Db,
  opts: {
    professionalId: string;
    durationMinutes: number;
    fromDate: string;
    toDate: string;
    rules: Rules;
    ignoreRules?: boolean;
  }
): Promise<Record<string, Slot[]>> {
  const { professionalId, durationMinutes, fromDate, toDate, rules } = opts;
  const now = new Date();
  const earliest = opts.ignoreRules ? now : new Date(now.getTime() + rules.minAdvanceHours * 3600_000);
  const lastDate = opts.ignoreRules ? toDate : minDate(toDate, addDaysLocal(todayLocal(), rules.bookingWindowDays));

  const working = await db.workingSlot.findMany({
    where: { professionalId, active: true },
    orderBy: { time: "asc" },
  });
  const byWeekday = new Map<number, string[]>();
  for (const w of working) byWeekday.set(w.weekday, [...(byWeekday.get(w.weekday) ?? []), w.time]);

  const rangeStart = localToUtc(fromDate, "00:00");
  const rangeEnd = new Date(localToUtc(addDaysLocal(toDate, 1), "00:00").getTime() + durationMinutes * 60_000);

  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { professionalId, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart }, ...occupyingWhere(now) },
      select: { startsAt: true, endsAt: true },
    }),
    db.timeBlock.findMany({
      where: { professionalId, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  const busy = [...bookings, ...blocks];

  const result: Record<string, Slot[]> = {};
  for (let date = fromDate; date <= toDate; date = addDaysLocal(date, 1)) {
    if (date > lastDate) {
      result[date] = [];
      continue;
    }
    const times = byWeekday.get(weekdayOf(date)) ?? [];
    result[date] = times.map((time) => {
      const start = localToUtc(date, time);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const free =
        start >= earliest && !busy.some((b) => b.startsAt < end && b.endsAt > start);
      return { time, startsAt: start.toISOString(), available: free };
    });
  }
  return result;
}

export async function getDaySummaries(
  db: Db,
  opts: { professionalId: string; durationMinutes: number; fromDate: string; toDate: string; rules: Rules }
): Promise<DaySummary[]> {
  const slots = await getSlotsForRange(db, opts);
  return Object.entries(slots).map(([date, list]) => ({
    date,
    total: list.length,
    available: list.filter((s) => s.available).length,
  }));
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}
