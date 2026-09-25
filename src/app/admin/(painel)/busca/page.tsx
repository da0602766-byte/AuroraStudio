import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/format";
import { fmt } from "@/lib/time";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const digits = q.replace(/\D/g, "");
  const [clients, bookings] = q.length >= 2
    ? await Promise.all([
        prisma.client.findMany({
          where: {
            NOT: { phone: { startsWith: "removido" } },
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            ],
          },
          take: 20,
          orderBy: { name: "asc" },
        }),
        prisma.booking.findMany({
          where: { code: { contains: q, mode: "insensitive" as const } },
          include: { client: true, service: true },
          take: 10,
        }),
      ])
    : [[], []];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl">Buscar</h1>
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">Buscar</label>
        <input id="q" name="q" defaultValue={q} className="campo" placeholder="Nome, telefone ou código da reserva" autoFocus />
        <button type="submit" className="btn-primario btn-pequeno">Buscar</button>
      </form>
      {q.length >= 2 && clients.length === 0 && bookings.length === 0 && (
        <p className="text-marrom-medio">Nada encontrado para “{q}”.</p>
      )}
      {bookings.length > 0 && (
        <section>
          <h2 className="text-xl">Reservas</h2>
          <ul className="mt-2 divide-y divide-linha rounded-2xl border border-linha bg-white">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/reservas/${b.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-po">
                  <span>{b.code} · {b.client.name} · {fmt(b.startsAt, "dd/MM HH:mm")}</span>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {clients.length > 0 && (
        <section>
          <h2 className="text-xl">Clientes</h2>
          <ul className="mt-2 divide-y divide-linha rounded-2xl border border-linha bg-white">
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clientes/${c.id}`} className="flex justify-between px-4 py-3 hover:bg-po">
                  <span>{c.name}</span>
                  <span className="text-sm text-marrom-medio">{formatPhone(c.phone)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
