import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { brl, durationLabel, effectivePrice, priceLabel } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Photo } from "@/components/site/Photo";
import { BrowArc } from "@/components/site/BrowArc";

async function load(slug: string) {
  return prisma.service.findFirst({
    where: { slug, active: true },
    include: {
      category: true,
      portfolio: { orderBy: [{ featured: "desc" }, { order: "asc" }, { createdAt: "desc" }], take: 12 },
    },
  });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sv = await load(params.slug);
  return sv ? { title: sv.name, description: sv.description ?? undefined } : {};
}

export default async function ServicePage({ params }: { params: { slug: string } }) {
  const sv = await load(params.slug);
  if (!sv) notFound();
  const s = await getSettings();
  const price = effectivePrice(sv);
  const deposit = s.depositEnabled ? sv.depositCents ?? s.depositCents : 0;
  const wa = waLink(s.whatsapp, `Olá! Tenho uma dúvida sobre o serviço ${sv.name}.`);

  // Se o serviço ainda não tem fotos próprias, mostra trabalhos da mesma categoria
  const photos =
    sv.portfolio.length > 0
      ? sv.portfolio
      : sv.categoryId
        ? await prisma.portfolioItem.findMany({ where: { categoryId: sv.categoryId }, take: 8, orderBy: { createdAt: "desc" } })
        : [];

  return (
    <div className="py-10 md:py-16">
      <div className="container-site">
        <nav aria-label="Caminho" className="text-sm text-marrom-medio">
          <Link href="/#servicos" className="hover:text-bordo">Serviços</Link>
          {sv.category && <span> / {sv.category.name}</span>}
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1fr]">
          <Photo src={sv.imageUrl ?? photos[0]?.imageUrl} alt={sv.name} priority sizes="(max-width: 768px) 100vw, 50vw" className="aspect-[4/5] w-full rounded-t-full" />
          <div className="md:pt-8">
            <h1 className="text-4xl sm:text-5xl">{sv.name}</h1>
            <BrowArc className="mt-2 w-48 text-ouro" />
            {sv.description && <p className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-marrom-medio">{sv.description}</p>}

            <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-linha py-6">
              <div>
                <dt className="text-sm text-marrom-medio">Valor</dt>
                <dd className="mt-1 font-display text-2xl text-bordo">
                  {price !== sv.priceCents && <span className="mr-2 text-base text-marrom-claro line-through">{brl(sv.priceCents)}</span>}
                  {priceLabel(price)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-marrom-medio">Duração aproximada</dt>
                <dd className="mt-1 font-display text-2xl">{durationLabel(sv.durationMinutes)}</dd>
              </div>
            </dl>

            {deposit > 0 && (
              <p className="mt-5 text-[15px] text-marrom-medio">
                Sinal de {brl(deposit)} via Pix para confirmar o horário, descontado no dia do atendimento.
              </p>
            )}
            {sv.notes && <p className="mt-3 whitespace-pre-line text-[15px] text-marrom-medio">{sv.notes}</p>}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/agendar?servico=${sv.slug}`} className="btn-primario">Ver horários livres</Link>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-contorno">Tirar dúvida</a>}
            </div>
          </div>
        </div>

        {photos.length > 0 && (
          <section className="mt-16">
            <h2 className="text-3xl">Trabalhos de {sv.name.toLowerCase()}</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {photos.map((p) => (
                <figure key={p.id}>
                  <Photo src={p.imageUrl} alt={p.title} className="aspect-square rounded-2xl" />
                  <figcaption className="mt-2 text-sm text-marrom-medio">{p.title}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
