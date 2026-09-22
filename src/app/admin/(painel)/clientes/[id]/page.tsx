import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { brl, firstName, formatPhone } from "@/lib/format";
import { fmt, localDateOf } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { addClientNote, anonymizeClient, deleteClientNote, updateClient } from "@/app/admin/actions/clients";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      bookings: { include: { service: true }, orderBy: { startsAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();

  const done = c.bookings.filter((b) => b.status === "CONCLUIDO");
  const totalPaid = c.bookings.reduce((sum, b) => sum + b.paidCents, 0);
  const noShows = c.bookings.filter((b) => b.status === "NAO_COMPARECEU").length;
  const lateCancels = c.bookings.filter((b) => b.lateCancel).length;
  const allergies = [...new Set(c.bookings.filter((b) => b.isAllergic && b.allergyDetails).map((b) => b.allergyDetails!))];
  const lastPregnant = c.bookings.find((b) => b.isPregnant);
  const favorite = Object.entries(
    done.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.service.name]: (acc[b.service.name] ?? 0) + 1 }), {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0];
  const wa = waLink(c.phone, `Olá, ${firstName(c.name)}! `);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clientes" className="text-sm text-marrom-medio hover:text-bordo">Clientes</Link>
        <h1 className="mt-1 text-3xl">{c.name}</h1>
        <p className="text-marrom-medio">{formatPhone(c.phone)}{c.email ? ` · ${c.email}` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/admin/reservas/nova?cliente=${c.id}`} className="btn-primario btn-pequeno">Nova reserva</Link>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-contorno btn-pequeno">WhatsApp</a>}
        </div>
      </div>

      {(allergies.length > 0 || lastPregnant) && (
        <div role="note" className="rounded-2xl border border-bordo/30 bg-bordo/5 p-4 text-[15px]">
          {allergies.length > 0 && <p><strong className="text-bordo">Alergias informadas:</strong> {allergies.join("; ")}</p>}
          {lastPregnant && <p className="mt-1"><strong className="text-bordo">Gestante</strong> informado em {fmt(lastPregnant.createdAt, "dd/MM/yy")}</p>}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Atendimentos", done.length],
          ["Total pago", brl(totalPaid)],
          ["Preferido", favorite ?? "—"],
          ["Faltas", noShows],
          ["Cancel. fora do prazo", lateCancels],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl border border-linha bg-white px-4 py-3">
            <dt className="text-xs text-marrom-medio">{l}</dt>
            <dd className="mt-1 font-display text-xl">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="painel-bloco">
          <h2 className="text-xl">Histórico</h2>
          {c.bookings.length === 0 ? (
            <p className="mt-2 text-marrom-medio">Nenhuma reserva ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-linha">
              {c.bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/reservas/${b.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-bordo">
                    <span>
                      <span className="block">{b.service.name}</span>
                      <span className="text-sm text-marrom-medio">{fmt(b.startsAt, "dd/MM/yy HH:mm")} · {brl(b.priceCents)}</span>
                    </span>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="painel-bloco">
            <h2 className="text-xl">Observações internas</h2>
            <p className="text-xs text-marrom-claro">Visíveis somente no painel.</p>
            <form action={addClientNote} className="mt-3 space-y-2">
              <input type="hidden" name="clientId" value={c.id} />
              <label htmlFor="text" className="sr-only">Nova observação</label>
              <textarea id="text" name="text" className="campo min-h-[80px]" placeholder="Ex.: prefere henna mais clara; pele sensível" required />
              <SubmitButton className="btn-contorno btn-pequeno" pendingText="Salvando…">Adicionar</SubmitButton>
            </form>
            <ul className="mt-4 space-y-3">
              {c.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-po p-3 text-sm">
                  <p className="whitespace-pre-line">{n.text}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-marrom-claro">
                    <span>{fmt(n.createdAt, "dd/MM/yy")}</span>
                    <form action={deleteClientNote}>
                      <input type="hidden" name="id" value={n.id} />
                      <SubmitButton className="text-bordo underline" pendingText="…" confirm="Apagar esta observação?">Apagar</SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="painel-bloco">
            <h2 className="text-xl">Dados</h2>
            <ActionForm action={updateClient} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <div><label htmlFor="name" className="rotulo">Nome</label><input id="name" name="name" defaultValue={c.name} className="campo" required /></div>
              <div><label htmlFor="phone" className="rotulo">WhatsApp</label><input id="phone" name="phone" defaultValue={formatPhone(c.phone)} className="campo" required /></div>
              <div><label htmlFor="email" className="rotulo">E-mail</label><input id="email" name="email" type="email" defaultValue={c.email ?? ""} className="campo" /></div>
              <div><label htmlFor="birthDate" className="rotulo">Aniversário</label><input id="birthDate" name="birthDate" type="date" defaultValue={c.birthDate ? localDateOf(c.birthDate) : ""} className="campo" /></div>
              <SubmitButton className="btn-primario btn-pequeno">Salvar</SubmitButton>
            </ActionForm>
          </section>

          <section className="painel-bloco">
            <h2 className="text-xl">Excluir dados (LGPD)</h2>
            <p className="mt-1 text-sm text-marrom-medio">
              Use quando a cliente pedir a exclusão. Nome, contato, observações e informações de saúde são apagados; os valores dos atendimentos ficam no histórico financeiro sem identificação.
            </p>
            <form action={anonymizeClient} className="mt-3">
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="btn-contorno btn-pequeno" pendingText="Excluindo…" confirm="Excluir definitivamente os dados pessoais desta cliente? Não é possível desfazer.">
                Excluir dados da cliente
              </SubmitButton>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
