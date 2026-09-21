"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-site max-w-xl py-20 text-center">
      <h1 className="text-4xl">Não foi possível carregar esta página</h1>
      <p className="mt-3 text-marrom-medio">Verifique sua conexão e tente novamente.</p>
      <button type="button" onClick={reset} className="btn-primario mt-8">Tentar de novo</button>
    </div>
  );
}
