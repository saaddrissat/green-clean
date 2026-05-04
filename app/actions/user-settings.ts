"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

export async function getOperationalPreferencesAction() {
  const user = await getSessionUser();
  if (!user) {
    return { storeClosingTime: "", expenseAlertRatio: 0.4 };
  }
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { storeClosingTime: true, expenseAlertRatio: true },
  });
  return {
    storeClosingTime: row?.storeClosingTime ?? "",
    expenseAlertRatio: row?.expenseAlertRatio ?? 0.4,
  };
}

export async function updateOperationalPreferencesAction(input: {
  storeClosingTime?: string | null;
  expenseAlertRatio?: number | null;
}) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }

  const ratio =
    input.expenseAlertRatio != null && Number.isFinite(input.expenseAlertRatio)
      ? Math.min(0.95, Math.max(0.05, input.expenseAlertRatio))
      : undefined;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      storeClosingTime: input.storeClosingTime?.trim() || null,
      expenseAlertRatio: ratio,
    },
  });

  revalidatePath("/parametres");
  revalidatePath("/notifications");
}
