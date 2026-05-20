import { SignJWT, jwtVerify } from "jose";

import { resolveAuthSecret } from "@/lib/auth-secret";

export const SITE_GATE_COOKIE = "gc-site-gate";
export const SITE_GATE_PATH = "/acces";
export const SITE_GATE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

/** Code d'accès site (surchargeable via SITE_GATE_PASSWORD dans .env). */
export function getSiteGatePassword(): string {
  const fromEnv = process.env.SITE_GATE_PASSWORD?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "157294386";
}

export function isSiteGateExemptPath(pathname: string): boolean {
  return pathname === SITE_GATE_PATH || pathname.startsWith(`${SITE_GATE_PATH}/`);
}

/** Clé de signature du cookie portail (fonctionne même si AUTH_SECRET manque en prod). */
function secretKey() {
  const auth = resolveAuthSecret();
  if (auth && auth.length >= 32) {
    return new TextEncoder().encode(auth);
  }
  return new TextEncoder().encode(`gc-site-gate:${getSiteGatePassword()}`);
}

export async function signSiteGateToken(): Promise<string | null> {
  const key = secretKey();
  if (!key) return null;
  return new SignJWT({ gate: "ok" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifySiteGateToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const key = secretKey();
  if (!key) return false;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.gate === "ok";
  } catch {
    return false;
  }
}
