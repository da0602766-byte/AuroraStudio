import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { authSecret, JWT_ALGORITHMS, SESSION_COOKIE, SESSION_DAYS } from "./session";
import { unstable_cache } from "next/cache";
import { ADMIN_SESSION_TAG } from "./cache";

export { authSecret, SESSION_COOKIE };

/** Impressão da senha: ao trocar a senha, sessões antigas deixam de valer. */
const getSessionAdmin = unstable_cache(
  (id: string) =>
    prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, sessionVersion: true },
    }),
  ["admin-da-sessao"],
  { tags: [ADMIN_SESSION_TAG], revalidate: 300 }
);

export async function createSession(user: { id: string; sessionVersion: number }) {
  const token = await new SignJWT({ sv: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(authSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: [...JWT_ALGORITHMS] });
    if (!payload.sub) return null;
    const user = await getSessionAdmin(payload.sub);
    if (!user) return null;
    if (payload.sv !== user.sessionVersion) return null;
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
