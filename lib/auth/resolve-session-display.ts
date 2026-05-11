import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CAISSIER_PAGE_ACCESS,
  FULL_PAGE_ACCESS,
  type PageAccess,
} from "@/lib/navigation-page-access";

import type { SessionUserWithRole } from "@/lib/auth/get-session";

/**
 * Nom affiché + droits navigation (même logique que GET /api/auth/me, hors vérif email).
 */
export async function resolveSessionDisplay(user: SessionUserWithRole): Promise<{
  displayName: string;
  pageAccess: PageAccess | null;
}> {
  let pageAccess: PageAccess | null = user.sessionRole === "ADMIN" ? FULL_PAGE_ACCESS : null;
  let displayName = (user.name ?? "").trim();
  let staff = null;

  if (user.staffAccountId) {
    staff = await prisma.staffAccount.findFirst({
      where: { id: user.staffAccountId, userId: user.id },
      select: { fullName: true, pageAccess: true },
    });
  } else if (user.sessionRole === "CAISSIER") {
    staff = await prisma.staffAccount.findFirst({
      where: { userId: user.id, role: "CAISSIER" },
      orderBy: [{ lastLoginAt: "desc" }, { updatedAt: "desc" }],
      select: { fullName: true, pageAccess: true },
    });
  }

  if (staff) {
    if (staff.fullName?.trim()) {
      displayName = staff.fullName.trim();
    }

    if (user.sessionRole === "CAISSIER") {
      if (staff.pageAccess && typeof staff.pageAccess === "object") {
        const raw = staff.pageAccess as Record<string, unknown>;
        pageAccess = {
          dashboard: !!raw.dashboard,
          caisse: !!raw.caisse,
          suivi: !!raw.suivi,
          clients: !!raw.clients,
          calendrier: !!raw.calendrier,
          portefeuille: !!raw.portefeuille,
          rapports: !!raw.rapports,
          notifications: !!raw.notifications,
          parametres: !!raw.parametres,
        };
      } else {
        pageAccess = DEFAULT_CAISSIER_PAGE_ACCESS;
      }
    }
  }

  if (!displayName) {
    displayName = user.email.split("@")[0] || "Utilisateur";
  }

  return { displayName, pageAccess };
}
