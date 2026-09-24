import webpush from "web-push";
import { prisma } from "./db";
import { alertarErro } from "./alerta";

/*
 * Notificação mesmo com o navegador fechado (Web Push).
 *
 * O sino do painel (`Avisos.tsx`) já avisa em tempo real enquanto o site
 * está aberto em alguma aba, mesmo escondida. Isso cobre a maior parte do
 * dia, mas não quando a proprietária fecha tudo. Web Push resolve essa
 * lacuna: o navegador guarda uma inscrição e mostra a notificação sozinho,
 * acordado pelo sistema operacional, sem o site precisar estar aberto.
 *
 * Sem as variáveis VAPID configuradas, todas as funções aqui viram no-op:
 * o resto do site continua funcionando normalmente, só sem esse aviso extra.
 */

/**
 * `webpush.setVapidDetails` só guarda os valores num objeto interno da
 * biblioteca — chamar de novo a cada envio não tem custo que justifique
 * cachear o resultado, e assim o valor das variáveis de ambiente nunca
 * fica preso a uma leitura antiga.
 *
 * A biblioteca valida o formato da chave e lança erro se ela estiver
 * malformada (por exemplo, colada com espaço a mais no painel da
 * hospedagem). Isso não pode virar uma promessa rejeitada sem quem trate:
 * melhor desligar o aviso por push desta vez do que derrubar a reserva ou
 * o pagamento que dispararam a chamada.
 */
function configurarVapid(): boolean {
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@example.com", publica, privada);
    return true;
  } catch {
    return false;
  }
}

export function pushConfigurado(): boolean {
  return configurarVapid();
}

type Notificacao = { titulo: string; texto: string; href: string; tag: string };

/**
 * Manda a notificação para todos os aparelhos inscritos.
 *
 * Cada envio é isolado: um aparelho com erro não impede os outros. Uma
 * inscrição que o navegador não reconhece mais (404/410 — a pessoa
 * desinstalou, limpou os dados ou trocou de aparelho) é apagada, para não
 * tentar de novo para sempre.
 */
export async function avisarPorPush(n: Notificacao): Promise<void> {
  if (!configurarVapid()) return;

  const inscricoes = await prisma.pushSubscription.findMany();
  if (!inscricoes.length) return;

  const payload = JSON.stringify({ title: n.titulo, body: n.texto, href: n.href, tag: n.tag });

  await Promise.all(
    inscricoes.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
          return;
        }
        await alertarErro("avisarPorPush", e, { inscricao: s.id });
      }
    })
  );
}
