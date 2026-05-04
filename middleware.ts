import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveAuthSecret } from "@/lib/auth-secret";

const SESSION_COOKIE = "gc-session";

const PUBLIC_PREFIXES = ["/connexion", "/inscription"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function getSecret() {
  const secret = resolveAuthSecret();
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (/\.(ico|png|jpg|jpeg|svg|webp|gif|woff2?)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const secret = getSecret();
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isPublicPath(pathname)) {
    if (token && secret) {
      try {
        await jwtVerify(token, secret);
        return NextResponse.redirect(new URL("/", request.url));
      } catch {
        // jeton invalide : afficher la page publique
      }
    }
    return NextResponse.next();
  }

  if (!secret) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }

  if (!token) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/connexion", request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
