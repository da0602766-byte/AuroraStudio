/** Link para abrir conversa no WhatsApp (sem API). */
export function waLink(phoneDigits: string | null | undefined, text?: string): string | null {
  if (!phoneDigits) return null;
  const d = phoneDigits.replace(/\D/g, "");
  if (d.length < 12) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
