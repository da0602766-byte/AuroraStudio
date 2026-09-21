import { prisma } from "@/lib/db";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { centsToInput, formatPhone } from "@/lib/format";
import { WEEKDAYS } from "@/lib/time";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { ImageInput } from "@/components/admin/ImageInput";
import { deleteFaq, saveBusiness, saveFaq, saveRules, saveSchedule } from "@/app/admin/actions/settings";
import { changePassword } from "@/app/admin/actions/auth";

const SECTIONS = [
  ["estudio", "Estúdio"],
  ["agendamento", "Agendamento e sinal"],
  ["horarios", "Horários"],
  ["duvidas", "Dúvidas"],
  ["senha", "Senha"],
];

export default async function SettingsPage() {
  const [s, pro, faqs] = await Promise.all([getSettings(), getDefaultProfessional(), prisma.faq.findMany({ orderBy: { order: "asc" } })]);
  const slots = await prisma.workingSlot.findMany({ where: { professionalId: pro.id, active: true }, orderBy: { time: "asc" } });
  const byDay = (d: number) => slots.filter((x) => x.weekday === d).map((x) => x.time).join(", ");

  return (
    <div className="space-y-8">
      <h1 className="text-3xl">Configurações</h1>
      <nav aria-label="Seções" className="flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full bg-white px-4 py-2 text-sm hover:text-bordo">{label}</a>
        ))}
      </nav>

      <section id="estudio" className="painel-bloco scroll-mt-6">
        <h2 className="text-2xl">Estúdio</h2>
        <ActionForm action={saveBusiness} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome do estúdio" defaultValue={s.name} required />
          <Field id="slogan" label="Frase de apresentação" defaultValue={s.slogan} />
          <div className="sm:col-span-2"><Area id="about" label="Texto curto sobre o estúdio" defaultValue={s.about} /></div>
          <Field id="ownerName" label="Seu nome (como aparece no site)" defaultValue={s.ownerName} />
          <Field id="whatsapp" label="WhatsApp do estúdio" defaultValue={s.whatsapp ? formatPhone(s.whatsapp) : ""} type="tel" />
          <div className="sm:col-span-2"><Area id="ownerBio" label="Sobre você" defaultValue={s.ownerBio} rows={5} /></div>
          <Field id="instagram" label="Instagram (sem @)" defaultValue={s.instagram} />
          <Field id="privacyContactEmail" label="E-mail para assuntos de privacidade" defaultValue={s.privacyContactEmail} type="email" />
          <Field id="address" label="Endereço (deixe vazio para mostrar só a região)" defaultValue={s.address} />
          <Field id="region" label="Bairro / cidade" defaultValue={s.region} />
          <Field id="mapsUrl" label="Link do Google Maps" defaultValue={s.mapsUrl} />
          <Field id="paymentMethods" label="Formas de pagamento" defaultValue={s.paymentMethods} />
          <ImageInput name="heroImage" label="Foto principal do site" current={s.heroImageUrl} />
          <ImageInput name="ownerPhoto" label="Sua foto" current={s.ownerPhotoUrl} />
          <div className="sm:col-span-2"><SubmitButton>Salvar informações</SubmitButton></div>
        </ActionForm>
      </section>

      <section id="agendamento" className="painel-bloco scroll-mt-6">
        <h2 className="text-2xl">Agendamento e sinal</h2>
        <ActionForm action={saveRules} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="minAdvanceHours" label="Antecedência mínima para agendar (horas)" defaultValue={String(s.minAdvanceHours)} type="number" />
          <Field id="cancelMinHours" label="Antecedência mínima para cancelar (horas)" defaultValue={String(s.cancelMinHours)} type="number" />
          <Field id="bookingWindowDays" label="Agenda aberta para os próximos (dias)" defaultValue={String(s.bookingWindowDays)} type="number" />
          <Field id="holdMinutes" label="Prazo para pagar o sinal (minutos)" defaultValue={String(s.holdMinutes)} type="number" />
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="depositEnabled" defaultChecked={s.depositEnabled} className="h-4 w-4 accent-bordo" /> Cobrar sinal nas reservas pelo site
          </label>
          <Field id="deposit" label="Valor padrão do sinal (R$)" defaultValue={centsToInput(s.depositCents)} inputMode="decimal" />
          <Field id="pixKeyType" label="Tipo da chave Pix" defaultValue={s.pixKeyType} placeholder="Celular, e-mail, CPF ou aleatória" />
          <Field id="pixKey" label="Chave Pix" defaultValue={s.pixKey} />
          <Field id="pixHolderName" label="Nome do titular da conta" defaultValue={s.pixHolderName} />
          <div className="sm:col-span-2"><Area id="cancellationPolicy" label="Política de cancelamento (aparece no site e na reserva)" defaultValue={s.cancellationPolicy} rows={4} /></div>
          <div className="sm:col-span-2"><Area id="bookingInstructions" label="Orientações antes do atendimento" defaultValue={s.bookingInstructions} rows={3} /></div>
          <div className="sm:col-span-2"><SubmitButton>Salvar regras</SubmitButton></div>
        </ActionForm>
      </section>

      <section id="horarios" className="painel-bloco scroll-mt-6">
        <h2 className="text-2xl">Horários de atendimento</h2>
        <p className="mt-1 text-sm text-marrom-medio">
          Informe os horários de início separados por vírgula, por exemplo: 09:30, 10:30, 14:30. Deixe vazio nos dias sem atendimento.
          Serviços mais longos bloqueiam automaticamente os horários seguintes.
        </p>
        <ActionForm action={saveSchedule} className="mt-4 space-y-3">
          {[2, 3, 4, 5, 6, 0, 1].map((d) => (
            <div key={d} className="grid items-center gap-2 sm:grid-cols-[8rem_1fr]">
              <label htmlFor={`day${d}`} className="font-medium">{WEEKDAYS[d]}</label>
              <input id={`day${d}`} name={`day${d}`} defaultValue={byDay(d)} className="campo" placeholder="Sem atendimento" />
            </div>
          ))}
          <SubmitButton>Salvar horários</SubmitButton>
        </ActionForm>
      </section>

      <section id="duvidas" className="painel-bloco scroll-mt-6">
        <h2 className="text-2xl">Dúvidas frequentes</h2>
        <div className="mt-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.id} className="rounded-2xl bg-po p-4">
              <form action={saveFaq} className="space-y-2">
                <input type="hidden" name="id" value={f.id} />
                <label className="sr-only" htmlFor={`q-${f.id}`}>Pergunta</label>
                <input id={`q-${f.id}`} name="question" defaultValue={f.question} className="campo" required />
                <label className="sr-only" htmlFor={`a-${f.id}`}>Resposta</label>
                <textarea id={`a-${f.id}`} name="answer" defaultValue={f.answer} className="campo min-h-[70px]" required />
                <input type="hidden" name="order" value={f.order} />
                <SubmitButton className="btn-contorno btn-pequeno">Salvar</SubmitButton>
              </form>
              <form action={deleteFaq} className="mt-2">
                <input type="hidden" name="id" value={f.id} />
                <SubmitButton className="text-sm text-marrom-medio underline" pendingText="…" confirm="Remover esta pergunta?">Remover</SubmitButton>
              </form>
            </div>
          ))}
          <form action={saveFaq} className="space-y-2 rounded-2xl border border-dashed border-linha p-4">
            <p className="font-medium">Nova pergunta</p>
            <input name="question" className="campo" placeholder="Pergunta" required />
            <textarea name="answer" className="campo min-h-[70px]" placeholder="Resposta" required />
            <input type="hidden" name="order" value={faqs.length + 1} />
            <SubmitButton className="btn-primario btn-pequeno">Adicionar</SubmitButton>
          </form>
        </div>
      </section>

      <section id="senha" className="painel-bloco max-w-md scroll-mt-6">
        <h2 className="text-2xl">Trocar senha</h2>
        <ActionForm action={changePassword} className="mt-4 space-y-3">
          <Field id="current" label="Senha atual" type="password" autoComplete="current-password" required />
          <Field id="next" label="Nova senha (mínimo 10 caracteres)" type="password" autoComplete="new-password" required />
          <Field id="confirm" label="Repita a nova senha" type="password" autoComplete="new-password" required />
          <SubmitButton>Trocar senha</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  defaultValue,
  type = "text",
  ...rest
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "tel" | "email" | "text";
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="rotulo">{label}</label>
      <input id={id} name={id} type={type} defaultValue={defaultValue ?? ""} className="campo" {...rest} />
    </div>
  );
}

function Area({ id, label, defaultValue, rows = 3 }: { id: string; label: string; defaultValue?: string | null; rows?: number }) {
  return (
    <div>
      <label htmlFor={id} className="rotulo">{label}</label>
      <textarea id={id} name={id} rows={rows} defaultValue={defaultValue ?? ""} className="campo" />
    </div>
  );
}
