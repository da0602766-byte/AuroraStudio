import { pior, situacaoDosServicos } from "@/lib/limites";
import { Medidor, Selo } from "@/components/admin/Medidor";
import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/Buttons";
import { resetarDadosDeTeste } from "@/app/admin/actions/sistema";

export const metadata = { title: "Sistema" };

const RESUMO: Record<string, { titulo: string; texto: string }> = {
  tranquilo: {
    titulo: "Está tudo tranquilo",
    texto: "Nenhum dos serviços que seguram o site está perto do limite do plano gratuito.",
  },
  desligado: {
    titulo: "Está tudo tranquilo",
    texto: "Nada perto do limite. Há serviço desligado abaixo — o site funciona assim mesmo, só sem aquele recurso.",
  },
  informativo: {
    titulo: "Está tudo tranquilo",
    texto: "Nenhum dos serviços que seguram o site está perto do limite do plano gratuito.",
  },
  "sem-leitura": {
    titulo: "Quase tudo tranquilo",
    texto: "Um dos serviços não respondeu à consulta agora. Veja abaixo qual foi e o link do painel dele.",
  },
  atencao: {
    titulo: "Um serviço pede atenção",
    texto: "Algo passou de 70% do que o plano gratuito oferece. Ainda funciona, mas vale resolver antes de encher.",
  },
  limite: {
    titulo: "Um serviço está no limite",
    texto: "Algo passou de 90% do plano. É aqui que o site começa a falhar — veja abaixo o que fazer.",
  },
};

export default async function Sistema() {
  const [servicos, clientes, reservas, avaliacoes] = await Promise.all([
    situacaoDosServicos(),
    prisma.client.count(),
    prisma.booking.count(),
    prisma.review.count(),
  ]);
  const geral = pior(servicos.map((s) => s.nivel));
  const resumo = RESUMO[geral];
  const semDados = clientes === 0 && reservas === 0 && avaliacoes === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Sistema</h1>
        <p className="mt-1 max-w-2xl text-marrom-medio">
          O site é gratuito porque vive em quatro serviços, cada um com um teto. Quando um enche, o sintoma é confuso
          — uma foto que não sobe, um e-mail que não chega. Esta página mostra quanto já foi usado de cada um.
        </p>
      </div>

      <section className="painel-bloco flex flex-wrap items-center gap-x-4 gap-y-2">
        <Selo nivel={geral} />
        <div>
          <p className="font-medium">{resumo.titulo}</p>
          <p className="text-sm text-marrom-medio">{resumo.texto}</p>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {servicos.map((s) => (
          <section key={s.id} className="painel-bloco flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl">{s.nome}</h2>
                <p className="text-sm text-marrom-claro">{s.fornecedor}</p>
              </div>
              <Selo nivel={s.nivel} />
            </div>

            <p className="mt-2 text-[15px] leading-relaxed text-marrom-medio">{s.paraQue}</p>

            {s.medidas.length > 0 && (
              <div className="mt-4 space-y-4 border-t border-linha pt-4">
                {s.medidas.map((m) => (
                  <Medidor key={m.rotulo} medida={m} />
                ))}
              </div>
            )}

            {s.referencia.length > 0 && (
              <dl className="mt-4 space-y-1.5 border-t border-linha pt-4 text-sm">
                {s.referencia.map((r) => (
                  <div key={r.rotulo} className="flex justify-between gap-3">
                    <dt className="text-marrom-medio">{r.rotulo}</dt>
                    <dd className="text-right font-medium">{r.valor}</dd>
                  </div>
                ))}
              </dl>
            )}

            <p className="mt-4 text-sm leading-relaxed text-marrom-medio">{s.recado}</p>
          </section>
        ))}
      </div>

      <section className="painel-bloco border-2 border-bordo/30">
        <h2 className="text-xl text-bordo">Zona de risco</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-marrom-medio">
          Apaga clientes, reservas, pagamentos e avaliações de uma vez — para tirar os dados de teste antes de começar
          a usar o site de verdade. Serviços, categorias, horários de atendimento, bloqueios, fotos do portfólio e as
          configurações do estúdio não são afetados.
        </p>

        {semDados ? (
          <p className="mt-3 text-sm text-marrom-claro">Não há clientes, reservas nem avaliações cadastradas agora.</p>
        ) : (
          <>
            <p className="mt-3 text-sm">
              Hoje há <strong>{clientes}</strong> cliente{clientes === 1 ? "" : "s"}, <strong>{reservas}</strong>{" "}
              reserva{reservas === 1 ? "" : "s"} e <strong>{avaliacoes}</strong> avaliaç{avaliacoes === 1 ? "ão" : "ões"}{" "}
              cadastrada{reservas === 1 ? "" : "s"}.
            </p>
            <ActionForm action={resetarDadosDeTeste} className="mt-4 max-w-sm space-y-3">
              <div>
                <label htmlFor="confirmacao" className="rotulo">
                  Digite APAGAR para confirmar
                </label>
                <input id="confirmacao" name="confirmacao" className="campo" autoComplete="off" required />
              </div>
              <SubmitButton
                className="btn-contorno btn-pequeno border-bordo text-bordo"
                pendingText="Apagando…"
                confirm={`Apagar definitivamente ${clientes} clientes, ${reservas} reservas e ${avaliacoes} avaliações? Não é possível desfazer.`}
              >
                Apagar dados de teste
              </SubmitButton>
            </ActionForm>
          </>
        )}
      </section>

      <p className="text-xs leading-relaxed text-marrom-claro">
        Os números são lidos na hora que você abre esta página. Os tetos vêm do próprio fornecedor, quando ele informa;
        onde não dá para medir, o valor do plano aparece escrito, sem barra.
      </p>
    </div>
  );
}
