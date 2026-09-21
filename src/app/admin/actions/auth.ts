"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, requireAdmin } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

// Hash fictício para que o tempo de resposta seja parecido quando o e-mail não existe
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5h5L6mWc4Wq0F0y5n1yC0mS2e7yZ1bK";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = clientIp();
  if (!rateLimit(`login:${ip}`, 8, 15 * 60_000) || !rateLimit(`login:${email}`, 8, 15 * 60_000)) {
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  }
  const user = email ? await prisma.adminUser.findUnique({ where: { email } }) : null;
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "E-mail ou senha incorretos." };

  await createSession(user);
  await audit(user.id, "LOGIN", "sessao", null, { ip });
  redirect("/admin");
}

export async function logout() {
  destroySession();
  redirect("/admin/login");
}

export async function changePassword(_prev: { error?: string; ok?: string } | undefined, form: FormData) {
  const admin = await requireAdmin();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next.length < 10) return { error: "A nova senha precisa ter pelo menos 10 caracteres." };
  if (next !== confirm) return { error: "A confirmação não é igual à nova senha." };
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "A senha atual está incorreta." };
  const updated = await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
  await createSession(updated); // outras sessões abertas deixam de valer
  await audit(admin.id, "SENHA_ALTERADA", "admin", admin.id);
  return { ok: "Senha alterada." };
}
