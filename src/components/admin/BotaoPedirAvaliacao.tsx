"use client";

import { useState, useTransition } from "react";
import { marcarAvaliacaoPedida } from "@/app/admin/actions/bookings";

/**
 * Abre o WhatsApp com o pedido de avaliação e registra que ele foi enviado.
 *
 * O registro acontece antes de abrir a conversa: se o navegador bloquear a
 * nova aba, a proprietária ainda pode copiar o link, e o estado fica certo.
 * Marcar não é impeditivo — falhar aqui não pode travar o envio.
 */
export function BotaoPedirAvaliacao({
  bookingId,
  href,
  jaPedido,
}: {
  bookingId: string;
  href: string;
  jaPedido: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [enviado, setEnviado] = useState(jaPedido);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={enviado ? "btn-contorno btn-pequeno" : "btn-primario btn-pequeno"}
      onClick={() => {
        setEnviado(true);
        iniciar(() => {
          marcarAvaliacaoPedida(bookingId).catch(() => {});
        });
      }}
    >
      {pendente ? "Abrindo…" : enviado ? "Pedir avaliação de novo" : "Pedir avaliação"}
    </a>
  );
}
