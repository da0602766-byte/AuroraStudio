import { NextResponse, type NextRequest } from "next/server";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";
import { emailParaceValido, sugerirEmail } from "@/lib/format";
import { dominioRecebeEmail } from "@/lib/email-dns";

export const dynamic = "force-dynamic";

/**
 * Diz se um e-mail tem chance de receber mensagem, para o formulário avisar
 * antes de a cliente enviar a reserva.
 *
 * Limite apertado de propósito: a rota faz consulta de DNS, e sem isso
 * viraria ferramenta de varredura para quem quisesse usá-la assim.
 */
export async function GET(req: NextRequest) {
  if (!(await sharedRateLimit(`valemail:${await clientIp()}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: "Muitas consultas seguidas." }, { status: 429 });
  }

  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().slice(0, 120);
  if (!email) return NextResponse.json({ error: "Informe o e-mail." }, { status: 400 });

  if (!emailParaceValido(email)) {
    return NextResponse.json({ ok: false, motivo: "Confira o e-mail: parece faltar algo." });
  }

  const recebe = await dominioRecebeEmail(email);
  if (recebe === false) {
    const sugestao = sugerirEmail(email);
    return NextResponse.json({
      ok: false,
      motivo: sugestao
        ? `Esse endereço não existe. Você quis dizer ${sugestao}?`
        : "Esse endereço de e-mail não existe. Confira o que vem depois do @.",
      sugestao,
    });
  }

  // `null` (não deu para verificar) conta como válido: o e-mail é opcional e
  // uma falha de rede não pode impedir alguém de reservar.
  return NextResponse.json({ ok: true, sugestao: sugerirEmail(email) });
}
