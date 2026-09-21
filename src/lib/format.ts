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

/** Normaliza telefone brasileiro para somente dígitos com DDI 55. */
export function normalizePhone(input: string): string | null {
  let d = (input || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
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
