import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { cacheSite } from "@/lib/cache";
import { scheduleLines } from "@/lib/schedule";
import { brl, durationLabel, effectivePrice, priceLabel } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { fmt } from "@/lib/time";
import { BrowArc } from "@/components/site/BrowArc";
import { Photo } from "@/components/site/Photo";
import { Stars } from "@/components/site/Stars";

/**
 * Tudo o que a página inicial mostra, numa consulta só e guardada em cache.
 * Antes eram oito idas ao banco a cada visita.
 */
const loadHome = cacheSite(async () => {
  const [s, pro] = await Promise.all([getSettings(), getDefaultProfessional()]);

  const [categories, featured, reviews, faqs, slots, uncategorized] = await Promise.all([
    prisma.category.findMany({
      orderBy: { order: "asc" },
      include: { services: { where: { active: true }, orderBy: { order: "asc" } } },
    }),
    prisma.portfolioItem.findMany({
      orderBy: [{ featured: "desc" }, { order: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.review.findMany({
      where: { status: "APROVADO" },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.faq.findMany({ orderBy: { order: "asc" } }),
    prisma.workingSlot.findMany({ where: { professionalId: pro.id, active: true } }),
    prisma.service.findMany({ where: { active: true, categoryId: null }, orderBy: { order: "asc" } }),
  ]);

  return { s, categories, featured, reviews, faqs, slots, uncategorized };
}, ["pagina-inicial"]);

export default async function HomePage() {
  const { s, categories, featured, reviews, faqs, slots, uncategorized } = await loadHome();

  const groups = [
    ...categories.filter((c) => c.services.length),
    ...(uncategorized.length ? [{ id: "outros", name: "Outros", services: uncategorized }] : []),
  ];

  const wa = waLink(s.whatsapp, `Olá! Vim pelo site da ${s.name} e gostaria de mais informações.`);
  const hours = scheduleLines(slots);

  return (
    <>
      {/* Abertura */}
      <section className="relative overflow-hidden bg-bordo text-white">
        <div className="container-site grid items-end gap-10 pb-14 pt-12 md:grid-cols-[1.15fr_1fr] md:pb-20 md:pt-20">
          <div>
            <h1 className="font-display text-[3.2rem] leading-[0.95] text-white sm:text-7xl lg:text-[5.5rem]">
              {s.name}
            </h1>
            <BrowArc className="mt-3 w-64 text-ouro-claro sm:w-80" />
            {s.slogan && <p className="mt-6 max-w-md font-display text-2xl italic text-ouro-palido">{s.slogan}</p>}
            {s.about && <p className="mt-4 max-w-md text-[17px] leading-relaxed text-white/80">{s.about}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/agendar" className="btn-ouro">
                Agendar horário
              </Link>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn border border-white/30 text-white hover:border-white/70">
                  Falar no WhatsApp
                </a>
              )}
            </div>
          </div>
          <Photo
            src={s.heroImageUrl || s.ownerPhotoUrl}
            alt={s.ownerName ? `${s.ownerName} no estúdio` : s.name}
            priority
            sizes="(max-width: 768px) 90vw, 40vw"
            className="mx-auto aspect-[4/5] w-full max-w-sm rounded-t-full border border-ouro-claro/40 md:max-w-none"
          />
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="scroll-mt-20 py-16 md:py-24">
        <div className="container-site">
          <h2 className="text-4xl sm:text-5xl">Serviços</h2>
          <p className="mt-3 max-w-xl text-marrom-medio">
            Escolha um serviço para ver fotos de trabalhos e os horários livres.
          </p>

          <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-x-16">
            {groups.map((g) => (
              <div key={g.id}>
                <h3 className="border-b border-ouro/50 pb-2 text-2xl text-bordo">{g.name}</h3>
                <ul>
                  {g.services.map((sv) => {
                    const price = effectivePrice(sv);
                    return (
                      <li key={sv.id} className="border-b border-linha">
                        <Link href={`/servicos/${sv.slug}`} className="group flex items-start justify-between gap-4 py-5">
                          <div className="min-w-0">
                            <p className="text-lg font-medium group-hover:text-bordo">{sv.name}</p>
                            {sv.description && <p className="mt-1 text-[15px] leading-relaxed text-marrom-medio">{sv.description}</p>}
                            <p className="mt-2 text-sm text-marrom-claro">{durationLabel(sv.durationMinutes)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {price !== sv.priceCents && <p className="text-sm text-marrom-claro line-through">{brl(sv.priceCents)}</p>}
                            <p className="font-display text-xl text-bordo">{priceLabel(price)}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trabalhos */}
      {featured.length > 0 && (
        <section id="trabalhos" className="scroll-mt-20 bg-white py-16 md:py-24">
          <div className="container-site">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-4xl sm:text-5xl">Trabalhos recentes</h2>
              <Link href="/galeria" className="shrink-0 text-[15px] font-medium text-bordo underline-offset-4 hover:underline">
                Ver galeria
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {featured.map((p, i) => (
                <figure key={p.id} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                  <Photo
                    src={p.imageUrl}
                    alt={p.title}
                    sizes={i === 0 ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
                    className="aspect-square h-full rounded-2xl"
                  />
                  <figcaption className="sr-only">{p.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Profissional */}
      <section className="py-16 md:py-24">
        <div className="container-site grid items-center gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <Photo
            src={s.ownerPhotoUrl}
            alt={s.ownerName ?? "Profissional"}
            sizes="(max-width: 768px) 80vw, 30vw"
            className="mx-auto aspect-[3/4] w-full max-w-xs rounded-t-full"
          />
          <div className="max-w-xl">
            <h2 className="text-4xl sm:text-5xl">{s.ownerName ? `Sou ${s.ownerName}` : "Quem vai te atender"}</h2>
            <BrowArc className="mt-2 w-48 text-ouro" />
            {s.ownerBio && (
              <p className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-marrom-medio">{s.ownerBio}</p>
            )}
            <p className="mt-5 text-[15px] text-marrom-medio">Atendimento individual, com hora marcada e sem pressa.</p>
          </div>
        </div>
      </section>

      {/* Avaliações */}
      {reviews.length > 0 && (
        <section id="avaliacoes" className="scroll-mt-20 bg-po-escuro py-16 md:py-24">
          <div className="container-site">
            <h2 className="text-4xl sm:text-5xl">O que dizem as clientes</h2>
            <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <blockquote key={r.id} className="border-l-2 border-ouro pl-5">
                  <Stars value={r.rating} />
                  <p className="mt-3 font-display text-xl leading-snug">“{r.comment}”</p>
                  <footer className="mt-3 text-sm text-marrom-medio">
                    {r.clientName}
                    {r.serviceName ? `, ${r.serviceName.toLowerCase()}` : ""}
                    {r.verified && <span className="ml-2 text-ouro">atendimento verificado</span>}
                    <span className="block text-marrom-claro">{fmt(r.createdAt, "MMMM 'de' yyyy")}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Atendimento */}
      <section id="atendimento" className="scroll-mt-20 py-16 md:py-24">
        <div className="container-site grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-4xl sm:text-5xl">Atendimento</h2>
            <dl className="mt-8 space-y-6">
              {hours.length > 0 && (
                <div>
                  <dt className="font-medium">Horários</dt>
                  {hours.map((h) => (
                    <dd key={h.label} className="mt-1 text-marrom-medio">
                      <span className="text-marrom">{h.label}:</span> {h.times}
                    </dd>
                  ))}
                </div>
              )}
              {(s.address || s.region) && (
                <div>
                  <dt className="font-medium">Onde</dt>
                  <dd className="mt-1 text-marrom-medio">
                    {s.address}
                    {s.address && s.region ? " — " : ""}
                    {s.region}
                    {s.mapsUrl && (
                      <a href={s.mapsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-bordo underline underline-offset-4">
                        Abrir no mapa
                      </a>
                    )}
                  </dd>
                </div>
              )}
              {s.paymentMethods && (
                <div>
                  <dt className="font-medium">Formas de pagamento</dt>
                  <dd className="mt-1 text-marrom-medio">{s.paymentMethods}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl">Como funciona o agendamento</h3>
              <p className="mt-3 leading-relaxed text-marrom-medio">
                Os horários podem ser reservados com pelo menos {s.minAdvanceHours} horas de antecedência.
                {s.depositEnabled && s.depositCents > 0 &&
                  ` Para confirmar, é pago um sinal de ${brl(s.depositCents)} via Pix, descontado do valor do procedimento.`}
              </p>
            </div>
            {s.cancellationPolicy && (
              <div>
                <h3 className="text-2xl">Cancelamento e remarcação</h3>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-marrom-medio">{s.cancellationPolicy}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Dúvidas */}
      {faqs.length > 0 && (
        <section id="duvidas" className="scroll-mt-20 bg-white py-16 md:py-24">
          <div className="container-site max-w-3xl">
            <h2 className="text-4xl sm:text-5xl">Dúvidas frequentes</h2>
            <div className="mt-8 divide-y divide-linha border-y border-linha">
              {faqs.map((f) => (
                <details key={f.id} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <span aria-hidden="true" className="text-2xl text-ouro transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-marrom-medio">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chamada final */}
      <section className="bg-bordo py-16 text-center text-white md:py-20">
        <div className="container-site">
          <h2 className="text-4xl text-white sm:text-5xl">Vamos marcar o seu horário?</h2>
          <BrowArc className="mx-auto mt-3 w-56 text-ouro-claro" />
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/agendar" className="btn-ouro">Agendar horário</Link>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn border border-white/30 text-white hover:border-white/70">
                Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
