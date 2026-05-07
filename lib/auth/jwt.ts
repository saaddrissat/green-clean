import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";

function secretKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export type SessionClaims = {
  userId: string;
  role: "ADMIN" | "CAISSIER";
  staffAccountId?: string | null;
};

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    sub: claims.userId,
    role: claims.role,
    staffAccountId: claims.staffAccountId ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  const sub = payload.sub;
  if (typeof sub !== "string" || !sub) {
    throw new Error("Invalid token");
  }
  const role = payload.role === "CAISSIER" ? "CAISSIER" : "ADMIN";
  const staffAccountId = typeof payload.staffAccountId === "string" ? payload.staffAccountId : null;
  return { userId: sub, role, staffAccountId };
}
