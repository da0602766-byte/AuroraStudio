/**
 * Endereço público do site.
 *
 * `NEXT_PUBLIC_SITE_URL` tem prioridade, mas é fácil ela ficar defasada
 * quando o projeto é renomeado na hospedagem. Sem ela, usamos o endereço
 * que a própria Netlify publica em `URL`, então o site se configura sozinho
 * e continua correto seja qual for o nome do projeto.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "http://localhost:3000";
  return raw.replace(/\/+$/, ""); // sem barra no final
}
