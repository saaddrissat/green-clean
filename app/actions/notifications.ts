"use server";

import {
  NotificationCategory,
  NotificationPriority,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/get-session";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

function toLocalDayBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function formatYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseClosingTime(value: string | null | undefined): { h: number; m: number } | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value.trim())) return null;
  const [hs, ms] = value.trim().split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

async function ensureOperationalNotifications(userId: string) {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = toLocalDayBounds(now);
  const ymd = formatYmd(now);

  const prefs = await prisma.user.findUnique({
    where: { id: userId },
    select: { storeClosingTime: true, expenseAlertRatio: true },
  });
  const ratioThreshold = prefs?.expenseAlertRatio ?? 0.4;

  // --- Livraisons du jour (matin : entre 6h et 12h) ---
  const hour = now.getHours();
  if (hour >= 6 && hour < 12) {
    const dueToday = await prisma.order.count({
      where: {
        userId,
        dueDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: [OrderStatus.LIVRE, OrderStatus.ANNULE] },
      },
    });
    if (dueToday > 0) {
      await createNotification({
        userId,
        type: NotificationCategory.OPERATIONS,
        priority: NotificationPriority.REMINDER,
        title: "Livraisons prévues aujourd'hui",
        message: `${dueToday} commande(s) ont une échéance aujourd'hui. Vérifiez le suivi et le calendrier.`,
        link: "/suivi",
        dedupeKey: `delivery-due-${ymd}`,
      });
    }
  }

  // --- Caisse non clôturée après l'heure de fermeture ---
  const envClosing = process.env.GC_STORE_CLOSING_HOUR;
  const parsedEnv = parseClosingTime(envClosing ?? null);
  const parsedUser = parseClosingTime(prefs?.storeClosingTime ?? null);
  const closing = parsedUser ?? parsedEnv ?? { h: 20, m: 0 };
  const pastClosing =
    now.getHours() > closing.h || (now.getHours() === closing.h && now.getMinutes() >= closing.m);

  if (pastClosing) {
    const closedToday = await prisma.cashClosure.findFirst({
      where: {
        userId,
        closureDate: { gte: todayStart, lte: todayEnd },
      },
      select: { id: true },
    });
    if (!closedToday) {
      await createNotification({
        userId,
        type: NotificationCategory.OPERATIONS,
        priority: NotificationPriority.REMINDER,
        title: "Clôture de caisse",
        message:
          "La caisse n'a pas été clôturée pour aujourd'hui. Validez la clôture dans Portefeuille.",
        link: "/portefeuille",
        dedupeKey: `cash-not-closed-${ymd}`,
      });
    }
  }

  // --- Rappel calendrier 15 minutes avant ---
  const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);
  const upcoming = await prisma.calendarEvent.findMany({
    where: {
      userId,
      start: { gt: now, lte: windowEnd },
      reminder15SentAt: null,
    },
    select: { id: true, title: true, start: true },
  });
  for (const ev of upcoming) {
    await createNotification({
      userId,
      type: NotificationCategory.CALENDAR,
      priority: NotificationPriority.REMINDER,
      title: "Rappel événement",
      message: `"${ev.title}" commence dans moins de 15 minutes.`,
      link: "/calendrier",
      dedupeKey: `cal-15-${ev.id}-${Math.floor(ev.start.getTime() / 60000)}`,
      metadata: { eventId: ev.id },
    });
    await prisma.calendarEvent.update({
      where: { id: ev.id },
      data: { reminder15SentAt: now },
    });
  }

  // --- Ratio dépenses / revenus (jour en cours) ---
  const revenueAgg = await prisma.order.aggregate({
    where: {
      userId,
      status: { not: OrderStatus.ANNULE },
      createdAt: { gte: todayStart, lte: todayEnd },
    },
    _sum: { total: true },
  });
  const expenseAgg = await prisma.expense.aggregate({
    where: {
      userId,
      expenseDate: { gte: todayStart, lte: todayEnd },
    },
    _sum: { amount: true },
  });
  const revenue = Number(revenueAgg._sum.total ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  if (revenue > 0 && expenses / revenue > ratioThreshold) {
    const pct = Math.round((expenses / revenue) * 100);
    await createNotification({
      userId,
      type: NotificationCategory.SMART_ALERT,
      priority: NotificationPriority.REMINDER,
      title: "Attention : ratio dépenses / revenus élevé",
      message: `Aujourd'hui : dépenses ${expenses.toFixed(0)} DH sur revenus ${revenue.toFixed(
        0,
      )} DH (${pct}% du CA).`,
      link: "/portefeuille",
      dedupeKey: `smart-ratio-${ymd}`,
      metadata: { revenue, expenses, ratioThreshold },
    });
  }
}

export type NotificationRow = {
  id: string;
  type: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

export async function listNotificationsAction(options?: {
  category?: NotificationCategory;
  limit?: number;
}) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }
  await ensureOperationalNotifications(user.id);

  const where: Prisma.NotificationWhereInput = { userId: user.id };
  if (options?.category) {
    where.type = options.category;
  }

  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 80,
  });

  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    priority: n.priority,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getUnreadNotificationCountAction() {
  const user = await getSessionUser();
  if (!user) return 0;
  await ensureOperationalNotifications(user.id);
  return prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });
}

export async function markNotificationReadAction(notificationId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

export async function notifyInvoiceSentAction(input: {
  channel: "EMAIL" | "WHATSAPP";
  clientName: string;
  orderNumber: string;
  recipient?: string | null;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  const channelLabel = input.channel === "WHATSAPP" ? "WhatsApp" : "Email";
  const dest = input.recipient ? ` (${input.recipient})` : "";
  await createNotification({
    userId: user.id,
    type: NotificationCategory.BILLING,
    priority: NotificationPriority.INFO,
    title: `Facture envoyée (${channelLabel})`,
    message: `Facture ${input.orderNumber} pour ${input.clientName}${dest}.`,
    link: "/clients",
  });
  revalidatePath("/notifications");
}
