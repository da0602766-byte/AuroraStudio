import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { durationLabel, effectivePrice, priceLabel } from "@/lib/format";
import { todayLocal } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";
import { BookingWizard, type ServiceOption } from "@/components/booking/BookingWizard";
import { cacheSite } from "@/lib/cache";

export const metadata: Metadata = { title: "Agendar horário", robots: { index: false } };

// Depende do dia de hoje e da disponibilidade ao vivo.
export const dynamic = "force-dynamic";

const loadBookingCatalog = cacheSite(async () => {
  const [s, services] = await Promise.all([
    getSettings(),
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      include: { category: true },
    }),
  ]);
  return { s, services };
}, ["catalogo-do-agendamento"]);

export default async function BookPage({ searchParams }: { searchParams: Promise<{ servico?: string }> }) {
  const query = await searchParams;
  const { s, services } = await loadBookingCatalog();

  const options: ServiceOption[] = services.map((sv) => ({
    id: sv.id,
    slug: sv.slug,
    name: sv.name,
    category: sv.category?.name ?? null,
    price: priceLabel(effectivePrice(sv)),
    duration: durationLabel(sv.durationMinutes),
    depositCents: s.depositEnabled ? sv.depositCents ?? s.depositCents : 0,
  }));

  return (
    <div className="container-site max-w-2xl py-10 md:py-14">
      <h1 className="text-4xl sm:text-5xl">Agendar horário</h1>
      <p className="mt-3 text-marrom-medio">
        Sem cadastro e sem senha. Reservas a partir de {s.minAdvanceHours} horas de antecedência.
      </p>
      {options.length === 0 ? (
        <p className="mt-10 text-marrom-medio">Nenhum serviço disponível para agendamento no momento.</p>
      ) : (
        <BookingWizard
          services={options}
          initialSlug={query.servico ?? null}
          today={todayLocal()}
          windowDays={s.bookingWindowDays}
          cancelMinHours={s.cancelMinHours}
          holdMinutes={s.holdMinutes}
          whatsappLink={waLink(s.whatsapp, "Olá! Não encontrei um horário no site e gostaria de ajuda para agendar.")}
        />
      )}
    </div>
  );
}
