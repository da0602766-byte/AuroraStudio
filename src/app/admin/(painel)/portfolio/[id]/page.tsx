import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SubmitButton } from "@/components/admin/Buttons";
import { deletePortfolioItem } from "@/app/admin/actions/catalog";
import { PortfolioForm } from "../PortfolioForm";

export default async function EditPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, categories, services] = await Promise.all([
    prisma.portfolioItem.findUnique({ where: { id }, include: { services: { select: { id: true } } } }),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    prisma.service.findMany({ orderBy: { order: "asc" } }),
  ]);
  if (!item) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/portfolio" className="text-sm text-marrom-medio hover:text-bordo">Trabalhos</Link>
        <h1 className="mt-1 text-3xl">{item.title}</h1>
      </div>
      <PortfolioForm item={item} categories={categories} services={services} />
      <form action={deletePortfolioItem}>
        <input type="hidden" name="id" value={item.id} />
        <SubmitButton className="btn-contorno btn-pequeno" pendingText="Removendo…" confirm="Remover esta foto do site?">Remover foto</SubmitButton>
      </form>
    </div>
  );
}
