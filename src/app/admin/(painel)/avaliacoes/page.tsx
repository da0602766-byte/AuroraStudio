import { prisma } from "@/lib/db";
import { fmt } from "@/lib/time";
import { Stars } from "@/components/site/Stars";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { addReview, moderateReview } from "@/app/admin/actions/catalog";

const LABEL = { PENDENTE: "Aguardando revisão", APROVADO: "Publicada", REJEITADO: "Não publicada" } as const;

export default async function ReviewsAdmin() {
  const reviews = await prisma.review.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const services = await prisma.service.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { name: true } });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Avaliações</h1>
      <p className="max-w-2xl text-marrom-medio">
        Clientes com atendimento concluído podem avaliar pelo link da reserva. Nenhuma avaliação aparece no site antes da sua aprovação.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          {reviews.length === 0 && <p className="text-marrom-medio">Nenhuma avaliação ainda.</p>}
          {reviews.map((r) => (
            <article key={r.id} className={`painel-bloco ${r.status === "PENDENTE" ? "border-ouro" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={r.rating} />
                <span className="text-xs text-marrom-medio">
                  {LABEL[r.status]}{r.featured ? " · destaque" : ""}{r.verified ? " · verificada" : ""}
                </span>
              </div>
              <p className="mt-2">“{r.comment}”</p>
              <p className="mt-1 text-sm text-marrom-medio">{r.clientName}{r.serviceName ? `, ${r.serviceName}` : ""} · {fmt(r.createdAt, "dd/MM/yy")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "APROVADO" && <Mod id={r.id} action="aprovar" label="Publicar" primary />}
                {r.status !== "REJEITADO" && <Mod id={r.id} action="rejeitar" label="Não publicar" />}
                <Mod id={r.id} action="destacar" label={r.featured ? "Tirar destaque" : "Destacar"} />
                <Mod id={r.id} action="excluir" label="Excluir" confirm="Excluir esta avaliação?" />
              </div>
            </article>
          ))}
        </section>

        <section className="painel-bloco h-fit">
          <h2 className="text-xl">Adicionar depoimento</h2>
          <p className="mt-1 text-sm text-marrom-medio">Para feedbacks recebidos por WhatsApp ou Instagram, com autorização da cliente.</p>
          <ActionForm action={addReview} className="mt-4 space-y-3">
            <div><label htmlFor="clientName" className="rotulo">Nome da cliente</label><input id="clientName" name="clientName" className="campo" placeholder="Ex.: Ana" required /></div>
            <div>
              <label htmlFor="serviceName" className="rotulo">Serviço</label>
              <select id="serviceName" name="serviceName" className="campo">
                <option value="">Não informar</option>
                {services.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rating" className="rotulo">Nota</label>
              <select id="rating" name="rating" className="campo" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} estrela{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div><label htmlFor="comment" className="rotulo">Comentário</label><textarea id="comment" name="comment" className="campo min-h-[100px]" required maxLength={600} /></div>
            <label className="flex items-center gap-2"><input type="checkbox" name="featured" className="h-4 w-4 accent-bordo" /> Destacar na página inicial</label>
            <SubmitButton pendingText="Publicando…">Publicar depoimento</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}

function Mod({ id, action, label, primary, confirm }: { id: string; action: string; label: string; primary?: boolean; confirm?: string }) {
  return (
    <form action={moderateReview}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton className={`${primary ? "btn-primario" : "btn-contorno"} btn-pequeno`} pendingText="…" confirm={confirm}>{label}</SubmitButton>
    </form>
  );
}
