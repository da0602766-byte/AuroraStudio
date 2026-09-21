import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions/auth";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [s, pendingReviews] = await Promise.all([
    getSettings(),
    prisma.review.count({ where: { status: "PENDENTE" } }),
  ]);
  return (
    <div className="min-h-screen bg-po">
      <header className="bg-bordo text-white">
        <div className="mx-auto max-w-6xl px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="font-display text-xl text-white">{s.name}</Link>
            <form action="/admin/busca" className="hidden flex-1 justify-center sm:flex" role="search">
              <label htmlFor="busca" className="sr-only">Buscar</label>
              <input id="busca" name="q" placeholder="Buscar cliente, telefone ou código" className="w-full max-w-sm rounded-full border-0 bg-white/15 px-4 py-2 text-sm text-white placeholder:text-white/60 focus:bg-white focus:text-marrom focus:outline-none" />
            </form>
            <div className="flex items-center gap-2 text-sm">
              <Link href="/admin/busca" className="rounded-full px-3 py-2 text-white/80 hover:text-white sm:hidden">Buscar</Link>
              <Link href="/" target="_blank" className="hidden rounded-full px-3 py-2 text-white/80 hover:text-white md:inline">Ver site</Link>
              <form action={logout}>
                <button type="submit" className="rounded-full px-3 py-2 text-white/80 hover:text-white" title={admin.email}>Sair</button>
              </form>
            </div>
          </div>
          <div className="mt-3">
            <AdminNav pendingReviews={pendingReviews} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
