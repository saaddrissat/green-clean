"use server";

import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

function toLocalDayBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

export async function recordCashClosureAction() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }
  const { start, end } = toLocalDayBounds(new Date());

  const revenueAgg = await prisma.order.aggregate({
    where: {
      userId: user.id,
      status: { not: OrderStatus.ANNULE },
      createdAt: { gte: start, lte: end },
    },
    _sum: { total: true },
  });
  const expenseAgg = await prisma.expense.aggregate({
    where: {
      userId: user.id,
      expenseDate: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });

  const revenueTotal = Number(revenueAgg._sum.total ?? 0);
  const expenseTotal = Number(expenseAgg._sum.amount ?? 0);

  await prisma.cashClosure.create({
    data: {
      userId: user.id,
      closureDate: start,
      revenueTotal,
      expenseTotal,
    },
  });

  revalidatePath("/portefeuille");
  revalidatePath("/notifications");
}
