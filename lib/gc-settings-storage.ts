import type { AccountItem } from "@/lib/navigation-page-access";

const LEGACY_SETTINGS_STORAGE_KEY = "gc-settings-v1";

function settingsStorageKey(userId: string | undefined): string {
  if (!userId) return LEGACY_SETTINGS_STORAGE_KEY;
  return `${LEGACY_SETTINGS_STORAGE_KEY}-${userId}`;
}

/** Charge les comptes Paramètres pour l’utilisateur connecté (isolé par id compte Mongo). */
export function loadAccountsFromStorage(userId?: string | null): AccountItem[] {
  if (typeof window === "undefined") return [];
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(settingsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { accounts?: AccountItem[] };
    return Array.isArray(parsed.accounts) ? parsed.accounts : [];
  } catch {
    return [];
  }
}

export function findAccountById(id: string, userId?: string | null): AccountItem | undefined {
  return loadAccountsFromStorage(userId ?? undefined).find((a) => a.id === id);
}
