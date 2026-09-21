"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizePhone, parseMoney } from "@/lib/format";
import { deleteImage, fileFrom, saveImage } from "@/lib/storage";
import { getDefaultProfessional, getSettings } from "@/lib/settings";
import { isTimeStr } from "@/lib/time";

type FormResult = { error?: string; ok?: string } | undefined;
const str = (v: FormDataEntryValue | null, max = 3000) => String(v ?? "").trim().slice(0, max) || null;
const int = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

function done(msg: string): FormResult {
  revalidatePath("/", "layout");
  return { ok: msg };
}

export async function saveBusiness(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const before = await getSettings();
  const name = str(form.get("name"), 80);
  if (!name) return { error: "Informe o nome do estúdio." };
  const waRaw = String(form.get("whatsapp") ?? "").trim();
  const whatsapp = waRaw ? normalizePhone(waRaw) : null;
  if (waRaw && !whatsapp) return { error: "WhatsApp inválido. Use DDD + número." };

  const images: Record<string, string> = {};
  for (const key of ["heroImage", "ownerPhoto"] as const) {
    const file = fileFrom(form, key);
    if (file) {
      try {
        images[key === "heroImage" ? "heroImageUrl" : "ownerPhotoUrl"] = await saveImage(file, "site");
      } catch (e) {
        return { error: (e as Error).message };
      }
    }
  }

  await prisma.businessSettings.update({
    where: { id: 1 },
    data: {
      name,
      slogan: str(form.get("slogan"), 140),
      about: str(form.get("about"), 600),
      ownerName: str(form.get("ownerName"), 80),
      ownerBio: str(form.get("ownerBio")),
      whatsapp,
      instagram: str(form.get("instagram"), 60)?.replace(/^@/, "") ?? null,
      address: str(form.get("address"), 200),
      region: str(form.get("region"), 120),
      mapsUrl: str(form.get("mapsUrl"), 500),
      paymentMethods: str(form.get("paymentMethods"), 300),
      privacyContactEmail: str(form.get("privacyContactEmail"), 120),
      ...images,
    },
  });
  if (images.heroImageUrl) await deleteImage(before.heroImageUrl);
  if (images.ownerPhotoUrl) await deleteImage(before.ownerPhotoUrl);
  await audit(admin.id, "CONFIG_NEGOCIO", "configuracoes", "1");
  return done("Informações do estúdio salvas.");
}

export async function saveRules(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const before = await getSettings();
  const data = {
    minAdvanceHours: int(form.get("minAdvanceHours"), 0, 720) ?? before.minAdvanceHours,
    cancelMinHours: int(form.get("cancelMinHours"), 0, 720) ?? before.cancelMinHours,
    bookingWindowDays: int(form.get("bookingWindowDays"), 7, 365) ?? before.bookingWindowDays,
    holdMinutes: int(form.get("holdMinutes"), 5, 1440) ?? before.holdMinutes,
    depositEnabled: form.get("depositEnabled") === "on",
    depositCents: parseMoney(form.get("deposit")) ?? before.depositCents,
    cancellationPolicy: str(form.get("cancellationPolicy")),
    bookingInstructions: str(form.get("bookingInstructions")),
    pixKey: str(form.get("pixKey"), 140),
    pixKeyType: str(form.get("pixKeyType"), 40),
    pixHolderName: str(form.get("pixHolderName"), 100),
  };
  await prisma.businessSettings.update({ where: { id: 1 }, data });
  const changed = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => (before as Record<string, unknown>)[k] !== v).map(([k, v]) => [k, v])
  );
  await audit(admin.id, "POLITICAS_ALTERADAS", "configuracoes", "1", changed);
  return done("Regras de agendamento salvas.");
}

/** Recebe um campo por dia da semana com horários separados por vírgula: "09:30, 10:30". */
export async function saveSchedule(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const pro = await getDefaultProfessional();
  const rows: { professionalId: string; weekday: number; time: string }[] = [];
  for (let d = 0; d <= 6; d++) {
    const raw = String(form.get(`day${d}`) ?? "");
    const times = raw
      .split(/[,;\s]+/)
      .map((t) => t.trim().replace(/h/i, ":").replace(/:$/, ":00"))
      .filter(Boolean)
      .map((t) => (/^\d:\d\d$/.test(t) ? `0${t}` : t));
    for (const t of times) {
      if (!isTimeStr(t)) return { error: `Horário inválido: "${t}". Use o formato 09:30.` };
      if (!rows.some((r) => r.weekday === d && r.time === t)) rows.push({ professionalId: pro.id, weekday: d, time: t });
    }
  }
  await prisma.$transaction([
    prisma.workingSlot.deleteMany({ where: { professionalId: pro.id } }),
    prisma.workingSlot.createMany({ data: rows }),
  ]);
  await audit(admin.id, "HORARIOS_ALTERADOS", "agenda", pro.id, { total: rows.length });
  return done("Horários de atendimento salvos.");
}

export async function saveFaq(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form.get("id"));
  const question = str(form.get("question"), 200);
  const answer = str(form.get("answer"), 1500);
  if (!question || !answer) return;
  const order = int(form.get("order"), 0, 999) ?? 0;
  if (id) await prisma.faq.update({ where: { id }, data: { question, answer, order } });
  else await prisma.faq.create({ data: { question, answer, order } });
  await audit(admin.id, id ? "DUVIDA_EDITADA" : "DUVIDA_CRIADA", "faq", id);
  revalidatePath("/", "layout");
}

export async function deleteFaq(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  await prisma.faq.delete({ where: { id } }).catch(() => null);
  await audit(admin.id, "DUVIDA_REMOVIDA", "faq", id);
  revalidatePath("/", "layout");
}
