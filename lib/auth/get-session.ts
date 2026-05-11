import type { User } from "@prisma/client";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import { SESSION_COOKIE } from "./constants";
import type { WorkspaceRole } from "./jwt";
import { verifySessionToken } from "./jwt";

export type SessionUserWithRole = User & {
  sessionRole: WorkspaceRole;
  staffAccountId: string | null;
};

export async function getSessionUser(): Promise<SessionUserWithRole | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const session = await verifySessionToken(token);
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return null;
    return {
      ...user,
      sessionRole: session.role,
      staffAccountId: session.staffAccountId ?? null,
    } satisfies SessionUserWithRole;
  } catch {
    return null;
  }
}
