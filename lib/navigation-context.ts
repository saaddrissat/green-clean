"use client";

export type NavigationContext = { mode: "full" } | { mode: "restricted"; accountId: string };

const NAV_CTX_KEY = "gc-navigation-context";

export function getNavigationContext(): NavigationContext {
  if (typeof window === "undefined") return { mode: "full" };
  try {
    const raw = localStorage.getItem(NAV_CTX_KEY);
    if (!raw) return { mode: "full" };
    const parsed = JSON.parse(raw) as NavigationContext;
    if (parsed?.mode === "restricted" && typeof parsed.accountId === "string") {
      return { mode: "restricted", accountId: parsed.accountId };
    }
    return { mode: "full" };
  } catch {
    return { mode: "full" };
  }
}

export function setNavigationContext(next: NavigationContext) {
  localStorage.setItem(NAV_CTX_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("gc-navigation-context-changed"));
}

/** Réinitialise l’aperçu « caissier » (équivalent déconnexion de session locale). */
export function resetNavigationToFullAccess() {
  try {
    localStorage.removeItem(NAV_CTX_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent("gc-navigation-context-changed"));
}
