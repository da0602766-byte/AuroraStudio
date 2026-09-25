/**
 * Esqueleto exibido enquanto a página carrega.
 *
 * A altura mínima aproxima a de uma página real de propósito: um esqueleto
 * curto fazia o rodapé aparecer no meio da tela e descer depois, dando a
 * impressão de que a página tinha pulado.
 */
export default function Loading() {
  return (
    <div className="container-site min-h-[70vh] py-20" role="status">
      <div className="h-10 w-2/3 max-w-sm animate-pulse rounded-full bg-po-escuro" />
      <div className="mt-6 h-4 w-full max-w-md animate-pulse rounded-full bg-po-escuro" />
      <div className="mt-3 h-4 w-5/6 max-w-md animate-pulse rounded-full bg-po-escuro" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-po-escuro" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
