import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-bordo px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7">
        <h1 className="text-3xl">Painel</h1>
        <p className="mt-1 text-sm text-marrom-medio">Acesso restrito à administração do estúdio.</p>
        <LoginForm />
      </div>
    </main>
  );
}
