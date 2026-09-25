import { unstable_cache } from "next/cache";

/**
 * Cache do conteúdo público do site.
 *
 * As páginas continuam sendo renderizadas a cada visita (o build não depende
 * do banco e nada fica pré-renderizado com dados velhos), mas as consultas
 * ficam guardadas entre as visitas: sem isto, cada acesso à página inicial
 * abria oito consultas.
 *
 * Toda ação do painel que muda conteúdo do site chama `revalidateSite()`,
 * então a proprietária vê a mudança na hora. Os 5 minutos abaixo são só a
 * rede de segurança para alterações feitas fora do painel.
 */
export const SITE_TAG = "conteudo-do-site";
export const ADMIN_SESSION_TAG = "sessao-administrativa";
export const ADMIN_NAV_TAG = "navegacao-administrativa";
const REVALIDATE_SECONDS = 300;

export function cacheSite<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[]
): (...args: A) => Promise<R> {
  return unstable_cache(fn, keyParts, { tags: [SITE_TAG], revalidate: REVALIDATE_SECONDS });
}
