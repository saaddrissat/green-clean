"use server";

import { OrderStatus, PaymentMethod } from "@prisma/client";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

export type DashboardDayPoint = {
  day: string;
  revenue: number;
  orders: number;
  activeClients: number;
};

/** Commandes sur 90 jours pour agrégations (période Jour / Semaine / Mois côté client). */
export type DashboardChartOrder = {
  orderNumber: string;
  createdAt: string;
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  clientId: string | null;
  clientLabel: string;
  /** Unités par nom de catégorie (lignes × quantité). */
  categoryUnits: Record<string, number>;
};

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  client: string;
  receptionDate: string;
  dueDate: string;
  total: string;
  status: OrderStatus;
};

export type DashboardTopClient = {
  name: string;
  contact: string;
  orders: number;
  totalPaid: number;
};

export type DashboardHomeData = {
  dailySeries: DashboardDayPoint[];
  chartOrders: DashboardChartOrder[];
  recentOrders: DashboardRecentOrder[];
  topClients: DashboardTopClient[];
};

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDhDisplay(amount: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} DHs`;
}

export async function getDashboardHomeData(): Promise<DashboardHomeData> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/connexion");
  }
  const userId = sessionUser.id;

  const todayStart = startOfLocalDay(new Date());
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - 89);

  const dayBuckets: {
    key: string;
    label: string;
    revenue: number;
    orders: number;
    clientIds: Set<string>;
  }[] = [];

  for (let i = 0; i < 90; i += 1) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - (89 - i));
    const key = localDayKey(d);
    const label = i === 89 ? "Aujourd'hui" : `J-${89 - i}`;
    dayBuckets.push({
      key,
      label,
      revenue: 0,
      orders: 0,
      clientIds: new Set<string>(),
    });
  }

  const keyToIndex = new Map(dayBuckets.map((b, idx) => [b.key, idx]));

  const orders = await prisma.order.findMany({
    where: {
      userId,
      createdAt: { gte: rangeStart },
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { fullName: true } },
      items: {
        include: {
          product: {
            include: {
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  for (const order of orders) {
    const key = localDayKey(order.createdAt);
    const idx = keyToIndex.get(key);
    if (idx === undefined) continue;

    if (order.status !== OrderStatus.ANNULE) {
      dayBuckets[idx].revenue += Number(order.total);
      dayBuckets[idx].orders += 1;
      if (order.clientId) {
        dayBuckets[idx].clientIds.add(order.clientId);
      }
    }
  }

  const dailySeries: DashboardDayPoint[] = dayBuckets.map((b) => ({
    day: b.label,
    revenue: Math.round(b.revenue),
    orders: b.orders,
    activeClients: b.clientIds.size,
  }));

  const chartOrders: DashboardChartOrder[] = orders.map((order) => {
    const categoryUnits: Record<string, number> = {};
    for (const line of order.items) {
      const catName = line.product.category.name;
      const add = line.quantity;
      categoryUnits[catName] = (categoryUnits[catName] ?? 0) + add;
    }
    return {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      status: order.status,
      clientId: order.clientId,
      clientLabel: order.client?.fullName?.trim() || "—",
      categoryUnits,
    };
  });

  const recentSource = orders.slice(0, 12);
  const recentOrders: DashboardRecentOrder[] = recentSource.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    client: order.client?.fullName?.trim() || "—",
    receptionDate: order.createdAt.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    dueDate: order.dueDate.toLocaleDateString("fr-FR"),
    total: formatDhDisplay(Number(order.total)),
    status: order.status,
  }));

  const spendRows = await prisma.order.findMany({
    where: {
      userId,
      status: { not: OrderStatus.ANNULE },
      clientId: { not: null },
    },
    select: {
      clientId: true,
      total: true,
    },
  });

  const agg = new Map<string, { sum: number; count: number }>();
  for (const row of spendRows) {
    const cid = row.clientId as string;
    const cur = agg.get(cid) ?? { sum: 0, count: 0 };
    cur.sum += Number(row.total);
    cur.count += 1;
    agg.set(cid, cur);
  }

  const ranked = [...agg.entries()]
    .map(([clientId, v]) => ({ clientId, ...v }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 7);

  const clientIds = ranked.map((r) => r.clientId);
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds }, userId },
          select: { id: true, fullName: true, phone: true },
        })
      : [];

  const clientById = new Map(clients.map((c) => [c.id, c]));

  const topClients: DashboardTopClient[] = ranked.map((r) => {
    const c = clientById.get(r.clientId);
    return {
      name: c?.fullName ?? "Client",
      contact: c?.phone?.trim() || "—",
      orders: r.count,
      totalPaid: Math.round(r.sum * 100) / 100,
    };
  });

  return {
    dailySeries,
    chartOrders,
    recentOrders,
    topClients,
  };
}
