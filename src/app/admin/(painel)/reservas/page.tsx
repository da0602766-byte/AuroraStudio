import Link from "next/link";
import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { brl, formatPhone } from "@/lib/format";
import { addDaysLocal, fmt, isDateStr, localToUtc } from "@/lib/time";
import { STATUS_LABEL } from "@/lib/status";
import { StatusBadge } from "@/components/admin/StatusBadge";

const PER_PAGE = 30;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; de?: string; ate?: string; q?: string; pagina?: string }>;
}) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.pagina) || 1);
  const status = (Object.keys(STATUS_LABEL) as BookingStatus[]).find((s) => s === query.status);
  const q = (query.q ?? "").trim();
  const digits = q.replace(/\D/g, "");

  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : {}),
    ...(isDateStr(query.de) || isDateStr(query.ate)
      ? {
          startsAt: {
            ...(isDateStr(query.de) ? { gte: localToUtc(query.de, "00:00") } : {}),
            ...(isDateStr(query.ate) ? { lt: localToUtc(addDaysLocal(query.ate, 1), "00:00") } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
            ...(digits.length >= 4 ? [{ client: { phone: { contains: digits } } }] : []),
            { service: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [list, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { client: true, service: true },
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.booking.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) =>
    `/admin/reservas?${new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)), pagina: String(p) } as Record<string, string>)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Reservas</h1>
        <Link href="/admin/reservas/nova" className="btn-primario btn-pequeno">Nova reserva</Link>
      </div>

      <form className="grid gap-3 rounded-2xl border border-linha bg-white p-4 sm:grid-cols-5" role="search">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="rotulo">Buscar</label>
          <input id="q" name="q" defaultValue={q} className="campo" placeholder="Nome, telefone, código ou serviço" />
        </div>
        <div>
          <label htmlFor="status" className="rotulo">Situação</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="campo">
            <option value="">Todas</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="de" className="rotulo">De</label>
          <input id="de" name="de" type="date" defaultValue={query.de} className="campo" />
        </div>
        <div>
          <label htmlFor="ate" className="rotulo">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={query.ate} className="campo" />
        </div>
        <div className="flex gap-2 sm:col-span-5">
          <button type="submit" className="btn-primario btn-pequeno">Filtrar</button>
          <Link href="/admin/reservas" className="btn-contorno btn-pequeno">Limpar</Link>
        </div>
      </form>

      {list.length === 0 ? (
        <p className="text-marrom-medio">Nenhuma reserva encontrada com esses filtros.</p>
      ) : (
        <>
          {/* Celular */}
          <ul className="space-y-2 md:hidden">
            {list.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/reservas/${b.id}`} className="block rounded-2xl border border-linha bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{b.client.name}</span>
                    <StatusBadge status={b.status} proof={!!b.proofSentAt} />
                  </div>
                  <p className="mt-1 text-sm text-marrom-medio">{b.service.name} · {fmt(b.startsAt, "dd/MM/yy HH:mm")}</p>
                  <p className="text-xs text-marrom-claro">{b.code}</p>
                </Link>
              </li>
            ))}
          </ul>
          {/* Computador */}
          <div className="hidden overflow-x-auto rounded-2xl border border-linha bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linha text-marrom-medio">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Serviço</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {list.map((b) => (
                  <tr key={b.id} className="hover:bg-po">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link href={`/admin/reservas/${b.id}`} className="font-medium hover:text-bordo">{fmt(b.startsAt, "dd/MM/yy HH:mm")}</Link>
                    </td>
                    <td className="px-4 py-3">{b.client.name}<span className="block text-xs text-marrom-claro">{formatPhone(b.client.phone)}</span></td>
                    <td className="px-4 py-3">{b.service.name}</td>
                    <td className="px-4 py-3">{brl(b.priceCents)}</td>
                    <td className="px-4 py-3">{brl(b.paidCents)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} proof={!!b.proofSentAt} /></td>
                    <td className="px-4 py-3 text-xs text-marrom-medio">{b.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
