/**
 * Droits d’accès aux pages de l’app (principalement pour les comptes Caissier).
 */

export type AccountRole = "CAISSIER" | "ADMIN";

export type PageKey =
  | "dashboard"
  | "caisse"
  | "suivi"
  | "clients"
  | "calendrier"
  | "portefeuille"
  | "rapports"
  | "notifications"
  | "parametres";

export type PageAccess = Record<PageKey, boolean>;

export const PAGE_ORDER: { key: PageKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "caisse", label: "Caisse" },
  { key: "suivi", label: "Suivi" },
  { key: "clients", label: "Clients" },
  { key: "calendrier", label: "Calendrier" },
  { key: "portefeuille", label: "Portefeuille" },
  { key: "rapports", label: "Rapports" },
  { key: "notifications", label: "Notifications" },
  { key: "parametres", label: "Paramètres" },
];

/** Par défaut pour un nouveau caissier : Caisse, Suivi, Clients uniquement. */
export const DEFAULT_CAISSIER_PAGE_ACCESS: PageAccess = {
  dashboard: false,
  caisse: true,
  suivi: true,
  clients: true,
  calendrier: false,
  portefeuille: false,
  rapports: false,
  notifications: false,
  parametres: false,
};

export const FULL_PAGE_ACCESS: PageAccess = {
  dashboard: true,
  caisse: true,
  suivi: true,
  clients: true,
  calendrier: true,
  portefeuille: true,
  rapports: true,
  notifications: true,
  parametres: true,
};

const HREF_TO_KEY: Record<string, PageKey> = {
  "/": "dashboard",
  "/caisse": "caisse",
  "/suivi": "suivi",
  "/clients": "clients",
  "/calendrier": "calendrier",
  "/portefeuille": "portefeuille",
  "/rapports": "rapports",
  "/notifications": "notifications",
  "/parametres": "parametres",
};

export const PAGE_KEY_TO_HREF: Record<PageKey, string> = {
  dashboard: "/",
  caisse: "/caisse",
  suivi: "/suivi",
  clients: "/clients",
  calendrier: "/calendrier",
  portefeuille: "/portefeuille",
  rapports: "/rapports",
  notifications: "/notifications",
  parametres: "/parametres",
};

export function hrefToPageKey(pathname: string): PageKey | null {
  if (pathname === "/" || pathname === "") return "dashboard";
  const base = pathname.split("/").filter(Boolean)[0];
  if (!base) return null;
  const prefixed = `/${base}`;
  return HREF_TO_KEY[prefixed] ?? null;
}

export type AccountItem = {
  id: string;
  fullName: string;
  role: AccountRole;
  createdAt: string;
  lastLoginAt: string | null;
  sessionDurationMinutes: number | null;
  /** Absent sur les anciens comptes : on applique les défauts caissier. */
  pageAccess?: PageAccess;
};

export function effectivePageAccess(account: AccountItem): PageAccess {
  if (account.role === "ADMIN") return FULL_PAGE_ACCESS;
  return account.pageAccess ?? DEFAULT_CAISSIER_PAGE_ACCESS;
}

export function isPathAllowed(pathname: string, access: PageAccess): boolean {
  const key = hrefToPageKey(pathname);
  if (!key) return true;
  return access[key] === true;
}

/** Première page autorisée pour une redirection (ordre métier). */
export function firstAllowedHref(access: PageAccess): string {
  const priorityKeys: PageKey[] = [
    "caisse",
    "suivi",
    "clients",
    "dashboard",
    "calendrier",
    "portefeuille",
    "rapports",
    "notifications",
    "parametres",
  ];
  for (const key of priorityKeys) {
    if (access[key]) return PAGE_KEY_TO_HREF[key];
  }
  return PAGE_KEY_TO_HREF.caisse;
}
