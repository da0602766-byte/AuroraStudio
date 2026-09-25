import { promises as dns } from "node:dns";

/**
 * Pergunta ao DNS se o domínio do e-mail recebe mensagens.
 *
 * É o que pega o erro que nenhuma validação de formato alcança:
 * "maria@gmial.com" é impecável na forma e simplesmente não existe.
 *
 * Só para servidor — `node:dns` não existe no navegador.
 *
 * Em caso de dúvida, libera. O e-mail é opcional no agendamento: uma
 * instabilidade de rede não pode impedir alguém de reservar um horário.
 */

const TEMPO_LIMITE_MS = 2500;

/**
 * - `true`  → o domínio aceita e-mail
 * - `false` → o domínio não existe ou não recebe e-mail
 * - `null`  → não foi possível verificar (rede, tempo esgotado)
 */
export async function dominioRecebeEmail(email: string): Promise<boolean | null> {
  const dominio = String(email || "").trim().toLowerCase().split("@")[1];
  if (!dominio || !dominio.includes(".")) return false;

  const comLimite = <T,>(p: Promise<T>) =>
    Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), TEMPO_LIMITE_MS)),
    ]);

  try {
    const mx = await comLimite(dns.resolveMx(dominio));
    // Registro MX vazio ou apontando para "." significa que o domínio
    // declara explicitamente que não recebe e-mail.
    const validos = mx.filter((r) => r.exchange && r.exchange !== ".");
    if (validos.length) return true;
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException).code;
    // Domínio inexistente é resposta definitiva: não precisa tentar o resto.
    if (codigo === "ENOTFOUND" || codigo === "NXDOMAIN") return false;
    if (codigo !== "ENODATA") return null; // rede ou tempo: não bloqueia
  }

  // Sem MX, um domínio ainda pode receber e-mail pelo próprio endereço
  // (comportamento previsto na especificação). Muitos domínios pequenos
  // dependem disso, então recusar aqui barraria gente de verdade.
  try {
    await comLimite(dns.resolve(dominio));
    return true;
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException).code;
    if (codigo === "ENOTFOUND" || codigo === "NXDOMAIN" || codigo === "ENODATA") return false;
    return null;
  }
}
