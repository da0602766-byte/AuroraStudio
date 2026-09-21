"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/format";
import { isDateStr, localToUtc } from "@/lib/time";

type FormResult = { error?: string; ok?: string } | undefined;

function readClient(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const email = String(form.get("email") ?? "").trim().slice(0, 120) || null;
  const birth = String(form.get("birthDate") ?? "");
  return { name, phone, email, birthDate: isDateStr(birth) ? localToUtc(birth, "12:00") : null };
}

export async function createClient(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const data = readClient(form);
  if (data.name.length < 2) return { error: "Informe o nome." };
  if (!data.phone) return { error: "Informe o WhatsApp com DDD." };
  const exists = await prisma.client.findUnique({ where: { phone: data.phone } });
  if (exists) return { error: "Já existe uma cliente com este WhatsApp." };
  const c = await prisma.client.create({ data: { ...data, phone: data.phone } });
  const note = String(form.get("note") ?? "").trim();
  if (note) await prisma.clientNote.create({ data: { clientId: c.id, text: note.slice(0, 2000) } });
  await audit(admin.id, "CLIENTE_CRIADA", "cliente", c.id);
  redirect(`/admin/clientes/${c.id}`);
}

export async function updateClient(_prev: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const data = readClient(form);
  if (data.name.length < 2) return { error: "Informe o nome." };
  if (!data.phone) return { error: "Informe o WhatsApp com DDD." };
  const other = await prisma.client.findUnique({ where: { phone: data.phone } });
  if (other && other.id !== id) return { error: "Este WhatsApp já pertence a outra cliente." };
  await prisma.client.update({ where: { id }, data: { ...data, phone: data.phone } });
  await audit(admin.id, "CLIENTE_EDITADA", "cliente", id);
  revalidatePath(`/admin/clientes/${id}`);
  return { ok: "Dados salvos." };
}

export async function addClientNote(form: FormData) {
  await requireAdmin();
  const clientId = String(form.get("clientId") ?? "");
  const text = String(form.get("text") ?? "").trim().slice(0, 2000);
  if (!text) return;
  await prisma.clientNote.create({ data: { clientId, text } });
  revalidatePath(`/admin/clientes/${clientId}`);
}

export async function deleteClientNote(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const note = await prisma.clientNote.delete({ where: { id } }).catch(() => null);
  if (note) revalidatePath(`/admin/clientes/${note.clientId}`);
}

/**
 * Exclusão a pedido da cliente (LGPD): remove dados pessoais e de saúde,
 * mantendo apenas o registro financeiro anônimo dos atendimentos.
 */
export async function anonymizeClient(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  await prisma.$transaction([
    prisma.clientNote.deleteMany({ where: { clientId: id } }),
    prisma.booking.updateMany({
      where: { clientId: id },
      data: { allergyDetails: null, isAllergic: false, isPregnant: false, clientNotes: null },
    }),
    prisma.client.update({
      where: { id },
      data: { name: "Cliente removida", phone: `removido-${id}`, email: null, birthDate: null },
    }),
  ]);
  await audit(admin.id, "CLIENTE_ANONIMIZADA", "cliente", id);
  redirect("/admin/clientes");
}
