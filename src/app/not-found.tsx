import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <h1 className="text-4xl">Página não encontrada</h1>
      <Link href="/" className="btn-primario mt-8">Ir para o início</Link>
    </main>
  );
}
