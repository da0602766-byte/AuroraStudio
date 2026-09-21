import Link from "next/link";
import { prisma } from "@/lib/db";
import { expireStaleHolds, getSlotsForRange } from "@/lib/availability";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { brl, firstName } from "@/lib/format";
import { addDaysLocal, dayRangeUtc, fmt, localToUtc, todayLocal } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/Buttons";
import { confirmDeposit } from "../actions/bookings";
import { ActionForm } from "@/components/admin/ActionForm";

export default async function Dashboard() {
  await expireStaleHolds(prisma);
  const [s, pro] = await Promise.all([getSettings(), getDefaultProfessional()]);
  const today = todayLocal();
  const { start: dayStart, end: dayEnd } = dayRangeUtc(today);
  const monthStart = localToUtc(`${today.slice(0, 7)}-01`, "00:00");
  const now = new Date();

  const [todayList, next, awaiting, paidMonth, doneMonth, cancelMonth, noShowMonth, newClients, freeSlots, returns] =
    await Promise.all([
      prisma.booking.findMany({
        where: { startsAt: { gte: dayStart, lt: dayEnd }, status: { not: "CANCELADO" } },
        include: { client: true, service: true },
        orderBy: { startsAt: "asc" },
      }),
      prisma.booking.findFirst({
        where: { startsAt: { gte: now }, status: { in: ["CONFIRMADO", "AGUARDANDO_PAGAMENTO"] } },
        include: { client: true, service: true },
        orderBy: { startsAt: "asc" },
      }),
      prisma.booking.findMany({
        where: { status: "AGUARDANDO_PAGAMENTO" },
        include: { client: true, service: true },
        orderBy: [{ proofSentAt: { sort: "desc", nulls: "last" } }, { startsAt: "asc" }],
        take: 10,
      }),
      prisma.payment.aggregate({ where: { status: "PAGO", createdAt: { gte: monthStart } }, _sum: { amountCents: true } }),
      prisma.booking.count({ where: { status: "CONCLUIDO", startsAt: { gte: monthStart } } }),
      prisma.booking.count({ where: { status: "CANCELADO", cancelledAt: { gte: monthStart } } }),
      prisma.booking.count({ where: { status: "NAO_COMPARECEU", startsAt: { gte: monthStart } } }),
      prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
      getSlotsForRange(prisma, {
        professionalId: pro.id,
        durationMinutes: 60,
        fromDate: today,
        toDate: addDaysLocal(today, 6),
        rules: s,
        ignoreRules: true,
      }),
      returnsDue(),
    ]);

  const free = Object.entries(freeSlots)
    .map(([date, list]) => ({ date, times: list.filter((x) => x.available).map((x) => x.time) }))
    .filter((d) => d.times.length);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-marrom-medio">{fmt(now, "EEEE, d 'de' MMMM")}</p>
          <h1 className="text-3xl sm:text-4xl">Olá{s.ownerName ? `, ${firstName(s.ownerName)}` : ""}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/reservas/nova" className="btn-primario btn-pequeno">Nova reserva</Link>
          <Link href="/admin/bloqueios" className="btn-contorno btn-pequeno">Bloquear horário</Link>
        </div>
      </div>

      {/* Números do mês */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Recebido no mês" value={brl(paidMonth._sum.amountCents ?? 0)} />
        <Stat label="Atendimentos" value={doneMonth} />
        <Stat label="Clientes novas" value={newClients} />
        <Stat label="Cancelamentos" value={cancelMonth} />
        <Stat label="Faltas" value={noShowMonth} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hoje */}
        <section className="painel-bloco">
          <h2 className="text-2xl">Hoje</h2>
          {todayList.length === 0 ? (
            <p className="mt-3 text-marrom-medio">Nenhum atendimento marcado para hoje.</p>
          ) : (
            <ul className="mt-3 divide-y divide-linha">
              {todayList.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/reservas/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-bordo">
                    <span className="flex items-center gap-3">
                      <span className="w-12 font-display text-lg">{fmt(b.startsAt, "HH:mm")}</span>
                      <span>
                        <span className="block font-medium">{b.client.name}</span>
                        <span className="text-sm text-marrom-medio">{b.service.name}</span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <StatusBadge status={b.status} proof={!!b.proofSentAt} />
                      {(b.isAllergic || b.isPregnant) && (
                        <span className="text-xs text-bordo">{[b.isAllergic && "alergia", b.isPregnant && "gestante"].filter(Boolean).join(", ")}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {next && next.startsAt >= dayEnd && (
            <p className="mt-4 border-t border-linha pt-4 text-sm text-marrom-medio">
              Próxima cliente: <Link href={`/admin/reservas/${next.id}`} className="font-medium text-marrom hover:text-bordo">{next.client.name}</Link>,{" "}
              {fmt(next.startsAt, "EEEE dd/MM 'às' HH:mm")} ({next.service.name})
            </p>
          )}
        </section>

        {/* Sinais */}
        <section className="painel-bloco">
          <h2 className="text-2xl">Sinais a conferir</h2>
          {awaiting.length === 0 ? (
            <p className="mt-3 text-marrom-medio">Nenhum sinal pendente.</p>
          ) : (
            <ul className="mt-3 divide-y divide-linha">
              {awaiting.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/admin/reservas/${b.id}`} className="hover:text-bordo">
                    <span className="block font-medium">{b.client.name}</span>
                    <span className="text-sm text-marrom-medio">
                      {b.service.name}, {fmt(b.startsAt, "dd/MM HH:mm")}
                      {b.proofSentAt ? " — comprovante informado" : b.holdExpiresAt ? ` — expira ${fmt(b.holdExpiresAt, "HH:mm")}` : ""}
                    </span>
                  </Link>
                  <ActionForm action={confirmDeposit}>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton className="btn-primario btn-pequeno" pendingText="Confirmando…">
                      Recebi {brl(b.depositCents)}
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Horários livres */}
        <section className="painel-bloco">
          <h2 className="text-2xl">Horários livres nos próximos 7 dias</h2>
          {free.length === 0 ? (
            <p className="mt-3 text-marrom-medio">Agenda cheia nos próximos dias.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-[15px]">
              {free.map((d) => (
                <li key={d.date}>
                  <Link href={`/admin/agenda?view=dia&data=${d.date}`} className="font-medium capitalize hover:text-bordo">
                    {fmt(localToUtc(d.date, "12:00"), "EEE dd/MM")}
                  </Link>
                  <span className="text-marrom-medio">: {d.times.map((t) => t.replace(":", "h")).join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Retornos */}
        <section className="painel-bloco">
          <h2 className="text-2xl">Clientes para retorno</h2>
          {returns.length === 0 ? (
            <p className="mt-3 text-marrom-medio">
              Nenhum retorno próximo. Defina o prazo de retorno em cada serviço para acompanhar aqui.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-linha">
              {returns.map((r) => {
                const wa = waLink(r.phone, `Olá, ${firstName(r.name)}! Já está chegando a hora do retorno de ${r.service.toLowerCase()}. Quer que eu reserve um horário para você?`);
                return (
                  <li key={r.clientId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <Link href={`/admin/clientes/${r.clientId}`} className="hover:text-bordo">
                      <span className="block font-medium">{r.name}</span>
                      <span className="text-sm text-marrom-medio">
                        {r.service}: última em {fmt(r.last, "dd/MM")}, retorno {fmt(r.from, "dd/MM")} a {fmt(r.to, "dd/MM")}
                        {r.overdue && <span className="ml-1 text-bordo">(atrasado)</span>}
                      </span>
                    </Link>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-contorno btn-pequeno">WhatsApp</a>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-linha bg-white px-4 py-3">
      <dt className="text-xs text-marrom-medio">{label}</dt>
      <dd className="mt-1 font-display text-2xl">{value}</dd>
    </div>
  );
}

/** Clientes com retorno recomendado próximo (7 dias) ou atrasado, sem reserva futura. */
async function returnsDue() {
  const now = new Date();
  const since = new Date(now.getTime() - 180 * 86400_000);
  const done = await prisma.booking.findMany({
    where: { status: "CONCLUIDO", startsAt: { gte: since }, service: { returnDaysMin: { not: null } } },
    include: { client: true, service: true },
    orderBy: { startsAt: "desc" },
  });
  const future = await prisma.booking.findMany({
    where: { startsAt: { gte: now }, status: { in: ["CONFIRMADO", "AGUARDANDO_PAGAMENTO"] } },
    select: { clientId: true },
  });
  const hasFuture = new Set(future.map((f) => f.clientId));
  const seen = new Set<string>();
  const list: { clientId: string; name: string; phone: string; service: string; last: Date; from: Date; to: Date; overdue: boolean }[] = [];
  for (const b of done) {
    if (seen.has(b.clientId) || hasFuture.has(b.clientId) || b.client.phone.startsWith("removido")) continue;
    seen.add(b.clientId);
    const min = b.service.returnDaysMin!;
    const max = b.service.returnDaysMax ?? min;
    const from = new Date(b.startsAt.getTime() + min * 86400_000);
    const to = new Date(b.startsAt.getTime() + max * 86400_000);
    if (from.getTime() - now.getTime() <= 7 * 86400_000) {
      list.push({ clientId: b.clientId, name: b.client.name, phone: b.client.phone, service: b.service.name, last: b.startsAt, from, to, overdue: to < now });
    }
  }
  return list.slice(0, 10);
}

