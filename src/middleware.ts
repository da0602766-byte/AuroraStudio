import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Primeira barreira do painel: exige sessão válida em /admin.
 * Cada página e ação administrativa também verifica a sessão no servidor.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get("aurora_admin")?.value;
  const secret = process.env.AUTH_SECRET;
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      /* sessão inválida */
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*"] };
