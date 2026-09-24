import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { buscarNovidades } from "@/lib/novidades";
import { alertarErro } from "@/lib/alerta";

export const dynamic = "force-dynamic";

/**
 * O que o sino do painel consulta de tempos em tempos.
 *
 * Fica atrás do login: a resposta traz nome de cliente e valor de sinal.
 * O limitador é rede de segurança contra um laço enlouquecido no
 * navegador — cada chamada é uma função cobrada da cota da Netlify.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ erro: "Entre no painel para ver os avisos." }, { status: 401 });

  if (!rateLimit(`novidades:${admin.id}`, 40, 60_000)) {
    return NextResponse.json({ erro: "Muitas consultas seguidas." }, { status: 429 });
  }

  try {
    const bruto = req.nextUrl.searchParams.get("desde");
    const pedido = bruto ? new Date(bruto) : null;
    const desde = pedido && !Number.isNaN(pedido.getTime()) ? pedido : null;
    return NextResponse.json(await buscarNovidades(desde), {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    await alertarErro("GET /api/admin/novidades", e);
    return NextResponse.json({ erro: "Não deu para buscar os avisos agora." }, { status: 500 });
  }
}
