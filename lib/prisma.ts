import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

/** Après `prisma generate`, un singleton obsolète peut ne pas exposer les nouveaux modèles. */
function clientHasUserDelegate(client: PrismaClient): boolean {
  return typeof (client as unknown as { user?: { create?: unknown } }).user?.create === "function";
}

let resolved: PrismaClient | undefined;

function resolveClient(): PrismaClient {
  let client = resolved ?? globalForPrisma.prisma ?? createPrismaClient();

  if (!clientHasUserDelegate(client)) {
    void client.$disconnect().catch(() => {});
    client = createPrismaClient();
  }

  resolved = client;
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Proxy pour réinitialiser correctement le client au premier accès après `prisma generate`,
 * et pour que les delegates (`user`, etc.) viennent toujours du client Node réel (avec serverExternalPackages).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = resolveClient();
    const value = Reflect.get(client, prop);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
