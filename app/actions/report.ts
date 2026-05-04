"use server";

import { ReportProblemKind } from "@prisma/client";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

const submitSchema = z.object({
  kind: z.nativeEnum(ReportProblemKind),
  message: z.string().trim().min(10, "Le message doit contenir au moins 10 caractères.").max(5000),
});

export type ReportFormState = { error?: string; ok?: true } | null;

export async function submitAppReportAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Vous devez être connecté pour envoyer un signalement." };
  }

  const parsed = submitSchema.safeParse({
    kind: formData.get("kind"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Données invalides." };
  }

  try {
    await prisma.appReport.create({
      data: {
        userId: user.id,
        kind: parsed.data.kind,
        message: parsed.data.message,
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("[submitAppReportAction]", e);
    return { error: "Envoi impossible. Réessayez plus tard." };
  }
}
