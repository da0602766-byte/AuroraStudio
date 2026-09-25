"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, requireAdmin } from "@/lib/auth";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { ADMIN_SESSION_TAG } from "@/lib/cache";

// Hash fictício para que o tempo de resposta seja parecido quando o e-mail não existe
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5h5L6mWc4Wq0F0y5n1yC0mS2e7yZ1bK";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  const [ipAllowed, emailAllowed] = await Promise.all([
    sharedRateLimit(`login:${ip}`, 8, 15 * 60_000),
    sharedRateLimit(`login:${email}`, 8, 15 * 60_000),
  ]);
  if (!ipAllowed || !emailAllowed) {
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  }
  const user = email ? await prisma.adminUser.findUnique({ where: { email } }) : null;
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "E-mail ou senha incorretos." };

  // Um erro de configuração aqui derrubava a página com "Application error"
  // e nenhuma pista: a senha estava certa, mas a sessão não podia ser
  // assinada. Melhor dizer o que falta.
  try {
    await createSession(user);
  } catch (e) {
    console.error("Falha ao criar a sessão", e);
    return {
      error:
        "O acesso não está configurado corretamente. Confira a variável AUTH_SECRET na hospedagem: ela precisa ter no mínimo 32 caracteres.",
    };
  }

  await audit(user.id, "LOGIN", "sessao", null, { ip });
  redirect("/admin");
}

export async function logout() {
  await destroySession();
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
    data: { passwordHash: await bcrypt.hash(next, 12), sessionVersion: { increment: 1 } },
  });
  revalidateTag(ADMIN_SESSION_TAG, { expire: 0 });
  await createSession(updated); // outras sessões abertas deixam de valer
  await audit(admin.id, "SENHA_ALTERADA", "admin", admin.id);
  return { ok: "Senha alterada." };
}
