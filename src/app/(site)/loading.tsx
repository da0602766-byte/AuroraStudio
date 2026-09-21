export default function Loading() {
  return (
    <div className="container-site py-20" role="status">
      <div className="h-10 w-2/3 max-w-sm animate-pulse rounded-full bg-po-escuro" />
      <div className="mt-6 h-4 w-full max-w-md animate-pulse rounded-full bg-po-escuro" />
      <div className="mt-3 h-4 w-5/6 max-w-md animate-pulse rounded-full bg-po-escuro" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
