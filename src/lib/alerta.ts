import { createHash } from "crypto";
import { sharedRateLimit } from "./rate-limit";
import { emailDaProprietaria, enviarEmail, esc, moldura } from "./mail";

/**
 * Avisa por e-mail quando algo quebra no servidor.
 *
 * O cuidado central aqui é não transformar uma falha em enxurrada de
 * e-mail: um erro que acontece a cada requisição mandaria centenas de
 * mensagens e provavelmente derrubaria a cota do Brevo. Por isso o mesmo
 * erro só é avisado uma vez por hora, e há um teto diário no total.
 *
 * Nunca propaga exceção: um problema no aviso não pode piorar o problema
 * que ele está tentando avisar.
 */

/** Agrupa erros iguais, para contar repetição em vez de mandar cada uma. */
function assinatura(onde: string, erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro);
  // Números costumam variar entre ocorrências do mesmo erro (ids, timestamps).
  const normalizada = msg.replace(/\d+/g, "#").slice(0, 200);
  return createHash("sha256").update(`${onde}|${normalizada}`).digest("hex").slice(0, 16);
}

export async function alertarErro(onde: string, erro: unknown, contexto?: Record<string, unknown>) {
  // O log sempre sai, mesmo sem e-mail configurado.
  console.error(`[${onde}]`, erro, contexto ?? "");

  try {
    const para = emailDaProprietaria();
    if (!para) return;

    const chave = assinatura(onde, erro);
    // Uma vez por hora para cada erro distinto…
    if (!(await sharedRateLimit(`alerta:${chave}`, 1, 60 * 60_000))) return;
    // …e no máximo 20 avisos por dia no total.
    if (!(await sharedRateLimit("alerta:total", 20, 24 * 60 * 60_000))) return;

    const msg = erro instanceof Error ? erro.message : String(erro);
    const pilha = erro instanceof Error && erro.stack ? erro.stack.split("\n").slice(0, 6).join("\n") : "";

    await enviarEmail({
      para: { email: para },
      assunto: `Erro no site: ${onde}`,
      texto: `${onde}\n\n${msg}\n\n${pilha}`,
      html: moldura(
        "Algo deu errado no site",
        `<p style="margin:0 0 12px">Aconteceu um erro em <strong>${esc(onde)}</strong>.</p>
         <pre style="margin:0 0 12px;white-space:pre-wrap;word-break:break-word;background:#FAF3F0;padding:12px;border-radius:8px;font-size:13px">${esc(msg)}</pre>
         ${contexto ? `<p style="margin:0 0 12px;font-size:13px;color:#6B5459">Contexto: ${esc(JSON.stringify(contexto))}</p>` : ""}
         ${pilha ? `<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:11px;color:#8A7378">${esc(pilha)}</pre>` : ""}
         <p style="margin:16px 0 0;font-size:13px;color:#6B5459">Erros iguais são agrupados: este aviso não se repete na próxima hora.</p>`
      ),
    });
  } catch (e) {
    // Falhar aqui não pode escalar. Só registra.
    console.error("Falha ao enviar o alerta de erro", e);
  }
}
