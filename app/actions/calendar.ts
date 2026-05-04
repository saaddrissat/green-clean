"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  start: z.string().min(1),
  end: z.string().min(1),
  allDay: z.boolean().optional(),
  color: z.string().min(1).max(32),
  location: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  guests: z.string().max(1000).optional(),
  reminder: z.string().max(120).optional(),
});

export async function listCalendarEventsAction() {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  const events = await prisma.calendarEvent.findMany({
    where: { userId: user.id },
    orderBy: { start: "asc" },
  });
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    color: e.color,
    location: e.location ?? "",
    description: e.description ?? "",
    guests: e.guests ?? "",
    reminder: e.reminder ?? "",
  }));
}

export async function createCalendarEventAction(input: z.infer<typeof createSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Données invalides.");
  }
  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Dates invalides.");
  }
  const created = await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      start,
      end,
      allDay: parsed.data.allDay ?? false,
      color: parsed.data.color,
      location: parsed.data.location?.trim() || null,
      description: parsed.data.description?.trim() || null,
      guests: parsed.data.guests?.trim() || null,
      reminder: parsed.data.reminder?.trim() || null,
    },
    select: { id: true },
  });
  revalidatePath("/calendrier");
  return { id: created.id };
}

export async function deleteCalendarEventAction(eventId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Non authentifié.");
  await prisma.calendarEvent.deleteMany({
    where: { id: eventId, userId: user.id },
  });
  revalidatePath("/calendrier");
}
