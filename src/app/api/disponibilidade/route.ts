import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getDaySummaries, getSlotsForRange } from "@/lib/availability";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { addDaysLocal, isDateStr } from "@/lib/time";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET ?servico=ID&data=AAAA-MM-DD         → horários do dia
 * GET ?servico=ID&de=AAAA-MM-DD&ate=...   → resumo de disponibilidade por dia
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  if (!rateLimit(`disp:${await clientIp()}`, 120, 60_000)) {
    return NextResponse.json({ error: "Muitas consultas seguidas. Aguarde um minuto." }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const [service, settings, pro] = await Promise.all([
    prisma.service.findFirst({ where: { id: sp.get("servico") ?? "", active: true } }),
    getSettings(),
    getDefaultProfessional(),
  ]);
  if (!service) return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404 });

  const base = { professionalId: pro.id, durationMinutes: service.durationMinutes, rules: settings };
  const responseHeaders = () => ({
    "Cache-Control": "no-store",
    "Server-Timing": `availability;dur=${Date.now() - startedAt}`,
  });

  const date = sp.get("data");
  if (date) {
    if (!isDateStr(date)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    const res = await getSlotsForRange(prisma, { ...base, fromDate: date, toDate: date });
    return NextResponse.json({ date, slots: res[date] ?? [] }, { headers: responseHeaders() });
  }

  const from = sp.get("de");
  const to = sp.get("ate");
  if (!isDateStr(from) || !isDateStr(to) || to < from || to > addDaysLocal(from, 62)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  const days = await getDaySummaries(prisma, { ...base, fromDate: from, toDate: to });
  return NextResponse.json({ days }, { headers: responseHeaders() });
}
