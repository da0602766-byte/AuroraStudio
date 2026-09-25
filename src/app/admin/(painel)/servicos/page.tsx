import Link from "next/link";
import { prisma } from "@/lib/db";
import { brl, durationLabel, priceLabel } from "@/lib/format";
import { mediasPorServico } from "@/lib/reviews";
import { SubmitButton } from "@/components/admin/Buttons";
import { Stars } from "@/components/site/Stars";
import { deleteCategory, saveCategory } from "@/app/admin/actions/catalog";

export default async function ServicesAdmin() {
  const [services, categories, medias] = await Promise.all([
    prisma.service.findMany({ include: { category: true }, orderBy: [{ active: "desc" }, { order: "asc" }] }),
    prisma.category.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { services: true } } } }),
    mediasPorServico(prisma),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Serviços</h1>
        <Link href="/admin/servicos/novo" className="btn-primario btn-pequeno">Novo serviço</Link>
      </div>
      {services.some((s) => s.priceCents === 0 && s.active) && (
        <p className="rounded-2xl bg-ouro-palido/60 px-4 py-3 text-sm">
          Serviços com valor zerado aparecem no site como “sob consulta”. Abra cada um para definir o preço.
        </p>
      )}
      <ul className="divide-y divide-linha rounded-2xl border border-linha bg-white">
        {services.map((s) => {
          const media = medias[s.id];
          return (
            <li key={s.id}>
              <Link href={`/admin/servicos/${s.id}`} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-po ${s.active ? "" : "opacity-60"}`}>
                <span>
                  <span className="block font-medium">{s.name}{!s.active && <span className="ml-2 text-xs">(inativo)</span>}</span>
                  <span className="text-sm text-marrom-medio">{s.category?.name ?? "Sem categoria"} · {durationLabel(s.durationMinutes)}</span>
                  {media && (
                    <span className="mt-1 flex items-center gap-1.5 text-sm text-marrom-claro">
                      <Stars value={Math.round(media.media)} />
                      {media.media.toFixed(1)} ({media.total})
                    </span>
                  )}
                </span>
                <span className="text-right">
                  {s.promoPriceCents ? <span className="mr-2 text-sm text-marrom-claro line-through">{brl(s.priceCents)}</span> : null}
                  <span className="font-medium">{priceLabel(s.promoPriceCents ?? s.priceCents)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="painel-bloco max-w-xl">
        <h2 className="text-xl">Categorias</h2>
        <ul className="mt-3 divide-y divide-linha">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>{c.name} <span className="text-sm text-marrom-claro">({c._count.services})</span></span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton className="text-sm text-bordo underline" pendingText="…" confirm={`Remover a categoria ${c.name}? Os serviços dela ficam sem categoria.`}>Remover</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveCategory} className="mt-3 flex gap-2">
          <label htmlFor="catname" className="sr-only">Nova categoria</label>
          <input id="catname" name="name" className="campo" placeholder="Nova categoria" required />
          <SubmitButton className="btn-contorno btn-pequeno shrink-0">Adicionar</SubmitButton>
        </form>
      </section>
    </div>
  );
}
