/**
 * Avisos do painel: o que a proprietária precisa saber sem ir procurar.
 *
 * Aqui ficam só o formato e a junção — nada de banco — porque este arquivo
 * é lido também no navegador, pelo sino do cabeçalho.
 *
 * Há dois tipos de aviso, e a diferença muda o comportamento:
 *
 * - **Eventos** ("reserva", "pagamento") aconteceram num instante. Chegam
 *   uma vez, e ficam na lista da sessão como histórico do dia.
 * - **Pendências** ("comprovante", "sinal") são situações abertas. O
 *   servidor as manda inteiras a cada consulta, e elas somem sozinhas
 *   quando alguém resolve — por isso a lista antiga é descartada e
 *   substituída, nunca somada.
 */

export type TipoAviso = "reserva" | "pagamento" | "comprovante" | "sinal";

export type Aviso = {
  /** Estável entre consultas, para o mesmo aviso não notificar duas vezes. */
  id: string;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  href: string;
  /** ISO. */
  em: string;
};

export type Novidades = {
  /** Instante da leitura, devolvido para a próxima consulta continuar daqui. */
  agora: string;
  novos: Aviso[];
  pendentes: Aviso[];
};

export function ehPendencia(tipo: TipoAviso): boolean {
  return tipo === "comprovante" || tipo === "sinal";
}

const TETO = 30;

function maisNovoPrimeiro(a: Aviso, b: Aviso) {
  return b.em.localeCompare(a.em);
}

/**
 * Junta o que já estava na tela com o que acabou de chegar.
 *
 * Pendências vêm primeiro porque pedem ação; os eventos ficam embaixo, em
 * ordem de chegada. Repetidos são descartados pelo id.
 */
export function juntarAvisos(anteriores: Aviso[], novos: Aviso[], pendentes: Aviso[]): Aviso[] {
  const eventos = [...anteriores.filter((a) => !ehPendencia(a.tipo)), ...novos.filter((a) => !ehPendencia(a.tipo))];

  const vistos = new Set<string>();
  const unicos = (lista: Aviso[]) =>
    lista.filter((a) => (vistos.has(a.id) ? false : (vistos.add(a.id), true)));

  return [
    ...unicos([...pendentes].sort(maisNovoPrimeiro)),
    ...unicos(eventos.sort(maisNovoPrimeiro)),
  ].slice(0, TETO);
}
