import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session";
import { resolveSessionDisplay } from "@/lib/auth/resolve-session-display";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerified: true },
  });

  if (dbUser && !dbUser.emailVerified) {
    return NextResponse.json(
      {
        error: "EMAIL_NOT_VERIFIED",
        message: "Veuillez vérifier votre email pour accéder à l'application.",
      },
      { status: 403 },
    );
  }

  const { displayName, pageAccess } = await resolveSessionDisplay(user);

  return NextResponse.json({
    id: user.id,
    name: displayName,
    email: user.email,
    role: user.sessionRole,
    staffAccountId: user.staffAccountId,
    isEmailVerified: dbUser?.emailVerified || false,
    pageAccess,
    plan: user.plan,
  });
}