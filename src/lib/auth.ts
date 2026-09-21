import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { prisma } from "./db";

export const SESSION_COOKIE = "aurora_admin";
const SESSION_DAYS = 7;

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ausente ou curto (mínimo 32 caracteres).");
  return new TextEncoder().encode(s);
}

/** Impressão da senha: ao trocar a senha, sessões antigas deixam de valer. */
function passwordVersion(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export async function createSession(user: { id: string; passwordHash: string }) {
  const token = await new SignJWT({ pv: passwordVersion(user.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(authSecret());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

export async function getAdmin() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.sub) return null;
    const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!user || payload.pv !== passwordVersion(user.passwordHash)) return null;
    return { id: user.id, name: user.name, email: user.email };
  } catch {
    return null;
  }
}

/** Usar em toda página e ação administrativa (a middleware é apenas a primeira barreira). */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
