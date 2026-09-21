import type { Metadata } from "next";
import { LookupForm } from "./LookupForm";

export const metadata: Metadata = { title: "Consultar reserva" };

export default function LookupPage() {
  return (
    <div className="container-site max-w-md py-10 md:py-16">
      <h1 className="text-4xl sm:text-5xl">Minha reserva</h1>
      <p className="mt-3 text-marrom-medio">
        Use o código que aparece na confirmação (por exemplo, AU-20260921-4832) e o WhatsApp informado no agendamento.
      </p>
      <LookupForm />
    </div>
  );
}
