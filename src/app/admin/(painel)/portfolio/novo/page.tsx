import Link from "next/link";
import { prisma } from "@/lib/db";
import { PortfolioForm } from "../PortfolioForm";

export default async function NewPortfolioPage() {
  const [categories, services] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    prisma.service.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
  ]);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/portfolio" className="text-sm text-marrom-medio hover:text-bordo">Trabalhos</Link>
        <h1 className="mt-1 text-3xl">Adicionar foto</h1>
      </div>
      <PortfolioForm categories={categories} services={services} />
    </div>
  );
}
