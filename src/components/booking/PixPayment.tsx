"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "./ReservationActions";

type Cobranca = {
  copiaECola: string;
  qrCodeBase64: string | null;
  expiraEm: string | null;
  valorCents: number;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Pix do sinal, com confirmação automática.
 *
 * A cobrança é criada no servidor na primeira visita e reaproveitada depois.
 * Enquanto a cliente não paga, a página pergunta ao servidor de tempos em
 * tempos se a reserva já foi confirmada — quando for, ela se atualiza
 * sozinha, sem a cliente precisar fazer nada.
 */
export function PixPayment({ token, expiraEmTexto }: { token: string; expiraEmTexto: string | null }) {
  const router = useRouter();
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const pedido = useRef(false);

  useEffect(() => {
    if (pedido.current) return; // o efeito roda duas vezes em desenvolvimento
    pedido.current = true;
    fetch(`/api/reservas/${token}/pix`, { method: "POST" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Não foi possível gerar o Pix.");
        setCobranca(d);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [token]);

  // Enquanto espera o pagamento, verifica a cada 6 segundos.
  useEffect(() => {
    if (!cobranca) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [cobranca, router]);

  if (carregando) {
    return <p className="mt-4 text-[15px] text-marrom-medio" role="status">Gerando o Pix…</p>;
  }

  if (erro || !cobranca) {
    return (
      <p className="mt-4 text-[15px] text-marrom-medio">
        {erro ?? "Não foi possível gerar o Pix."} Se preferir, fale pelo WhatsApp para combinar o pagamento.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4">
      {cobranca.qrCodeBase64 && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${cobranca.qrCodeBase64}`}
            alt="QR Code para pagar o sinal via Pix"
            className="h-56 w-56"
          />
        </div>
      )}

      <p className="mt-3 text-center text-sm text-marrom-medio">
        Abra o aplicativo do seu banco, escolha Pix e leia o código acima.
      </p>

      <div className="mt-4 border-t border-linha pt-4">
        <p className="text-sm text-marrom-medio">Ou copie o código Pix:</p>
        <p className="mt-1 break-all font-mono text-xs text-marrom-medio">
          {cobranca.copiaECola.slice(0, 60)}…
        </p>
        <div className="mt-3">
          <CopyButton text={cobranca.copiaECola} label="Copiar código Pix" />
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-marrom-medio">
        Assim que o pagamento cair, esta página confirma sozinha.
        {expiraEmTexto ? ` O código vale até ${expiraEmTexto}.` : ""}
      </p>
    </div>
  );
}
