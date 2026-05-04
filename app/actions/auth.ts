"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/constants";
import { signSessionToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export type AuthFormState = { error?: string } | null;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(1, "Le nom est requis."),
  email: z.string().email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  phone: z.string().min(6, "Téléphone invalide."),
  city: z.string().min(1, "La ville est requise."),
  employeeCount: z.coerce.number().int().min(0),
  laundryCount: z.coerce.number().int().min(1, "Au moins une blanchisserie."),
});

async function setSessionCookie(userId: string) {
  const token = await signSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Vérifiez votre email et votre mot de passe." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Email ou mot de passe incorrect." };
  }
  await setSessionCookie(user.id);
  redirect("/");
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    employeeCount: formData.get("employeeCount"),
    laundryCount: formData.get("laundryCount"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Formulaire invalide." };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash,
        phone: parsed.data.phone.trim(),
        city: parsed.data.city.trim(),
        employeeCount: parsed.data.employeeCount,
        laundryCount: parsed.data.laundryCount,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return { error: "Un compte existe déjà avec cet email." };
      }
      if (e.code === "P1001" || e.code === "P1002" || e.code === "P1017") {
        return {
          error:
            "Impossible de joindre MongoDB. Vérifiez Internet, DATABASE_URL, et sur MongoDB Atlas : « Network Access » → autorisez votre adresse IP (ou 0.0.0.0/0 le temps des tests).",
        };
      }
    }

    if (e instanceof Prisma.PrismaClientInitializationError) {
      return {
        error: `Connexion à la base refusée : ${e.message}. Vérifiez DATABASE_URL (mot de passe avec caractères spéciaux encodés dans l’URL) et l’accès réseau Atlas.`,
      };
    }

    if (e instanceof Prisma.PrismaClientUnknownRequestError) {
      console.error("[registerAction]", e.message);
      return {
        error: `Erreur MongoDB : ${e.message}`,
      };
    }

    const raw = e instanceof Error ? e.message : String(e);
    console.error("[registerAction]", e);

    if (/timeout|timed out|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|network/i.test(raw)) {
      return {
        error:
          "MongoDB ne répond pas (réseau ou timeout). Vérifiez Atlas : cluster actif, Network Access, et firewall local.",
      };
    }

    if (process.env.NODE_ENV === "development") {
      return { error: `Inscription : ${raw}` };
    }

    return {
      error:
        "Enregistrement impossible. Vérifiez MongoDB (Atlas : IP autorisées, mot de passe dans l’URL) puis exécutez « npx prisma db push » et redémarrez le serveur.",
    };
  }

  redirect("/connexion?registered=1");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/connexion");
}
