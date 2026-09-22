import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Photo } from "@/components/site/Photo";
import { cacheSite } from "@/lib/cache";

export const metadata: Metadata = { title: "Trabalhos" };

const PER_PAGE = 24;

const loadGallery = cacheSite(async (categorySlug: string, page: number) => {
  const categories = await prisma.category.findMany({
    where: { portfolio: { some: {} } },
    orderBy: { order: "asc" },
  });
  const active = categories.find((c) => c.slug === categorySlug);
  const where = active ? { categoryId: active.id } : {};
  const [items, total] = await Promise.all([
    prisma.portfolioItem.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { services: { select: { slug: true, name: true }, take: 1 } },
    }),
    prisma.portfolioItem.count({ where }),
  ]);
  return { categories, active, items, total };
}, ["galeria-publica"]);

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ categoria?: string; pagina?: string }> }) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.pagina) || 1);
  const { categories, active, items, total } = await loadGallery(query.categoria ?? "", page);
  const pages = Math.ceil(total / PER_PAGE);
  const q = (p: number) => `/galeria?${new URLSearchParams({ ...(active ? { categoria: active.slug } : {}), pagina: String(p) })}`;

  return (
    <div className="container-site py-10 md:py-16">
      <h1 className="text-4xl sm:text-5xl">Trabalhos</h1>

      {categories.length > 1 && (
        <nav aria-label="Filtrar por categoria" className="mt-6 flex gap-2 overflow-x-auto pb-2">
          <Link href="/galeria" className={`tag shrink-0 px-4 py-2 text-sm ${!active ? "bg-bordo text-white" : "bg-white text-marrom"}`}>
            Todos
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/galeria?categoria=${c.slug}`}
              className={`tag shrink-0 px-4 py-2 text-sm ${active?.id === c.id ? "bg-bordo text-white" : "bg-white text-marrom"}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {items.length === 0 ? (
        <p className="mt-10 text-marrom-medio">As fotos dos trabalhos serão publicadas em breve.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <figure key={p.id}>
              <Photo src={p.imageUrl} alt={p.title} className="aspect-square rounded-2xl" />
              <figcaption className="mt-2 text-sm">
                <span className="block">{p.title}</span>
                {p.services[0] && (
                  <Link href={`/servicos/${p.services[0].slug}`} className="text-bordo underline-offset-4 hover:underline">
                    {p.services[0].name}
                  </Link>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-10 flex justify-center gap-3">
          {page > 1 && <Link href={q(page - 1)} className="btn-contorno btn-pequeno">Anterior</Link>}
          <span className="self-center text-sm text-marrom-medio">Página {page} de {pages}</span>
          {page < pages && <Link href={q(page + 1)} className="btn-contorno btn-pequeno">Próxima</Link>}
        </nav>
      )}
    </div>
  );
}
