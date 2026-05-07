"use server";

import { ExpenseCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

export type ProviderRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  category: string | null;
  monthlyExpenseTotal: number;
};

export type ProviderExpenseRow = {
  id: string;
  title: string;
  amount: number;
  expenseDate: string;
  notes: string | null;
};

function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function listProvidersWithMonthlyTotalsAction(referenceDateIso?: string): Promise<ProviderRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const ref = referenceDateIso ? new Date(referenceDateIso) : new Date();
  const { start: monthStart, end: monthEnd } = monthBounds(Number.isNaN(ref.getTime()) ? new Date() : ref);

  const providers = await prisma.provider.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  if (providers.length === 0) return [];

  const ids = providers.map((p) => p.id);
  const agg = await prisma.expense.groupBy({
    by: ["providerId"],
    where: {
      userId: user.id,
      providerId: { in: ids },
      expenseDate: { gte: monthStart, lte: monthEnd },
    },
    _sum: { amount: true },
  });

  const sumMap = new Map<string, number>();
  for (const row of agg) {
    if (row.providerId) {
      sumMap.set(row.providerId, Number(row._sum.amount ?? 0));
    }
  }

  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone ?? "",
    email: p.email ?? null,
    category: p.category ?? null,
    monthlyExpenseTotal: sumMap.get(p.id) ?? 0,
  }));
}

export async function createProviderAction(input: { name: string; phone?: string; category?: string }) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  const name = input.name.trim();
  if (!name) throw new Error("Le nom du fournisseur est requis.");

  await prisma.provider.create({
    data: {
      userId: user.id,
      name,
      phone: input.phone?.trim() || null,
      category: input.category?.trim() || null,
    },
  });

  revalidatePath("/portefeuille");
}

export async function updateProviderAction(input: {
  id: string;
  name?: string;
  phone?: string | null;
  category?: string | null;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");

  const existing = await prisma.provider.findFirst({
    where: { id: input.id, userId: user.id },
  });
  if (!existing) throw new Error("Fournisseur introuvable.");

  await prisma.provider.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.category !== undefined ? { category: input.category?.trim() || null } : {}),
    },
  });

  revalidatePath("/portefeuille");
}

export async function deleteProviderAction(providerId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");

  const existing = await prisma.provider.findFirst({
    where: { id: providerId, userId: user.id },
  });
  if (!existing) throw new Error("Fournisseur introuvable.");

  await prisma.provider.delete({
    where: { id: providerId },
  });

  revalidatePath("/portefeuille");
}

export async function listProviderExpensesAction(providerId: string): Promise<{
  expenses: ProviderExpenseRow[];
  monthTotal: number;
  monthLabel: string;
}> {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");

  const provider = await prisma.provider.findFirst({
    where: { id: providerId, userId: user.id },
  });
  if (!provider) throw new Error("Fournisseur introuvable.");

  const { start: monthStart, end: monthEnd } = monthBounds();

  const [monthAgg, rows] = await Promise.all([
    prisma.expense.aggregate({
      where: {
        userId: user.id,
        providerId,
        expenseDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: { userId: user.id, providerId },
      orderBy: { expenseDate: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        amount: true,
        expenseDate: true,
        notes: true,
      },
    }),
  ]);

  const monthTotal = Number(monthAgg._sum.amount ?? 0);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(monthStart);

  return {
    expenses: rows.map((r) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      expenseDate: r.expenseDate.toISOString(),
      notes: r.notes ?? null,
    })),
    monthTotal,
    monthLabel,
  };
}

export async function createSupplierExpenseAction(input: {
  providerId: string;
  title: string;
  amount: number;
  expenseDateIso?: string;
  notes?: string | null;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");

  const provider = await prisma.provider.findFirst({
    where: { id: input.providerId, userId: user.id },
  });
  if (!provider) throw new Error("Fournisseur introuvable.");

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide.");

  const title = input.title.trim() || `Dépense ${provider.name}`;
  const expenseDate = input.expenseDateIso ? new Date(input.expenseDateIso) : new Date();
  if (Number.isNaN(expenseDate.getTime())) throw new Error("Date invalide.");

  await prisma.expense.create({
    data: {
      userId: user.id,
      providerId: input.providerId,
      title,
      amount,
      expenseDate,
      category: ExpenseCategory.FOURNITURE,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/portefeuille");
}
