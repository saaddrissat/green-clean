import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";

function secretKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secretKey());
  const sub = payload.sub;
  if (typeof sub !== "string" || !sub) {
    throw new Error("Invalid token");
  }
  return sub;
}
