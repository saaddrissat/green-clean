import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import { SESSION_COOKIE } from "./constants";
import { verifySessionToken } from "./jwt";

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const userId = await verifySessionToken(token);
    return prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}
