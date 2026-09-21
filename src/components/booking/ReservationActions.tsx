"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-contorno btn-pequeno"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2500);
        } catch {
          window.prompt("Copie a chave:", text);
        }
      }}
    >
      <span aria-live="polite">{done ? "Copiado" : label}</span>
    </button>
  );
}

/** Registra que a cliente enviou o comprovante e abre o WhatsApp. */
export function ProofButton({ token, href }: { token: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-primario w-full sm:w-auto"
      onClick={() => {
        fetch(`/api/reservas/${token}/comprovante`, { method: "POST", keepalive: true }).catch(() => {});
      }}
    >
      Enviar comprovante pelo WhatsApp
    </a>
  );
}

export function CancelButton({ token }: { token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button type="button" className="btn-contorno" onClick={() => setConfirming(true)}>
        Cancelar reserva
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-bordo/30 bg-bordo/5 p-4">
      <p className="font-medium">Cancelar esta reserva?</p>
      <p className="mt-1 text-sm text-marrom-medio">O horário será liberado para outras clientes.</p>
      {error && <p role="alert" className="erro">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primario btn-pequeno"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await fetch(`/api/reservas/${token}/cancelar`, { method: "POST" }).catch(() => null);
            const data = r ? await r.json().catch(() => ({})) : {};
            setBusy(false);
            if (r?.ok) router.refresh();
            else setError(data.error ?? "Não foi possível cancelar agora. Tente novamente.");
          }}
        >
          {busy ? "Cancelando…" : "Sim, cancelar"}
        </button>
        <button type="button" className="btn-contorno btn-pequeno" onClick={() => setConfirming(false)} disabled={busy}>
          Manter reserva
        </button>
      </div>
    </div>
  );
}

export function ReviewForm({ token }: { token: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (msg?.ok) return <p role="status" className="text-marrom-medio">{msg.text}</p>;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return setMsg({ ok: false, text: "Escolha de 1 a 5 estrelas." });
        setBusy(true);
        const r = await fetch(`/api/reservas/${token}/avaliacao`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment }),
        }).catch(() => null);
        const data = r ? await r.json().catch(() => ({})) : {};
        setBusy(false);
        if (r?.ok) {
          setMsg({ ok: true, text: "Obrigada pela avaliação! Ela aparece no site depois de revisada." });
          router.refresh();
        } else setMsg({ ok: false, text: data.error ?? "Não foi possível enviar. Tente novamente." });
      }}
    >
      <fieldset>
        <legend className="rotulo">Sua nota</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} estrela${n > 1 ? "s" : ""}`} aria-pressed={rating === n} className="flex h-11 w-11 items-center justify-center text-ouro">
              <svg width="28" height="28" viewBox="0 0 24 24" fill={n <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="coment" className="rotulo">Comentário</label>
        <textarea id="coment" className="campo min-h-[100px]" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} required />
      </div>
      {msg && !msg.ok && <p role="alert" className="erro">{msg.text}</p>}
      <button type="submit" className="btn-primario" disabled={busy}>{busy ? "Enviando…" : "Enviar avaliação"}</button>
    </form>
  );
}
