import Link from "next/link";
import { prisma } from "@/lib/db";
import { Photo } from "@/components/site/Photo";
import { SubmitButton } from "@/components/admin/Buttons";
import { toggleFeatured } from "@/app/admin/actions/catalog";

export default async function PortfolioAdmin() {
  const items = await prisma.portfolioItem.findMany({
    include: { category: true },
    orderBy: [{ featured: "desc" }, { order: "asc" }, { createdAt: "desc" }],
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Trabalhos</h1>
          <p className="text-sm text-marrom-medio">Publique somente fotos autorizadas pelas clientes. Os destaques aparecem primeiro na página inicial.</p>
        </div>
        <Link href="/admin/portfolio/novo" className="btn-primario btn-pequeno">Adicionar foto</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-marrom-medio">Nenhuma foto ainda. Adicione a primeira para mostrar seus trabalhos no site.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-linha bg-white">
              <Link href={`/admin/portfolio/${p.id}`}>
                <Photo src={p.imageUrl} alt={p.title} className="aspect-square" />
              </Link>
              <div className="p-3">
                <Link href={`/admin/portfolio/${p.id}`} className="block text-sm font-medium hover:text-bordo">{p.title}</Link>
                <p className="text-xs text-marrom-medio">{p.category?.name ?? "Sem categoria"}</p>
                <form action={toggleFeatured} className="mt-2">
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className={`tag ${p.featured ? "bg-ouro-palido text-marrom" : "bg-po text-marrom-medio"}`} pendingText="…">
                    {p.featured ? "Em destaque" : "Destacar"}
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
