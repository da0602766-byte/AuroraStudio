export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Preço zero é tratado como "sob consulta". */
export function priceLabel(cents: number): string {
  return cents > 0 ? brl(cents) : "Sob consulta";
}

export function effectivePrice(s: { priceCents: number; promoPriceCents: number | null }): number {
  return s.promoPriceCents != null && s.promoPriceCents > 0 && s.promoPriceCents < s.priceCents
    ? s.promoPriceCents
    : s.priceCents;
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/**
 * DDDs que existem no Brasil. Sem esta lista, números como (01) ou (30)
 * passavam — e pior: o "01" perdia o zero e virava outro número, válido na
 * aparência e inalcançável na prática.
 */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type TelefoneInvalido = { ok: false; motivo: string };
export type TelefoneValido = { ok: true; numero: string };
export type ResultadoTelefone = TelefoneValido | TelefoneInvalido;

/**
 * Confere e normaliza um telefone brasileiro, explicando o que está errado.
 *
 * Por padrão exige celular, porque o site usa o número para falar pelo
 * WhatsApp: um fixo deixaria a cliente sem canal de contato. O painel pode
 * passar `exigirCelular: false` para cadastrar quem só tem telefone fixo.
 */
export function validarTelefone(
  input: string,
  opts: { exigirCelular?: boolean } = {}
): ResultadoTelefone {
  const exigirCelular = opts.exigirCelular ?? true;
  let d = (input || "").replace(/\D/g, "");

  // Prefixo de discagem (0 ou 0 + operadora) vem antes do DDD, nunca dentro
  // dele. Removê-lo com `replace(/^0+/, "")` corrompia DDDs como 01.
  if (d.length > 11 && d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);

  if (!d) return { ok: false, motivo: "Informe seu WhatsApp com DDD." };
  if (d.length < 10) return { ok: false, motivo: "Faltam dígitos. Informe DDD e número." };
  if (d.length > 11) return { ok: false, motivo: "Dígitos demais. Confira o número." };

  const ddd = Number(d.slice(0, 2));
  if (!DDDS.has(ddd)) {
    return { ok: false, motivo: `O DDD ${d.slice(0, 2)} não existe. Confira os dois primeiros dígitos.` };
  }

  const numero = d.slice(2);
  if (/^(\d)\1+$/.test(numero)) {
    return { ok: false, motivo: "Esse número não parece real. Confira os dígitos." };
  }

  if (exigirCelular) {
    if (numero.length !== 9 || !numero.startsWith("9")) {
      return {
        ok: false,
        motivo: "Informe um celular com WhatsApp: 9 dígitos após o DDD, começando com 9.",
      };
    }
  } else if (numero.length === 9 && !numero.startsWith("9")) {
    return { ok: false, motivo: "Celular com 9 dígitos precisa começar com 9." };
  }

  return { ok: true, numero: `55${d}` };
}

/** Normaliza telefone brasileiro para somente dígitos com DDI 55. */
export function normalizePhone(input: string, opts?: { exigirCelular?: boolean }): string | null {
  const r = validarTelefone(input, opts);
  return r.ok ? r.numero : null;
}

export function formatPhone(digits: string): string {
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "15,00" / "15" / "R$ 1.250,50" → centavos */
export function parseMoney(input: FormDataEntryValue | null): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[^\d,.-]/g, "").trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export const centsToInput = (c: number | null | undefined) =>
  c == null ? "" : (c / 100).toFixed(2).replace(".", ",");

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Domínios de e-mail mais usados no Brasil, para detectar erro de digitação.
 * Um "gmail.con" é aceito por qualquer validação de formato e depois some:
 * a confirmação nunca chega e ninguém descobre por quê.
 */
const DOMINIOS = [
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "yahoo.com",
  "icloud.com", "live.com", "bol.com.br", "uol.com.br", "terra.com.br",
  "globo.com", "me.com", "msn.com",
];

/** Distância de edição, limitada: acima do limite não interessa o valor exato. */
function distancia(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/**
 * Sugere a correção de um domínio digitado errado, ou null se estiver bom.
 * "maria@gmail.con" → "maria@gmail.com"
 */
export function sugerirEmail(email: string): string | null {
  const partes = String(email || "").trim().toLowerCase().split("@");
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  const [usuario, dominio] = partes;
  if (DOMINIOS.includes(dominio)) return null;

  let melhor: string | null = null;
  let menor = 3;
  for (const d of DOMINIOS) {
    const dist = distancia(dominio, d, 2);
    if (dist < menor) {
      menor = dist;
      melhor = d;
    }
  }
  return melhor && menor <= 2 ? `${usuario}@${melhor}` : null;
}

/**
 * Um pedaço do endereço feito de uma letra repetida ("ooooooo") não é erro
 * de digitação: é campo preenchido a esmo para passar da validação. Cinco
 * repetições seguidas formando a parte inteira não acontecem em endereço
 * real, mas "aaa@gmail.com" continua passando.
 */
function pedacoDigitadoAEsmo(parte: string): boolean {
  return parte.length >= 5 && /^(.)\1+$/.test(parte);
}

/** Formato de e-mail, mais exigente que o mínimo: exige domínio com ponto. */
export function emailParaceValido(email: string): boolean {
  const e = String(email || "").trim();
  if (e.length < 6 || e.length > 120) return false;
  if (/\s/.test(e) || e.includes("..")) return false;
  if (!/^[^@]+@[^@.]+(\.[^@.]+)+$/.test(e)) return false;

  const [usuario, dominio] = e.toLowerCase().split("@");
  if (pedacoDigitadoAEsmo(usuario)) return false;
  // Confere rótulo por rótulo: "ooooo.ooo" e "gmail.ooooo" caem aqui.
  if (dominio.split(".").some(pedacoDigitadoAEsmo)) return false;

  return true;
}
