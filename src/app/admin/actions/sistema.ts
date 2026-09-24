"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { SITE_TAG } from "@/lib/cache";

type FormResult = { error?: string; ok?: string } | undefined;

const FRASE_DE_CONFIRMACAO = "APAGAR";

/**
 * Apaga clientes, reservas, pagamentos e avaliações — o que costuma
 * acumular durante os testes antes do site entrar no ar de verdade.
 *
 * Não mexe em serviços, categorias, horários de atendimento, bloqueios,
 * portfólio nem nas configurações do estúdio: isso é trabalho de
 * configuração, não dado de teste, e apagar por engano custaria caro.
 *
 * Cliente e reserva têm exclusão restrita por padrão (sem `onDelete:
 * Cascade`), então a ordem importa: primeiro as avaliações (senão ficariam
 * órfãs, só com o vínculo da reserva apagado), depois as reservas — que
 * arrastam consigo os eventos e pagamentos por cascata — e por fim as
 * clientes.
 */
export async function resetarDadosDeTeste(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const digitado = String(form.get("confirmacao") ?? "").trim();
  if (digitado !== FRASE_DE_CONFIRMACAO) {
    return { error: `Digite exatamente "${FRASE_DE_CONFIRMACAO}" para confirmar.` };
  }

  const [clientes, reservas, avaliacoes] = await prisma.$transaction([
    prisma.client.count(),
    prisma.booking.count(),
    prisma.review.count(),
  ]);

  await prisma.$transaction([
    prisma.review.deleteMany({}),
    prisma.booking.deleteMany({}),
    prisma.client.deleteMany({}),
  ]);

  await audit(admin.id, "RESET_DADOS_TESTE", "sistema", null, { clientes, reservas, avaliacoes });

  revalidatePath("/", "layout");
  revalidateTag(SITE_TAG, { expire: 0 }); // as avaliações do site acabaram de sumir

  return { ok: `Pronto: ${clientes} clientes, ${reservas} reservas e ${avaliacoes} avaliações apagadas.` };
}
