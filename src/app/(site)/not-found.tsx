import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-site max-w-xl py-20 text-center">
      <h1 className="text-4xl">Página não encontrada</h1>
      <p className="mt-3 text-marrom-medio">O endereço pode ter mudado ou o link está incompleto.</p>
      <Link href="/" className="btn-primario mt-8">Voltar para o início</Link>
    </div>
  );
}
