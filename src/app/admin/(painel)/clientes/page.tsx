import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/format";
import { fmt } from "@/lib/time";

const PER_PAGE = 40;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const digits = q.replace(/\D/g, "");
  const page = Math.max(1, Number(query.pagina) || 1);
  const where: Prisma.ClientWhereInput = {
    NOT: { phone: { startsWith: "removido" } },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        bookings: { where: { status: "CONCLUIDO" }, orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true } },
        _count: { select: { bookings: { where: { status: "CONCLUIDO" } } } },
      },
    }),
    prisma.client.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => `/admin/clientes?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Clientes <span className="text-lg text-marrom-medio">({total})</span></h1>
        <Link href="/admin/clientes/novo" className="btn-primario btn-pequeno">Nova cliente</Link>
      </div>
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">Buscar cliente</label>
        <input id="q" name="q" defaultValue={q} placeholder="Nome, telefone ou e-mail" className="campo max-w-md" />
        <button className="btn-primario btn-pequeno" type="submit">Buscar</button>
      </form>
      {clients.length === 0 ? (
        <p className="text-marrom-medio">Nenhuma cliente encontrada.</p>
      ) : (
        <ul className="divide-y divide-linha rounded-2xl border border-linha bg-white">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clientes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-po">
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-sm text-marrom-medio">{formatPhone(c.phone)}</span>
                </span>
                <span className="text-right text-sm text-marrom-medio">
                  {c._count.bookings} atendimento{c._count.bookings === 1 ? "" : "s"}
                  {c.bookings[0] && <span className="block text-xs">último em {fmt(c.bookings[0].startsAt, "dd/MM/yy")}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-center gap-3">
          {page > 1 && <Link href={qs(page - 1)} className="btn-contorno btn-pequeno">Anterior</Link>}
          <span className="text-sm text-marrom-medio">Página {page} de {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="btn-contorno btn-pequeno">Próxima</Link>}
        </nav>
      )}
    </div>
  );
}
