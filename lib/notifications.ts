"use server";

import { NotificationCategory, NotificationPriority, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type CreateNotificationInput = {
  userId: string;
  type: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createNotification(input: CreateNotificationInput) {
  if (input.dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    });
    if (existing) return existing;
  }
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      priority: input.priority,
      title: input.title,
      message: input.message,
      link: input.link,
      dedupeKey: input.dedupeKey,
      metadata: input.metadata,
    },
    select: { id: true },
  });
}
