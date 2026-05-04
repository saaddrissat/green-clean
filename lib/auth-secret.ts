/**
 * Secret JWT partagé entre Node (Prisma / actions) et Edge (middleware).
 * En développement sans variable : secret de secours (à ne jamais utiliser en prod).
 */
export const DEV_AUTH_SECRET_FALLBACK =
  "green-clean-dev-only-secret-do-not-use-in-production-min-32-chars!!";

export function resolveAuthSecret(): string {
  const raw = process.env.AUTH_SECRET?.trim();
  if (raw && raw.length >= 32) {
    return raw;
  }
  if (process.env.NODE_ENV !== "production") {
    if (!raw && typeof console !== "undefined") {
      console.warn(
        "[green-clean] AUTH_SECRET est absent du fichier .env. Un secret de développement est utilisé (les sessions peuvent être invalidées après redémarrage). Ajoutez AUTH_SECRET (32+ caractères), ex. : openssl rand -base64 32",
      );
    }
    return DEV_AUTH_SECRET_FALLBACK;
  }
  return "";
}
