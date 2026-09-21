/**
 * Constantes e verificação da sessão do painel.
 *
 * Este módulo é propositalmente leve: não importa Prisma nem `next/headers`,
 * para que a middleware (que roda no runtime Edge) use exatamente as mesmas
 * regras que o servidor. Assim o nome do cookie, o algoritmo de assinatura e
 * o tamanho mínimo do segredo nunca ficam diferentes entre os dois lugares.
 */

export const SESSION_COOKIE = "aurora_admin";
export const SESSION_DAYS = 7;

/** Único algoritmo aceito ao verificar a sessão. */
export const JWT_ALGORITHMS = ["HS256"] as const;

/** Tamanho mínimo do segredo, em caracteres. */
export const MIN_SECRET_LENGTH = 32;

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < MIN_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET ausente ou curto (mínimo ${MIN_SECRET_LENGTH} caracteres).`);
  }
  return new TextEncoder().encode(s);
}
