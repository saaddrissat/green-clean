import type { SubscriptionPlan } from "@prisma/client";

/** Limite de commandes cumulées pour le plan DEMO (hors commandes annulées : on compte toutes les lignes Order). */
export const DEMO_MAX_ORDERS = 40;

export function isDemoPlan(plan: SubscriptionPlan | null | undefined): boolean {
  return plan === "DEMO" || plan == null;
}

export function demoBlocksRapports(plan: SubscriptionPlan | null | undefined): boolean {
  return isDemoPlan(plan);
}
