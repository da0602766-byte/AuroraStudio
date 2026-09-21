import type { Category, Service } from "@prisma/client";
import { centsToInput } from "@/lib/format";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { ImageInput } from "@/components/admin/ImageInput";
import { saveService } from "@/app/admin/actions/catalog";

export function ServiceForm({ service, categories }: { service?: Service; categories: Category[] }) {
  return (
    <ActionForm action={saveService} className="painel-bloco space-y-5">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div><label htmlFor="name" className="rotulo">Nome</label><input id="name" name="name" defaultValue={service?.name} className="campo" required /></div>
      <div>
        <label htmlFor="categoryId" className="rotulo">Categoria</label>
        <select id="categoryId" name="categoryId" defaultValue={service?.categoryId ?? ""} className="campo">
          <option value="">Sem categoria</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div><label htmlFor="description" className="rotulo">Descrição</label><textarea id="description" name="description" defaultValue={service?.description ?? ""} className="campo min-h-[90px]" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="price" className="rotulo">Valor (R$)</label>
          <input id="price" name="price" inputMode="decimal" defaultValue={centsToInput(service?.priceCents ?? 0)} className="campo" />
          <p className="ajuda">0 = sob consulta</p>
        </div>
        <div>
          <label htmlFor="promoPrice" className="rotulo">Promoção (R$)</label>
          <input id="promoPrice" name="promoPrice" inputMode="decimal" defaultValue={centsToInput(service?.promoPriceCents)} className="campo" />
          <p className="ajuda">Deixe vazio sem promoção</p>
        </div>
        <div>
          <label htmlFor="durationMinutes" className="rotulo">Duração (min)</label>
          <input id="durationMinutes" name="durationMinutes" type="number" min={10} max={600} step={5} defaultValue={service?.durationMinutes ?? 60} className="campo" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="deposit" className="rotulo">Sinal próprio (R$)</label>
          <input id="deposit" name="deposit" inputMode="decimal" defaultValue={centsToInput(service?.depositCents)} className="campo" />
          <p className="ajuda">Vazio = sinal padrão</p>
        </div>
        <div>
          <label htmlFor="returnDaysMin" className="rotulo">Retorno a partir de (dias)</label>
          <input id="returnDaysMin" name="returnDaysMin" type="number" min={1} defaultValue={service?.returnDaysMin ?? ""} className="campo" />
        </div>
        <div>
          <label htmlFor="returnDaysMax" className="rotulo">Retorno até (dias)</label>
          <input id="returnDaysMax" name="returnDaysMax" type="number" min={1} defaultValue={service?.returnDaysMax ?? ""} className="campo" />
        </div>
      </div>
      <div><label htmlFor="notes" className="rotulo">Observações para a cliente</label><textarea id="notes" name="notes" defaultValue={service?.notes ?? ""} className="campo min-h-[70px]" placeholder="Ex.: venha sem maquiagem nos olhos" /></div>
      <ImageInput name="image" label="Foto do serviço" current={service?.imageUrl} />
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="order" className="rotulo">Ordem de exibição</label><input id="order" name="order" type="number" defaultValue={service?.order ?? 0} className="campo" /></div>
        <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="h-5 w-5 accent-bordo" /> Disponível no site</label>
      </div>
      <SubmitButton>Salvar serviço</SubmitButton>
    </ActionForm>
  );
}
