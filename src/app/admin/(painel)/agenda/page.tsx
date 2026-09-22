import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSlotsForRange } from "@/lib/availability";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { addDaysLocal, fmt, isDateStr, localDateOf, localToUtc, todayLocal, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";
import { StatusBadge } from "@/components/admin/StatusBadge";

type View = "dia" | "semana" | "mes";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ view?: string; data?: string }> }) {
  const query = await searchParams;
  const view: View = query.view === "dia" || query.view === "mes" ? query.view : "semana";
  const date = isDateStr(query.data) ? query.data : todayLocal();
  const [s, pro] = await Promise.all([getSettings(), getDefaultProfessional()]);

  let from: string, to: string;
  if (view === "dia") {
    from = to = date;
  } else if (view === "semana") {
    const wd = weekdayOf(date);
    from = addDaysLocal(date, -((wd + 6) % 7)); // segunda-feira
    to = addDaysLocal(from, 6);
  } else {
    from = `${date.slice(0, 7)}-01`;
    const [y, m] = date.split("-").map(Number);
    to = `${date.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  }
  const rangeStart = localToUtc(from, "00:00");
  const rangeEnd = localToUtc(addDaysLocal(to, 1), "00:00");

  const [bookings, blocks, slots] = await Promise.all([
    prisma.booking.findMany({
      where: { professionalId: pro.id, startsAt: { gte: rangeStart, lt: rangeEnd } },
      include: { client: true, service: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.timeBlock.findMany({
      where: { professionalId: pro.id, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      orderBy: { startsAt: "asc" },
    }),
    getSlotsForRange(prisma, { professionalId: pro.id, durationMinutes: 60, fromDate: from, toDate: to, rules: s, ignoreRules: true }),
  ]);

  const step = view === "dia" ? 1 : view === "semana" ? 7 : 0;
  const prev = step ? addDaysLocal(date, -step) : shiftMonth(date, -1);
  const nextD = step ? addDaysLocal(date, step) : shiftMonth(date, 1);
  const link = (v: View, d: string) => `/admin/agenda?view=${v}&data=${d}`;

  const title =
    view === "dia"
      ? fmt(localToUtc(date, "12:00"), "EEEE, d 'de' MMMM")
      : view === "semana"
        ? `${fmt(localToUtc(from, "12:00"), "d MMM")} a ${fmt(localToUtc(to, "12:00"), "d MMM")}`
        : fmt(localToUtc(date, "12:00"), "MMMM 'de' yyyy");

  const byDay = (d: string) => bookings.filter((b) => localDateOf(b.startsAt) === d);
  const blocksOn = (d: string) =>
    blocks.filter((b) => b.startsAt < localToUtc(addDaysLocal(d, 1), "00:00") && b.endsAt > localToUtc(d, "00:00"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl capitalize">{title}</h1>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-full border border-linha bg-white p-1" role="group" aria-label="Visualização">
            {(["dia", "semana", "mes"] as View[]).map((v) => (
              <Link key={v} href={link(v, date)} aria-current={v === view ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm ${v === view ? "bg-bordo text-white" : ""}`}>
                {v === "mes" ? "Mês" : v === "dia" ? "Dia" : "Semana"}
              </Link>
            ))}
          </div>
          <Link href={link(view, prev)} className="btn-contorno btn-pequeno w-10 px-0" aria-label="Anterior">‹</Link>
          <Link href={link(view, todayLocal())} className="btn-contorno btn-pequeno">Hoje</Link>
          <Link href={link(view, nextD)} className="btn-contorno btn-pequeno w-10 px-0" aria-label="Próximo">›</Link>
        </div>
      </div>

      {view === "dia" && (
        <DayView
          date={date}
          bookings={byDay(date)}
          blocks={blocksOn(date)}
          slots={slots[date] ?? []}
        />
      )}

      {view === "semana" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 7 }, (_, i) => addDaysLocal(from, i)).map((d) => {
            const list = byDay(d).filter((b) => b.status !== "CANCELADO");
            const freeCount = (slots[d] ?? []).filter((x) => x.available).length;
            const dayBlocks = blocksOn(d);
            return (
              <section key={d} className={`painel-bloco ${d === todayLocal() ? "border-ouro" : ""}`}>
                <Link href={link("dia", d)} className="flex items-baseline justify-between hover:text-bordo">
                  <h2 className="text-xl capitalize">{fmt(localToUtc(d, "12:00"), "EEEE, dd/MM")}</h2>
                  <span className="text-xs text-marrom-medio">{freeCount ? `${freeCount} livre${freeCount > 1 ? "s" : ""}` : ""}</span>
                </Link>
                {dayBlocks.map((bl) => (
                  <p key={bl.id} className="mt-2 rounded-lg bg-stone-100 px-3 py-1.5 text-sm text-stone-600">
                    Bloqueado {fmt(bl.startsAt, "HH:mm")}–{fmt(bl.endsAt, "HH:mm")}{bl.reason ? `: ${bl.reason}` : ""}
                  </p>
                ))}
                {list.length === 0 ? (
                  <p className="mt-2 text-sm text-marrom-claro">Sem reservas</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {list.map((b) => (
                      <li key={b.id}>
                        <Link href={`/admin/reservas/${b.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-po">
                          <span><strong className="font-medium">{fmt(b.startsAt, "HH:mm")}</strong> {b.client.name} <span className="text-marrom-medio">· {b.service.name}</span></span>
                          <StatusBadge status={b.status} proof={!!b.proofSentAt} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {view === "mes" && (
        <div className="rounded-2xl border border-linha bg-white p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-marrom-medio">
            {WEEKDAYS_SHORT.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {Array.from({ length: weekdayOf(from) }, (_, i) => <span key={`v${i}`} />)}
            {daysBetween(from, to).map((d) => {
              const n = byDay(d).filter((b) => b.status !== "CANCELADO").length;
              const blocked = blocksOn(d).length > 0;
              return (
                <Link
                  key={d}
                  href={link("dia", d)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm hover:bg-po ${d === todayLocal() ? "ring-2 ring-ouro" : ""} ${blocked ? "bg-stone-100" : ""}`}
                >
                  <span>{Number(d.slice(8))}</span>
                  {n > 0 && <span className="mt-0.5 rounded-full bg-bordo px-1.5 text-[11px] text-white">{n}</span>}
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-marrom-medio">Número = reservas no dia. Fundo cinza = dia com bloqueio.</p>
        </div>
      )}
    </div>
  );
}

function DayView({
  date,
  bookings,
  blocks,
  slots,
}: {
  date: string;
  bookings: Prisma.BookingGetPayload<{ include: { client: true; service: true } }>[];
  blocks: { id: string; startsAt: Date; endsAt: Date; reason: string | null }[];
  slots: { time: string; available: boolean }[];
}) {
  const active = bookings.filter((b) => b.status !== "CANCELADO");
  const cancelled = bookings.filter((b) => b.status === "CANCELADO");
  const takenTimes = new Set(active.map((b) => fmt(b.startsAt, "HH:mm")));
  type Row = { time: string; node: React.ReactNode; key: string };
  const rows: Row[] = [
    ...active.map((b) => ({
      time: fmt(b.startsAt, "HH:mm"),
      key: b.id,
      node: (
        <Link href={`/admin/reservas/${b.id}`} className="flex flex-1 items-center justify-between gap-3 rounded-xl bg-po px-4 py-3 hover:bg-po-escuro">
          <span>
            <span className="block font-medium">{b.client.name}{b.isEncaixe && <span className="ml-2 text-xs text-ouro">encaixe</span>}</span>
            <span className="text-sm text-marrom-medio">{b.service.name} até {fmt(b.endsAt, "HH:mm")}</span>
          </span>
          <StatusBadge status={b.status} proof={!!b.proofSentAt} />
        </Link>
      ),
    })),
    ...blocks.map((bl) => ({
      time: fmt(bl.startsAt, "yyyy-MM-dd") < date ? "00:00" : fmt(bl.startsAt, "HH:mm"),
      key: bl.id,
      node: (
        <div className="flex-1 rounded-xl bg-stone-100 px-4 py-3 text-stone-600">
          Bloqueado até {fmt(bl.endsAt, "dd/MM HH:mm")}{bl.reason ? ` — ${bl.reason}` : ""}
        </div>
      ),
    })),
    ...slots
      .filter((sl) => !takenTimes.has(sl.time))
      .map((sl) => ({
        time: sl.time,
        key: `s${sl.time}`,
        node: sl.available ? (
          <Link href={`/admin/reservas/nova?data=${date}&hora=${sl.time}`} className="flex-1 rounded-xl border border-dashed border-linha px-4 py-3 text-marrom-medio hover:border-bordo hover:text-bordo">
            Livre — reservar
          </Link>
        ) : (
          <div className="flex-1 rounded-xl px-4 py-3 text-sm text-marrom-claro">Indisponível</div>
        ),
      })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="painel-bloco">
      {rows.length === 0 ? (
        <p className="text-marrom-medio">
          Dia sem horários de atendimento.{" "}
          <Link href={`/admin/reservas/nova?data=${date}`} className="text-bordo underline underline-offset-4">Criar reserva ou encaixe</Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-stretch gap-3">
              <span className="w-14 shrink-0 pt-3 font-display text-lg">{r.time}</span>
              {r.node}
            </li>
          ))}
        </ul>
      )}
      {cancelled.length > 0 && (
        <div className="mt-6 border-t border-linha pt-4">
          <h2 className="text-sm font-medium text-marrom-medio">Canceladas</h2>
          <ul className="mt-2 space-y-1 text-sm text-marrom-claro">
            {cancelled.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/reservas/${b.id}`} className="hover:text-bordo">
                  {fmt(b.startsAt, "HH:mm")} {b.client.name} · {b.service.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6">
        <Link href={`/admin/reservas/nova?data=${date}`} className="btn-contorno btn-pequeno">Adicionar encaixe</Link>
      </div>
    </div>
  );
}

function shiftMonth(date: string, delta: number) {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysLocal(d, 1)) out.push(d);
  return out;
}
