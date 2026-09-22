export default function PanelLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando seção do painel…</span>
      <div className="h-9 w-48 animate-pulse rounded-xl bg-marrom/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-marrom/10" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl bg-marrom/10" />
        <div className="h-56 animate-pulse rounded-2xl bg-marrom/10" />
      </div>
    </div>
  );
}
