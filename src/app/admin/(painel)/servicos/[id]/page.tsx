import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SubmitButton } from "@/components/admin/Buttons";
import { deleteService } from "@/app/admin/actions/catalog";
import { ServiceForm } from "../ServiceForm";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [service, categories] = await Promise.all([
    prisma.service.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
  ]);
  if (!service) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/servicos" className="text-sm text-marrom-medio hover:text-bordo">Serviços</Link>
        <h1 className="mt-1 text-3xl">{service.name}</h1>
        <Link href={`/servicos/${service.slug}`} target="_blank" className="text-sm text-bordo underline underline-offset-4">Ver no site</Link>
      </div>
      <ServiceForm service={service} categories={categories} />
      <form action={deleteService}>
        <input type="hidden" name="id" value={service.id} />
        <SubmitButton className="btn-contorno btn-pequeno" pendingText="Removendo…" confirm="Remover este serviço? Se já tiver reservas, ele será apenas desativado.">
          Remover serviço
        </SubmitButton>
      </form>
    </div>
  );
}
