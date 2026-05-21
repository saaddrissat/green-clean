import { z } from "zod";

import { resolveAuthSecret } from "./auth-secret";

function isMongoDatabaseUrl(value: string) {
  return value.startsWith("mongodb://") || value.startsWith("mongodb+srv://");
}

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required.")
    .refine(
      isMongoDatabaseUrl,
      "DATABASE_URL doit commencer par mongodb:// ou mongodb+srv:// (voir .env.example et prisma/schema.prisma).",
    ),
  AUTH_SECRET: z
    .string()
    .min(
      32,
      "AUTH_SECRET doit contenir au moins 32 caractères. Ajoutez-le dans .env (ex. : openssl rand -base64 32).",
    ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: resolveAuthSecret(),
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
