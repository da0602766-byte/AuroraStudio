import type { Db } from "./db";

export type MediaServico = { media: number; total: number };

/**
 * Nota média de cada serviço, a partir das avaliações aprovadas.
 *
 * O nome do serviço gravado na avaliação (`Review.serviceName`) é só uma
 * lembrança de como ele se chamava na hora — se a proprietária renomear o
 * serviço depois, a nota continua contando para o mesmo serviço porque a
 * média é somada pelo `serviceId` da reserva, não pelo texto congelado.
 * Avaliação sem reserva vinculada (caso raro, de reserva apagada por fora
 * do painel) não entra em nenhuma média.
 *
 * Devolve um objeto simples, não um Map: o resultado passa pelo cache do
 * site (`cacheSite`), que serializa em JSON, e um Map viraria `{}` nessa
 * volta.
 *
 * Recebe o cliente do banco por parâmetro (em vez de importar `prisma`
 * direto) para dar para testar a conta com um banco de mentira, como
 * `getSlotsForRange` já faz.
 */
export async function mediasPorServico(db: Db): Promise<Record<string, MediaServico>> {
  const avaliacoes = await db.review.findMany({
    where: { status: "APROVADO", booking: { isNot: null } },
    select: { rating: true, booking: { select: { serviceId: true } } },
  });

  const acumulado = new Map<string, { soma: number; total: number }>();
  for (const r of avaliacoes) {
    const serviceId = r.booking?.serviceId;
    if (!serviceId) continue;
    const atual = acumulado.get(serviceId) ?? { soma: 0, total: 0 };
    atual.soma += r.rating;
    atual.total += 1;
    acumulado.set(serviceId, atual);
  }

  const medias: Record<string, MediaServico> = {};
  for (const [serviceId, { soma, total }] of acumulado) {
    medias[serviceId] = { media: soma / total, total };
  }
  return medias;
}
