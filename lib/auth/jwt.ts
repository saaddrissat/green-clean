import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";

/** Rôle workspace (caisse / admin tenant). */
export type WorkspaceRole = "ADMIN" | "CAISSIER";

/** Rôle plateforme (JWT), aligné sur Prisma `User.role`. */
export type PlatformRole = "USER" | "SUPERADMIN";

export type SessionClaims = {
  userId: string;
  role: WorkspaceRole;
  staffAccountId?: string | null;
  platformRole: PlatformRole;
};

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    sub: claims.userId,
    role: claims.role,
    staffAccountId: claims.staffAccountId ?? null,
    platformRole: claims.platformRole,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

function secretKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  const sub = payload.sub;
  if (typeof sub !== "string" || !sub) {
    throw new Error("Invalid token");
  }
  const role: WorkspaceRole = payload.role === "CAISSIER" ? "CAISSIER" : "ADMIN";
  const staffAccountId = typeof payload.staffAccountId === "string" ? payload.staffAccountId : null;
  const platformRole: PlatformRole =
    payload.platformRole === "SUPERADMIN" ? "SUPERADMIN" : "USER";
  return { userId: sub, role, staffAccountId, platformRole };
}
