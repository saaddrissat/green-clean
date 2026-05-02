import { z } from "zod";

function isDatabaseUrl(value: string) {
  return (
    value.startsWith("postgresql://") ||
    value.startsWith("postgres://") ||
    value.startsWith("mongodb://") ||
    value.startsWith("mongodb+srv://")
  );
}

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required.")
    .refine(
      isDatabaseUrl,
      "DATABASE_URL must be a PostgreSQL or MongoDB connection string (see prisma/schema.prisma).",
    ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
