import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { alertarErro } from "@/lib/alerta";

export const dynamic = "force-dynamic";

/**
 * Guarda e remove a inscrição do navegador para Web Push.
 *
 * Chamado pelo sino do painel quando a proprietária liga o aviso "mesmo com
 * o navegador fechado". `endpoint` é único por navegador/aparelho: o mesmo
 * POST serve tanto para cadastrar quanto para atualizar, se o navegador
 * trocar as chaves da inscrição.
 */
const inscricaoSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Entre no painel." }, { status: 401 });
  if (!rateLimit(`push-inscrever:${admin.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  }

  const corpo = await req.json().catch(() => null);
  const parsed = inscricaoSchema.safeParse(corpo);
  if (!parsed.success) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      create: {
        adminUserId: admin.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
      update: {
        adminUserId: admin.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await alertarErro("POST /api/admin/push", e);
    return NextResponse.json({ error: "Não foi possível salvar agora." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Entre no painel." }, { status: 401 });
  if (!rateLimit(`push-cancelar:${admin.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  }

  const corpo = await req.json().catch(() => null);
  const endpoint = typeof corpo?.endpoint === "string" ? corpo.endpoint : null;
  if (!endpoint) return NextResponse.json({ error: "Faltou o endpoint." }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint, adminUserId: admin.id } });
  return NextResponse.json({ ok: true });
}
