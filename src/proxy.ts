import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // /login にログイン済みで来たら /home へ
  if (pathname === "/login") {
    if (!token) return NextResponse.next();

    try {
      await verifySessionToken(token);
      return NextResponse.redirect(new URL("/home", request.url));
    } catch {
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
  }

  // / と /home* を保護
  if (pathname === "/" || pathname.startsWith("/home") || pathname.startsWith("/upload")) {
    if (!token) return NextResponse.redirect(new URL("/login", request.url));

    try {
      await verifySessionToken(token);
      return NextResponse.next();
    } catch {
      const res = NextResponse.redirect(new URL("/login", request.url));
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home/:path*", "/upload", "/login"],
};
