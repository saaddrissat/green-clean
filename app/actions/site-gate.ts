"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SITE_GATE_COOKIE,
  SITE_GATE_MAX_AGE,
  getSiteGatePassword,
  signSiteGateToken,
} from "@/lib/site-gate";

export type SiteGateFormState = { error?: string } | null;

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/connexion";
  }
  if (value.startsWith("/acces")) {
    return "/connexion";
  }
  return value;
}

export async function verifySiteGateAction(
  _prev: SiteGateFormState,
  formData: FormData,
): Promise<SiteGateFormState> {
  const password = String(formData.get("password") ?? "").trim();
  const redirectTo = safeRedirectPath(
    typeof formData.get("redirect") === "string" ? formData.get("redirect") : null,
  );

  if (password !== getSiteGatePassword()) {
    return { error: "Code d'accès incorrect." };
  }

  const token = await signSiteGateToken();
  if (!token) {
    return { error: "Configuration serveur invalide (AUTH_SECRET manquant)." };
  }

  const store = await cookies();
  store.set(SITE_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_GATE_MAX_AGE,
  });

  redirect(redirectTo);
}
