"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { ADMIN_NAV_TAG, SITE_TAG } from "@/lib/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseMoney, slugify } from "@/lib/format";
import { deleteImage, fileFrom, saveImage } from "@/lib/storage";
import { isDateStr, localToUtc } from "@/lib/time";

type FormResult = { error?: string; ok?: string } | undefined;

const int = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};
const str = (v: FormDataEntryValue | null, max = 2000) => String(v ?? "").trim().slice(0, max) || null;

function revalidateSite() {
  revalidatePath("/", "layout");
  revalidateTag(SITE_TAG, { expire: 0 }); // derruba o cache das consultas do site
}

// ─── Serviços ───────────────────────────────────────────────────────

export async function saveService(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const id = str(form.get("id"));
  const name = str(form.get("name"), 100);
  if (!name) return { error: "Informe o nome do serviço." };
  const price = parseMoney(form.get("price")) ?? 0;
  const promo = parseMoney(form.get("promoPrice"));
  const duration = int(form.get("durationMinutes"));
  if (!duration || duration < 10 || duration > 600) return { error: "Informe a duração em minutos (entre 10 e 600)." };
  const depositRaw = String(form.get("deposit") ?? "").trim();
  const deposit = depositRaw === "" ? null : parseMoney(depositRaw);
  const retMin = int(form.get("returnDaysMin"));
  const retMax = int(form.get("returnDaysMax"));

  const data = {
    name,
    description: str(form.get("description")),
    notes: str(form.get("notes")),
    priceCents: price,
    promoPriceCents: promo && promo > 0 ? promo : null,
    durationMinutes: duration,
    depositCents: deposit,
    returnDaysMin: retMin,
    returnDaysMax: retMax && retMin && retMax < retMin ? retMin : retMax,
    active: form.get("active") === "on",
    order: int(form.get("order")) ?? 0,
    categoryId: str(form.get("categoryId")),
  };

  let imageUrl: string | undefined;
  const file = fileFrom(form, "image");
  if (file) {
    try {
      imageUrl = await saveImage(file, "servicos");
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  if (id) {
    const before = await prisma.service.findUnique({ where: { id } });
    if (!before) return { error: "Serviço não encontrado." };
    await prisma.service.update({ where: { id }, data: { ...data, ...(imageUrl ? { imageUrl } : {}) } });
    if (imageUrl) await deleteImage(before.imageUrl);
    const changes: Record<string, unknown> = {};
    if (before.priceCents !== data.priceCents) changes.preco = [before.priceCents, data.priceCents];
    if (before.promoPriceCents !== data.promoPriceCents) changes.promocao = [before.promoPriceCents, data.promoPriceCents];
    if (before.durationMinutes !== data.durationMinutes) changes.duracao = [before.durationMinutes, data.durationMinutes];
    if (before.active !== data.active) changes.ativo = [before.active, data.active];
    await audit(admin.id, "SERVICO_EDITADO", "servico", id, changes);
  } else {
    let slug = slugify(name) || "servico";
    if (await prisma.service.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const created = await prisma.service.create({ data: { ...data, slug, imageUrl: imageUrl ?? null } });
    await audit(admin.id, "SERVICO_CRIADO", "servico", created.id, { name });
  }
  revalidateSite();
  redirect("/admin/servicos");
}

export async function deleteService(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const used = await prisma.booking.count({ where: { serviceId: id } });
  if (used > 0) {
    // Serviço com histórico não é apagado: apenas desativado
    await prisma.service.update({ where: { id }, data: { active: false } });
    await audit(admin.id, "SERVICO_DESATIVADO", "servico", id);
  } else {
    const s = await prisma.service.delete({ where: { id } });
    await deleteImage(s.imageUrl);
    await audit(admin.id, "SERVICO_REMOVIDO", "servico", id, { name: s.name });
  }
  revalidateSite();
  redirect("/admin/servicos");
}

export async function saveCategory(form: FormData) {
  const admin = await requireAdmin();
  const name = str(form.get("name"), 60);
  if (!name) return;
  let slug = slugify(name);
  if (await prisma.category.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const c = await prisma.category.create({ data: { name, slug, order: (await prisma.category.count()) + 1 } });
  await audit(admin.id, "CATEGORIA_CRIADA", "categoria", c.id, { name });
  revalidateSite();
}

export async function deleteCategory(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  await prisma.category.delete({ where: { id } }).catch(() => null);
  await audit(admin.id, "CATEGORIA_REMOVIDA", "categoria", id);
  revalidateSite();
}

// ─── Portfólio ─────────────────────────────────────────────────────

export async function savePortfolioItem(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const id = str(form.get("id"));
  const title = str(form.get("title"), 100);
  if (!title) return { error: "Dê um título para a foto." };
  const serviceIds = form.getAll("serviceIds").map(String).filter(Boolean);
  const taken = String(form.get("takenAt") ?? "");

  let imageUrl: string | undefined;
  const file = fileFrom(form, "image");
  if (file) {
    try {
      imageUrl = await saveImage(file, "portfolio");
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  if (!id && !imageUrl) return { error: "Escolha a foto do trabalho." };

  const data = {
    title,
    description: str(form.get("description")),
    categoryId: str(form.get("categoryId")),
    featured: form.get("featured") === "on",
    order: int(form.get("order")) ?? 0,
    takenAt: isDateStr(taken) ? localToUtc(taken, "12:00") : null,
  };

  if (id) {
    const before = await prisma.portfolioItem.findUnique({ where: { id } });
    if (!before) return { error: "Trabalho não encontrado." };
    await prisma.portfolioItem.update({
      where: { id },
      data: { ...data, ...(imageUrl ? { imageUrl } : {}), services: { set: serviceIds.map((sid) => ({ id: sid })) } },
    });
    if (imageUrl) await deleteImage(before.imageUrl);
    await audit(admin.id, "TRABALHO_EDITADO", "portfolio", id);
  } else {
    const created = await prisma.portfolioItem.create({
      data: { ...data, imageUrl: imageUrl!, services: { connect: serviceIds.map((sid) => ({ id: sid })) } },
    });
    await audit(admin.id, "TRABALHO_CRIADO", "portfolio", created.id);
  }
  revalidateSite();
  redirect("/admin/portfolio");
}

export async function deletePortfolioItem(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const item = await prisma.portfolioItem.delete({ where: { id } }).catch(() => null);
  if (item) {
    await deleteImage(item.imageUrl);
    await audit(admin.id, "TRABALHO_REMOVIDO", "portfolio", id);
  }
  revalidateSite();
  redirect("/admin/portfolio");
}

export async function toggleFeatured(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const item = await prisma.portfolioItem.findUnique({ where: { id } });
  if (item) await prisma.portfolioItem.update({ where: { id }, data: { featured: !item.featured } });
  revalidateSite();
}

// ─── Avaliações ────────────────────────────────────────────────────

export async function moderateReview(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const action = String(form.get("action") ?? "");
  if (action === "aprovar") await prisma.review.update({ where: { id }, data: { status: "APROVADO" } });
  else if (action === "rejeitar") await prisma.review.update({ where: { id }, data: { status: "REJEITADO", featured: false } });
  else if (action === "destacar") {
    const r = await prisma.review.findUnique({ where: { id } });
    if (r) await prisma.review.update({ where: { id }, data: { featured: !r.featured, status: "APROVADO" } });
  } else if (action === "excluir") await prisma.review.delete({ where: { id } }).catch(() => null);
  await audit(admin.id, `AVALIACAO_${action.toUpperCase()}`, "avaliacao", id);
  revalidateTag(ADMIN_NAV_TAG, { expire: 0 });
  revalidateSite();
}

/** Depoimentos que a proprietária já recebeu (WhatsApp, Instagram etc.). */
export async function addReview(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const clientName = str(form.get("clientName"), 60);
  const comment = str(form.get("comment"), 600);
  const rating = int(form.get("rating")) ?? 5;
  if (!clientName || !comment) return { error: "Informe o nome e o comentário." };
  await prisma.review.create({
    data: {
      clientName,
      comment,
      rating: Math.min(5, Math.max(1, rating)),
      serviceName: str(form.get("serviceName"), 100),
      status: "APROVADO",
      featured: form.get("featured") === "on",
    },
  });
  await audit(admin.id, "AVALIACAO_ADICIONADA", "avaliacao", null, { clientName });
  revalidateTag(ADMIN_NAV_TAG, { expire: 0 });
  revalidateSite();
  return { ok: "Depoimento publicado." };
}
