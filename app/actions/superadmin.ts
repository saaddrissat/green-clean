"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

const planSchema = z.enum(["DEMO", "STARTER", "PRO", "BUSINESS"]);

async function requireSuperAdmin() {
  const me = await getSessionUser();
  if (!me || me.role !== "SUPERADMIN") {
    throw new Error("Accès réservé aux super-administrateurs.");
  }
  return me;
}

export async function updateTenantPlanAction(userId: string, plan: string) {
  await requireSuperAdmin();
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error("Plan invalide.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { plan: parsed.data },
  });
  revalidatePath("/admin/dashboard");
}
