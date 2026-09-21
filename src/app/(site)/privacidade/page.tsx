import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Política de privacidade" };

export default async function PrivacyPage() {
  const s = await getSettings();
  const contato = [s.privacyContactEmail, s.whatsapp ? `WhatsApp ${formatPhone(s.whatsapp)}` : null].filter(Boolean).join(" ou ");
  return (
    <article className="container-site max-w-3xl py-10 leading-relaxed text-marrom-medio md:py-16">
      <h1 className="text-4xl text-marrom sm:text-5xl">Política de privacidade</h1>
      <p className="mt-6">
        Esta página explica como {s.name} usa os dados informados no agendamento, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2 className="mt-10 text-2xl">Quais dados coletamos</h2>
      <p className="mt-3">
        Nome, WhatsApp, e-mail (opcional), serviço, data e horário escolhidos, e as informações de saúde necessárias para a sua segurança no procedimento:
        se você tem alergias e se está gestante.
      </p>

      <h2 className="mt-10 text-2xl">Para que usamos</h2>
      <p className="mt-3">
        Para organizar a agenda, confirmar e lembrar o seu horário, entrar em contato sobre o atendimento e avaliar se o procedimento é indicado para você.
        As informações de saúde são tratadas com o seu consentimento e usadas somente para o seu atendimento.
      </p>

      <h2 className="mt-10 text-2xl">Com quem compartilhamos</h2>
      <p className="mt-3">
        Não vendemos nem compartilhamos seus dados para publicidade. Eles ficam armazenados em serviços de hospedagem contratados para funcionamento do site,
        com acesso restrito à profissional responsável.
      </p>

      <h2 className="mt-10 text-2xl">Seus direitos</h2>
      <p className="mt-3">
        Você pode pedir a qualquer momento acesso, correção ou exclusão dos seus dados, e retirar o consentimento sobre as informações de saúde.
        {contato && ` Para isso, fale com a gente por ${contato}.`}
      </p>

      <h2 className="mt-10 text-2xl">Fotos</h2>
      <p className="mt-3">Fotos de trabalhos só são publicadas com autorização da cliente.</p>
    </article>
  );
}
