import { prisma } from "@/lib/db";
import { getDefaultProfessional } from "@/lib/settings";
import { fmt, todayLocal } from "@/lib/time";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { createBlock, deleteBlock } from "@/app/admin/actions/bookings";

export default async function BlocksPage() {
  const pro = await getDefaultProfessional();
  const blocks = await prisma.timeBlock.findMany({
    where: { professionalId: pro.id, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const today = todayLocal();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h1 className="text-3xl">Folgas e bloqueios</h1>
        <p className="mt-1 text-marrom-medio">Feriados, férias, cursos ou qualquer horário em que você não vai atender. Reservas já feitas não são alteradas.</p>
        <ActionForm action={createBlock} className="painel-bloco mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="from" className="rotulo">De</label><input id="from" name="from" type="date" defaultValue={today} className="campo" required /></div>
            <div><label htmlFor="to" className="rotulo">Até</label><input id="to" name="to" type="date" defaultValue={today} className="campo" /></div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" name="allDay" defaultChecked className="h-4 w-4 accent-bordo" /> Dia inteiro</label>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="startTime" className="rotulo">Hora inicial</label><input id="startTime" name="startTime" type="time" className="campo" /></div>
            <div><label htmlFor="endTime" className="rotulo">Hora final</label><input id="endTime" name="endTime" type="time" className="campo" /></div>
          </div>
          <p className="ajuda">As horas só valem se “Dia inteiro” estiver desmarcado.</p>
          <div><label htmlFor="reason" className="rotulo">Motivo (só você vê)</label><input id="reason" name="reason" className="campo" placeholder="Ex.: Feriado, curso, consulta" /></div>
          <SubmitButton pendingText="Bloqueando…">Bloquear</SubmitButton>
        </ActionForm>
      </section>

      <section>
        <h2 className="text-2xl">Próximos bloqueios</h2>
        {blocks.length === 0 ? (
          <p className="mt-3 text-marrom-medio">Nenhum bloqueio programado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-linha rounded-2xl border border-linha bg-white">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-medium">{fmt(b.startsAt, "dd/MM HH:mm")} até {fmt(b.endsAt, "dd/MM HH:mm")}</span>
                  {b.reason && <span className="text-sm text-marrom-medio">{b.reason}</span>}
                </span>
                <form action={deleteBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton className="btn-contorno btn-pequeno" pendingText="…" confirm="Remover este bloqueio e liberar os horários?">Remover</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
