import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { createClient } from "@/app/admin/actions/clients";

export default function NewClientPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/admin/clientes" className="text-sm text-marrom-medio hover:text-bordo">Clientes</Link>
        <h1 className="mt-1 text-3xl">Nova cliente</h1>
      </div>
      <ActionForm action={createClient} className="painel-bloco space-y-4">
        <div><label htmlFor="name" className="rotulo">Nome</label><input id="name" name="name" className="campo" required /></div>
        <div><label htmlFor="phone" className="rotulo">WhatsApp</label><input id="phone" name="phone" type="tel" className="campo" required /></div>
        <div><label htmlFor="email" className="rotulo">E-mail (opcional)</label><input id="email" name="email" type="email" className="campo" /></div>
        <div><label htmlFor="birthDate" className="rotulo">Aniversário (opcional)</label><input id="birthDate" name="birthDate" type="date" className="campo" /></div>
        <div><label htmlFor="note" className="rotulo">Observação interna (opcional)</label><textarea id="note" name="note" className="campo min-h-[80px]" /></div>
        <SubmitButton pendingText="Salvando…">Salvar cliente</SubmitButton>
      </ActionForm>
    </div>
  );
}
