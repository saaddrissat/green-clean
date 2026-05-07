"use server";

import bcrypt from "bcryptjs";
import { StaffRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/get-session";
import type { PageAccess } from "@/lib/navigation-page-access";
import { DEFAULT_CAISSIER_PAGE_ACCESS, FULL_PAGE_ACCESS } from "@/lib/navigation-page-access";
import { prisma } from "@/lib/prisma";

export type StaffAccountRow = {
  id: string;
  fullName: string;
  role: "ADMIN" | "CAISSIER";
  createdAt: string;
  lastLoginAt: string | null;
  pageAccess: PageAccess;
};

function toPageAccess(role: "ADMIN" | "CAISSIER", raw: unknown): PageAccess {
  if (role === "ADMIN") return FULL_PAGE_ACCESS;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      dashboard: obj.dashboard === true,
      caisse: obj.caisse === true,
      suivi: obj.suivi === true,
      clients: obj.clients === true,
      calendrier: obj.calendrier === true,
      portefeuille: obj.portefeuille === true,
      rapports: obj.rapports === true,
      notifications: obj.notifications === true,
      parametres: obj.parametres === true,
    };
  }
  return DEFAULT_CAISSIER_PAGE_ACCESS;
}

export async function listStaffAccountsAction(): Promise<StaffAccountRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await prisma.staffAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    role: a.role === StaffRole.CAISSIER ? "CAISSIER" : "ADMIN",
    createdAt: a.createdAt.toISOString(),
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    pageAccess: toPageAccess(a.role === StaffRole.CAISSIER ? "CAISSIER" : "ADMIN", a.pageAccess),
  }));
}

export async function createStaffAccountAction(input: {
  fullName: string;
  role: "ADMIN" | "CAISSIER";
  password: string;
  pageAccess?: PageAccess;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  if (user.sessionRole !== "ADMIN") throw new Error("Accès refusé.");

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Le nom est requis.");
  if (!input.password || input.password.length < 4) {
    throw new Error("Le mot de passe doit contenir au moins 4 caractères.");
  }

  await prisma.staffAccount.create({
    data: {
      userId: user.id,
      fullName,
      role: input.role === "CAISSIER" ? StaffRole.CAISSIER : StaffRole.ADMIN,
      passwordHash: await bcrypt.hash(input.password, 12),
      pageAccess: input.role === "CAISSIER" ? (input.pageAccess ?? DEFAULT_CAISSIER_PAGE_ACCESS) : FULL_PAGE_ACCESS,
    },
  });

  revalidatePath("/parametres");
}

export async function updateStaffAccountAccessAction(input: { id: string; pageAccess: PageAccess }) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  if (user.sessionRole !== "ADMIN") throw new Error("Accès refusé.");

  const row = await prisma.staffAccount.findFirst({
    where: { id: input.id, userId: user.id },
    select: { id: true, role: true },
  });
  if (!row) throw new Error("Compte introuvable.");
  if (row.role !== StaffRole.CAISSIER) throw new Error("Les admins ont déjà tous les accès.");

  await prisma.staffAccount.update({
    where: { id: input.id },
    data: { pageAccess: input.pageAccess },
  });

  revalidatePath("/parametres");
}

export async function deleteStaffAccountAction(input: { id: string; adminPassword: string }) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  if (user.sessionRole !== "ADMIN") throw new Error("Accès refusé.");

  const adminPassword = input.adminPassword.trim();
  if (!adminPassword) throw new Error("Le mot de passe admin est requis.");

  let passwordValid = false;
  if (user.staffAccountId) {
    const currentAdminStaff = await prisma.staffAccount.findFirst({
      where: { id: user.staffAccountId, userId: user.id, role: StaffRole.ADMIN },
      select: { passwordHash: true },
    });
    if (!currentAdminStaff) throw new Error("Compte admin introuvable.");
    passwordValid = await bcrypt.compare(adminPassword, currentAdminStaff.passwordHash);
  } else {
    passwordValid = await bcrypt.compare(adminPassword, user.passwordHash);
  }
  if (!passwordValid) throw new Error("Mot de passe admin incorrect.");

  const target = await prisma.staffAccount.findFirst({
    where: { id: input.id, userId: user.id },
    select: { id: true, role: true, fullName: true },
  });
  if (!target) throw new Error("Compte introuvable.");

  if (target.role === StaffRole.ADMIN) {
    const adminCount = await prisma.staffAccount.count({
      where: { userId: user.id, role: StaffRole.ADMIN },
    });
    if (adminCount <= 1) {
      throw new Error("Impossible de supprimer le dernier compte admin.");
    }
  }

  await prisma.staffAccount.delete({ where: { id: target.id } });
  revalidatePath("/parametres");
}
