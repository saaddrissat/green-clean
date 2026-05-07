import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session";
import { DEFAULT_CAISSIER_PAGE_ACCESS, FULL_PAGE_ACCESS, type PageAccess } from "@/lib/navigation-page-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  
  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  // --- NOUVELLE VÉRIFICATION : EMAIL NON VÉRIFIÉ ---
  // On récupère l'état actuel en base de données
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isEmailVerified: true }
  });

  if (dbUser && !dbUser.isEmailVerified) {
    return NextResponse.json({ 
      error: "EMAIL_NOT_VERIFIED",
      message: "Veuillez vérifier votre email pour accéder à l'application." 
    }, { status: 403 }); // 403 Forbidden
  }
  // ------------------------------------------------

  let pageAccess: PageAccess | null = user.sessionRole === "ADMIN" ? FULL_PAGE_ACCESS : null;
  let displayName = user.name;
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
    if (staff?.fullName?.trim()) {
      displayName = staff.fullName.trim();
    }
    
    if (user.sessionRole === "CAISSIER") {
      if (staff?.pageAccess && typeof staff.pageAccess === "object") {
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

  return NextResponse.json({
    id: user.id,
    name: displayName,
    email: user.email,
    role: user.sessionRole,
    staffAccountId: user.staffAccountId,
    isEmailVerified: dbUser?.isEmailVerified || false, // On renvoie l'info au front-end
    pageAccess,
  });
}