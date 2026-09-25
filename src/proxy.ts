import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { authSecret, JWT_ALGORITHMS, SESSION_COOKIE } from "@/lib/session";

/**
 * Primeira barreira do painel: exige sessão válida em /admin.
 * Cada página e ação administrativa também verifica a sessão no servidor.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await jwtVerify(token, authSecret(), { algorithms: [...JWT_ALGORITHMS] });
      return NextResponse.next();
    } catch {
      /* sessão inválida ou segredo mal configurado */
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*"] };
