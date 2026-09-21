import type { Category, PortfolioItem, Service } from "@prisma/client";
import { localDateOf } from "@/lib/time";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { ImageInput } from "@/components/admin/ImageInput";
import { savePortfolioItem } from "@/app/admin/actions/catalog";

export function PortfolioForm({
  item,
  categories,
  services,
}: {
  item?: PortfolioItem & { services: { id: string }[] };
  categories: Category[];
  services: Service[];
}) {
  const selected = new Set(item?.services.map((s) => s.id));
  return (
    <ActionForm action={savePortfolioItem} className="painel-bloco space-y-5">
      {item && <input type="hidden" name="id" value={item.id} />}
      <ImageInput name="image" label={item ? "Trocar foto" : "Foto"} current={item?.imageUrl} />
      <div><label htmlFor="title" className="rotulo">Título</label><input id="title" name="title" defaultValue={item?.title} className="campo" placeholder="Ex.: Design com henna" required /></div>
      <div><label htmlFor="description" className="rotulo">Descrição (opcional)</label><textarea id="description" name="description" defaultValue={item?.description ?? ""} className="campo min-h-[70px]" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="categoryId" className="rotulo">Categoria</label>
          <select id="categoryId" name="categoryId" defaultValue={item?.categoryId ?? ""} className="campo">
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label htmlFor="takenAt" className="rotulo">Data do trabalho</label><input id="takenAt" name="takenAt" type="date" defaultValue={item?.takenAt ? localDateOf(item.takenAt) : ""} className="campo" /></div>
      </div>
      <fieldset>
        <legend className="rotulo">Serviços relacionados</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={selected.has(s.id)} className="h-4 w-4 accent-bordo" /> {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="order" className="rotulo">Ordem</label><input id="order" name="order" type="number" defaultValue={item?.order ?? 0} className="campo" /></div>
        <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" name="featured" defaultChecked={item?.featured} className="h-5 w-5 accent-bordo" /> Destaque</label>
      </div>
      <SubmitButton pendingText="Enviando…">Salvar</SubmitButton>
    </ActionForm>
  );
}
