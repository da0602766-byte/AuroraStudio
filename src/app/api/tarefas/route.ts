import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { expireStaleHolds } from "@/lib/availability";
import { avisarSinaisAtrasados, enviarLembretesDeAmanha, pedirAvaliacoesDeOntem } from "@/lib/notificacoes";
import { alertarErro } from "@/lib/alerta";
import { fmt } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Tarefas que precisam rodar sozinhas, sem ninguém acessar o site.
 *
 * Chamada de hora em hora pela função agendada da Netlify
 * (`netlify/functions/agendador.mts`).
 *
 * - Liberar sinais vencidos: antes isso só acontecia quando alguém abria o
 *   site ou o painel. Sem visita, o horário de uma reserva morta ficava
 *   bloqueado.
 * - Lembretes da véspera: uma vez por dia, no fim da tarde.
 */

const HORA_DOS_LEMBRETES = 18; // horário do estúdio

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(recebido);
  const b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const resultado: Record<string, unknown> = {};

  try {
    await expireStaleHolds(prisma);
    resultado.sinaisVencidos = "ok";
  } catch (e) {
    await alertarErro("tarefas/expireStaleHolds", e);
    resultado.sinaisVencidos = "falhou";
  }

  try {
    resultado.sinaisAtrasados = await avisarSinaisAtrasados();
  } catch (e) {
    await alertarErro("tarefas/avisarSinaisAtrasados", e);
    resultado.sinaisAtrasados = "falhou";
  }

  // `fmt` devolve a hora no fuso do estúdio, não no do servidor.
  const horaLocal = Number(fmt(new Date(), "H"));
  const forcar = req.nextUrl.searchParams.get("lembretes") === "1";
  if (horaLocal === HORA_DOS_LEMBRETES || forcar) {
    try {
      resultado.lembretes = await enviarLembretesDeAmanha();
    } catch (e) {
      await alertarErro("tarefas/lembretes", e);
      resultado.lembretes = "falhou";
    }
    try {
      resultado.avaliacoes = await pedirAvaliacoesDeOntem();
    } catch (e) {
      await alertarErro("tarefas/avaliacoes", e);
      resultado.avaliacoes = "falhou";
    }
  } else {
    resultado.lembretes = `fora do horário (agora ${horaLocal}h, envio às ${HORA_DOS_LEMBRETES}h)`;
  }

  return NextResponse.json({ ok: true, ...resultado });
}
