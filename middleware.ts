import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveAuthSecret } from "@/lib/auth-secret";
import {
  SITE_GATE_COOKIE,
  SITE_GATE_PATH,
  isSiteGateExemptPath,
  verifySiteGateToken,
} from "@/lib/site-gate";

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

  const gateToken = request.cookies.get(SITE_GATE_COOKIE)?.value;
  const gateOk = await verifySiteGateToken(gateToken);
  if (!gateOk && !isSiteGateExemptPath(pathname)) {
    const url = new URL(SITE_GATE_PATH, request.url);
    if (pathname !== "/") {
      url.searchParams.set("redirect", pathname);
    } else {
      url.searchParams.set("redirect", "/connexion");
    }
    const res = NextResponse.redirect(url);
    if (gateToken) {
      res.cookies.delete(SITE_GATE_COOKIE);
    }
    return res;
  }

  if (gateOk && pathname === SITE_GATE_PATH) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const dest =
      redirectParam &&
      redirectParam.startsWith("/") &&
      !redirectParam.startsWith("//") &&
      !redirectParam.startsWith(SITE_GATE_PATH)
        ? redirectParam
        : "/connexion";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  /** Page code d'accès : pas de session requise (sinon boucle / page blanche). */
  if (isSiteGateExemptPath(pathname)) {
    return NextResponse.next();
  }

  const secret = getSecret();
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!secret) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }

  if (!token) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (pathname.startsWith("/admin") && payload.platformRole !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
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
