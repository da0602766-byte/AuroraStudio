import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/format";
import { isDateStr, isTimeStr, todayLocal } from "@/lib/time";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { createManualBooking } from "@/app/admin/actions/bookings";

export default async function NewBookingPage({ searchParams }: { searchParams: { data?: string; hora?: string; cliente?: string } }) {
  const [services, client] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ active: "desc" }, { order: "asc" }] }),
    searchParams.cliente ? prisma.client.findUnique({ where: { id: searchParams.cliente } }) : null,
  ]);
  const date = isDateStr(searchParams.data) ? searchParams.data : todayLocal();
  const time = isTimeStr(searchParams.hora) ? searchParams.hora : "";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/agenda" className="text-sm text-marrom-medio hover:text-bordo">Agenda</Link>
        <h1 className="mt-1 text-3xl">Nova reserva</h1>
        <p className="mt-1 text-marrom-medio">Para clientes que marcaram por WhatsApp, telefone ou pessoalmente.</p>
      </div>

      <ActionForm action={createManualBooking} className="painel-bloco space-y-5">
        <div>
          <label htmlFor="serviceId" className="rotulo">Serviço</label>
          <select id="serviceId" name="serviceId" className="campo" required>
            <option value="">Escolha…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (inativo)"}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="date" className="rotulo">Data</label>
            <input id="date" name="date" type="date" defaultValue={date} className="campo" required />
          </div>
          <div>
            <label htmlFor="time" className="rotulo">Horário</label>
            <input id="time" name="time" type="time" defaultValue={time} className="campo" required />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="rotulo">Nome da cliente</label>
            <input id="name" name="name" defaultValue={client?.name} className="campo" required />
          </div>
          <div>
            <label htmlFor="phone" className="rotulo">WhatsApp</label>
            <input id="phone" name="phone" type="tel" defaultValue={client ? formatPhone(client.phone) : ""} className="campo" required />
          </div>
        </div>
        <div>
          <label htmlFor="email" className="rotulo">E-mail (opcional)</label>
          <input id="email" name="email" type="email" defaultValue={client?.email ?? ""} className="campo" />
        </div>
        <fieldset className="space-y-3">
          <legend className="rotulo">Ficha de segurança</legend>
          <label className="flex items-center gap-2"><input type="checkbox" name="isAllergic" className="h-4 w-4 accent-bordo" /> Tem alergia</label>
          <input name="allergyDetails" className="campo" placeholder="A quê? (se tiver)" maxLength={300} />
          <label className="flex items-center gap-2"><input type="checkbox" name="isPregnant" className="h-4 w-4 accent-bordo" /> Está gestante</label>
        </fieldset>
        <div>
          <label htmlFor="notes" className="rotulo">Observações</label>
          <textarea id="notes" name="notes" className="campo min-h-[80px]" maxLength={500} />
        </div>
        <fieldset className="space-y-2 border-t border-linha pt-4">
          <label className="flex items-center gap-2"><input type="checkbox" name="awaitDeposit" className="h-4 w-4 accent-bordo" /> Aguardar pagamento do sinal</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="isEncaixe" className="h-4 w-4 accent-bordo" /> Encaixe (permite sobrepor outra reserva ou bloqueio)</label>
        </fieldset>
        <SubmitButton pendingText="Criando…">Criar reserva</SubmitButton>
      </ActionForm>
    </div>
  );
}
