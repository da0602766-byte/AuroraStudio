import { createHmac, timingSafeEqual } from "crypto";

/**
 * Integração com o Mercado Pago para o sinal via Pix.
 *
 * Princípio que rege este arquivo: **o webhook nunca é fonte da verdade.**
 * Ele só avisa que algo mudou. Antes de confirmar qualquer reserva,
 * reconsultamos o pagamento na API com o nosso token — assim, mesmo que
 * alguém descubra o endereço do webhook e forje uma notificação, não
 * consegue confirmar reserva nenhuma.
 */

const API = "https://api.mercadopago.com";

export class PagamentoError extends Error {}

export function mercadoPagoConfigurado(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function token(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new PagamentoError("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  return t;
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const corpo = await r.json().catch(() => null);
  if (!r.ok) {
    console.error("Mercado Pago respondeu", r.status, corpo);
    throw new PagamentoError("Não foi possível falar com o Mercado Pago agora.");
  }
  return corpo as T;
}

export type CobrancaPix = {
  id: string;
  /** Código "copia e cola" do Pix. */
  copiaECola: string;
  /** Imagem do QR Code em PNG, já em base64 (pode vir vazia). */
  qrCodeBase64: string | null;
  expiraEm: Date | null;
};

type RespostaPagamento = {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  external_reference?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
};

/** Centavos → o formato decimal que a API espera. */
const emReais = (centavos: number) => Math.round(centavos) / 100;

export async function criarCobrancaPix(opts: {
  /** Vai no external_reference e é conferido na confirmação. */
  bookingId: string;
  valorCents: number;
  descricao: string;
  nome: string;
  email?: string | null;
  expiraEm: Date;
  notificationUrl: string;
}): Promise<CobrancaPix> {
  const [primeiro, ...resto] = opts.nome.trim().split(/\s+/);
  const p = await chamar<RespostaPagamento>("/v1/payments", {
    method: "POST",
    headers: {
      // Evita cobranças duplicadas se a requisição for repetida.
      "X-Idempotency-Key": `reserva-${opts.bookingId}`,
    },
    body: JSON.stringify({
      transaction_amount: emReais(opts.valorCents),
      description: opts.descricao,
      payment_method_id: "pix",
      external_reference: opts.bookingId,
      notification_url: opts.notificationUrl,
      date_of_expiration: opts.expiraEm.toISOString(),
      payer: {
        email: opts.email || "sem-email@exemplo.com",
        first_name: primeiro || "Cliente",
        ...(resto.length ? { last_name: resto.join(" ") } : {}),
      },
    }),
  });

  const dados = p.point_of_interaction?.transaction_data;
  if (!dados?.qr_code) throw new PagamentoError("O Mercado Pago não devolveu o código Pix.");

  return {
    id: String(p.id),
    copiaECola: dados.qr_code,
    qrCodeBase64: dados.qr_code_base64 || null,
    expiraEm: p.date_of_expiration ? new Date(p.date_of_expiration) : null,
  };
}

export type SituacaoPagamento = {
  id: string;
  aprovado: boolean;
  valorCents: number;
  bookingId: string | null;
  situacao: string;
};

/** Consulta o pagamento na API. É esta resposta que vale, não o webhook. */
export async function consultarPagamento(id: string): Promise<SituacaoPagamento> {
  const p = await chamar<RespostaPagamento>(`/v1/payments/${encodeURIComponent(id)}`);
  return {
    id: String(p.id),
    aprovado: p.status === "approved",
    valorCents: Math.round(p.transaction_amount * 100),
    bookingId: p.external_reference ?? null,
    situacao: p.status,
  };
}

/**
 * Confere a assinatura do webhook.
 *
 * O Mercado Pago manda `x-signature: ts=...,v1=...` e assina a string
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com HMAC-SHA256.
 *
 * Sem `MERCADOPAGO_WEBHOOK_SECRET` cadastrado, devolve `null` — e quem chama
 * decide o que fazer. A reconsulta na API continua valendo de qualquer forma.
 */
export function assinaturaConfere(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): boolean | null {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo) return null;
  if (!opts.xSignature) return false;

  const partes = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    })
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  // O id vai em minúsculas, conforme a documentação.
  const manifesto = `id:${opts.dataId.toLowerCase()};request-id:${opts.xRequestId ?? ""};ts:${ts};`;
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
