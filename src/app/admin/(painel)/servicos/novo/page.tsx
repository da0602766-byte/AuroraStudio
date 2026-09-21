import Link from "next/link";
import { prisma } from "@/lib/db";
import { ServiceForm } from "../ServiceForm";

export default async function NewServicePage() {
  const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/servicos" className="text-sm text-marrom-medio hover:text-bordo">Serviços</Link>
        <h1 className="mt-1 text-3xl">Novo serviço</h1>
      </div>
      <ServiceForm categories={categories} />
    </div>
  );
}
