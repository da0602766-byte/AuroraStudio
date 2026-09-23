import type { Config } from "@netlify/functions";

/**
 * Acorda o site de hora em hora para rodar as tarefas automáticas.
 *
 * Não contém regra de negócio de propósito: só chama a rota, para que toda
 * a lógica continue num lugar só, dentro do Next, e possa ser testada e
 * movida de hospedagem sem reescrever nada.
 */
const agendador = async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const segredo = process.env.CRON_SECRET;
  if (!base || !segredo) {
    console.error("agendador: faltam URL ou CRON_SECRET");
    return new Response("configuração incompleta", { status: 500 });
  }

  const r = await fetch(`${base.replace(/\/+$/, "")}/api/tarefas`, {
    method: "POST",
    headers: { authorization: `Bearer ${segredo}` },
  });
  const corpo = await r.text().catch(() => "");
  console.log("agendador:", r.status, corpo.slice(0, 300));
  return new Response(corpo, { status: r.status });
};

export default agendador;

export const config: Config = { schedule: "@hourly" };
