/**
 * Envio de e-mail pelo Brevo.
 *
 * Escolhido porque aceita um endereço comum (Gmail) como remetente, sem
 * exigir domínio próprio, e tem 300 envios por dia no plano gratuito.
 *
 * Sem as variáveis configuradas, `enviarEmail` não faz nada e devolve
 * `false`. Nenhuma funcionalidade do site depende do e-mail funcionar:
 * avisos que falham são registrados, não propagados.
 */

const API = "https://api.brevo.com/v3/smtp/email";

export function emailConfigurado(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_REMETENTE);
}

/** Para onde vão os avisos do sistema. Cai no e-mail de login se não houver outro. */
export function emailDaProprietaria(): string | null {
  return process.env.EMAIL_PROPRIETARIA || process.env.ADMIN_EMAIL || null;
}

export type Destinatario = { email: string; nome?: string | null };

export async function enviarEmail(opts: {
  para: Destinatario | Destinatario[];
  assunto: string;
  html: string;
  /** Texto puro, para quem lê e-mail sem formatação. */
  texto?: string;
}): Promise<boolean> {
  if (!emailConfigurado()) return false;

  const destinos = (Array.isArray(opts.para) ? opts.para : [opts.para])
    .filter((d) => d.email && d.email.includes("@"))
    .map((d) => ({ email: d.email, ...(d.nome ? { name: d.nome } : {}) }));
  if (!destinos.length) return false;

  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: process.env.EMAIL_REMETENTE!,
          name: process.env.EMAIL_REMETENTE_NOME || "Aurora Studio",
        },
        to: destinos,
        subject: opts.assunto,
        htmlContent: opts.html,
        ...(opts.texto ? { textContent: opts.texto } : {}),
      }),
      cache: "no-store",
    });
    if (!r.ok) {
      console.error("Brevo recusou o envio", r.status, await r.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Falha ao enviar e-mail", e);
    return false;
  }
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

/** Escapa texto que vem da cliente antes de entrar no HTML do e-mail. */
export function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Moldura simples, para os e-mails ficarem legíveis em qualquer aplicativo. */
export function moldura(titulo: string, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#FAF3F0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#3B2A2F">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#5E1A2C">${esc(titulo)}</h1>
${corpo}
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#8A7378">Enviado automaticamente pelo site do estúdio.</p>
</body></html>`;
}

/**
 * Situação da conta no Brevo.
 *
 * Serve para o painel mostrar se os avisos ainda têm cota. O Brevo devolve
 * os planos em uma lista e nem toda conta traz o mesmo formato, então aqui
 * só se aproveita o que vier reconhecível: sem número legível, devolve
 * `creditos: null` e quem chama mostra a referência do plano em vez de
 * inventar uma medida.
 */
export async function contaBrevo(sinal?: AbortSignal): Promise<{ creditos: number | null; plano: string | null } | null> {
  if (!process.env.BREVO_API_KEY) return null;
  const r = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
    signal: sinal,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Brevo respondeu ${r.status}`);
  const j = (await r.json()) as { plan?: { type?: string; credits?: unknown; creditsType?: string }[] };
  const planos = Array.isArray(j.plan) ? j.plan : [];
  const envio = planos.find((p) => p.creditsType === "sendLimit") ?? planos[0];
  const creditos = typeof envio?.credits === "number" && Number.isFinite(envio.credits) ? envio.credits : null;
  return { creditos, plano: envio?.type ?? null };
}
