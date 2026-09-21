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
  if (!rateLimit(`disp:${clientIp()}`, 120, 60_000)) {
    return NextResponse.json({ error: "Muitas consultas seguidas. Aguarde um minuto." }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const service = await prisma.service.findFirst({ where: { id: sp.get("servico") ?? "", active: true } });
  if (!service) return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404 });

  const [settings, pro] = await Promise.all([getSettings(), getDefaultProfessional()]);
  const base = { professionalId: pro.id, durationMinutes: service.durationMinutes, rules: settings };
  const headers = { "Cache-Control": "no-store" };

  const date = sp.get("data");
  if (date) {
    if (!isDateStr(date)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    const res = await getSlotsForRange(prisma, { ...base, fromDate: date, toDate: date });
    return NextResponse.json({ date, slots: res[date] ?? [] }, { headers });
  }

  const from = sp.get("de");
  const to = sp.get("ate");
  if (!isDateStr(from) || !isDateStr(to) || to < from || to > addDaysLocal(from, 62)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  const days = await getDaySummaries(prisma, { ...base, fromDate: from, toDate: to });
  return NextResponse.json({ days }, { headers });
}
