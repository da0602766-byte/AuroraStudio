"use client";

import { useEffect } from "react";

/**
 * Tela de erro do painel.
 *
 * Sem este arquivo, qualquer falha aqui caía na tela branca do Next, com um
 * código e nenhuma orientação. O código (`digest`) continua visível, porque
 * é por ele que se encontra o erro no log do servidor.
 */
export default function PainelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erro no painel", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-3xl">Algo deu errado aqui</h1>
      <p className="mt-3 text-marrom-medio">
        A página não pôde ser carregada. Suas reservas e clientes estão seguras — isto é um problema de exibição.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primario">Tentar de novo</button>
        <a href="/admin" className="btn-contorno">Voltar ao início</a>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-marrom-claro">
          Código do erro: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
