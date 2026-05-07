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

function parseDay(iso: string | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

/** Agrège revenus / dépenses entre deux bornes locales (début et fin de journée possibles). */
export async function getWalletPeriodTotalsAction(periodStartIso: string, periodEndIso: string) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }
  const start = parseDay(periodStartIso);
  const end = parseDay(periodEndIso);
  const { start: rangeStart } = toLocalDayBounds(start);
  const { end: rangeEnd } = toLocalDayBounds(end);

  const revenueAgg = await prisma.order.aggregate({
    where: {
      userId: user.id,
      status: { not: OrderStatus.ANNULE },
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    _sum: { total: true },
  });
  const expenseAgg = await prisma.expense.aggregate({
    where: {
      userId: user.id,
      expenseDate: { gte: rangeStart, lte: rangeEnd },
    },
    _sum: { amount: true },
  });

  const revenue = Number(revenueAgg._sum.total ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  return {
    revenueTotal: revenue,
    expenseTotal: expenses,
    netToClose: revenue - expenses,
  };
}

export type WalletDailyCandle = {
  date: string;
  revenue: number;
  expense: number;
  profit: number;
};

export async function getWalletDailyCandlesAction(periodStartIso: string, periodEndIso: string): Promise<WalletDailyCandle[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const start = parseDay(periodStartIso);
  const end = parseDay(periodEndIso);
  const { start: rangeStart } = toLocalDayBounds(start);
  const { end: rangeEnd } = toLocalDayBounds(end);

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        userId: user.id,
        status: { not: OrderStatus.ANNULE },
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: { createdAt: true, total: true },
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        expenseDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: { expenseDate: true, amount: true },
    }),
  ]);

  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const revenueByDay = new Map<string, number>();
  for (const row of orders) {
    const key = dayKey(row.createdAt);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(row.total));
  }

  const expenseByDay = new Map<string, number>();
  for (const row of expenses) {
    const key = dayKey(row.expenseDate);
    expenseByDay.set(key, (expenseByDay.get(key) ?? 0) + Number(row.amount));
  }

  const out: WalletDailyCandle[] = [];
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    const revenue = revenueByDay.get(key) ?? 0;
    const expense = expenseByDay.get(key) ?? 0;
    out.push({
      date: new Date(d).toISOString(),
      revenue,
      expense,
      profit: revenue - expense,
    });
  }

  return out;
}

export type WalletTransactionRow = {
  id: string;
  date: string;
  client: string;
  amount: number;
  method: "TPE" | "Cash" | "Crédit";
};

export async function listWalletTransactionsAction(limit = 300): Promise<WalletTransactionRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await prisma.order.findMany({
    where: {
      userId: user.id,
      status: OrderStatus.LIVRE,
      clientId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      orderNumber: true,
      createdAt: true,
      total: true,
      paymentMethod: true,
      client: { select: { fullName: true } },
    },
  });

  return rows
    .filter((row) => Boolean(row.client?.fullName?.trim()))
    .map((row) => ({
      id: row.orderNumber,
      date: row.createdAt.toISOString(),
      client: row.client?.fullName?.trim() ?? "—",
      amount: Number(row.total),
      method:
        row.paymentMethod === "CARD"
          ? "TPE"
          : row.paymentMethod === "MOBILE_MONEY" || row.paymentMethod === "CREDIT"
            ? "Crédit"
            : "Cash",
    }));
}

export type CashClosureRow = {
  id: string;
  closureDate: string;
  closedAt: string;
  revenueTotal: number;
  expenseTotal: number;
  countedAmount: number | null;
  expectedNet: number;
  difference: number;
  comment: string | null;
};

export async function listCashClosuresAction(limit = 80): Promise<CashClosureRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await prisma.cashClosure.findMany({
    where: { userId: user.id },
    orderBy: { closedAt: "desc" },
    take: limit,
  });

  return rows.map((r) => {
    const rev = Number(r.revenueTotal);
    const exp = Number(r.expenseTotal);
    const computedNet = rev - exp;
    const expectedNet = r.expectedNet != null ? Number(r.expectedNet) : computedNet;
    const counted = r.countedAmount != null ? Number(r.countedAmount) : null;
    const difference =
      r.difference != null
        ? Number(r.difference)
        : counted != null
          ? counted - expectedNet
          : 0;
    return {
      id: r.id,
      closureDate: r.closureDate.toISOString(),
      closedAt: r.closedAt.toISOString(),
      revenueTotal: rev,
      expenseTotal: exp,
      countedAmount: counted,
      expectedNet,
      difference,
      comment: r.comment ?? null,
    };
  });
}

export async function recordCashClosureAction(input: {
  countedAmount: number;
  comment?: string | null;
  /** Période affichée dans le portefeuille (bornes inclusives, jour local). */
  periodStartIso: string;
  periodEndIso: string;
}) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }
  const counted = Number(input.countedAmount);
  if (!Number.isFinite(counted) || counted < 0) {
    throw new Error("Montant compté invalide.");
  }

  const startDay = parseDay(input.periodStartIso);
  const endDay = parseDay(input.periodEndIso);
  const { start: rangeStart } = toLocalDayBounds(startDay);
  const { end: rangeEnd } = toLocalDayBounds(endDay);

  const revenueAgg = await prisma.order.aggregate({
    where: {
      userId: user.id,
      status: { not: OrderStatus.ANNULE },
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    _sum: { total: true },
  });
  const expenseAgg = await prisma.expense.aggregate({
    where: {
      userId: user.id,
      expenseDate: { gte: rangeStart, lte: rangeEnd },
    },
    _sum: { amount: true },
  });

  const revenueTotal = Number(revenueAgg._sum.total ?? 0);
  const expenseTotal = Number(expenseAgg._sum.amount ?? 0);
  const expectedNet = revenueTotal - expenseTotal;
  const difference = counted - expectedNet;

  const { start: closureStamp } = toLocalDayBounds(endDay);

  await prisma.cashClosure.create({
    data: {
      userId: user.id,
      closureDate: closureStamp,
      revenueTotal,
      expenseTotal,
      countedAmount: counted,
      expectedNet,
      difference,
      comment: input.comment?.trim() || null,
    },
  });

  revalidatePath("/portefeuille");
  revalidatePath("/notifications");

  return {
    ok: true as const,
    expectedNet,
    difference,
    countedAmount: counted,
    surplus: counted >= expectedNet,
    shortfall: expectedNet > counted ? expectedNet - counted : 0,
  };
}

export async function updateCashClosureAction(input: {
  id: string;
  countedAmount?: number;
  comment?: string | null;
}) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }

  const existing = await prisma.cashClosure.findFirst({
    where: { id: input.id, userId: user.id },
  });
  if (!existing) {
    throw new Error("Clôture introuvable.");
  }

  const expectedNet = Number(existing.expectedNet);
  let counted =
    input.countedAmount != null && Number.isFinite(input.countedAmount)
      ? Number(input.countedAmount)
      : Number(existing.countedAmount ?? 0);
  if (!Number.isFinite(counted) || counted < 0) {
    throw new Error("Montant invalide.");
  }

  const difference = counted - expectedNet;

  await prisma.cashClosure.update({
    where: { id: input.id },
    data: {
      countedAmount: counted,
      difference,
      comment: input.comment !== undefined ? input.comment?.trim() || null : existing.comment,
    },
  });

  revalidatePath("/portefeuille");
}

export type CashSettings = {
  cashReserveAmount: number;
  cashClosureTimePref: string;
  cashWorkDays: number[];
};

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

function parseWorkDays(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [...DEFAULT_WORK_DAYS];
  try {
    const parsed = raw.split(",").map((s) => parseInt(s.trim(), 10));
    const valid = parsed.filter((n) => n >= 1 && n <= 7);
    return valid.length > 0 ? valid : [...DEFAULT_WORK_DAYS];
  } catch {
    return [...DEFAULT_WORK_DAYS];
  }
}

export async function getCashSettingsAction(): Promise<CashSettings> {
  const user = await getSessionUser();
  if (!user) {
    return {
      cashReserveAmount: 0,
      cashClosureTimePref: "",
      cashWorkDays: [...DEFAULT_WORK_DAYS],
    };
  }
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { cashReserveAmount: true, cashClosureTimePref: true, cashWorkDays: true },
  });
  return {
    cashReserveAmount: Number(row?.cashReserveAmount ?? 0),
    cashClosureTimePref: row?.cashClosureTimePref ?? "",
    cashWorkDays: parseWorkDays(row?.cashWorkDays ?? null),
  };
}

export async function updateCashSettingsAction(input: {
  cashReserveAmount?: number;
  cashClosureTimePref?: string | null;
  cashWorkDays?: number[];
}) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }

  const reserve =
    input.cashReserveAmount != null && Number.isFinite(input.cashReserveAmount)
      ? Math.max(0, input.cashReserveAmount)
      : undefined;

  const workDaysStr =
    input.cashWorkDays != null
      ? [...new Set(input.cashWorkDays.filter((d) => d >= 1 && d <= 7))]
          .sort((a, b) => a - b)
          .join(",")
      : undefined;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(reserve !== undefined ? { cashReserveAmount: reserve } : {}),
      ...(input.cashClosureTimePref !== undefined
        ? { cashClosureTimePref: input.cashClosureTimePref?.trim() || null }
        : {}),
      ...(workDaysStr !== undefined ? { cashWorkDays: workDaysStr || null } : {}),
    },
  });

  revalidatePath("/portefeuille");
  revalidatePath("/parametres");
}
